import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// trial click 会等待真实命中测试通过，覆盖层挡住按钮时不能误判为界面可用。
export async function waitForRecheckReady(page) {
  const panel = page.getByRole('region', { name: 'Recheck 结论保鲜盒', exact: true })
  await panel.getByRole('button', { name: '新建卡片', exact: true }).click({ trial: true, timeout: 45_000 })
  assert.equal(await panel.evaluate(el => getComputedStyle(el).fontSize), '14px')
}

export async function verifyDiagnostics(page, { project, hostVersion, simulateMismatch = true }) {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const panel = page.getByRole('region', { name: 'Recheck 结论保鲜盒', exact: true })
  const details = panel.locator('.rc-diagnostics')
  await details.locator('summary').click()
  await details.getByRole('button', { name: '读取诊断', exact: true }).click()
  const summary = details.getByLabel('诊断摘要')
  await summary.waitFor()
  const value = JSON.parse(await summary.inputValue())
  assert.equal(value.clientPluginVersion, manifest.version)
  assert.equal(value.hostPluginVersion, manifest.version)
  assert.ok(value.hostPackageVersion)
  if (hostVersion) assert.equal(value.hostPackageVersion, hostVersion)
  assert.equal(value.installedPluginVersion, manifest.version); assert.equal(value.profile, null)
  assert.equal(value.storage, 'valid'); assert.equal(value.supportedSchema, 1)
  assert.ok(!(await summary.inputValue()).includes(project))
  assert.doesNotMatch(await summary.inputValue(), /sessionId|claim|title|evidence\.txt|token/i)
  await panel.evaluate(el => { el.style.width = '300px' })
  assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), '诊断在 300px 无横向溢出')
  await panel.evaluate(el => el.style.removeProperty('width'))
  await panel.screenshot({ path: `${project}/diagnostics.png` })
  // 响应拦截只测试客户端版本不一致提示；Host 的真实返回已在上方验证。
  // Electron 可能走原生 IPC，不在该表面伪称 HTTP 响应已被替换。
  if (simulateMismatch) {
  const pattern = '**/api/recheck/diagnostics'
  await page.route(pattern, async route => {
    const response = await route.fetch(), json = await response.json()
    json.result.value.hostPluginVersion = '0.1.0-alpha.4'
    await route.fulfill({ response, json })
  })
  try {
    await details.getByRole('button', { name: '读取诊断', exact: true }).click()
    await details.getByRole('alert').filter({ hasText: '客户端与 Host 版本不一致' }).waitFor()
  } finally { await page.unroute(pattern) }
  await details.getByRole('button', { name: '读取诊断', exact: true }).click()
  await page.waitForFunction(() => {
    const el = document.querySelector('.rc-diagnostics textarea')
    if (!el) return false
    const d = JSON.parse(el.value); return d.clientPluginVersion === d.hostPluginVersion
  })
  }
  await details.locator('summary').click()
  return value
}
