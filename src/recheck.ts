import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { LIMITS, type Card, type CardVersion, type Check, type Evidence, type EvidenceIssue, type FileCheck, type Request, type Response } from './types.js'
import { current, evidenceFailure, findCard, freshness, needsAttention, orderCards, parseRequest, reject, RecheckError, summarize, text } from './cards.js'
import { errorCode, fileFailure, guardedWrite, now, readEvidence, sha256, target, writable, type Environment } from './io.js'
import { loadStore, saveStore } from './store.js'
import { markdown } from './export.js'

function view(card: Card, history = true) {
  return { ...card, versions: history ? card.versions : [current(card)], versionCount: card.versions.length,
    versionId: current(card).id, cardId: card.id, freshness: freshness(card), assessment: current(card).assessment, needsAttention: needsAttention(card) }
}
function version(env: Environment, reason: CardVersion['reason'], claim: string, evidence: Evidence[], note = '', assessment: CardVersion['assessment'] = 'unreviewed'): CardVersion {
  return { id: randomUUID(), reason, claim, evidence, note, assessment, actor: env.actor, createdAt: now() }
}
function capacity(card: Card): void {
  if (card.versions.length >= LIMITS.versions) reject('VERSION_CAPACITY', '已达到 20 个版本上限；旧版本不会被自动删除。')
}
const touch = (card: Card) => { card.revision++; card.updatedAt = now() }
function makeCheck(card: Card, files: FileCheck[], persist: boolean): Check {
  const unknownFiles = files.filter(f => f.status === 'unknown').length
  return { ...(persist ? { checkId: randomUUID() } : {}), versionId: current(card).id, observedAt: now(), persisted: persist,
    freshness: summarize(files.map(f => f.status)), coverage: { totalFiles: files.length, checkedFiles: files.length - unknownFiles, unknownFiles }, files }
}

