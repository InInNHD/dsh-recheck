import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, unlink, symlink, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID, createHash } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import * as observationPolicy from '@deepseek-ai/dsh-fs-observation-policy'
import { Recheck } from '../lib/index.js'

// fixture 的 Node fs 只用于测试布置；被测业务始终调用真实 DSH FileSystem。
async function fixture(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-recheck-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(join(cwd, 'a.txt'), 'original\r\n')
  await writeFile(join(cwd, 'b.txt'), 'second\n')
  const ctx = new Context()
  const fs = new LocalFileSystem(ctx, LocalFileSystem.Config({ cwd }))
  observationPolicy.apply(ctx)
  const session = {}, service = new Recheck()
  t.after(() => service.dispose())
  const env = { ctx, fs, cwd, root: await fs.resolve(cwd), actor: { kind: 'user', sessionId: 'test-session' },
    token: { agent: { session } }, policy: { mode: 'workspace-write', workspaceRoot: cwd }, signal: new AbortController().signal }
  const call = async request => service.execute(env, request)
  const ok = async request => { const result = await call(request); assert.equal(result.status, 'ok', JSON.stringify(result)); return result.data }
  const create = (extra = {}) => ok({ action: 'create', title: '重试不会重复扣款', claim: '相同 ID 的重试不会重复扣款。', files: ['a.txt'], ...extra })
  const get = id => ok({ action: 'get', cardId: id, includeHistory: true })
  const check = card => ok({ action: 'check', scope: 'card', cardId: card.id, expectedRevision: card.revision })
  const stored = () => readFile(join(cwd, '.dsh/recheck/cards.json'), 'utf8')
  return { cwd, ctx, fs, env, service, call, ok, create, get, check, stored }
}
async function rejection(f, req, code) { const result = await f.call(req); assert.equal(result.status, 'rejected', JSON.stringify(result)); assert.equal(result.reason.code, code) }

