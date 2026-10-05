import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'

// 同一组流程用于真实 Web 和 Electron。仅在调用者创建的隔离项目布置数据。
export async function verifyReviewQueue(page, { project, simulateLegacy = true }) {
  const panel = page.getByRole('region', { name: 'Recheck 结论保鲜盒', exact: true })
  const button = name => panel.getByRole('button', { name, exact: true })
  const idle = () => page.waitForFunction(() => document.querySelector('.recheck')?.getAttribute('aria-busy') === 'false')
  {
    if (await button('← 返回列表').isVisible()) await button('← 返回列表').click()
    await button('刷新列表').click(); await idle()
    const file = join(project, 'queue.txt'), dataPath = join(project, '.dsh/recheck/cards.json')
    await writeFile(file, 'queue original\n')
    // 只布置初始意见夹具；被测筛选、检查、复核与保存走真正的 Host。
    // Electron 使用原生 IPC，不能假定它提供可拦截的 HTTP RPC。
    const initial = JSON.parse(await readFile(dataPath, 'utf8')), cards = [], base = initial.cards[0].versions.at(-1)
    const at = new Date().toISOString(), bytes = await readFile(file)
    const evidence = [{ path: 'queue.txt', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), capturedAt: at }]
    for (const assessment of ['supported', 'refuted', 'uncertain', 'unreviewed']) {
      const v = { ...structuredClone(base), id: randomUUID(), reason: 'create', assessment: 'unreviewed', claim: '队列验收初始意见夹具', note: '', evidence, createdAt: at }
      const c = { id: randomUUID(), title: `beta queue ${assessment}`, revision: 1, archived: false, createdAt: at, updatedAt: at, versions: [v] }
      if (assessment !== 'unreviewed') {
        c.versions.push({ ...structuredClone(v), id: randomUUID(), reason: 'review', assessment, note: '受控初始意见夹具，不代表真实结论验证' })
        c.revision = 2
        c.latestCheck = { checkId: randomUUID(), versionId: c.versions.at(-1).id, observedAt: at, persisted: true, freshness: 'unchanged', coverage: { totalFiles: 1, checkedFiles: 1, unknownFiles: 0 }, files: [{ ...evidence[0], status: 'unchanged', observedAt: at }] }
        delete c.latestCheck.files[0].capturedAt
      }
      cards.push(c)
    }
    initial.cards.push(...cards); initial.storeRevision++
    await writeFile(dataPath, JSON.stringify(initial))
    const search = panel.getByLabel('搜索标题或结论'), opinion = panel.getByLabel('复核意见筛选'), freshness = panel.getByLabel('新鲜度', { exact: true }), sort = panel.getByLabel('排序方式')
    const rows = panel.locator('.rc-card'), selected = title => panel.getByRole('checkbox', { name: `选择卡片：${title}`, exact: true })
    await button('刷新列表').click(); await idle(); await search.fill('beta queue')
    await opinion.selectOption('refuted'); await freshness.selectOption('unchanged'); assert.equal(await rows.count(), 1)
    await panel.getByLabel('只显示需要关注').check(); assert.equal(await rows.count(), 0)
    await panel.getByLabel('只显示需要关注').uncheck(); await opinion.selectOption(''); await freshness.selectOption('')
    assert.equal(await rows.count(), 4)
    await selected(cards[0].title).focus(); await page.keyboard.press('Space')
    assert.equal(await button('检查选中的 1 张并保存').isEnabled(), true)
    await sort.selectOption('checked'); assert.equal(await button('检查选中的 0 张并保存').isDisabled(), true)
    assert.equal(await rows.last().getByRole('button', { name: cards[3].title, exact: true }).count(), 1)
    await selected(cards[0].title).check(); await sort.selectOption('updated'); assert.equal(await selected(cards[0].title).isChecked(), false)
    await sort.selectOption('attention')
    await selected(cards[0].title).check(); await selected(cards[3].title).check()
    const before = JSON.parse(await readFile(dataPath, 'utf8'))
    await writeFile(file, 'queue changed\n')
    await button('检查选中的 2 张并保存').click(); await idle()
    assert.match(await panel.getByRole('status').innerText(), /完成 2 张，保存 2 张/)
    const after = JSON.parse(await readFile(dataPath, 'utf8')), ids = [cards[0].id, cards[3].id]
    for (const c of before.cards) {
      const next = after.cards.find(a => a.id === c.id)
      if (ids.includes(c.id)) { assert.equal(next.revision, c.revision + 1); assert.equal(next.latestCheck.freshness, 'changed'); assert.equal(next.versions.at(-1).assessment, c.versions.at(-1).assessment) }
      else assert.deepEqual(next, c, '未选中的卡片不能被检查或修改')
    }
    await panel.getByText('逐卡检查结果（2）', { exact: true }).click(); assert.equal(await panel.locator('.rc-batch-results li').count(), 2)
    await selected(cards[3].title).check(); await freshness.selectOption('changed'); assert.equal(await button('检查选中的 0 张并保存').isDisabled(), true)
    await opinion.selectOption('unreviewed'); assert.equal(await rows.count(), 1)
    await selected(cards[3].title).check()
    const stale = after.cards.find(c => c.id === cards[3].id)
    const updated = JSON.parse(await readFile(dataPath, 'utf8')), external = updated.cards.find(c => c.id === stale.id)
    external.title += ' updated'; external.revision++; external.updatedAt = new Date().toISOString(); updated.storeRevision++
    await writeFile(dataPath, JSON.stringify(updated))
    const conflictBefore = await readFile(dataPath, 'utf8')
    await button('检查选中的 1 张并保存').click(); await idle()
    assert.match(await panel.getByRole('status').innerText(), /本次检查结果未保存.*保存 0 张，冲突 1 张/)
    assert.match(await panel.innerText(), /REVISION_CONFLICT/); assert.equal(await readFile(dataPath, 'utf8'), conflictBefore)
    await opinion.selectOption(''); await freshness.selectOption(''); await search.fill('beta queue unreviewed')
    const beforeAll = JSON.parse(await readFile(dataPath, 'utf8'))
    await button('检查全部活动卡片并保存').click(); await idle()
    const afterAll = JSON.parse(await readFile(dataPath, 'utf8'))
    for (const c of beforeAll.cards.filter(c => !c.archived)) assert.equal(afterAll.cards.find(a => a.id === c.id).revision, c.revision + 1)
    await search.fill('beta queue')
    await page.getByRole('button', { name: /^访问模式，当前：/ }).click(); await page.getByText('仅可查看', { exact: true }).click()
    await button('刷新列表').click(); await idle()
    await selected(cards[0].title).check(); await selected(cards[1].title).check()
    const beforeTemp = await readFile(dataPath, 'utf8')
    await button('临时检查选中的 2 张').click(); await idle()
    assert.match(await panel.getByRole('status').innerText(), /本次检查结果未保存.*保存 0 张/)
    assert.equal(await readFile(dataPath, 'utf8'), beforeTemp)
    await button(cards[0].title).click(); await idle(); assert.equal(await button('记录复核').isDisabled(), true)
    assert.match(await panel.innerText(), /临时观察，未保存/); await button('← 返回列表').click()
    await page.getByRole('button', { name: /^访问模式，当前：/ }).click(); await page.getByText('工作区内修改', { exact: true }).click()
    await button('刷新列表').click(); await idle()
    await selected(cards[0].title).check(); await unlink(file)
    await button('检查选中的 1 张并保存').click(); await idle(); await button(cards[0].title).click(); await idle()
    assert.equal(await button('记录复核').isDisabled(), true); assert.match(await panel.innerText(), /文件不存在|找不到文件|依据缺失/)
    await writeFile(file, 'queue restored\n'); await button('检查依据并保存').click(); await idle()
    await button('记录复核').click()
    await panel.getByLabel('复核意见', { exact: true }).selectOption('supported'); await panel.getByLabel('复核说明（必填）').fill('读取确认步骤验收')
    const beforeRead = await readFile(dataPath, 'utf8')
    await button('保存').click(); await idle(); assert.match(await panel.getByRole('alert').innerText(), /请先阅读/)
    assert.equal(await readFile(dataPath, 'utf8'), beforeRead)
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('name')), 'readConfirmed')
    await panel.getByLabel('我已阅读本次检查对应的依据文件').check()
    await panel.screenshot({ path: join(project, 'beta1-review-steps.png') })
    await button('保存').click(); await idle(); await button('← 返回列表').click()
    // 模拟旧 Host 的 list 能力缺失，真实 RPC 仍由宿主执行；客户端不能误发 selected。
    const legacy = async route => {
      if (route.request().postDataJSON()?.payload?.request?.action !== 'list') return route.continue()
      const response = await route.fetch(), body = await response.json()
      delete body.result.value.data.capabilities
      await route.fulfill({ response, json: body })
    }
    if (simulateLegacy) {
      await page.route('**/api/recheck/dispatch', legacy)
      try { await button('刷新列表').click(); await idle(); assert.equal(await selected(cards[0].title).isDisabled(), true); assert.match(await panel.innerText(), /Host 未声明选中检查能力/) }
      finally { await page.unroute('**/api/recheck/dispatch', legacy) }
    }
    await button('刷新列表').click(); await idle()
    await button('已归档').click(); await idle()
    assert.equal(await panel.getByRole('checkbox', { name: /^选择卡片：/ }).count(), 0); assert.equal(await panel.locator('.rc-selection').count(), 0)
    await button('活动卡片').click(); await idle()
    await panel.evaluate(el => { el.style.width = '300px'; el.style.maxWidth = '100%' })
    assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'beta.1 队列在 300px 窄栏不横向溢出')
    await panel.screenshot({ path: join(project, 'beta1-review-queue.png') })
    const background = await panel.evaluate(el => getComputedStyle(el).backgroundColor)
    const originalDark = await page.evaluate(() => document.body.hasAttribute('data-ds-dark-theme'))
    await page.evaluate(value => document.body.toggleAttribute('data-ds-dark-theme', !value), originalDark)
    try {
      assert.notEqual(await panel.evaluate(el => getComputedStyle(el).backgroundColor), background, '队列跟随宿主主题令牌')
      await panel.screenshot({ path: join(project, 'beta1-review-queue-theme.png') })
    } finally { await page.evaluate(value => document.body.toggleAttribute('data-ds-dark-theme', value), originalDark) }
    await panel.evaluate(el => { el.style.removeProperty('width'); el.style.removeProperty('max-width') })
    return ['beta.1 意见/新鲜度组合与关注规则', '稳定排序与键盘选中', '筛选清空选择与归档范围', '单次选中批处理及未选中保护', '逐卡冲突保存事实', '全部检查独立于筛选', '真实只读选中观察不保存', '缺失依据与阅读确认门槛', ...(simulateLegacy ? ['Web 旧 Host 能力回退'] : []), '300px 队列和复核步骤', '队列跟随宿主主题令牌']
  }
}
