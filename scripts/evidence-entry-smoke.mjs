import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// 两个真实表面共用；只操作调用者已创建的隔离项目与新建表单。
export async function verifyEvidenceEntry(page, project) {
  const panel = page.getByRole('region', { name: 'Recheck 结论保鲜盒', exact: true })
  const files = panel.getByLabel('依据文件（项目相对路径，每行一个，1–8 个）')
  const title = panel.getByLabel('标题（最多 120 字符）'), claim = panel.getByLabel('结论（最多 2,000 字符）')
  const note = panel.getByLabel('初始说明（可选）'), save = panel.getByRole('button', { name: '保存', exact: true })
  const original = { title: await title.inputValue(), claim: await claim.inputValue() }
  await note.fill('失败后仍保留的说明')
  await files.fill('evidence.txt\n\nevidence.txt\n../outside.txt')
  await save.click()
  await panel.getByRole('alert').filter({ hasText: '请修正依据文件' }).waitFor()
  assert.equal(await panel.locator('.rc-file-errors li').count(), 3)
  await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'files')
  await panel.getByRole('button', { name: '第 4 行', exact: true }).click()
  assert.equal(await files.evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd)), '../outside.txt')
  await files.fill(Array.from({ length: 9 }, (_, i) => `${i}.txt`).join('\n'))
  assert.match(await panel.locator('.rc-file-errors').innerText(), /最多填写 8/)
  await writeFile(join(project, 'too-large.txt'), Buffer.alloc(2 * 1024 * 1024 + 1))
  await files.fill('missing.txt\ntoo-large.txt')
  await save.click()
  await panel.getByRole('alert').filter({ hasText: 'EVIDENCE_UNAVAILABLE' }).waitFor()
  await page.waitForFunction(() => document.activeElement?.getAttribute('name') === 'files')
  assert.match(await panel.locator('.rc-file-errors').innerText(), /文件不存在/)
  assert.match(await panel.locator('.rc-file-errors').innerText(), /2 MiB/)
  assert.equal(await title.inputValue(), original.title); assert.equal(await claim.inputValue(), original.claim)
  assert.equal(await note.inputValue(), '失败后仍保留的说明'); assert.equal(await files.inputValue(), 'missing.txt\ntoo-large.txt')
  await assert.rejects(readFile(join(project, '.dsh/recheck/cards.json')), { code: 'ENOENT' })
  await panel.evaluate(el => { el.style.width = '300px' })
  assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
  await panel.screenshot({ path: join(project, 'alpha6-entry-errors.png') })
  await panel.evaluate(el => el.style.removeProperty('width'))
  await writeFile(join(project, '中文 文件.txt'), '中文与空格路径依据\n')
  await files.fill('evidence.txt\n中文 文件.txt\n')
  // 合成事件只验证 composition 保护逻辑，不冒充真实操作系统输入法验收。
  await title.dispatchEvent('compositionstart')
  await title.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true })
  await panel.locator('form').dispatchEvent('submit')
  await title.dispatchEvent('compositionend')
  await assert.rejects(readFile(join(project, '.dsh/recheck/cards.json')), { code: 'ENOENT' })
  await panel.screenshot({ path: join(project, 'alpha6-entry-ready.png') })
}