test('完整工作流：创建、变化、复核、历史、编辑、归档、导出及重启恢复', async t => {
  const f = await fixture(t)
  let card = await f.create({ note: '已运行测试，但此说明不等于支持意见。' })
  assert.equal(card.freshness, 'unchecked'); assert.equal(card.assessment, 'unreviewed'); assert.equal(card.revision, 1)
  assert.match(card.versions[0].evidence[0].sha256, /^[a-f0-9]{64}$/)
  await f.check(card); card = await f.get(card.id)
  assert.equal(card.freshness, 'unchanged'); assert.equal(card.needsAttention, true)
  await writeFile(join(f.cwd, 'a.txt'), 'changed\n')
  await f.check(card); card = await f.get(card.id)
  assert.equal(card.freshness, 'changed'); assert.equal(card.assessment, 'unreviewed')
  card = await f.ok({ action: 'review', cardId: card.id, expectedRevision: card.revision, checkId: card.latestCheck.checkId, assessment: 'refuted', note: '阅读了变更，原结论已不成立。' })
  assert.equal(card.freshness, 'unchanged'); assert.equal(card.assessment, 'refuted'); assert.equal(card.needsAttention, false)
  assert.equal(card.versions.length, 2); assert.equal(card.versions[0].assessment, 'unreviewed')
  const versionId = card.versionId
  card = await f.ok({ action: 'edit', cardId: card.id, expectedRevision: card.revision, title: '改标题' })
  assert.equal(card.versionId, versionId); assert.equal(card.assessment, 'refuted')
  const revision = card.revision
  card = await f.ok({ action: 'edit', cardId: card.id, expectedRevision: card.revision, title: card.title, claim: card.versions.at(-1).claim, files: ['a.txt'] })
  assert.equal(card.revision, revision)
  card = await f.ok({ action: 'edit', cardId: card.id, expectedRevision: card.revision, claim: '修订结论', files: ['b.txt'], note: '依据转到第二个文件。' })
  assert.equal(card.assessment, 'unreviewed'); assert.equal(card.freshness, 'unchecked'); assert.equal(card.versions.length, 3)
  card = await f.ok({ action: 'archive', cardId: card.id, expectedRevision: card.revision, archived: true })
  assert.equal((await f.ok({ action: 'list' })).cards.length, 0)
  assert.equal((await f.ok({ action: 'list', archived: true })).cards.length, 1)
  card = await f.ok({ action: 'archive', cardId: card.id, expectedRevision: card.revision, archived: false })
  assert.equal(card.freshness, 'unchecked'); assert.equal(card.versions.length, 3)
  const exported = await f.ok({ action: 'export', cardId: card.id, includeHistory: true, path: 'report.md' })
  assert.equal(await readFile(join(f.cwd, 'report.md'), 'utf8'), exported.markdown)
  assert.ok(exported.markdown.includes('完整历史'))
  await rejection(f, { action: 'export', cardId: card.id, path: 'report.md' }, 'FILE_EXISTS')
  const restarted = new Recheck(); t.after(() => restarted.dispose())
  assert.equal((await restarted.execute(f.env, { action: 'get', cardId: card.id })).data.versionId, card.versionId)
})
test('原始字节、mtime、恢复内容与双状态分别比较', async t => {
  const f = await fixture(t); let card = await f.create()
  await utimes(join(f.cwd, 'a.txt'), new Date(), new Date())
  await f.check(card); card = await f.get(card.id); assert.equal(card.freshness, 'unchanged')
  await writeFile(join(f.cwd, 'a.txt'), 'original\n')
  await f.check(card); card = await f.get(card.id); assert.equal(card.freshness, 'changed')
  await writeFile(join(f.cwd, 'a.txt'), 'original\r\n')
  await f.check(card); card = await f.get(card.id); assert.equal(card.freshness, 'unchanged')
})
test('缺失优先于变化与未知，保留逐文件状态，缺失检查不能复核', async t => {
  const f = await fixture(t)
  await writeFile(join(f.cwd, 'c.txt'), 'third')
  let card = await f.create({ files: ['a.txt', 'b.txt', 'c.txt'] })
  await unlink(join(f.cwd, 'a.txt')); await writeFile(join(f.cwd, 'b.txt'), 'changed')
  await writeFile(join(f.cwd, 'c.txt'), Buffer.alloc(2 * 1024 * 1024 + 1))
  await f.check(card); card = await f.get(card.id)
  assert.equal(card.freshness, 'missing'); assert.deepEqual(card.latestCheck.files.map(f => f.status), ['missing', 'changed', 'unknown'])
  assert.equal(card.latestCheck.coverage.unknownFiles, 1)
  assert.equal(card.latestCheck.files[2].sha256, undefined)
  await rejection(f, { action: 'review', cardId: card.id, expectedRevision: card.revision, checkId: card.latestCheck.checkId, assessment: 'supported', note: '不完整' }, 'INCOMPLETE_CHECK')
})
test('复核拒绝过期 revision、checkId 和检查后文件变化', async t => {
  const f = await fixture(t); const old = await f.create(); await f.check(old); let card = await f.get(old.id)
  await rejection(f, { action: 'edit', cardId: card.id, expectedRevision: old.revision, title: 'stale' }, 'REVISION_CONFLICT')
  await rejection(f, { action: 'review', cardId: card.id, expectedRevision: card.revision, checkId: 'wrong', assessment: 'supported', note: '说明' }, 'CHECK_CONFLICT')
  await writeFile(join(f.cwd, 'a.txt'), 'newer')
  const before = await f.stored()
  await rejection(f, { action: 'review', cardId: card.id, expectedRevision: card.revision, checkId: card.latestCheck.checkId, assessment: 'supported', note: '说明' }, 'CHECK_CONFLICT')
  assert.equal(await f.stored(), before)
})
test('只读显式拒绝写入；临时检查不保存、不生成 checkId', async t => {
  const f = await fixture(t), card = await f.create(), before = await f.stored()
  f.env.policy = { ...f.env.policy, mode: 'read-only' }
  await rejection(f, { action: 'check', scope: 'card', cardId: card.id, expectedRevision: card.revision }, 'READ_ONLY')
  const result = await f.ok({ action: 'check', scope: 'card', cardId: card.id, expectedRevision: card.revision, persist: false })
  assert.equal(result.persisted, false); assert.equal(result.results[0].checkId, undefined)
  assert.equal(await f.stored(), before)
  assert.equal((await f.ok({ action: 'export', cardId: card.id })).written, false)
  await rejection(f, { action: 'create', title: 'x', claim: 'x', files: ['a.txt'] }, 'READ_ONLY')
})
test('路径与字段校验：逃逸、绝对路径、URL、内部存储、重复、链接与目录', async t => {
  const f = await fixture(t)
  for (const path of ['../a.txt', 'C:/a.txt', '//host/share', 'https://x', '.dsh/recheck/cards.json', 'a.txt\0', 'NUL', 'a.txt.']) {
    await rejection(f, { action: 'create', title: 'x', claim: 'x', files: [path] }, 'INVALID_PATH')
  }
  await rejection(f, { action: 'create', title: 'x', claim: 'x', files: ['a.txt', 'a.txt'] }, 'INVALID_INPUT')
  await rejection(f, { action: 'list', workspaceRoot: f.cwd }, 'INVALID_INPUT')
  await mkdir(join(f.cwd, 'folder'))
  await rejection(f, { action: 'create', title: 'x', claim: 'x', files: ['folder'] }, 'EVIDENCE_UNAVAILABLE')
  await symlink(join(f.cwd, 'folder'), join(f.cwd, 'junction'), 'junction')
  await rejection(f, { action: 'create', title: 'x', claim: 'x', files: ['junction/a.txt'] }, 'EVIDENCE_UNAVAILABLE')
})
test('Unicode code point 上限；初始证据失败不会创建半张卡片', async t => {
  const f = await fixture(t)
  assert.equal((await f.create({ title: '😀'.repeat(120) })).title.length, 240)
  await rejection(f, { action: 'create', title: '😀'.repeat(121), claim: 'x', files: ['a.txt'] }, 'INVALID_INPUT')
  const before = await f.stored()
  await rejection(f, { action: 'create', title: 'x', claim: 'x', files: ['a.txt', 'not-found.txt'] }, 'EVIDENCE_UNAVAILABLE')
  assert.equal(await f.stored(), before)
})
test('损坏和未来版本存储始终保留原文件', async t => {
  const f = await fixture(t); await f.create()
  for (const [content, code] of [['{bad', 'CORRUPT_STORE'], [JSON.stringify({ schemaVersion: 9, cards: [] }), 'UNSUPPORTED_SCHEMA'],
    [JSON.stringify({ schemaVersion: 1, storeRevision: 0, cards: [{}] }), 'CORRUPT_STORE']]) {
    await writeFile(join(f.cwd, '.dsh/recheck/cards.json'), content)
    await rejection(f, { action: 'create', title: 'x', claim: 'x', files: ['a.txt'] }, code)
    assert.equal(await f.stored(), content)
  }
})
test('批量检查共享文件只读一次，分别比较每卡基线，只提交一次', async t => {
  const f = await fixture(t), first = await f.create()
  await writeFile(join(f.cwd, 'a.txt'), 'second-baseline')
  const second = await f.create({ title: '第二张' })
  let evidenceReads = 0, writes = 0
  f.fs.internals.inspectReadBytesAfterStat = file => { if (file.displayPath.endsWith('a.txt')) evidenceReads++ }
  f.fs.internals.inspectTemp = () => { writes++ }
  const result = await f.ok({ action: 'check', scope: 'all' })
  assert.equal(evidenceReads, 1); assert.equal(writes, 1); assert.equal(result.counts.checked, 2)
  assert.equal((await f.get(first.id)).freshness, 'changed'); assert.equal((await f.get(second.id)).freshness, 'unchanged')
})
test('读取期间变更、超大文件均为 unknown，不伪造指纹', async t => {
  const f = await fixture(t); let card = await f.create()
  let changed = false
  f.fs.internals.inspectReadBytesAfterStat = async file => { if (!changed && file.displayPath.endsWith('a.txt')) { changed = true; await writeFile(join(f.cwd, 'a.txt'), 'during-read') } }
  await f.check(card); card = await f.get(card.id)
  assert.equal(card.freshness, 'unknown'); assert.equal(card.latestCheck.files[0].sha256, undefined)
  f.fs.internals.inspectReadBytesAfterStat = undefined
  await writeFile(join(f.cwd, 'a.txt'), Buffer.alloc(2 * 1024 * 1024 + 1))
  await f.check(card); card = await f.get(card.id); assert.equal(card.freshness, 'unknown')
})
test('并行同 revision 编辑只有一项成功，历史没有丢失', async t => {
  const f = await fixture(t), card = await f.create()
  const results = await Promise.all(['first', 'second'].map(title => f.call({ action: 'edit', cardId: card.id, expectedRevision: card.revision, title })))
  assert.equal(results.filter(r => r.status === 'ok').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'REVISION_CONFLICT').length, 1)
})
test('同项目两会话并发复核同 revision：一胜一冲突，完整保留原历史', async t => {
  const f = await fixture(t)
  let card = await f.create()
  card = await f.ok({ action: 'edit', cardId: card.id, expectedRevision: card.revision, claim: '修订后的结论', note: '建立待复核版本' })
  await f.check(card); card = await f.get(card.id)
  const history = structuredClone(card.versions)
  const inputs = [
    { sessionId: 'review-session-a', assessment: 'supported', note: '会话 A 根据当前依据认为成立。' },
    { sessionId: 'review-session-b', assessment: 'refuted', note: '会话 B 根据当前依据认为不成立。' },
  ]
  const results = await Promise.all(inputs.map(({ sessionId, assessment, note }) => f.service.execute(
    { ...f.env, actor: { kind: 'user', sessionId }, token: { agent: { session: {} } } },
    { action: 'review', cardId: card.id, expectedRevision: card.revision, checkId: card.latestCheck.checkId, assessment, note },
  )))
  const winner = results.findIndex(r => r.status === 'ok')
  assert.notEqual(winner, -1)
  assert.equal(results.filter(r => r.status === 'ok').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected' && r.reason.code === 'REVISION_CONFLICT').length, 1)
  const saved = await f.get(card.id)
  assert.equal(saved.revision, card.revision + 1)
  assert.equal(saved.versions.length, history.length + 1)
  assert.deepEqual(saved.versions.slice(0, -1), history)
  assert.equal(saved.versions.at(-1).reason, 'review')
  assert.equal(saved.versions.at(-1).actor.sessionId, inputs[winner].sessionId)
  assert.equal(saved.versions.at(-1).assessment, inputs[winner].assessment)
  assert.equal(saved.versions.at(-1).note, inputs[winner].note)
  assert.equal(saved.freshness, 'unchanged')
})
test('用户取消发生在批量提交前：完全不保存本次结果', async t => {
  const f = await fixture(t); await f.create(); const before = await f.stored(), controller = new AbortController()
  f.env.signal = controller.signal
  f.fs.internals.inspectReadBytesAfterStat = file => { if (file.displayPath.endsWith('a.txt')) controller.abort() }
  await rejection(f, { action: 'check', scope: 'all' }, 'CANCELLED')
  assert.equal(await f.stored(), before)
})
test('实际原子写入故障保留旧存储；不能吞成成功', async t => {
  const f = await fixture(t), card = await f.create(), before = await f.stored()
  f.fs.internals.inspectTemp = () => { throw new Error('故障注入：发布前磁盘错误') }
  await assert.rejects(f.call({ action: 'edit', cardId: card.id, expectedRevision: card.revision, title: '不能保存' }), /文件系统操作失败/)
  assert.equal(await f.stored(), before)
})
test('Markdown 对恶意标题和闭合围栏保持文字语义，导出不包含主机根目录', async t => {
  const f = await fixture(t), card = await f.create({ title: '<img src=x onerror=alert(1)>', claim: '```\n<script>alert(1)</script>\n```', note: '``````\n恶意围栏' })
  const output = (await f.ok({ action: 'export', cardId: card.id })).markdown
  assert.ok(output.includes('\\<img')); assert.ok(output.includes('```````text'))
  assert.equal(output.includes(f.cwd), false)
})
test('不同项目隔离，同项目不同来源会话共享存储', async t => {
  const a = await fixture(t), b = await fixture(t), card = await a.create()
  assert.equal((await b.ok({ action: 'list' })).cards.length, 0)
  const env = { ...a.env, actor: { kind: 'agent', sessionId: 'another-session' }, token: { agent: { session: {} } } }
  const service = new Recheck(); t.after(() => service.dispose())
  assert.equal((await service.execute(env, { action: 'get', cardId: card.id })).data.cardId, card.id)
})

test('批量读取期间卡片被编辑：只提交仍匹配的卡片', async t => {
  const f = await fixture(t), first = await f.create(), second = await f.create({ files: ['b.txt'] })
  let updated = false
  f.fs.internals.inspectReadBytesAfterStat = async file => {
    if (!updated && file.displayPath.endsWith('a.txt')) {
      updated = true
      const store = JSON.parse(await f.stored()), c = store.cards.find(c => c.id === first.id)
      c.revision++; c.title = '其他会话修改'; store.storeRevision++
      await writeFile(join(f.cwd, '.dsh/recheck/cards.json'), JSON.stringify(store))
    }
  }
  const result = await f.ok({ action: 'check', scope: 'all' })
  assert.equal(result.counts.checked, 1); assert.equal(result.counts.conflict, 1)
  assert.equal((await f.get(first.id)).freshness, 'unchecked'); assert.equal((await f.get(second.id)).freshness, 'unchanged')
})
test('实际 FS 版本 guard 拒绝提交前的外部更新，不覆盖外部内容', async t => {
  const f = await fixture(t), card = await f.create()
  const original = f.fs.writeText.bind(f.fs)
  let external
  f.fs.writeText = async (...args) => {
    const store = JSON.parse(await f.stored()); store.cards[0].title = '外部更新'; store.cards[0].revision++; store.storeRevision++
    external = JSON.stringify(store)
    await writeFile(join(f.cwd, '.dsh/recheck/cards.json'), external)
    return original(...args)
  }
  await rejection(f, { action: 'edit', cardId: card.id, expectedRevision: card.revision, title: '本次更新' }, 'REVISION_CONFLICT')
  assert.equal(await f.stored(), external)
})
test('发布完成后收到取消：仍返回实际已保存的结果', async t => {
  const f = await fixture(t), card = await f.create(), controller = new AbortController()
  f.env.signal = controller.signal
  f.fs.internals.removeStagingDir = async path => { await rm(path, { recursive: true, force: true }); controller.abort() }
  const response = await f.call({ action: 'edit', cardId: card.id, expectedRevision: card.revision, title: '已经保存' })
  assert.equal(response.status, 'ok'); assert.equal(JSON.parse(await f.stored()).cards[0].title, '已经保存')
})
test('20 个版本的容量限制明确拒绝，不删除历史', async t => {
  const f = await fixture(t); let card = await f.create()
  for (let i = 1; i < 20; i++) card = await f.ok({ action: 'edit', cardId: card.id, expectedRevision: card.revision, claim: `结论 ${i}`, note: '修订' })
  const before = await f.stored()
  await rejection(f, { action: 'edit', cardId: card.id, expectedRevision: card.revision, claim: '第 21 个版本', note: '修订' }, 'VERSION_CAPACITY')
  assert.equal(await f.stored(), before); assert.equal(card.versions.length, 20)
})
async function seed(f, cards) {
  const original = await f.create()
  const store = JSON.parse(await f.stored())
  store.cards = cards.map((paths, i) => {
    const c = structuredClone(original); delete c.freshness; delete c.assessment; delete c.needsAttention; delete c.cardId; delete c.versionId; delete c.versionCount
    c.id = randomUUID(); c.title = `卡片 ${i}`; c.versions[0].id = randomUUID()
    if (paths) c.versions[0].evidence = paths.map(path => ({ ...c.versions[0].evidence[0], path }))
    return c
  })
  await writeFile(join(f.cwd, '.dsh/recheck/cards.json'), JSON.stringify(store))
  return store
}
test('活动 100、总量 200 独立限额，归档不释放总容量', async t => {
  const f = await fixture(t)
  let store = await seed(f, Array.from({ length: 100 }, () => undefined))
  await rejection(f, { action: 'create', title: 'x', claim: 'x', files: ['a.txt'] }, 'ACTIVE_CAPACITY')
  const base = structuredClone(store.cards[0])
  store.cards.push(...Array.from({ length: 100 }, () => ({ ...structuredClone(base), id: randomUUID(), archived: true,
    versions: [{ ...structuredClone(base.versions[0]), id: randomUUID() }] })))
  await writeFile(join(f.cwd, '.dsh/recheck/cards.json'), JSON.stringify(store))
  await rejection(f, { action: 'create', title: 'x', claim: 'x', files: ['a.txt'] }, 'CARD_CAPACITY')
  await rejection(f, { action: 'archive', cardId: store.cards[100].id, expectedRevision: 1, archived: false }, 'ACTIVE_CAPACITY')
})
test('批量 200 个唯一目标上限：未覆盖部分如实保存 unknown', async t => {
  const f = await fixture(t)
  const paths = Array.from({ length: 208 }, (_, i) => `e-${i}.txt`)
  await Promise.all(paths.map(path => writeFile(join(f.cwd, path), 'original\r\n')))
  await seed(f, Array.from({ length: 26 }, (_, i) => paths.slice(i * 8, i * 8 + 8)))
  let reads = 0
  f.fs.internals.inspectReadBytesAfterStat = file => { if (file.displayPath.includes('e-') && file.displayPath.endsWith('.txt')) reads++ }
  const result = await f.ok({ action: 'check', scope: 'all' })
  assert.equal(result.counts.checked, 26); assert.equal(result.counts.unknownFiles, 8); assert.equal(reads, 200)
})
test('批量 64 MiB 实际读取预算：后续依据 unknown，不截断哈希', async t => {
  const f = await fixture(t), bytes = Buffer.alloc(2 * 1024 * 1024, 65)
  const paths = Array.from({ length: 40 }, (_, i) => `large-${i}.bin`)
  await Promise.all(paths.map(path => writeFile(join(f.cwd, path), bytes)))
  const store = await seed(f, Array.from({ length: 5 }, (_, i) => paths.slice(i * 8, i * 8 + 8)))
  const hash = createHash('sha256').update(bytes).digest('hex')
  for (const c of store.cards) for (const e of c.versions[0].evidence) { e.size = bytes.length; e.sha256 = hash }
  await writeFile(join(f.cwd, '.dsh/recheck/cards.json'), JSON.stringify(store))
  let reads = 0
  f.fs.internals.inspectReadBytesAfterStat = file => { if (file.displayPath.endsWith('.bin')) reads++ }
  const result = await f.ok({ action: 'check', scope: 'all' })
  assert.equal(result.counts.unknownFiles, 8); assert.equal(reads, 32)
  for (const r of result.results) for (const file of r.files) if (file.status === 'unknown') assert.equal(file.sha256, undefined)
})
test('10 秒预算耗尽保存 unknown；用户取消与时间预算不同', async t => {
  const f = await fixture(t), card = await f.create()
  f.fs.internals.inspectReadBytesAfterStat = async file => { if (file.displayPath.endsWith('a.txt')) await new Promise(resolve => setTimeout(resolve, 10_050)) }
  const result = await f.check(card)
  assert.equal(result.persisted, true); assert.equal(result.results[0].freshness, 'unknown')
  assert.equal((await f.get(card.id)).freshness, 'unknown')
})
test('8 MiB UTF-8 存储上限，不按 JS 字符数量估算', async t => {
  const f = await fixture(t); await f.create()
  const content = '中'.repeat(Math.floor(8 * 1024 * 1024 / 3) + 1)
  await writeFile(join(f.cwd, '.dsh/recheck/cards.json'), content)
  await rejection(f, { action: 'list' }, 'STORE_TOO_LARGE'); assert.equal(await f.stored(), content)
})
test('卸载取消读取、等待正在进行的工作，不删除已保存文件', async t => {
  const f = await fixture(t); await f.create(); const before = await f.stored()
  let entered, resume
  const atRead = new Promise(resolve => { entered = resolve }), blocked = new Promise(resolve => { resume = resolve })
  f.fs.internals.inspectReadBytesAfterStat = async file => { if (file.displayPath.endsWith('a.txt')) { entered(); await blocked } }
  const running = f.call({ action: 'check', scope: 'all' })
  await atRead; const disposing = f.service.dispose(); resume(); await disposing
  assert.equal((await running).reason.code, 'CANCELLED'); assert.equal(await f.stored(), before)
  assert.equal((await f.call({ action: 'list' })).reason.code, 'UNLOADED')
})
