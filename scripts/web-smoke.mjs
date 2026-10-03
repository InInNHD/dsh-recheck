import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

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
  await page.getByText(name, { exact: true }).first().hover()
  await page.getByRole('button', { name: `在“${name}”中新建会话`, exact: true }).click()
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
  await page.goto(launchUrl)
  for (const name of ['继续', '稍后配置']) {
    const modal = page.getByRole('button', { name, exact: true })
    await modal.waitFor({ timeout: 2500 }).catch(() => {})
    if (await modal.isVisible()) await modal.click()
  }
  await rpc('workspace/create', { request: { path: project } })
  await selectProject(projectName)
  await button('新建卡片').waitFor()
  await page.waitForFunction(() => !document.querySelector('.recheck button')?.disabled)
  assert.ok(sessionId, '侧栏调用必须携带宿主会话身份。')
  assert.match(await panel.innerText(), new RegExp(projectName))
  const anonymous = await browser.newContext()
  try {
    const denied = await anonymous.request.post(`${origin}/api/recheck/dispatch`, { headers: { Origin: origin }, data: { type: 'client-request', rpcId: randomUUID(), method: 'recheck/dispatch', payload: { sessionId, request: { action: 'list' } } } })
    assert.ok([401, 403].includes(denied.status()), '未认证请求必须被宿主拒绝。')
  } finally { await anonymous.close() }
  const spoofed = await rpc('recheck/dispatch', { sessionId, request: { action: 'list', cwd: project } }, true)
  assert.equal(spoofed.status, 'rejected', '网页请求不能自带工作区。')
  await button('新建卡片').click()
  await panel.getByLabel('标题（最多 120 字符）').fill('Web 实机验收卡片')
  await panel.getByLabel('结论（最多 2,000 字符）').fill('文件内容保持稳定时仍需人工判断。')
  await panel.getByLabel('依据文件（项目相对路径，每行一个，1–8 个）').fill('evidence.txt')
  await savedClick('保存')
  assert.match(await panel.innerText(), /尚未检查.*尚未复核/s)
  await checked(); assert.match(await panel.innerText(), /依据未变化\s*·\s*复核意见：尚未复核/)
  await writeFile(join(project, 'evidence.txt'), '依据已修改\n')
  await checked(); assert.match(await panel.innerText(), /依据已变化\s*·\s*复核意见：尚未复核/)
  await button('记录复核').click()
  assert.equal(await panel.getByLabel('复核意见').inputValue(), '', '不得预选支持意见。')
  await panel.getByLabel('复核意见').selectOption('refuted')
  await panel.getByLabel('复核说明（必填）').fill('实机阅读后否定；这是显式用户意见。')
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
  assert.equal(store.cards.length, 1); assert.equal(store.cards[0].archived, false)
  assert.equal(store.cards[0].versions[0].actor.kind, 'user')
  assert.equal(errors.length, 0, errors.join('\n')); assert.equal(modelRequests.length, 0, '卡片操作不应发送模型消息。')
  const report = { passed: true, project, sessionId, checks: ['原生入口与项目绑定', '宿主认证与拒绝伪造工作区', '创建及双状态', '完整文件检查', '主动否定复核', '并发冲突保留草稿', '导出新文件并拒绝覆盖', '归档恢复', '真实只读模式临时检查不写入', '持久检查清除临时显示', '窄栏与键盘焦点', 'UTC及时区展开', 'A/B项目草稿隔离与同项目新会话恢复', '无模型请求及页面异常'], screenshot: join(project, 'web-result.png') }
  await writeFile(join(root, '.integration/web-smoke-result.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await page.screenshot({ path: join(project, 'web-failure.png'), fullPage: true }).catch(() => {})
  console.error((await page.locator('body').innerText().catch(() => '')).slice(-8000))
  throw error
} finally { await browser.close() }
