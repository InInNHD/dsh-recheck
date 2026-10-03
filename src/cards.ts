import { LIMITS, type Card, type Freshness, type Request, type Store } from './types.js'

export class RecheckError extends Error {
  constructor(public readonly code: string, message: string, public readonly retryable = false) { super(message) }
}
export function reject(code: string, message: string, retryable = false): never {
  throw new RecheckError(code, message, retryable)
}
export const current = (card: Card) => card.versions[card.versions.length - 1]!
export function summarize(statuses: Exclude<Freshness, 'unchecked'>[]): Exclude<Freshness, 'unchecked'> {
  return statuses.includes('missing') ? 'missing' : statuses.includes('changed') ? 'changed'
    : !statuses.length || statuses.includes('unknown') ? 'unknown' : 'unchanged'
}
export const freshness = (card: Card): Freshness => card.latestCheck?.freshness ?? 'unchecked'
export const needsAttention = (card: Card) => freshness(card) !== 'unchanged'
  || ['unreviewed', 'uncertain'].includes(current(card).assessment)
export function text(value: unknown, field: string, max: number, optional = false): string {
  if (typeof value !== 'string') reject('INVALID_INPUT', `${field}必须是字符串。`)
  const result = value.trim()
  if ((!optional && !result) || [...result].length > max) reject('INVALID_INPUT', `${field}长度不符合限制（最多 ${max} 个字符）。`)
  return result
}
// 拒绝路径别名和目录链接，比尝试接受无法证明安全的路径更可预测。
export function relativePath(value: unknown, internal = false): string {
  const path = text(value, '文件路径', 1024).replaceAll('\\', '/')
  const parts = path.split('/')
  if (path.startsWith('/') || /[:\x00-\x1f\x7f]/.test(path) || parts.some(p => !p || p === '.' || p === '..'
    || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) reject('INVALID_PATH', '请使用不含上级目录、设备名或绝对路径的项目相对文件路径。')
  if (!internal && (path.toLowerCase() === '.dsh/recheck' || path.toLowerCase().startsWith('.dsh/recheck/')))
    reject('INVALID_PATH', '不能把 Recheck 自身存储用作依据或导出目标。')
  return path
}
export function files(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > LIMITS.evidence) reject('INVALID_INPUT', '依据文件必须为 1–8 个。')
  const result = value.map(p => relativePath(p))
  if (new Set(result).size !== result.length) reject('INVALID_INPUT', '依据路径不能重复。')
  return result
}
const fields: Record<string, string[]> = {
  create: ['title', 'claim', 'files', 'note'], list: ['query', 'archived', 'needsAttention', 'freshness'],
  get: ['cardId', 'includeHistory'], edit: ['cardId', 'expectedRevision', 'title', 'claim', 'files', 'note'],
  check: ['scope', 'cardId', 'expectedRevision', 'persist'], review: ['cardId', 'expectedRevision', 'checkId', 'assessment', 'note'],
  archive: ['cardId', 'expectedRevision', 'archived'], export: ['cardId', 'includeHistory', 'path'],
}
export function parseRequest(input: unknown): Request {
  if (!input || typeof input !== 'object' || Array.isArray(input)) reject('INVALID_INPUT', '请求必须是 JSON 对象。')
  const r = { ...input } as Record<string, unknown>
  if (typeof r.action !== 'string' || !Object.hasOwn(fields, r.action)) reject('INVALID_INPUT', 'action 不受支持。')
  if (Object.keys(r).some(k => k !== 'action' && !fields[r.action as string]!.includes(k))) reject('INVALID_INPUT', '请求包含未知或不适用字段。')
  for (const k of ['persist', 'archived', 'needsAttention', 'includeHistory']) {
    if (r[k] !== undefined && typeof r[k] !== 'boolean') reject('INVALID_INPUT', `${k}必须为布尔值。`)
  }
  if (['get', 'edit', 'review', 'archive', 'export'].includes(r.action) || (r.action === 'check' && r.scope === 'card'))
    r.cardId = text(r.cardId, 'cardId', 128)
  if (['edit', 'review', 'archive'].includes(r.action) || (r.action === 'check' && r.scope === 'card')) {
    if (!Number.isSafeInteger(r.expectedRevision) || (r.expectedRevision as number) < 1) reject('INVALID_INPUT', 'expectedRevision 必须是正整数。')
  }
  if (r.action === 'create' || r.title !== undefined) r.title = text(r.title, '标题', LIMITS.title)
  if (r.action === 'create' || r.claim !== undefined) r.claim = text(r.claim, '结论', LIMITS.claim)
  if (r.action === 'create' || r.files !== undefined) r.files = files(r.files)
  if (r.note !== undefined) r.note = text(r.note, '说明', LIMITS.note, true)
  if (r.query !== undefined) r.query = text(r.query, '搜索', LIMITS.claim, true)
  if (r.path !== undefined) r.path = relativePath(r.path)
  if (r.freshness !== undefined && !['unchecked', 'unchanged', 'changed', 'missing', 'unknown'].includes(String(r.freshness))) reject('INVALID_INPUT', '新鲜度值无效。')
  if (r.action === 'check') {
    if (!['card', 'all'].includes(String(r.scope))) reject('INVALID_INPUT', 'scope 必须是 card 或 all。')
    if (r.scope === 'all' && (r.cardId !== undefined || r.expectedRevision !== undefined)) reject('INVALID_INPUT', '批量检查不能指定卡片或 revision。')
  }
  if (r.action === 'edit' && r.title === undefined && r.claim === undefined && r.files === undefined) reject('INVALID_INPUT', '编辑至少提供一个可修改字段。')
  if (r.action === 'review') {
    r.checkId = text(r.checkId, 'checkId', 128)
    r.note = text(r.note, '复核说明', LIMITS.note)
    if (!['supported', 'refuted', 'uncertain'].includes(String(r.assessment))) reject('INVALID_INPUT', '请选择支持、否定或不确定。')
  }
  if (r.action === 'archive' && typeof r.archived !== 'boolean') reject('INVALID_INPUT', '归档操作必须指定 archived。')
  return r as unknown as Request
}
export function findCard(store: Store, id: string, revision?: number): Card {
  const card = store.cards.find(c => c.id === id)
  if (!card) reject('CARD_NOT_FOUND', '卡片不存在。')
  if (revision !== undefined && card.revision !== revision) reject('REVISION_CONFLICT', '卡片已更新，请重新读取后提交。', true)
  return card
}
