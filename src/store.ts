import { z } from 'zod'
import type { FsObservation, FsTarget } from '@deepseek-ai/dsh-fs'
import { LIMITS, type Store } from './types.js'
import { current, relativePath, reject, summarize } from './cards.js'
import { guardedWrite, observe, target, type Environment } from './io.js'

const id = z.string().uuid()
const date = z.iso.datetime()
const bounded = (max: number, blank = false) => z.string().refine(s => (blank || !!s.trim()) && [...s].length <= max)
const path = z.string().refine(s => { try { return relativePath(s) === s } catch { return false } })
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const positive = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER)
const size = z.number().int().min(0).max(LIMITS.fileBytes)
const evidence = z.strictObject({ path, sha256: hash, size, capturedAt: date })
const file = z.strictObject({ path, status: z.enum(['unchanged', 'changed', 'missing', 'unknown']), observedAt: date,
  sha256: hash.optional(), size: size.optional(), reason: bounded(128).optional() })
const check = z.strictObject({ checkId: id, versionId: id, observedAt: date, persisted: z.literal(true),
  freshness: z.enum(['unchanged', 'changed', 'missing', 'unknown']),
  coverage: z.strictObject({ totalFiles: z.number().int().min(1).max(8), checkedFiles: z.number().int().min(0).max(8), unknownFiles: z.number().int().min(0).max(8) }),
  files: z.array(file).min(1).max(8) })
const version = z.strictObject({ id, reason: z.enum(['create', 'edit', 'review']), claim: bounded(LIMITS.claim),
  assessment: z.enum(['unreviewed', 'supported', 'refuted', 'uncertain']), note: bounded(LIMITS.note, true),
  actor: z.strictObject({ kind: z.enum(['user', 'agent']), sessionId: bounded(256) }), createdAt: date,
  evidence: z.array(evidence).min(1).max(8) })
const card = z.strictObject({ id, title: bounded(LIMITS.title), revision: positive, archived: z.boolean(),
  createdAt: date, updatedAt: date, versions: z.array(version).min(1).max(LIMITS.versions), latestCheck: check.optional() })
const schema = z.strictObject({ schemaVersion: z.literal(1), storeRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), cards: z.array(card).max(LIMITS.cards) })

export function validateStore(input: unknown): Store {
  if (typeof input === 'object' && input !== null && 'schemaVersion' in input && input.schemaVersion !== 1)
    reject('UNSUPPORTED_SCHEMA', '存储版本不受支持，原文件已保留。')
  const parsed = schema.safeParse(input)
  if (!parsed.success) reject('CORRUPT_STORE', '存储结构损坏，不能覆盖原文件。')
  const store = parsed.data as Store
  const identifiers = new Set<string>()
  const unique = (value: string) => { if (identifiers.has(value)) reject('CORRUPT_STORE', '存储包含重复标识。'); identifiers.add(value) }
  if (store.cards.filter(c => !c.archived).length > LIMITS.active) reject('CORRUPT_STORE', '存储活动卡片数量无效。')
  for (const c of store.cards) {
    unique(c.id)
    if (c.revision < c.versions.length || c.versions[0]!.reason !== 'create') reject('CORRUPT_STORE', '卡片版本关系无效。')
    for (const [index, v] of c.versions.entries()) {
      unique(v.id)
      if ((index > 0 && v.reason === 'create') || new Set(v.evidence.map(e => e.path)).size !== v.evidence.length || (v.reason !== 'review' && v.assessment !== 'unreviewed')
        || (v.reason === 'review' && (v.assessment === 'unreviewed' || !v.note.trim()))) reject('CORRUPT_STORE', '结论版本或依据无效。')
    }
    const latest = c.latestCheck
    if (!latest) continue
    unique(latest.checkId!)
    const bases = current(c).evidence
    const unknown = latest.files.filter(f => f.status === 'unknown').length
    if (latest.versionId !== current(c).id || latest.files.length !== bases.length
      || latest.freshness !== summarize(latest.files.map(f => f.status))
      || latest.coverage.totalFiles !== bases.length || latest.coverage.unknownFiles !== unknown
      || latest.coverage.checkedFiles !== bases.length - unknown) reject('CORRUPT_STORE', '检查结果与卡片版本不匹配。')
    for (let i = 0; i < bases.length; i++) {
      const f = latest.files[i]!, b = bases[i]!
      if (f.path !== b.path || (!['changed', 'unchanged'].includes(f.status) && (f.sha256 !== undefined || f.size !== undefined)) || (['changed', 'unchanged'].includes(f.status) && (f.sha256 === undefined || f.size === undefined
        || (f.status === 'unchanged') !== (f.sha256 === b.sha256)))) reject('CORRUPT_STORE', '逐文件检查结果无效。')
    }
  }
  return store
}
export interface LoadedStore { value: Store; target: FsTarget; observation: FsObservation }
export async function loadStore(env: Environment): Promise<LoadedStore> {
  const file = await target(env, '.dsh/recheck/cards.json', true)
  const before = await env.fs.stat(file, env.signal)
  if (!before) {
    observe(env, file, { kind: 'absent' })
    return { value: { schemaVersion: 1, storeRevision: 0, cards: [] }, target: file, observation: { kind: 'absent' } }
  }
  if (before.type !== 'file') reject('CORRUPT_STORE', '存储目标不是普通文件。')
  if (before.size !== undefined && before.size > LIMITS.storeBytes) reject('STORE_TOO_LARGE', '存储超过 8 MiB，原文件已保留。')
  const bytes = await env.fs.readBytes(file, env.signal, LIMITS.storeBytes)
  const after = await env.fs.stat(file, env.signal)
  if (!after || before.version !== after.version || (await target(env, '.dsh/recheck/cards.json', true)).targetKey !== file.targetKey)
    reject('REVISION_CONFLICT', '读取期间存储改变，请重试。', true)
  let json: unknown
  try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { reject('CORRUPT_STORE', '存储不是有效 UTF-8 JSON，原文件已保留。') }
  const value = validateStore(json)
  const observation: FsObservation = { kind: 'present', version: after.version }
  observe(env, file, observation)
  return { value, target: file, observation }
}
export async function saveStore(env: Environment, loaded: LoadedStore): Promise<void> {
  loaded.value.storeRevision++
  validateStore(loaded.value)
  const content = JSON.stringify(loaded.value, null, 2) + '\n'
  if (Buffer.byteLength(content, 'utf8') > LIMITS.storeBytes) reject('STORE_CAPACITY', '保存将超过 8 MiB；没有删除旧记录。')
  await guardedWrite(env, loaded.target, content, loaded.observation)
}
