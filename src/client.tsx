import React, { useEffect, useId, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { LIMITS, type Assessment, type Card, type CardSort, type Check, type CheckTarget, type EvidenceIssue, type Freshness, type Request, type Response } from './types.js'
import { freshness, current, evidenceFailure, evidenceIssues, evidenceLines, orderCards, relativePath, text } from './cards.js'
import { styles } from './client-styles.js'
import { pluginVersion, supportedHosts, guidance, type DiagnosticInfo } from './diagnostic-info.js'

// 小型线框图标与宿主工具栏保持一致，不引入额外图标依赖。
function Icon({ name }: { name: 'box' | 'plus' | 'refresh' | 'folder' | 'search' | 'arrow' | 'info' }) {
  const paths = {
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10M8 5l8 4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" /></>,
    folder: <path d="M3 7V5h6l2 2h10v12H3V7Z" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Counter({ value, limit }: { value: string; limit: number }) {
  // 与服务端一致，按 Unicode code point 计数，emoji 不按 UTF-16 长度算两个。
  const count = [...value].length
  return <span className="rc-count" data-over={count > limit}>{count.toLocaleString()} / {limit.toLocaleString()}</span>
}

const copy = {
  fresh: { unchecked: '尚未检查', unchanged: '依据未变化', changed: '依据已变化', missing: '依据缺失', unknown: '检查未知' },
  opinion: { unreviewed: '尚未复核', supported: '支持', refuted: '否定', uncertain: '不确定' },
  limitation: '文件状态表示观察时的字节变化，不证明结论正确。多个文件分别读取，不构成项目快照。',
} as const
type Summary = { cardId: string; versionId: string; title: string; revision: number; archived: boolean; claim: string; freshness: Freshness;
  assessment: Assessment; needsAttention: boolean; evidenceCount: number; updatedAt: string; observedAt?: string; actor: { kind: string } }
type Listing = { workspace: { id: string; name: string; writable: boolean }; capabilities?: string[]; counts: { active: number; archived: number; total: number; needsAttention: number }; cards: Summary[] }
type Form = { mode: 'create' | 'edit' | 'review'; cardId?: string; expectedRevision?: number; checkId?: string;
  title: string; claim: string; files: string; note: string; assessment: '' | Exclude<Assessment, 'unreviewed'> }
type Props = { sessionId: string; call: (request: Request, signal: AbortSignal) => Promise<Response>; diagnose: (signal: AbortSignal) => Promise<DiagnosticInfo>; navigate: (id: string, signal: AbortSignal) => Promise<void> }
// 草稿只保存在本次客户端内存中，以宿主返回的项目身份隔离。
const drafts = new Map<string, Form>()
function Stamp({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  return <span className="rc-stamp"><time dateTime={value}>{new Date(value).toLocaleString('zh-CN')}</time>{' '}
    <button type="button" aria-expanded={expanded} aria-label={`展开时间详情 ${value}`} onClick={() => setExpanded(!expanded)}>UTC</button>
    {expanded && <small>{value}（UTC）；本地时区 {Intl.DateTimeFormat().resolvedOptions().timeZone}</small>}
  </span>
}
const stamp = (s?: string) => s ? <Stamp value={s} /> : '—'
const empty = (): Form => ({ mode: 'create', title: '', claim: '', files: '', note: '', assessment: '' })
function Badge({ status, assessment }: { status: Freshness; assessment: Assessment }) {
  return <p className="rc-badges"><strong className="rc-badge" data-state={status}>{copy.fresh[status]}</strong>{' · '}
    <span className="rc-badge">复核意见：{copy.opinion[assessment]}</span></p>
}
function ReviewSteps({ checked, read, opinion, saved }: { checked: boolean; read: boolean; opinion: boolean; saved: boolean }) {
  return <ol className="rc-review-steps" aria-label="复核步骤">{['检查依据', '阅读依据', '选择意见', '保存记录'].map((label, index) => <li key={label} data-complete={[checked, read, opinion, saved][index]}>{index + 1}. {label}{[checked, read, opinion, saved][index] ? ' ✓' : ''}</li>)}</ol>
}
function fileReason(code: string): string {
  return code === 'TIME_BUDGET' ? '检查时间预算已耗尽，请缩小范围后重试。'
    : code === 'READ_BUDGET' ? '本次文件数量或字节预算已耗尽，请缩小范围。' : evidenceFailure(code).message
}
function Panel(props: Props) {
  const fieldId = useId()
  const [list, setList] = useState<Listing>(), [card, setCard] = useState<Card>()
  const [archived, setArchived] = useState(false), [query, setQuery] = useState('')
  const [attention, setAttention] = useState(false), [filter, setFilter] = useState('')
  const [opinion, setOpinion] = useState(''), [sort, setSort] = useState<CardSort>('attention')
  const [selected, setSelected] = useState<CheckTarget[]>([]), [readConfirmed, setReadConfirmed] = useState(false)
  const [batchRows, setBatchRows] = useState<{ cardId: string; title: string; outcome: string; saved: boolean; reason?: { code: string; message: string } }[]>([])
  const [form, setForm] = useState<Form>(), [preview, setPreview] = useState(''), [outputPath, setOutputPath] = useState('')
  const [fullHistory, setFullHistory] = useState(false), [temporary, setTemporary] = useState<Check>()
  const [temporaryBatch, setTemporaryBatch] = useState<Record<string, Check>>({})
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [diagnostic, setDiagnostic] = useState<DiagnosticInfo>(), [diagnosticText, setDiagnosticText] = useState('')
  const running = useRef(false)
  const [fileErrors, setFileErrors] = useState<EvidenceIssue[]>([])
  const formElement = useRef<HTMLFormElement>(null), composing = useRef(false)
  const invalidField = useRef<{ name: string; index?: number }>()
  const requests = useRef(new Set<AbortController>()), mounted = useRef(true), workspace = useRef<string>()
  const focusError = useRef<HTMLParagraphElement>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; for (const request of requests.current) request.abort() } }, [])
  function focusField(name: string, index?: number) {
    const control = formElement.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
    if (!control) { focusError.current?.focus(); return }
    control.focus()
    if (name === 'files' && index !== undefined && control instanceof HTMLTextAreaElement) {
      const lines = control.value.split('\n'), start = lines.slice(0, index).reduce((n, line) => n + line.length + 1, 0)
      control.setSelectionRange(start, start + (lines[index]?.length ?? 0))
    }
  }
  useEffect(() => { if (error && !busy) { const field = invalidField.current; field ? focusField(field.name, field.index) : focusError.current?.focus() } }, [error, busy])
  useEffect(() => { setFileErrors([]) }, [form?.files, form?.mode])
  useEffect(() => { setSelected([]) }, [archived, query, attention, filter, opinion, sort])
  useEffect(() => { setReadConfirmed(false) }, [card?.id, card?.latestCheck?.checkId])
  useEffect(() => {
    if (workspace.current) { if (form) drafts.set(workspace.current, form); else drafts.delete(workspace.current) }
  }, [form])
  async function call(request: Request) {
    const controller = new AbortController(); requests.current.add(controller)
    try {
      const result = await props.call(request, controller.signal)
      controller.signal.throwIfAborted()
      if (!mounted.current) throw new DOMException('会话已切换', 'AbortError')
      if (result.status === 'rejected') {
        if (result.reason.evidenceIssues?.length) {
          setFileErrors(result.reason.evidenceIssues); invalidField.current = { name: 'files', index: result.reason.evidenceIssues[0]!.index }
        }
        throw new Error(`${result.reason.message}（${result.reason.code}） ${guidance(result.reason.code)}`)
      }
      return result.data
    } finally { requests.current.delete(controller) }
  }
  async function refresh() {
    const value: Listing = await call({ action: 'list', archived })
    setList(value)
    setSelected([])
    setTemporaryBatch(old => Object.fromEntries(Object.entries(old).filter(([id, check]) => value.cards.some(c => c.cardId === id && c.versionId === check.versionId))))
    if (workspace.current !== value.workspace.id) {
      workspace.current = value.workspace.id
      const draft = drafts.get(value.workspace.id)
      if (draft) { setForm(draft); setMessage('已恢复本项目的内存草稿；提交前请核对卡片及 revision。') }
    }
  }
  async function run(fn: () => Promise<void>) {
    if (running.current) return
    running.current = true
    invalidField.current = undefined
    setBusy(true); setError(''); setMessage('')
    try { await fn() } catch (e) {
      if (mounted.current && !(e instanceof Error && e.name === 'AbortError')) setError(e instanceof Error ? e.message : '操作失败。')
    } finally { running.current = false; if (mounted.current) setBusy(false) }
  }
  async function diagnose() {
    const controller = new AbortController(); requests.current.add(controller)
    setDiagnostic(undefined); setDiagnosticText('')
    try {
      const value = await props.diagnose(controller.signal)
      controller.signal.throwIfAborted()
      if (!mounted.current) throw new DOMException('会话已切换', 'AbortError')
      setDiagnostic(value)
      setDiagnosticText(JSON.stringify({ clientPluginVersion: pluginVersion, ...value }, null, 2))
    } finally { requests.current.delete(controller) }
  }
  useEffect(() => { void run(refresh) }, [archived])
  const canWrite = list?.workspace.writable === true
  const canCreate = canWrite && !!list && list.counts.active < 100 && list.counts.total < 200
  const observed = card && temporary?.versionId === current(card).id ? temporary : card?.latestCheck
  const completeSavedCheck = card && !temporary && card.latestCheck?.checkId
    && card.latestCheck.versionId === current(card).id
    && card.latestCheck.files.every(f => f.status === 'changed' || f.status === 'unchanged')
  const reviewAllowed = canWrite && card && !card.archived && completeSavedCheck
  const reviewedEvidence = card && completeSavedCheck && observed?.freshness === 'unchanged' && current(card).reason === 'review'
  const supportsSelected = list?.capabilities?.includes('selectedCheck') === true
  const displayedFileErrors = fileErrors.length ? fileErrors : form?.files ? evidenceIssues(evidenceLines(form.files)) : []
  const visible = orderCards(list?.cards.map(c => {
    const candidate = temporaryBatch[c.cardId]
    const observed = candidate?.versionId === c.versionId ? candidate : undefined
    return observed ? { ...c, observedAt: observed.observedAt, freshness: observed.freshness, needsAttention: observed.freshness !== 'unchanged' || ['unreviewed', 'uncertain'].includes(c.assessment) } : c
  }).filter(c => (!query || (c.title + '\n' + c.claim).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    && (!attention || c.needsAttention) && (!filter || c.freshness === filter) && (!opinion || c.assessment === opinion)) ?? [], sort)
  const change = (patch: Partial<Form>) => setForm(old => old ? { ...old, ...patch } : old)
  function clearTemporary(id?: string) {
    setTemporary(undefined)
    setTemporaryBatch(old => id ? Object.fromEntries(Object.entries(old).filter(([key]) => key !== id)) : {})
  }
  async function open(id: string, allowTemporary = true) {
    const value: Card = await call({ action: 'get', cardId: id, includeHistory: true })
    setCard(value)
    const saved = allowTemporary ? temporaryBatch[id] : undefined
    setTemporary(saved?.versionId === current(value).id ? saved : undefined)
    if (saved && saved.versionId !== current(value).id) clearTemporary(id)
    setPreview('')
  }
  async function check(scope: 'card' | 'all' | 'selected' = 'card') {
    const titles = new Map(list?.cards.map(c => [c.cardId, c.title]))
    const result = await call(scope === 'selected' ? { action: 'check', scope, targets: selected, persist: canWrite }
      : scope === 'all' ? { action: 'check', scope, persist: canWrite }
      : { action: 'check', scope: 'card', cardId: card!.id, expectedRevision: card!.revision, persist: canWrite })
    if (result.persisted) clearTemporary(scope === 'card' ? card!.id : undefined)
    const savedCount = result.counts.saved ?? (result.persisted ? result.counts.checked : 0)
    setMessage(`${savedCount ? '检查结果已保存' : '本次检查结果未保存'}：完成 ${result.counts.checked} 张，保存 ${savedCount} 张，冲突 ${result.counts.conflict} 张，错误 ${result.counts.error} 张，未知依据 ${result.counts.unknownFiles} 个。`)
    if (scope !== 'card') setBatchRows(result.results.map((r: any) => ({ cardId: r.cardId, title: titles.get(r.cardId) ?? r.cardId, outcome: r.outcome, saved: r.saved ?? (result.persisted && r.outcome === 'checked'), reason: r.reason })))
    if (!canWrite && scope !== 'card') setTemporaryBatch(old => ({ ...old, ...Object.fromEntries(result.results.filter((r: any) => r.outcome === 'checked').map((r: any) => [r.cardId, r])) }))
    if (scope === 'card' && card) {
      if (canWrite) await open(card.id, false)
      else setTemporary(result.results.find((r: any) => r.cardId === card.id && r.outcome === 'checked'))
    }
    await refresh()
  }
  function edit() {
    const v = current(card!)
    setForm({ mode: 'edit', cardId: card!.id, expectedRevision: card!.revision, title: card!.title, claim: v.claim,
      files: v.evidence.map(e => e.path).join('\n'), note: '', assessment: '' })
  }
  function review() { setReadConfirmed(false); setForm({ ...empty(), mode: 'review', cardId: card!.id, expectedRevision: card!.revision, checkId: card!.latestCheck!.checkId }) }
  async function submit() {
    if (!form) return
    const f = form
    function validate(name: string, value: string, label: string, limit: number, optional = false) {
      try { text(value, label, limit, optional) } catch (error) { invalidField.current = { name }; throw error }
    }
    let files: string[] = []
    if (f.mode !== 'review') {
      validate('title', f.title, '标题', LIMITS.title); validate('claim', f.claim, '结论', LIMITS.claim)
      const lines = evidenceLines(f.files), issues = evidenceIssues(lines)
      setFileErrors(issues)
      if (issues.length) { invalidField.current = { name: 'files', index: issues[0]!.index }; throw new Error('请修正依据文件中标出的条目，所有输入已保留。') }
      files = lines.map(path => relativePath(path))
    }
    const changed = f.mode === 'edit' && card && (f.claim.trim() !== current(card).claim || JSON.stringify(files) !== JSON.stringify(current(card).evidence.map(e => e.path)))
    validate('note', f.note, f.mode === 'review' ? '复核说明' : '说明', LIMITS.note, f.mode !== 'review' && !changed)
    let req: Request
    if (f.mode === 'create') req = { action: 'create', title: f.title, claim: f.claim, files, note: f.note }
    else if (f.mode === 'edit') req = { action: 'edit', cardId: f.cardId!, expectedRevision: f.expectedRevision!, title: f.title, claim: f.claim, files, note: f.note }
    else {
      if (!readConfirmed) { invalidField.current = { name: 'readConfirmed' }; throw new Error('请先阅读本次检查对应的依据文件，再确认已阅读。') }
      if (!f.assessment) { invalidField.current = { name: 'assessment' }; throw new Error('请主动选择复核意见。') }
      req = { action: 'review', cardId: f.cardId!, expectedRevision: f.expectedRevision!, checkId: f.checkId!, assessment: f.assessment, note: f.note }
    }
    const value = await call(req)
    setCard(value); setForm(undefined); clearTemporary(value.id); setPreview(''); await refresh()
    setMessage('已保存。')
  }
  async function navigate(id: string) {
    const controller = new AbortController(); requests.current.add(controller)
    try { await props.navigate(id, controller.signal) } finally { requests.current.delete(controller) }
  }
  async function exportCard(path?: string) {
    const value = await call({ action: 'export', cardId: card!.id, includeHistory: fullHistory, ...(path ? { path } : {}) })
    setPreview(value.markdown)
    if (value.written) setMessage(`已写入新文件：${value.path}`)
  }
  async function archive() {
    const value = await call({ action: 'archive', cardId: card!.id, expectedRevision: card!.revision, archived: !card!.archived })
    setCard(value); clearTemporary(value.id); await refresh(); setMessage(value.archived ? '已归档，历史保留。可点击“恢复”。' : '已恢复，请重新检查依据。')
  }
  return <section className="recheck" aria-label="Recheck 结论保鲜盒" aria-busy={busy}>
    <style>{styles}</style>
    <div className="rc-body">
    <header className="rc-header">
      <div className="rc-brand"><span className="rc-logo"><Icon name="box" /></span><div><h2>Recheck</h2><p className="rc-subtitle">结论保鲜盒</p></div></div>
      <div className="rc-actions">
        <button className="rc-ghost rc-icon" aria-label="刷新列表" title="刷新列表" disabled={busy} onClick={() => void run(refresh)}><Icon name="refresh" /></button>
        {!form && !card && <button className="rc-primary" disabled={busy || !canCreate} onClick={() => setForm(empty())}><Icon name="plus" />新建卡片</button>}
      </div>
    </header>
    <div className="rc-project"><Icon name="folder" /><p>当前项目：{list?.workspace.name ?? (error ? '尚未连接到有效工作区' : '正在读取工作区…')}{list && !canWrite ? ' · 只读' : ''}</p></div>
    <details className="rc-diagnostics"><summary>版本与诊断</summary>
      <p className="rc-muted">客户端加载版本：{pluginVersion}<br />支持的宿主：{supportedHosts.join('、')}</p>
      <button disabled={busy} onClick={() => void run(diagnose)}>读取诊断</button>
      {diagnostic && <>
        <p>Host 加载版本：{diagnostic.hostPluginVersion}<br />宿主包版本：{diagnostic.hostPackageVersion ?? '无法读取'}<br />安装版本：{diagnostic.installedPluginVersion ?? '无法读取'}<br />运行配置（profile）：无法读取</p>
        <p className="rc-muted">宿主包版本来自运行时包解析器。安装后尚未加载的版本请在宿主插件管理页核对；更新后完全重启客户端。</p>
        {diagnostic.hostPluginVersion !== pluginVersion && <p className="rc-notice" role="alert">客户端与 Host 版本不一致。保存当前工作后完全重启客户端；不要重复提交未确认的操作。</p>}
        {diagnostic.installedPluginVersion && diagnostic.installedPluginVersion !== diagnostic.hostPluginVersion && <p className="rc-notice" role="alert">安装版本尚未在 Host 生效，请保存当前工作并完全重启客户端。</p>}
        {diagnostic.hostPackageVersion && !diagnostic.supportedHosts.includes(diagnostic.hostPackageVersion) && <p className="rc-notice">此宿主版本未列入兼容清单，请使用已验证组合。</p>}
        <p>会话写入策略：{diagnostic.access === 'read-only' ? '只读' : diagnostic.access === 'write-permitted' ? '允许写入（仍受文件权限约束）' : '无法读取'}<br />支持的数据格式：schema {diagnostic.supportedSchema}<br />存储状态：{diagnostic.storage === 'valid' ? '结构校验通过（schema 1）' : diagnostic.storage === 'absent' ? '尚未创建数据文件' : '无法读取或校验'}</p>
        {diagnostic.reasonCode && <p className="rc-notice">{diagnostic.reasonCode}：{guidance(diagnostic.reasonCode)}</p>}
        <textarea aria-label="诊断摘要" readOnly rows={5} value={diagnosticText} />
        <button disabled={busy} onClick={() => void run(async () => { try { await navigator.clipboard.writeText(diagnosticText); setMessage('诊断摘要已复制。') } catch { setMessage('无法自动复制，请在诊断摘要中手动选择并复制。') } })}>复制诊断摘要</button>
        <p className="rc-muted">摘要不包含项目路径、会话身份、卡片或依据正文。权限和存储状态仅代表本次读取，可重新读取更新。</p>
      </>}
    </details>
    <p className="rc-notice" role="alert" tabIndex={-1} ref={focusError} hidden={!error}>{error}</p>
    <p className="rc-notice" role="status" aria-live="polite">{message}</p>
    {busy && <button className="rc-cancel" onClick={() => { for (const request of requests.current) request.abort(); setMessage('取消已发出；如果提交已完成，请刷新确认实际保存结果。') }}>取消当前操作</button>}
    {form ? <form ref={formElement} noValidate onCompositionStart={() => { composing.current = true }} onCompositionEnd={() => { composing.current = false }}
      onKeyDown={e => { if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault() }}
      onSubmit={e => { e.preventDefault(); if (!composing.current) void run(submit) }}><fieldset className="rc-form-fields" disabled={busy}>
      <div className="rc-form-heading"><h3>{form.mode === 'create' ? '新建卡片' : form.mode === 'edit' ? '编辑卡片' : '记录复核'}</h3>
        <p className="rc-muted">{form.mode === 'review' ? '阅读依据后，记录你对这条结论的判断。' : '收藏一条结论，绑定下次需要检查的文件。'}</p></div>
      <div className="rc-draft"><Icon name="info" /><p>草稿仅保存在本客户端内存中，切换会话可恢复；刷新或关闭会丢失。</p></div>
      {form.cardId && <>
        <p className="rc-muted">草稿引用 revision：{form.expectedRevision}。{card ? `当前读到 revision：${card.revision}。` : ''}</p>
        <button type="button" disabled={busy} onClick={() => void run(async () => { await open(form.cardId!); setMessage('已重新读取卡片；草稿内容与提交 revision 保留，请核对后决定。') })}>重新读取卡片（保留草稿）</button>
        {form.mode === 'edit' && card?.id === form.cardId && card.revision !== form.expectedRevision && <button type="button" disabled={busy} onClick={() => change({ expectedRevision: card.revision })}>采用当前 revision 并保留输入</button>}
      </>}
      {form.mode !== 'review' ? <>
        <section className="rc-form-section" aria-label="基本信息"><h4>基本信息</h4>
          <div className="rc-field"><div className="rc-field-head"><label htmlFor={`${fieldId}-title`}>标题<span className="rc-required" aria-hidden="true">*</span></label><Counter value={form.title} limit={120} /></div>
            <input name="title" id={`${fieldId}-title`} aria-label="标题（最多 120 字符）" value={form.title} onChange={e => change({ title: e.target.value })} required placeholder="例如：重试不会重复扣款" /></div>
          <div className="rc-field"><div className="rc-field-head"><label htmlFor={`${fieldId}-claim`}>结论<span className="rc-required" aria-hidden="true">*</span></label><Counter value={form.claim} limit={2000} /></div>
            <textarea name="claim" id={`${fieldId}-claim`} aria-label="结论（最多 2,000 字符）" aria-describedby={`${fieldId}-claim-help`} value={form.claim} onChange={e => change({ claim: e.target.value })} required rows={4} placeholder="写下明确、可复核的项目结论…" />
            <p className="rc-muted" id={`${fieldId}-claim-help`}>写清适用条件，方便日后结合依据重新判断。</p></div>
        </section>
        <section className="rc-form-section" aria-label="依据文件"><h4>依据文件<span className="rc-required" aria-hidden="true">*</span></h4>
          <textarea name="files" className="rc-file-input" aria-label="依据文件（项目相对路径，每行一个，1–8 个）" aria-invalid={displayedFileErrors.length > 0} aria-describedby={`${fieldId}-files-help ${fieldId}-files-errors`} value={form.files} onChange={e => change({ files: e.target.value })} required rows={3} placeholder={'src/payment.ts\ntests/retry.test.ts'} />
          <p className="rc-muted" id={`${fieldId}-files-help`}>项目相对路径，每行一个，需填写 1–8 个文件。保存时捕获内容指纹。</p>
          <ul className="rc-file-errors" id={`${fieldId}-files-errors`} aria-label="依据逐项反馈">{displayedFileErrors.map(issue => <li key={`${issue.index}-${issue.code}`}><button type="button" onClick={() => focusField('files', issue.index)}>第 {issue.index + 1} 行</button>：{issue.message}</li>)}</ul>
          <details><summary>如何填写依据路径</summary><p className="rc-muted">从项目根目录开始填写，例如 src/支付 重试.ts；可逐行粘贴，删除中间空行。路径格式通过不代表文件可读，保存时仍会重新读取完整内容。当前宿主的附件上传入口不用于选择项目依据。</p></details>
        </section>
        {form.mode === 'edit' && <p className="rc-notice">仅改标题保留原意见。修改结论或依据会建立新版本，重置意见与检查；变更说明必填。</p>}
      </> : <>
        <ReviewSteps checked={!!reviewAllowed && form.checkId === card?.latestCheck?.checkId && form.expectedRevision === card?.revision} read={readConfirmed} opinion={!!form.assessment} saved={false} />
        <p className="rc-notice">将记录为用户复核。引用检查：{form.checkId}；revision：{form.expectedRevision}。<br />观察时间：{stamp(card?.latestCheck?.observedAt)} · 依据 {card ? current(card).evidence.length : '—'} 个。保存前将重新读取依据。</p>
        <p className="rc-muted">请在编辑器中阅读本次检查的文件：{card ? current(card).evidence.map(e => e.path).join('、') : '请先重新读取卡片核对依据。'}。勾选确认不代表结论已被自动验证。</p>
        <label className="rc-checkbox"><input name="readConfirmed" type="checkbox" checked={readConfirmed} onChange={e => setReadConfirmed(e.target.checked)} />我已阅读本次检查对应的依据文件</label>
        {fileErrors.length > 0 && <ul className="rc-file-errors">{fileErrors.map(issue => <li key={issue.index}>第 {issue.index + 1} 个依据{card ? `（${current(card).evidence[issue.index]?.path ?? ''}）` : ''}：{issue.message}</li>)}</ul>}
        <section className="rc-form-section"><label>复核意见<select name="assessment" aria-label="复核意见" required value={form.assessment} onChange={e => change({ assessment: e.target.value as Form['assessment'] })}>
          <option value="">请选择…</option><option value="supported">支持</option><option value="refuted">否定</option><option value="uncertain">不确定</option>
        </select></label></section>
      </>}
      <section className="rc-form-section"><div className="rc-field-head"><label htmlFor={`${fieldId}-note`}>{form.mode === 'create' ? '补充说明（可选）' : form.mode === 'edit' ? '变更说明' : '复核说明（必填）'}</label><Counter value={form.note} limit={4000} /></div>
        <textarea name="note" id={`${fieldId}-note`} aria-label={form.mode === 'create' ? '初始说明（可选）' : form.mode === 'edit' ? '变更说明' : '复核说明（必填）'} value={form.note} onChange={e => change({ note: e.target.value })} required={form.mode === 'review'} rows={3} placeholder={form.mode === 'create' ? '记录背景、适用范围或待验证的问题…' : '说明本次变更或判断的理由…'} />
      </section>
      <footer className="rc-form-footer"><p className="rc-muted rc-footer-note">保存失败或发生冲突时，输入会保留。</p><div className="rc-actions">
        <button type="button" disabled={busy} onClick={() => setForm(undefined)}>放弃草稿</button>
        <button className="rc-primary" type="submit" disabled={busy || !canWrite}>保存</button>
      </div></footer>
    </fieldset></form> : card ? <div className="rc-detail">
      <div className="rc-actions"><button className="rc-ghost" disabled={busy} onClick={() => { setCard(undefined); setTemporary(undefined); setPreview('') }}>← 返回列表</button>
      <button disabled={busy} onClick={() => void run(() => open(card.id))}>重新读取卡片</button>
      </div>
      <h3>{card.title}{card.archived ? '（已归档）' : ''}</h3>
      <Badge status={observed?.freshness ?? freshness(card)} assessment={current(card).assessment} />
      <ReviewSteps checked={!!completeSavedCheck} read={!!reviewedEvidence} opinion={!!reviewedEvidence} saved={!!reviewedEvidence} />
      <p className="rc-muted">步骤表示当前依据对应的复核进度；上方保留已有版本的意见。再次复核需重新阅读并主动选择。</p>
      {temporary && <p><strong>临时观察，未保存；不能引用本次结果复核。</strong></p>}
      <p>当前版本：{current(card).id}<br />revision：{card.revision}<br />上次观察：{stamp(observed?.observedAt)}</p>
      <p className="rc-claim">{current(card).claim}</p>
      <p>意见来源：{current(card).actor.kind === 'user' ? '用户' : 'Agent'} · {stamp(current(card).createdAt)}<br />会话：{current(card).actor.sessionId}</p>
      <button disabled={busy} onClick={() => void run(() => navigate(current(card).actor.sessionId))}>打开此版本来源会话</button>
      <p className="rc-muted">定位到记录此版本的会话，不定位到原始论据消息。仅修改标题不会改变版本来源。</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>说明：{current(card).note || '（无）'}</p>
      <h4>依据文件</h4>
      {current(card).evidence.map(e => {
        const f = observed?.files.find(f => f.path === e.path)
        return <article key={e.path} data-state={f?.status}><strong>{e.path}</strong><p>{copy.fresh[f?.status ?? 'unchecked']}{f?.reason ? ` · ${fileReason(f.reason)}` : ''}</p>
          <p>基线捕获：{stamp(e.capturedAt)}<br />本次观察：{stamp(f?.observedAt)}</p>
          <details><summary>指纹与字节详情</summary><pre>基线 SHA-256：{e.sha256}{'\n'}基线字节：{e.size}{'\n'}当前 SHA-256：{f?.sha256 ?? '未获得'}{'\n'}当前字节：{f?.size ?? '未获得'}</pre></details>
        </article>
      })}
      {observed && <p>覆盖 {observed.coverage.checkedFiles}/{observed.coverage.totalFiles} 个依据；未知 {observed.coverage.unknownFiles} 个。</p>}
      <div className="rc-actions"><button className="rc-primary" disabled={busy || card.archived} onClick={() => void run(() => check())}>{canWrite ? '检查依据并保存' : '临时检查依据'}</button>
      <button disabled={busy || !canWrite || card.archived} onClick={edit}>编辑</button>
      <button disabled={busy || !reviewAllowed} onClick={review}>记录复核</button>
      </div>
      {!reviewAllowed && !card.archived && <p>复核需要当前版本最近保存的完整检查；缺失或未知的依据必须先处理。</p>}
      <button disabled={busy || !canWrite} onClick={() => void run(archive)}>{card.archived ? '恢复' : '归档'}</button>
      <p>{copy.limitation}</p>
      <details><summary>历史版本（{card.versions.length}）</summary>{card.versions.map((v, i) => <article key={v.id}>
        <h4>v{i + 1} · {copy.opinion[v.assessment]} · {v.reason}</h4><p>{v.id}<br />{v.actor.kind} · {stamp(v.createdAt)}<br />来源会话：{v.actor.sessionId}</p>
        <button disabled={busy} onClick={() => void run(() => navigate(v.actor.sessionId))}>打开 v{i + 1} 来源会话</button>
        <p style={{ whiteSpace: 'pre-wrap' }}>{v.claim}</p><p style={{ whiteSpace: 'pre-wrap' }}>{v.note}</p>
        {v.evidence.map(e => <pre key={e.path}>{e.path}{'\n'}{e.sha256}{'\n'}{e.size} 字节 · {stamp(e.capturedAt)}</pre>)}
      </article>)}</details>
      <fieldset><legend>Markdown 导出</legend>
        <label className="rc-checkbox"><input type="checkbox" checked={fullHistory} onChange={e => { setFullHistory(e.target.checked); setPreview('') }} />包含完整历史</label>
        <button disabled={busy} onClick={() => void run(() => exportCard())}>生成预览</button>
        {preview && <>
          <label>导出文本<textarea readOnly value={preview} rows={16} /></label>
          <button disabled={busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(preview); setMessage('已复制 Markdown。') })}>复制 Markdown</button>
          <label>新文件的项目相对路径<input value={outputPath} onChange={e => setOutputPath(e.target.value)} placeholder={`recheck-${card.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.md`} /></label>
          <button disabled={busy || !canWrite || !outputPath.trim()} onClick={() => void run(() => exportCard(outputPath.trim()))}>写入以上新文件（不覆盖）</button>
        </>}
      </fieldset>
    </div> : <>
      {list && (list.counts.active >= 100 || list.counts.total >= 200) && <p className="rc-notice">已达到卡片容量上限。活动上限 100 张，总量上限 200 张；现有记录会保留。</p>}
      {list && !canWrite && <p className="rc-notice">当前项目为只读：可以查看、导出预览和临时检查；创建及保存需切换到可写模式。</p>}
      <div className="rc-overview" aria-label="卡片统计">
        <div className="rc-stat" aria-label={`活动 ${list?.counts.active ?? 0}/100`}><span>活动卡片</span><strong>{list?.counts.active ?? '—'}<small>/ 100</small></strong></div>
        <div className="rc-stat" aria-label={`需要关注 ${list?.counts.needsAttention ?? 0}`}><span>需要关注</span><strong>{list?.counts.needsAttention ?? '—'}</strong></div>
        <div className="rc-stat" aria-label={`已归档 ${list?.counts.archived ?? 0}`}><span>已归档</span><strong>{list?.counts.archived ?? '—'}</strong></div>
      </div>
      <div className="rc-toolbar">
        <div className="rc-tabs" role="group" aria-label="卡片范围"><button disabled={busy} aria-pressed={!archived} onClick={() => setArchived(false)}>活动卡片</button><button disabled={busy} aria-pressed={archived} onClick={() => setArchived(true)}>已归档</button></div>
        <button className="rc-check-all" disabled={busy || !list || list.counts.active === 0} aria-describedby={`${fieldId}-batch-help`} onClick={() => void run(() => check('all'))}><Icon name="refresh" />{canWrite ? '检查全部活动卡片并保存' : '临时检查全部活动卡片'}</button>
      </div>
      <div className="rc-filters">
        <div className="rc-search"><Icon name="search" /><input disabled={busy} aria-label="搜索标题或结论" value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索标题或结论…" /></div>
        <select disabled={busy} aria-label="新鲜度" value={filter} onChange={e => setFilter(e.target.value)}><option value="">全部新鲜度</option>{Object.entries(copy.fresh).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
        <select disabled={busy} aria-label="复核意见筛选" value={opinion} onChange={e => setOpinion(e.target.value)}><option value="">全部复核意见</option>{Object.entries(copy.opinion).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
        <select disabled={busy} aria-label="排序方式" value={sort} onChange={e => setSort(e.target.value as CardSort)}><option value="attention">需要关注优先</option><option value="checked">最近检查（未检查在后）</option><option value="updated">最近更新</option></select>
      </div>
      <div className="rc-filter-bottom"><label className="rc-checkbox"><input disabled={busy} type="checkbox" checked={attention} onChange={e => setAttention(e.target.checked)} />只显示需要关注</label><span className="rc-muted">显示 {visible.length} 张 · 已选 {selected.length} 张 · 总量 {list?.counts.total ?? '—'}/200</span></div>
      {!archived && <div className="rc-selection" aria-label="选中范围"><button disabled={busy || !supportsSelected || !visible.length} onClick={() => setSelected(visible.map(c => ({ cardId: c.cardId, expectedRevision: c.revision })))}>选中当前显示的卡片</button><button disabled={busy || !selected.length} onClick={() => setSelected([])}>清空选择</button>
        <button className="rc-primary" disabled={busy || !supportsSelected || !selected.length} onClick={() => void run(() => check('selected'))}>{canWrite ? `检查选中的 ${selected.length} 张并保存` : `临时检查选中的 ${selected.length} 张`}</button></div>}
      <p className="rc-muted">筛选、排序、范围变化或刷新列表会清空选择；项目统计来自已保存记录。{!supportsSelected ? '当前 Host 未声明选中检查能力，请升级 Host 插件并重启。' : ''}</p>
      <p className="rc-muted" id={`${fieldId}-batch-help`} style={{ marginBottom: 14 }}>“检查全部活动卡片”不受搜索和筛选影响；选中检查只处理明确选中的卡片。</p>
      {Object.keys(temporaryBatch).length > 0 && <p className="rc-notice">下方带“未保存”的状态来自临时观察；上方数量统计来自已保存记录。</p>}
      {!!batchRows.length && <details className="rc-batch-results"><summary>逐卡检查结果（{batchRows.length}）</summary><ul>{batchRows.map(r => <li key={r.cardId} data-outcome={r.outcome}>{r.title}：{r.reason ? `${r.reason.message}（${r.reason.code}）` : r.saved ? '已检查并保存' : '临时观察，未保存'}</li>)}</ul></details>}
      {list && !visible.length && <div className="rc-empty"><span className="rc-empty-icon"><Icon name={list.cards.length ? 'search' : 'box'} /></span>
        <h3>{list.cards.length ? '没有匹配的卡片' : archived ? '暂无归档卡片' : '收藏值得再次确认的结论'}</h3>
        <p>{list.cards.length ? '当前筛选没有匹配的卡片，请调整搜索或筛选条件。' : archived ? '归档后的卡片会保留历史，可随时恢复。' : '绑定项目文件，检查依据是否变化，再记录你的复核意见。'}</p>
        {list.cards.length ? <button onClick={() => { setQuery(''); setAttention(false); setFilter(''); setOpinion('') }}>清除筛选</button> : !archived && <button className="rc-ghost" disabled={busy || !canCreate} onClick={() => setForm(empty())}><Icon name="plus" />收藏第一条结论</button>}
      </div>}
      <div className="rc-list">{visible.map(c => <article className="rc-card" key={c.cardId}>{!archived && <label className="rc-checkbox"><input type="checkbox" aria-label={`选择卡片：${c.title}`} disabled={busy || !supportsSelected} checked={selected.some(t => t.cardId === c.cardId)} onChange={e => setSelected(old => e.target.checked ? [...old, { cardId: c.cardId, expectedRevision: c.revision }] : old.filter(t => t.cardId !== c.cardId))} />加入检查范围</label>}<button className="card-title" disabled={busy} onClick={() => void run(() => open(c.cardId))}><span>{c.title}</span><Icon name="arrow" /></button>
        <Badge status={c.freshness} assessment={c.assessment} />{temporaryBatch[c.cardId] && <p className="rc-muted">本次观察未保存。</p>}<p className="rc-claim">{c.claim.slice(0, 120)}</p>
        <p className="rc-meta">{c.evidenceCount} 个依据 · 来源 {c.actor.kind === 'user' ? '用户' : 'Agent'}<br />最近检查 {stamp(c.observedAt)}</p>
      </article>)}</div>
    </>}
    </div>
  </section>
}
// key 强制切换会话时卸载旧面板，取消旧 RPC，避免迟到结果跨会话显示或提交。
function SessionPanel(props: Props) { return <Panel key={props.sessionId} {...props} /> }
export const inject = ['slots', 'sidebarRightTabs', 'connection']
export function apply(ctx: Context): void {
  const connection = ctx.get('connection') as ConnectionHandle
  ctx.effect(() => ctx.sidebarRightTabs.register({ id: 'dsh-recheck', kind: 'recheck', title: () => 'Recheck · 结论保鲜盒',
    guide: [{ id: 'recheck', order: 80, title: () => 'Recheck · 结论保鲜盒', description: () => '收藏项目结论，检查依据变化并记录复核意见。' }] }))
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'dsh-recheck',
    inject: (sessionId): Props => ({ sessionId,
      navigate: async (id, signal) => {
        const navigation = ctx.get('uiWorkspace'), sessions = ctx.get('sessions'), workspaces = ctx.get('workspaces')
        if (!navigation || !sessions || !workspaces) throw new Error('当前宿主未提供来源会话导航，可在宿主会话列表中查找。')
        try { await sessions.refresh() } catch { throw new Error('无法读取宿主会话列表，请检查连接后重试。') }
        signal.throwIfAborted()
        // 会话目录包含归档项；归档状态必须取自宿主持续同步的工作区快照。
        const snapshot = workspaces.list.getSnapshot()
        if (snapshot.phase !== 'ready' || snapshot.state !== 'idle') throw new Error('宿主会话状态尚未就绪，请稍后重试。当前页面已保留。')
        if (snapshot.archivedSessionIds.some(value => value === id) || !sessions.list.getSnapshot().ids.some(value => value === id)) throw new Error('来源会话不存在、已归档或当前不可访问。当前页面已保留。')
        navigation.openSession(id as SessionId)
      },
      diagnose: async signal => {
        const result = await connection.rpc.call('/api', 'recheck/diagnostics', { sessionId }, signal)
        if (!result.ok) throw new Error('诊断连接失败。确认 Host 已升级到 alpha.5，再完全重启客户端。')
        const value = result.value as DiagnosticInfo
        if (!value || typeof value.hostPluginVersion !== 'string') throw new Error('Host 未提供有效诊断，请核对加载版本并重启。')
        return value
      },
      call: async (request, signal) => {
        const result = await connection.rpc.call('/api', 'recheck/dispatch', { sessionId, request }, signal)
        if (!result.ok) throw new Error(result.error.message)
        return result.value as Response
      },
    }),
  }, SessionPanel)))
  ctx.effect(() => () => drafts.clear())
}
