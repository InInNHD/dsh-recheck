import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { waitForRecheckReady, verifyDiagnostics } from './diagnostics-smoke.mjs'
import { verifyEvidenceEntry } from './evidence-entry-smoke.mjs'
import { verifyReviewQueue } from './review-queue-smoke.mjs'

// 只在本地专用 DSH 配置中运行；所有数据都是本脚本创建的独立验收项目。
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const option = key => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1] }
const launchUrl = option('--url') ?? 'http://127.0.0.1:31478'
const origin = new URL(launchUrl).origin
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname), '验收只连接本机 DSH。')
const state = option('--state')
const projectName = `web-smoke-${randomUUID().slice(0, 8)}`
const project = join(root, '.integration', projectName)
await mkdir(project, { recursive: true })
await writeFile(join(project, 'evidence.txt'), '原始依据\n')
const browser = await chromium.launch({ executablePath: option('--browser') ?? (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined), headless: true })
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1400, height: 950 }, ...(state ? { storageState: state } : {}) })
const page = await context.newPage(), errors = [], modelRequests = []
let sessionId
page.on('pageerror', error => errors.push(error.message))
page.on('request', request => {
  if (request.url().includes('/api/recheck/dispatch')) sessionId = request.postDataJSON()?.payload?.sessionId
  if (/\/api\/(session\/submit|session\/prompt)/.test(request.url())) modelRequests.push(request.url())
})
async function rpc(method, payload, raw = false) {
  const response = await context.request.post(`${origin}/api/${method}`, { headers: { Origin: origin }, data: { type: 'client-request', rpcId: randomUUID(), method, payload: raw ? payload : { args: payload } } })
  assert.equal(response.status(), 200, await response.text())
  const body = await response.json(); assert.equal(body.result.ok, true, JSON.stringify(body.result)); return body.result.value
}
const panel = page.getByRole('region', { name: 'Recheck 结论保鲜盒', exact: true })
const button = name => panel.getByRole('button', { name, exact: true })
async function savedClick(name) { await button(name).click(); await panel.getByRole('status').filter({ hasText: /已保存|已写入|已归档|已恢复/ }).waitFor() }
async function checked() { await savedClick('检查依据并保存'); await button('重新读取卡片').waitFor({ state: 'visible' }); await page.waitForFunction(() => document.querySelector('.recheck')?.getAttribute('aria-busy') === 'false') }
async function selectProject(name) {
  const row = page.getByText(name, { exact: true }).first()
  const start = page.getByRole('button', { name: `在“${name}”中新建会话`, exact: true })
  await row.hover()
  try { await start.click({ timeout: 5000 }) } catch (error) {
    // 引导处理器点击弹窗后会移动鼠标，重新悬停才能显示宿主的行内按钮。
    if (await start.isVisible()) throw error
    await row.hover(); await start.click()
  }
  await page.getByRole('button', { name: '选择工作区', exact: true }).filter({ hasText: name }).waitFor()
  const open = page.getByRole('button', { name: '打开右侧边栏', exact: true })
  await open.waitFor({ timeout: 2500 }).catch(() => {})
  if (await open.isVisible()) await open.click()
  const guide = page.locator('[data-sidebar-right-guide-entry="recheck"]')
  await guide.waitFor({ timeout: 2500 }).catch(() => {})
  if (await guide.isVisible()) await guide.click()
  await panel.getByText(new RegExp(`当前项目：${name}(?:$|\\s)`)).waitFor()
  await page.waitForFunction(() => document.querySelector('.recheck')?.getAttribute('aria-busy') === 'false')
}
try {
  // 新配置的引导弹窗可能晚于启动动画出现。由真实动作触发处理，避免固定等待漏过弹窗。
  for (const name of ['继续', '稍后配置']) {
    await page.addLocatorHandler(page.getByRole('button', { name, exact: true }), async button => { await button.click() })
  }
  await page.goto(launchUrl)
  await rpc('workspace/create', { request: { path: project } })
  await selectProject(projectName)
  await waitForRecheckReady(page)
  await button('新建卡片').waitFor()
  await page.waitForFunction(() => !document.querySelector('.recheck button')?.disabled)
  assert.ok(sessionId, '侧栏调用必须携带宿主会话身份。')
  assert.match(await panel.innerText(), new RegExp(projectName))
  const anonymous = await browser.newContext()
  try {
    const denied = await anonymous.request.post(`${origin}/api/recheck/dispatch`, { headers: { Origin: origin }, data: { type: 'client-request', rpcId: randomUUID(), method: 'recheck/dispatch', payload: { sessionId, request: { action: 'list' } } } })
    assert.ok([401, 403].includes(denied.status()), '未认证请求必须被宿主拒绝。')
    const diagnosticDenied = await anonymous.request.post(`${origin}/api/recheck/diagnostics`, { headers: { Origin: origin }, data: { type: 'client-request', rpcId: randomUUID(), method: 'recheck/diagnostics', payload: { sessionId } } })
    assert.ok([401, 403].includes(diagnosticDenied.status()), '诊断同样必须经过宿主认证。')
  } finally { await anonymous.close() }
  const spoofed = await rpc('recheck/dispatch', { sessionId, request: { action: 'list', cwd: project } }, true)
  assert.equal(spoofed.status, 'rejected', '网页请求不能自带工作区。')
  const diagnosticSpoof = await rpc('recheck/diagnostics', { sessionId, cwd: project }, true)
  assert.equal(diagnosticSpoof.reason.code, 'INVALID_INPUT', '诊断不能指定其他工作区。')
  await button('新建卡片').click()
  await panel.getByLabel('标题（最多 120 字符）').fill('Web 实机验收卡片')
  await panel.getByLabel('结论（最多 2,000 字符）').fill('文件内容保持稳定时仍需人工判断。')
  await panel.getByLabel('依据文件（项目相对路径，每行一个，1–8 个）').fill('evidence.txt')
  await verifyEvidenceEntry(page, project)
  await savedClick('保存')
  assert.match(await panel.innerText(), /尚未检查.*尚未复核/s)
  await checked(); assert.match(await panel.innerText(), /依据未变化\s*·\s*复核意见：尚未复核/)
  await writeFile(join(project, 'evidence.txt'), '依据已修改\n')
  await checked(); assert.match(await panel.innerText(), /依据已变化\s*·\s*复核意见：尚未复核/)
  await button('记录复核').click()
  assert.equal(await panel.getByLabel('复核意见').inputValue(), '', '不得预选支持意见。')
  await panel.getByLabel('复核意见').selectOption('refuted')
  await panel.getByLabel('复核说明（必填）').fill('实机阅读后否定；这是显式用户意见。')
  await panel.getByLabel('我已阅读本次检查对应的依据文件').check()
  await savedClick('保存'); assert.match(await panel.innerText(), /依据未变化\s*·\s*复核意见：否定/)
  // 用另一调用模拟并发编辑；保存冲突应保留本地输入，重新读取不自动覆盖草稿。
  await button('编辑').click()
  await panel.getByLabel('标题（最多 120 字符）').fill('保留的编辑草稿')
  const listed = await rpc('recheck/dispatch', { sessionId, request: { action: 'list' } }, true)
  const entry = listed.data.cards[0]
  await rpc('recheck/dispatch', { sessionId, request: { action: 'edit', cardId: entry.cardId, expectedRevision: entry.revision, title: '另一会话修改的标题' } }, true)
  await button('保存').click()
  await panel.getByRole('alert').filter({ hasText: /CONFLICT/ }).waitFor()
  assert.equal(await panel.getByLabel('标题（最多 120 字符）').inputValue(), '保留的编辑草稿')
  await button('重新读取卡片（保留草稿）').click()
  await button('采用当前 revision 并保留输入').click()
  await savedClick('保存'); assert.match(await panel.innerText(), /复核意见：否定/)
  await button('生成预览').click()
  const exportText = panel.getByLabel('导出文本')
  await exportText.waitFor(); assert.match(await exportText.inputValue(), /否定|refuted/)
  await panel.getByLabel('新文件的项目相对路径').fill('export.md')
  await savedClick('写入以上新文件（不覆盖）')
  const markdown = await readFile(join(project, 'export.md'), 'utf8')
  assert.equal(markdown, await exportText.inputValue())
  await button('写入以上新文件（不覆盖）').click()
  await panel.getByRole('alert').filter({ hasText: /已存在|EXISTS/ }).waitFor()
  assert.equal(await readFile(join(project, 'export.md'), 'utf8'), markdown)
  await savedClick('归档'); assert.match(await panel.innerText(), /（已归档）/)
  await savedClick('恢复')
  await page.getByRole('button', { name: /^访问模式，当前：/ }).click()
  await page.getByText('仅可查看', { exact: true }).click()
  await page.getByRole('button', { name: '访问模式，当前：仅可查看', exact: true }).waitFor()
  await button('刷新列表').click()
  await panel.getByText(new RegExp(`当前项目：${projectName}.*只读`)).waitFor()
  assert.equal(await button('编辑').isDisabled(), true)
  const beforeTemporary = await readFile(join(project, '.dsh/recheck/cards.json'), 'utf8')
  await writeFile(join(project, 'evidence.txt'), '只读观察期间的测试改动\n')
  await button('临时检查依据').click()
  await panel.getByRole('status').filter({ hasText: '本次检查结果未保存' }).waitFor()
  assert.match(await panel.innerText(), /临时观察，未保存/)
  assert.equal(await readFile(join(project, '.dsh/recheck/cards.json'), 'utf8'), beforeTemporary)
  await page.getByRole('button', { name: /^访问模式，当前：/ }).click()
  await page.getByText('工作区内修改', { exact: true }).click()
  await page.getByRole('button', { name: '访问模式，当前：工作区内修改', exact: true }).waitFor()
  await button('刷新列表').click()
  await button('检查依据并保存').waitFor()
  await checked()
  assert.doesNotMatch(await panel.innerText(), /临时观察，未保存/)
  // 窄栏可滚动而不横向截断，所有表单控件使用原生键盘行为。
  await page.setViewportSize({ width: 900, height: 850 })
  await button('编辑').click()
  await panel.getByLabel('标题（最多 120 字符）').focus(); await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'TEXTAREA')
  assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '插件窄栏应无横向溢出。')
  await button('放弃草稿').click()
  await panel.getByRole('button', { name: /^展开时间详情/ }).first().click()
  assert.match(await panel.innerText(), /\d{4}-\d{2}-\d{2}T.*（UTC）；本地时区/s)
  await page.setViewportSize({ width: 1400, height: 950 })
  await button('← 返回列表').click()
  await button('新建卡片').click()
  await panel.getByLabel('标题（最多 120 字符）').fill('项目 A 保留草稿')
  const projectB = `${project}-b`, nameB = `${projectName}-b`
  await mkdir(projectB, { recursive: true })
  await rpc('workspace/create', { request: { path: projectB } })
  await selectProject(nameB)
  await panel.getByLabel('活动 0/100', { exact: true }).waitFor()
  await button('新建卡片').click()
  assert.equal(await panel.getByLabel('标题（最多 120 字符）').inputValue(), '')
  await panel.getByLabel('标题（最多 120 字符）').fill('项目 B 独立草稿')
  await selectProject(projectName)
  assert.equal(await panel.getByLabel('标题（最多 120 字符）').inputValue(), '项目 A 保留草稿')
  await button('放弃草稿').click()
  await button('保留的编辑草稿').click()
  await button('重新读取卡片').waitFor()
  await page.setViewportSize({ width: 900, height: 850 })
  await panel.evaluate(el => { el.scrollTop = 0 })
  await panel.screenshot({ path: join(project, 'web-result.png') })
  if (option('--screenshot')) await panel.screenshot({ path: resolve(option('--screenshot')) })
  const store = JSON.parse(await readFile(join(project, '.dsh/recheck/cards.json'), 'utf8'))
  await verifyDiagnostics(page, { project })
  await page.setViewportSize({ width: 1400, height: 950 })
  // 真实会话切换 20 次，每次只应挂载一个面板和发起一次初始列表读取。
  let listCalls = 0
  const countLists = request => { if (request.url().endsWith('/api/recheck/dispatch') && request.postDataJSON()?.payload?.request?.action === 'list') listCalls++ }
  page.on('request', countLists)
  for (let i = 0; i < 20; i++) {
    const before = listCalls
    await selectProject(i % 2 ? projectName : nameB)
    assert.equal(await panel.count(), 1)
    assert.equal(listCalls - before, 1, '切换不应累积重复的列表请求')
  }
  page.off('request', countLists)
  // 保留真实 Host 响应，但让旧会话的刷新响应在切换到 B 后才到达。
  const oldSession = sessionId
  let release, seen, delivered
  const held = new Promise(resolve => { release = resolve }), started = new Promise(resolve => { seen = resolve }), settled = new Promise(resolve => { delivered = resolve })
  const lateRoute = async route => {
    if (route.request().postDataJSON()?.payload?.sessionId !== oldSession) return route.continue()
    const response = await route.fetch(); seen(); await held
    try { await route.fulfill({ response }) } catch {} finally { delivered() } // 切换主动取消时浏览器可直接丢弃该响应。
  }
  await page.route('**/api/recheck/dispatch', lateRoute)
  try {
    await button('刷新列表').click(); await started
    await selectProject(nameB); release(); await settled
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await button('放弃草稿').click()
    assert.match(await panel.innerText(), new RegExp(nameB))
    assert.equal(await button('保留的编辑草稿').count(), 0)
  } finally { release(); await page.unroute('**/api/recheck/dispatch', lateRoute) }
  await selectProject(projectName)
  assert.equal(store.cards.length, 1); assert.equal(store.cards[0].archived, false)
  // 没有模型消息的会话会被宿主复用。将测试卡片复制到 B，从 B 跳回真正记录它的 A。
  await mkdir(join(projectB, '.dsh/recheck'), { recursive: true })
  await writeFile(join(projectB, '.dsh/recheck/cards.json'), await readFile(join(project, '.dsh/recheck/cards.json')))
  await selectProject(nameB)
  await button('保留的编辑草稿').click()
  const sourceSession = store.cards[0].versions.at(-1).actor.sessionId
  assert.notEqual(sessionId, sourceSession, '必须从另一会话验证真实导航')
  const fromSession = sessionId
  try {
    const archived = await rpc('workspace/archiveSession', { request: { sessionId: sourceSession } })
    assert.ok(archived.archivedSessionIds.includes(sourceSession))
    await button('打开此版本来源会话').click()
    await panel.getByRole('alert').filter({ hasText: '来源会话不存在、已归档或当前不可访问' }).waitFor()
    assert.equal(sessionId, fromSession, '归档来源必须留在当前项目')
    await panel.getByText(`当前项目：${nameB}`, { exact: true }).waitFor()
  } finally { await rpc('workspace/unarchiveSession', { request: { sessionId: sourceSession } }) }
  const sourceOpened = page.waitForRequest(r => r.url().endsWith('/api/recheck/dispatch') && r.postDataJSON()?.payload?.sessionId === sourceSession && r.postDataJSON()?.payload?.request?.action === 'list')
  await button('打开此版本来源会话').click(); await sourceOpened
  await panel.getByText(`当前项目：${projectName}`, { exact: true }).waitFor()
  await button('保留的编辑草稿').click()
  // 等详情读取彻底完成后再改 fixture，否则会人为触发正在读取中的 CAS 冲突。
  await button('重新读取卡片').waitFor()
  await page.waitForFunction(() => document.querySelector('.recheck')?.getAttribute('aria-busy') === 'false')
  const dataPath = join(project, '.dsh/recheck/cards.json'), originalStore = await readFile(dataPath, 'utf8')
  try {
    const unavailable = JSON.parse(originalStore)
    unavailable.cards[0].versions.at(-1).actor.sessionId = `session-missing-${randomUUID()}`
    await writeFile(dataPath, JSON.stringify(unavailable))
    await button('重新读取卡片').click()
    await button('打开此版本来源会话').click()
    await panel.getByRole('alert').filter({ hasText: '来源会话不存在、已归档或当前不可访问' }).waitFor()
    assert.match(await panel.innerText(), /保留的编辑草稿/)
  } finally { await writeFile(dataPath, originalStore) }
  assert.equal(store.cards[0].versions[0].actor.kind, 'user')
  const queueChecks = await verifyReviewQueue(page, { project })
  assert.equal(errors.length, 0, errors.join('\n')); assert.equal(modelRequests.length, 0, '卡片操作不应发送模型消息。')
  const report = { passed: true, project, sessionId, checks: ['原生入口与项目绑定', '宿主认证与拒绝伪造工作区', '创建及双状态', '完整文件检查', '主动否定复核', '并发冲突保留草稿', '导出新文件并拒绝覆盖', '归档恢复', '真实只读模式临时检查不写入', '持久检查清除临时显示', '窄栏与键盘焦点', 'UTC及时区展开', 'A/B项目草稿隔离与同项目新会话恢复', '无模型请求及页面异常'], screenshot: join(project, 'web-result.png') }
  report.checks.push('alpha.5 诊断与版本不一致提示', '诊断白名单与窄栏', '20 次真实会话切换无重复列表请求', '迟到响应隔离')
  report.checks.push('alpha.6 逐项错误与焦点定位', '失败保留输入及修正重试', '中文空格路径与 composition 提交保护', '原生来源会话导航与不可用反馈')
  report.checks.push(...queueChecks)
  await writeFile(option('--report') ?? join(root, '.integration/web-smoke-result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await page.screenshot({ path: join(project, 'web-failure.png'), fullPage: true }).catch(() => {})
  console.error((await page.locator('body').innerText().catch(() => '')).slice(-8000))
  throw error
} finally { await browser.close() }
