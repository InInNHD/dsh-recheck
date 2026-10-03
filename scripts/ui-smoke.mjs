import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, request } from 'playwright'

// 使用真实 DSH Web 与独立配置，界面测试只写入本脚本的样例项目。
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const home = join(root, '.integration/dsh-home')
const profile = join(home, 'profiles/recheck-web')
const projectName = `Recheck-UI-${randomUUID().slice(0, 8)}`
const project = join(root, '.integration', projectName)
const images = join(root, 'docs/assets')
await mkdir(project, { recursive: true }); await mkdir(images, { recursive: true })
await writeFile(join(project, 'evidence.txt'), 'UI acceptance evidence\n')
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const origin = `http://127.0.0.1:${port}`
const host = spawn(process.execPath, [join(profile, 'node_modules/@deepseek-ai/dsh/lib/bin.js'), '--profile', 'recheck-web', '--port', String(port), '--no-open'],
  { cwd: root, env: { ...process.env, DSH_HOME: home }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
const closed = new Promise(resolve => host.once('exit', resolve))
let browser, client
try {
  const authUrl = await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error('UI 验收宿主启动超时')), 90_000)
    const receive = bytes => {
      output += bytes.toString()
      const match = output.match(new RegExp(`http://127\\.0\\.0\\.1:${port}/\\?token=[A-Za-z0-9_-]+`))
      if (match) { clearTimeout(timeout); resolve(match[0]) }
    }
    host.stdout.on('data', receive); host.stderr.on('data', receive)
    host.once('error', error => { clearTimeout(timeout); reject(error) })
    host.once('exit', code => { clearTimeout(timeout); reject(new Error(`UI 验收宿主提前退出：${code}`)) })
  })
  client = await request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } })
  assert.ok((await client.get(authUrl)).ok())
  const state = await client.storageState()
  const statePath = join(project, 'browser-state.json')
  await writeFile(statePath, JSON.stringify(state))
  const option = key => { const index = process.argv.indexOf(key); return index < 0 ? undefined : process.argv[index + 1] }
  browser = await chromium.launch({ executablePath: option('--browser') ?? (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined), headless: true })
  const context = await browser.newContext({ storageState: state, locale: 'zh-CN', viewport: { width: 1400, height: 1100 } })
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  async function rpc(method, args) {
    const response = await context.request.post(`${origin}/api/${method}`, { headers: { Origin: origin }, data: { type: 'client-request', rpcId: randomUUID(), method, payload: { args } } })
    assert.equal(response.status(), 200)
    assert.equal((await response.json()).result.ok, true)
  }
  await page.goto(origin)
  for (const name of ['继续', '稍后配置']) {
    const modal = page.getByRole('button', { name, exact: true })
    await modal.waitFor({ timeout: 2000 }).catch(() => {})
    if (await modal.isVisible()) await modal.click()
  }
  await rpc('workspace/create', { request: { path: project } })
  await page.getByText(projectName, { exact: true }).first().hover()
  await page.getByRole('button', { name: `在“${projectName}”中新建会话`, exact: true }).click()
  await page.getByRole('button', { name: '选择工作区', exact: true }).filter({ hasText: projectName }).waitFor()
  const open = page.getByRole('button', { name: '打开右侧边栏', exact: true })
  await open.waitFor({ timeout: 2000 }).catch(() => {})
  if (await open.isVisible()) await open.click()
  const guide = page.locator('[data-sidebar-right-guide-entry="recheck"]')
  await guide.waitFor({ timeout: 2000 }).catch(() => {})
  if (await guide.isVisible()) await guide.click()
  const panel = page.getByRole('region', { name: 'Recheck 结论保鲜盒', exact: true })
  const button = name => panel.getByRole('button', { name, exact: true })
  const idle = () => page.waitForFunction(() => document.querySelector('.recheck')?.getAttribute('aria-busy') === 'false')
  await button('新建卡片').waitFor(); await idle()
  const typography = await panel.evaluate(el => ({ font: getComputedStyle(el).fontSize, fontFamily: getComputedStyle(el).fontFamily, color: getComputedStyle(el).color,
    hostColor: getComputedStyle(document.body).getPropertyValue('--dsw-alias-label-primary').trim() }))
  assert.equal(typography.font, '14px')
  assert.match(typography.fontFamily, /Segoe UI/, '必须使用宿主字体栈，而非浏览器默认衬线字体。')
  assert.ok(typography.hostColor, '必须使用真实 Harness 主题。')
  await panel.screenshot({ path: join(images, 'recheck-alpha4-empty.png') })
  await button('新建卡片').click()
  await panel.getByLabel('标题（最多 120 字符）').fill('😀')
  assert.equal(await panel.locator('.rc-count').first().innerText(), '1 / 120', 'Unicode 计数必须与 Host 一致。')
  await panel.getByLabel('标题（最多 120 字符）').fill('重试不会重复扣款')
  await panel.getByLabel('结论（最多 2,000 字符）').fill('同一个 requestId 的重试只扣款一次；超时后仍使用原 requestId。')
  await panel.getByLabel('依据文件（项目相对路径，每行一个，1–8 个）').fill('evidence.txt')
  await panel.getByLabel('初始说明（可选）').fill('下次修改重试逻辑后，重新检查并阅读依据。')
  await panel.getByLabel('标题（最多 120 字符）').focus(); await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'TEXTAREA')
  await panel.screenshot({ path: join(images, 'recheck-alpha4-create.png') })
  const light = await panel.evaluate(el => getComputedStyle(el).backgroundColor)
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  const dark = await panel.evaluate(el => getComputedStyle(el).backgroundColor)
  assert.notEqual(dark, light, '深色模式必须随宿主主题更新。')
  await panel.screenshot({ path: join(images, 'recheck-alpha4-create-dark.png') })
  await panel.evaluate(el => { el.style.width = '300px'; el.scrollTop = 0 })
  assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '300px 窄栏不能横向溢出。')
  await panel.screenshot({ path: join(images, 'recheck-alpha4-narrow.png') })
  await panel.evaluate(el => { el.style.removeProperty('width') })
  await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'))
  await button('保存').click(); await panel.getByRole('status').filter({ hasText: '已保存' }).waitFor(); await idle()
  await button('检查依据并保存').click(); await idle()
  await button('← 返回列表').click()
  await panel.getByLabel('新鲜度').selectOption('changed')
  await panel.getByRole('heading', { name: '没有匹配的卡片' }).waitFor()
  await button('清除筛选').click()
  await button('重试不会重复扣款').waitFor()
  await panel.screenshot({ path: join(images, 'recheck-alpha4-main.png') })
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''))
  await panel.screenshot({ path: join(images, 'recheck-alpha4-main-dark.png') })
  await panel.evaluate(el => { el.style.width = '300px' })
  assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
  assert.equal(errors.length, 0, errors.join('\n'))
  await writeFile(join(root, '.integration/ui-smoke-result.json'), JSON.stringify({ passed: true, project, typography, light, dark,
    checks: ['宿主主题令牌', '14px 字号', 'Unicode 字数', '键盘 Tab', '浅色与深色', '300px 窄栏', '新建保存', '检查', '筛选与清除', '无页面异常'] }, null, 2))
  console.log('UI 验收通过：主题、字号、Unicode、键盘、窄栏、新建、检查、筛选。')
  await browser.close(); browser = undefined
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/web-smoke.mjs', '--url', origin, '--state', statePath], { cwd: root, stdio: 'inherit', windowsHide: true })
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`完整 Web 回归失败：${code}`)))
  })
} finally {
  await browser?.close(); await client?.dispose()
  if (host.exitCode === null) host.kill('SIGTERM')
  await closed
}