/** 单个 Host 实例按项目串行提交；耗时依据读取在提交队列外进行。 */
export class Recheck {
  private readonly queues = new Map<string, Promise<unknown>>()
  private readonly active = new Set<Promise<unknown>>()
  private readonly lifetime = new AbortController()
  private stopped = false
  async dispose(): Promise<void> {
    this.stopped = true
    this.lifetime.abort()
    await Promise.allSettled([...this.active])
    this.queues.clear()
  }
  private async commit<T>(env: Environment, body: () => Promise<T>): Promise<T> {
    writable(env)
    const key = env.root.targetKey
    const previous = this.queues.get(key) ?? Promise.resolve()
    const pending = previous.catch(() => {}).then(() => {
      if (this.stopped) reject('UNLOADED', '插件正在卸载，未开始的提交已取消。')
      writable(env); return body()
    })
    this.queues.set(key, pending)
    try { return await pending } finally { if (this.queues.get(key) === pending) this.queues.delete(key) }
  }
  async execute(environment: Environment, input: unknown): Promise<Response> {
    const pending = this.run(environment, input)
    this.active.add(pending)
    try { return await pending } finally { this.active.delete(pending) }
  }
  private async run(environment: Environment, input: unknown): Promise<Response> {
    let action = typeof input === 'object' && input !== null && 'action' in input && typeof input.action === 'string' ? input.action : 'invalid'
    try {
      if (this.stopped) reject('UNLOADED', '插件正在卸载。')
      const req = parseRequest(input); action = req.action
      const env = { ...environment, signal: AbortSignal.any([environment.signal, this.lifetime.signal]) }
      // 卸载取消未完成的读取；已进入原子提交的写入只遵循调用者取消并等待完成。
      const writeEnv = environment
      const data = await this.dispatch(env, writeEnv, req)
      return { status: 'ok', action, data }
    } catch (error) {
      if (error instanceof RecheckError) return { status: 'rejected', action, reason: { code: error.code, message: error.message, retryable: error.retryable, ...(error.evidenceIssues ? { evidenceIssues: error.evidenceIssues } : {}) } }
      const code = errorCode(error)
      const mapped: Record<string, [string, string, boolean]> = {
        FS_STALE_VERSION: ['REVISION_CONFLICT', '存储被其他操作更新，请重新读取后提交。', true],
        FS_PERMISSION_DENIED: ['PERMISSION_DENIED', '宿主拒绝文件访问。', false], FS_SANDBOX_DENIED: ['PERMISSION_DENIED', '宿主沙箱拒绝该操作。', false],
        FS_NOT_OBSERVED: ['PERMISSION_DENIED', '宿主要求先读取文件。', true], FS_ABORTED: ['CANCELLED', '操作在提交前取消。', true],
      }
      if (environment.signal.aborted || this.lifetime.signal.aborted || (error instanceof Error && error.name === 'AbortError'))
        return { status: 'rejected', action, reason: { code: 'CANCELLED', message: '操作在提交前取消。', retryable: true } }
      const known = mapped[code]
      if (known) return { status: 'rejected', action, reason: { code: known[0], message: known[1], retryable: known[2] } }
      // 不把未知基础设施异常伪装成成功；不向客户端暴露主机路径。
      throw new Error(`Recheck 文件系统操作失败（${code}）。`)
    }
  }
  private async capture(env: Environment, paths: string[]): Promise<Evidence[]> {
    const bounded = { ...env, signal: AbortSignal.any([env.signal, AbortSignal.timeout(LIMITS.timeoutMs)]) }
    const result: Evidence[] = [], keys = new Set<string>(), issues: EvidenceIssue[] = []
    for (const [index, path] of paths.entries()) {
      try {
        const snapshot = await readEvidence(bounded, path)
        if (keys.has(snapshot.target.targetKey)) reject('DUPLICATE_EVIDENCE', '多个路径指向同一文件。')
        keys.add(snapshot.target.targetKey); result.push(snapshot.evidence)
      } catch (error) {
        env.signal.throwIfAborted()
        issues.push({ index, ...evidenceFailure(errorCode(error)) })
      }
    }
    if (issues.length) throw new RecheckError(issues.some(i => i.code === 'DUPLICATE_EVIDENCE') ? 'DUPLICATE_EVIDENCE' : 'EVIDENCE_UNAVAILABLE', '依据未完整读取，没有保存；请修正标出的条目。', true, issues)
    return result
  }
  private async dispatch(env: Environment, writeEnv: Environment, req: Request): Promise<unknown> {
    if (['create', 'edit', 'review', 'archive'].includes(req.action) || (req.action === 'check' && req.persist !== false) || (req.action === 'export' && req.path)) writable(env)
    const loaded = await loadStore(env)
    if (req.action === 'list') {
      const all = loaded.value.cards
      let cards = all.filter(c => c.archived === (req.archived ?? false))
      if (req.query) { const q = req.query.toLocaleLowerCase(); cards = cards.filter(c => (c.title + '\n' + current(c).claim).toLocaleLowerCase().includes(q)) }
      if (req.needsAttention !== undefined) cards = cards.filter(c => needsAttention(c) === req.needsAttention)
      if (req.freshness) cards = cards.filter(c => freshness(c) === req.freshness)
      if (req.assessment) cards = cards.filter(c => current(c).assessment === req.assessment)
      return { workspace: { id: sha256(Buffer.from(String(env.root.targetKey))), name: basename(env.cwd), writable: env.policy.mode !== 'read-only' },
        capabilities: ['selectedCheck', 'assessmentFilter', 'listSort'], storeRevision: loaded.value.storeRevision, counts: { active: all.filter(c => !c.archived).length, archived: all.filter(c => c.archived).length,
          total: all.length, needsAttention: all.filter(c => !c.archived && needsAttention(c)).length },
        cards: orderCards(cards.map(c => ({ cardId: c.id, versionId: current(c).id, title: c.title, revision: c.revision, archived: c.archived, claim: current(c).claim,
          freshness: freshness(c), assessment: current(c).assessment, needsAttention: needsAttention(c), evidenceCount: current(c).evidence.length,
          updatedAt: c.updatedAt, observedAt: c.latestCheck?.observedAt, actor: current(c).actor })), req.sort) }
    }
    if (req.action === 'create') {
      const evidence = await this.capture(env, req.files)
      env.signal.throwIfAborted()
      return this.commit(writeEnv, async () => {
        const fresh = await loadStore(writeEnv)
        if (fresh.value.cards.length >= LIMITS.cards) reject('CARD_CAPACITY', '已达到 200 张总卡片上限。')
        if (fresh.value.cards.filter(c => !c.archived).length >= LIMITS.active) reject('ACTIVE_CAPACITY', '已达到 100 张活动卡片上限。')
        const stamp = now()
        const card: Card = { id: randomUUID(), title: req.title, revision: 1, archived: false, createdAt: stamp, updatedAt: stamp,
          versions: [version(env, 'create', req.claim, evidence, req.note)] }
        fresh.value.cards.push(card); await saveStore(writeEnv, fresh); return view(card)
      })
    }
    if (req.action === 'check') return this.check(env, writeEnv, loaded.value.cards, req)
    const original = findCard(loaded.value, req.cardId, 'expectedRevision' in req ? req.expectedRevision : undefined)
    if (req.action === 'get') return view(original, req.includeHistory === true)
    if (req.action === 'export') {
      const content = markdown(original, req.includeHistory === true)
      if (req.path) {
        const file = await target(env, req.path)
        if (await env.fs.stat(file, env.signal)) reject('FILE_EXISTS', '导出目标已存在，请更换文件名。')
        env.signal.throwIfAborted()
        await this.commit(writeEnv, () => guardedWrite(writeEnv, file, content, { kind: 'absent' }))
      }
      return { markdown: content, ...(req.path ? { path: req.path, written: true } : { written: false }) }
    }
    if (req.action === 'archive') {
      env.signal.throwIfAborted()
      return this.commit(writeEnv, async () => {
        const fresh = await loadStore(writeEnv), c = findCard(fresh.value, req.cardId, req.expectedRevision)
        if (c.archived === req.archived) return view(c)
        if (!req.archived && fresh.value.cards.filter(c => !c.archived).length >= LIMITS.active) reject('ACTIVE_CAPACITY', '恢复将超过活动卡片上限。')
        c.archived = req.archived; if (!req.archived) delete c.latestCheck
        touch(c); await saveStore(writeEnv, fresh); return view(c)
      })
    }
    if (original.archived) reject('ARCHIVED_CARD', '请先恢复卡片，再编辑或复核。')
    if (req.action === 'edit') {
      const base = current(original), claim = req.claim ?? base.claim, paths = req.files ?? base.evidence.map(e => e.path)
      const changed = claim !== base.claim || JSON.stringify(paths) !== JSON.stringify(base.evidence.map(e => e.path))
      let evidence: Evidence[] | undefined
      if (changed) { capacity(original); text(req.note, '变更说明', LIMITS.note); evidence = await this.capture(env, paths) }
      env.signal.throwIfAborted()
      return this.commit(writeEnv, async () => {
        const fresh = await loadStore(writeEnv), c = findCard(fresh.value, req.cardId, req.expectedRevision)
        if (!changed && (req.title === undefined || req.title === c.title)) return view(c)
        if (req.title !== undefined) c.title = req.title
        if (changed) { capacity(c); c.versions.push(version(env, 'edit', claim, evidence!, req.note)); delete c.latestCheck }
        touch(c); await saveStore(writeEnv, fresh); return view(c)
      })
    }
    if (req.action === 'review') {
      capacity(original)
      const check = original.latestCheck
      if (!check || check.checkId !== req.checkId || check.versionId !== current(original).id) reject('CHECK_CONFLICT', '请引用当前版本最近保存的检查。', true)
      if (check.files.some(f => f.status === 'missing' || f.status === 'unknown')) reject('INCOMPLETE_CHECK', '缺失或未知的依据不能用于复核，请处理后重新检查。')
      env.signal.throwIfAborted()
      return this.commit(writeEnv, async () => {
        const fresh = await loadStore(writeEnv), c = findCard(fresh.value, req.cardId, req.expectedRevision)
        if (c.latestCheck?.checkId !== req.checkId || current(c).id !== check.versionId) reject('CHECK_CONFLICT', '引用的检查已经过期。', true)
        capacity(c)
        // 复核在取得提交队列后再读取，避免排队期间变更却仍提交旧意见。
        const evidence = await this.capture(env, current(c).evidence.map(e => e.path))
        if (evidence.some((e, i) => e.sha256 !== check.files[i]!.sha256 || e.size !== check.files[i]!.size)) reject('CHECK_CONFLICT', '依据在检查后改变，请重新检查。复核意见未保存。', true)
        c.versions.push(version(env, 'review', current(c).claim, evidence, req.note, req.assessment))
        c.latestCheck = makeCheck(c, evidence.map(e => ({ path: e.path, status: 'unchanged', sha256: e.sha256, size: e.size, observedAt: e.capturedAt })), true)
        touch(c); await saveStore(writeEnv, fresh); return view(c)
      })
    }
    reject('INVALID_INPUT', '动作不受支持。')
  }
  private async check(env: Environment, writeEnv: Environment, all: Card[], req: Extract<Request, { action: 'check' }>): Promise<unknown> {
    const failures = new Map<string, { outcome: 'error' | 'conflict'; cardId: string; saved: false; reason: { code: string; message: string } }>()
    let cards: Card[]
    if (req.scope === 'selected') {
      cards = []
      for (const t of req.targets) {
        const card = all.find(c => c.id === t.cardId)
        const reason = !card ? { code: 'CARD_NOT_FOUND', message: '卡片不存在，本卡未检查。' }
          : card.archived ? { code: 'ARCHIVED_CARD', message: '卡片已归档，请恢复后再检查。' }
          : card.revision !== t.expectedRevision ? { code: 'REVISION_CONFLICT', message: '卡片已更新，本卡未检查；请刷新后重新选择。' } : undefined
        if (reason) failures.set(t.cardId, { outcome: reason.code === 'REVISION_CONFLICT' ? 'conflict' : 'error', cardId: t.cardId, saved: false, reason })
        else cards.push(card!)
      }
    } else cards = req.scope === 'all' ? all.filter(c => !c.archived) : [findCard({ schemaVersion: 1, storeRevision: 0, cards: all }, req.cardId, req.expectedRevision)]
    if (cards.some(c => c.archived)) reject('ARCHIVED_CARD', '请先恢复卡片，再检查。')
    const persist = req.persist !== false, deadline = AbortSignal.timeout(LIMITS.timeoutMs)
    const readEnv = { ...env, signal: AbortSignal.any([env.signal, deadline]) }
    const cache = new Map<string, Omit<FileCheck, 'path' | 'status'> & { failure?: 'missing' | 'unknown' }>()
    let remaining = LIMITS.batchBytes
    const collected: { card: Card; check: Check }[] = []
    const response = (outcomes: any[], cancelled = false) => {
      const results = req.scope === 'selected' ? req.targets.map(t => failures.get(t.cardId) ?? outcomes.find(r => r.cardId === t.cardId)
        ?? { outcome: 'error', cardId: t.cardId, saved: false, reason: { code: 'CANCELLED', message: '检查已取消，本卡没有保存。' } }) : outcomes
      return { persisted: persist && !cancelled, saved: results.some(r => r.saved), cancelled, results,
        counts: { checked: results.filter(r => r.outcome === 'checked').length, saved: results.filter(r => r.saved).length,
          conflict: results.filter(r => r.outcome === 'conflict').length, error: results.filter(r => r.outcome === 'error').length,
          unknownFiles: results.reduce((n, r) => n + (r.coverage?.unknownFiles ?? 0), 0) } }
    }
    const observations = () => collected.map(({ card, check }) => {
      const { checkId: _unsavedId, ...value } = check
      return { outcome: 'checked', cardId: card.id, revision: card.revision, ...value, persisted: false, saved: false }
    })
    try {
    for (const c of cards) {
      const files: FileCheck[] = []
      for (const base of current(c).evidence) {
        env.signal.throwIfAborted()
        let result: Omit<FileCheck, 'path' | 'status'> & { failure?: 'missing' | 'unknown' }
        try {
          if (deadline.aborted) reject('TIME_BUDGET', '本次检查时间预算耗尽。')
          const file = await target(readEnv, base.path)
          const existing = cache.get(file.targetKey)
          if (existing) result = existing
          else if (cache.size >= LIMITS.batchTargets || remaining === 0) result = { observedAt: now(), failure: 'unknown', reason: 'READ_BUDGET' }
          else {
            const allowance = Math.min(LIMITS.fileBytes, remaining)
            try {
              const snapshot = await readEvidence(readEnv, base.path, file, allowance)
              remaining -= snapshot.evidence.size
              result = { observedAt: snapshot.evidence.capturedAt, sha256: snapshot.evidence.sha256, size: snapshot.evidence.size }
            } catch (error) {
              env.signal.throwIfAborted()
              // 失败的读取可能已读取部分字节；保守扣除许可额度保证总读取上限。
              remaining -= allowance
              const failure = fileFailure(error)
              result = { observedAt: now(), failure: failure.status, reason: deadline.aborted ? 'TIME_BUDGET' : failure.reason }
            }
            cache.set(file.targetKey, result)
          }
        } catch (error) {
          env.signal.throwIfAborted()
          const failure = fileFailure(error)
          result = { observedAt: now(), failure: failure.status, reason: deadline.aborted ? 'TIME_BUDGET' : failure.reason }
        }
        const { failure, ...detail } = result
        files.push({ path: base.path, status: failure ?? (detail.sha256 === base.sha256 ? 'unchanged' : 'changed'), ...detail })
      }
      collected.push({ card: c, check: makeCheck(c, files, persist) })
    }
    env.signal.throwIfAborted()
    if (!persist) return response(observations())
    return await this.commit(writeEnv, async () => {
      const fresh = await loadStore(writeEnv)
      const outcomes = collected.map(({ card: before, check }) => {
        const c = fresh.value.cards.find(c => c.id === before.id)
        if (!c || c.archived || c.revision !== before.revision || current(c).id !== check.versionId)
          return { outcome: 'conflict', cardId: before.id, saved: false, reason: { code: 'REVISION_CONFLICT', message: '卡片在检查期间改变；本卡结果没有保存。' } }
        c.latestCheck = check; touch(c)
        return { outcome: 'checked', cardId: c.id, revision: c.revision, ...check, saved: true }
      })
      if (outcomes.some(r => r.outcome === 'checked')) await saveStore(writeEnv, fresh)
      return response(outcomes)
    })
    } catch (error) {
      if (req.scope === 'selected' && env.signal.aborted) return response(observations(), true)
      throw error
    }
  }
}
