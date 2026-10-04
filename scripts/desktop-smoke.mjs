import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
import { waitForRecheckReady, verifyDiagnostics } from './diagnostics-smoke.mjs'

// 开发验收启动真正安装的应用。仅替代文件夹选择结果，宿主/RPC/文件系统均保持真实。
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const option = key => { const i = process.argv.indexOf(key); return i < 0 ? undefined : process.argv[i + 1] }
const executablePath = option('--app') ?? process.env.RECHECK_DESKTOP_APP
assert.ok(executablePath, '请用 --app 或 RECHECK_DESKTOP_APP 指定已安装的桌面应用。')
const projectName = `Recheck安装验收-${randomUUID().slice(0, 8)}`
const project = join(root, '.integration', projectName)
await mkdir(project, { recursive: true }); await writeFile(join(project, 'evidence.txt'), '初始依据\n')
// UI 开发可使用独立 Harness home 和 Electron user-data，避免打断日常客户端。
const isolatedHome = option('--home'), userData = option('--user-data-dir')
assert.equal(Boolean(isolatedHome), Boolean(userData), '隔离验收必须同时指定 --home 和 --user-data-dir。')
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE; delete env.DSH_HOME
if (isolatedHome) env.DSH_HOME = resolve(isolatedHome)
const app = await electron.launch({ executablePath, args: userData ? [`--user-data-dir=${resolve(userData)}`] : [], env, timeout: 30_000 })
const page = await app.firstWindow(), errors = []
page.on('pageerror', error => errors.push(error.message))
const panel = page.getByRole('region', { name: 'Recheck 结论保鲜盒', exact: true })
const button = name => panel.getByRole('button', { name, exact: true })
async function idle() { await page.waitForFunction(() => document.querySelector('.recheck')?.getAttribute('aria-busy') === 'false') }
async function saved(name) { await button(name).click(); await panel.getByRole('status').filter({ hasText: /已保存|已写入|已归档|已恢复/ }).waitFor(); await idle() }
try {
  const metadata = await app.evaluate(({ app }) => ({ version: app.getVersion(), name: app.getName(), userData: app.getPath('userData') }))
  assert.equal(metadata.version, '0.2.0-rc.2')
  if (userData) assert.equal(resolve(metadata.userData), resolve(userData), '必须隔离 Electron 用户数据。')
  const profile = join(isolatedHome ? resolve(isolatedHome) : join(homedir(), '.dsh'), 'profiles/desktop')
  const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
  assert.ok(manifest.dsh.profile.bundles.includes('dsh-recheck'))
  for (const path of ['lib/index.js', 'lib/client.js', 'cordis.patch.yml']) {
    const hash = bytes => createHash('sha256').update(bytes).digest('hex')
    assert.equal(hash(await readFile(join(profile, 'node_modules/dsh-recheck', path))), hash(await readFile(join(root, path))))
  }
  await page.getByRole('button', { name: '添加工作区', exact: true }).waitFor()
  await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }) }, project)
  await page.getByRole('button', { name: '添加工作区', exact: true }).click()
  console.log('添加后界面', (await page.locator('body').innerText()).slice(0, 2500))
  await page.getByText(projectName, { exact: true }).first().hover()
  await page.getByRole('button', { name: `在“${projectName}”中新建会话`, exact: true }).click()
  await page.getByRole('button', { name: '选择工作区', exact: true }).filter({ hasText: projectName }).waitFor()
  const open = page.getByRole('button', { name: '打开右侧边栏', exact: true })
  await open.waitFor({ timeout: 3000 }).catch(() => {}); if (await open.isVisible()) await open.click()
  const guide = page.locator('[data-sidebar-right-guide-entry="recheck"]')
  await guide.waitFor({ timeout: 3000 }).catch(() => {}); if (await guide.isVisible()) await guide.click()
  await button('新建卡片').waitFor(); await idle()
  await waitForRecheckReady(page)
  assert.match(await panel.innerText(), new RegExp(projectName))
  await button('新建卡片').click()
  await panel.getByLabel('标题（最多 120 字符）').fill('Recheck 本机安装验收（测试）')
  await panel.getByLabel('结论（最多 2,000 字符）').fill('字节变化会提示复核，未变化不能证明结论正确。')
  await panel.getByLabel('依据文件（项目相对路径，每行一个，1–8 个）').fill('evidence.txt')
  await saved('保存'); assert.match(await panel.innerText(), /尚未检查\s*·\s*复核意见：尚未复核/)
  await saved('检查依据并保存'); assert.match(await panel.innerText(), /依据未变化\s*·\s*复核意见：尚未复核/)
  await writeFile(join(project, 'evidence.txt'), '修改后的依据\n')
  await saved('检查依据并保存'); assert.match(await panel.innerText(), /依据已变化\s*·\s*复核意见：尚未复核/)
  await button('记录复核').click()
  assert.equal(await panel.getByLabel('复核意见').inputValue(), '')
  await panel.getByLabel('复核意见').selectOption('uncertain')
  await panel.getByLabel('复核说明（必填）').fill('本机测试显式选择不确定，需要后续阅读核实。')
  await saved('保存'); assert.match(await panel.innerText(), /依据未变化\s*·\s*复核意见：不确定/)
  // 仅修改本脚本 fixture，模拟其他程序在用户表单打开后更新 JSON。
  await button('编辑').click()
  await panel.getByLabel('标题（最多 120 字符）').fill('Recheck 本机验收完成（测试）')
  const storePath = join(project, '.dsh/recheck/cards.json')
  const external = JSON.parse(await readFile(storePath, 'utf8'))
  external.cards[0].title = '并发程序修改的测试标题'; external.cards[0].revision++; external.cards[0].updatedAt = new Date().toISOString(); external.storeRevision++
  await writeFile(storePath, JSON.stringify(external))
  await button('保存').click(); await panel.getByRole('alert').filter({ hasText: /CONFLICT/ }).waitFor()
  assert.equal(await panel.getByLabel('标题（最多 120 字符）').inputValue(), 'Recheck 本机验收完成（测试）')
  await button('重新读取卡片（保留草稿）').click(); await idle()
  await button('采用当前 revision 并保留输入').click(); await saved('保存')
  assert.match(await panel.innerText(), /复核意见：不确定/)
  await button('生成预览').click(); await panel.getByLabel('导出文本').waitFor(); await idle()
  await panel.getByLabel('新文件的项目相对路径').fill('验收导出.md')
  await saved('写入以上新文件（不覆盖）')
  const markdown = await readFile(join(project, '验收导出.md'), 'utf8')
  assert.equal(markdown, await panel.getByLabel('导出文本').inputValue())
  await button('写入以上新文件（不覆盖）').click(); await panel.getByRole('alert').filter({ hasText: /已存在|EXISTS/ }).waitFor()
  assert.equal(await readFile(join(project, '验收导出.md'), 'utf8'), markdown)
  await saved('归档'); assert.match(await panel.innerText(), /（已归档）/)
  await saved('恢复'); await saved('检查依据并保存')
  await panel.getByRole('button', { name: /^展开时间详情/ }).first().click(); assert.match(await panel.innerText(), /（UTC）；本地时区/)
  await button('← 返回列表').click()
  await panel.getByLabel('搜索标题或结论').fill('不存在的测试标题'); assert.match(await panel.innerText(), /当前筛选没有匹配/)
  await panel.getByLabel('搜索标题或结论').fill(''); await button('Recheck 本机验收完成（测试）').click(); await idle()
  const store = JSON.parse(await readFile(storePath, 'utf8'))
  assert.equal(store.cards.length, 1); assert.equal(store.cards[0].versions.length, 2); assert.equal(store.cards[0].versions[0].actor.kind, 'user')
  assert.equal(store.cards[0].archived, false); assert.equal(errors.length, 0, errors.join('\n'))
  await page.mouse.move(1000, 80); await panel.evaluate(el => { el.scrollTop = 0 })
  await verifyDiagnostics(page, { project, hostVersion: metadata.version, simulateMismatch: false })
  await page.screenshot({ path: join(project, 'desktop-result.png'), fullPage: true })
  const report = { passed: true, metadata, profile, project, checks: ['实际 desktop 配置启用', '安装文件与交付包一致', '原生 Electron 页面与项目绑定', '创建及双状态', '文件未变/变化检查', '主动不确定复核', '外部并发冲突及草稿保留', '导出新文件并拒绝覆盖', '归档恢复及历史保留', 'UTC及时区展开', '列表搜索', '没有页面异常'], dialogSelectionStubbed: true, modelMessagesSent: false, screenshot: join(project, 'desktop-result.png') }
  report.checks.push('alpha.5 真实版本诊断', '诊断白名单与窄栏', '真实命中测试等待启动覆盖层消失')
  await writeFile(join(root, '.integration/desktop-smoke-result.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await page.screenshot({ path: join(project, 'desktop-failure.png'), fullPage: true }).catch(() => {})
  console.error((await page.locator('body').innerText().catch(() => '')).slice(-7000)); throw error
} finally { await app.close() }
