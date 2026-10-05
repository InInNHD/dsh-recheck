// 文件新鲜度只能使用这五种字符串。
export type Freshness =
  | 'unchecked'
  | 'unchanged'
  | 'changed'
  | 'missing'
  | 'unknown'

// 复核意见独立于文件新鲜度。
export type Assessment =
  | 'unreviewed'
  | 'supported'
  | 'refuted'
  | 'uncertain'

export type CardSort = 'attention' | 'checked' | 'updated'
export interface CheckTarget { cardId: string; expectedRevision: number }

export const LIMITS = Object.freeze({ title: 120, claim: 2000, note: 4000, evidence: 8,
  active: 100, cards: 200, versions: 20, fileBytes: 2 * 1024 * 1024,
  storeBytes: 8 * 1024 * 1024, batchTargets: 200, batchBytes: 64 * 1024 * 1024, timeoutMs: 10_000 })

export interface Actor { kind: 'user' | 'agent'; sessionId: string }
export interface EvidenceIssue { index: number; code: string; message: string }
export interface Evidence { path: string; sha256: string; size: number; capturedAt: string }
export interface FileCheck {
  path: string; status: Exclude<Freshness, 'unchecked'>; observedAt: string
  sha256?: string; size?: number; reason?: string
}
export interface Check {
  checkId?: string; versionId: string; observedAt: string; persisted: boolean
  freshness: Exclude<Freshness, 'unchecked'>
  coverage: { totalFiles: number; checkedFiles: number; unknownFiles: number }
  files: FileCheck[]
}
export interface CardVersion {
  id: string; reason: 'create' | 'edit' | 'review'; claim: string
  assessment: Assessment; note: string; actor: Actor; createdAt: string; evidence: Evidence[]
}
export interface Card {
  id: string; title: string; revision: number; archived: boolean
  createdAt: string; updatedAt: string; versions: CardVersion[]; latestCheck?: Check
}
export interface Store { schemaVersion: 1; storeRevision: number; cards: Card[] }
export type Request =
  | { action: 'create'; title: string; claim: string; files: string[]; note?: string }
  | { action: 'list'; query?: string; archived?: boolean; needsAttention?: boolean; freshness?: Freshness; assessment?: Assessment; sort?: CardSort }
  | { action: 'get'; cardId: string; includeHistory?: boolean }
  | { action: 'edit'; cardId: string; expectedRevision: number; title?: string; claim?: string; files?: string[]; note?: string }
  | { action: 'check'; scope: 'card'; cardId: string; expectedRevision: number; persist?: boolean }
  | { action: 'check'; scope: 'all'; persist?: boolean }
  | { action: 'check'; scope: 'selected'; targets: CheckTarget[]; persist?: boolean }
  | { action: 'review'; cardId: string; expectedRevision: number; checkId: string; assessment: Exclude<Assessment, 'unreviewed'>; note: string }
  | { action: 'archive'; cardId: string; expectedRevision: number; archived: boolean }
  | { action: 'export'; cardId: string; includeHistory?: boolean; path?: string }
export type Response = { status: 'ok'; action: string; data: any }
  | { status: 'rejected'; action: string; reason: { code: string; message: string; retryable: boolean; evidenceIssues?: EvidenceIssue[] } }
