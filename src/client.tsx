import React, { useEffect, useRef, useState } from 'react'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type { Assessment, Card, Check, Freshness, Request, Response } from './types.js'
import { freshness, current } from './cards.js'

const copy = {
  fresh: { unchecked: '尚未检查', unchanged: '依据未变化', changed: '依据已变化', missing: '依据缺失', unknown: '检查未知' },
  opinion: { unreviewed: '尚未复核', supported: '支持', refuted: '否定', uncertain: '不确定' },
  limitation: '文件状态表示观察时的字节变化，不证明结论正确。多个文件分别读取，不构成项目快照。',
} as const
type Summary = { cardId: string; versionId: string; title: string; revision: number; archived: boolean; claim: string; freshness: Freshness;
  assessment: Assessment; needsAttention: boolean; evidenceCount: number; updatedAt: string; observedAt?: string; actor: { kind: string } }
type Listing = { workspace: { id: string; name: string; writable: boolean }; counts: { active: number; archived: number; total: number; needsAttention: number }; cards: Summary[] }
type Form = { mode: 'create' | 'edit' | 'review'; cardId?: string; expectedRevision?: number; checkId?: string;
  title: string; claim: string; files: string; note: string; assessment: '' | Exclude<Assessment, 'unreviewed'> }
type Props = { sessionId: string; call: (request: Request, signal: AbortSignal) => Promise<Response> }
// 草稿只保存在本次客户端内存中，以宿主返回的项目身份隔离。
const drafts = new Map<string, Form>()
function Stamp({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  return <span><time dateTime={value}>{new Date(value).toLocaleString('zh-CN')}</time>{' '}
    <button type="button" aria-expanded={expanded} aria-label={`展开时间详情 ${value}`} onClick={() => setExpanded(!expanded)}>UTC</button>
    {expanded && <small>{value}（UTC）；本地时区 {Intl.DateTimeFormat().resolvedOptions().timeZone}</small>}
  </span>
}
const stamp = (s?: string) => s ? <Stamp value={s} /> : '—'
const empty = (): Form => ({ mode: 'create', title: '', claim: '', files: '', note: '', assessment: '' })
function Badge({ status, assessment }: { status: Freshness; assessment: Assessment }) {
  return <p><strong>{copy.fresh[status]}</strong> · 复核意见：{copy.opinion[assessment]}</p>
}
function Panel(props: Props) {
  const [list, setList] = useState<Listing>(), [card, setCard] = useState<Card>()
  const [archived, setArchived] = useState(false), [query, setQuery] = useState('')
  const [attention, setAttention] = useState(false), [filter, setFilter] = useState('')
  const [form, setForm] = useState<Form>(), [preview, setPreview] = useState(''), [outputPath, setOutputPath] = useState('')
  const [fullHistory, setFullHistory] = useState(false), [temporary, setTemporary] = useState<Check>()
  const [temporaryBatch, setTemporaryBatch] = useState<Record<string, Check>>({})
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const requests = useRef(new Set<AbortController>()), mounted = useRef(true), workspace = useRef<string>()
  const focusError = useRef<HTMLParagraphElement>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; for (const request of requests.current) request.abort() } }, [])
  useEffect(() => { if (error) focusError.current?.focus() }, [error])
  useEffect(() => {
    if (workspace.current) { if (form) drafts.set(workspace.current, form); else drafts.delete(workspace.current) }
  }, [form])
  async function call(request: Request) {
    const controller = new AbortController(); requests.current.add(controller)
    try {
      const result = await props.call(request, controller.signal)
      if (!mounted.current) throw new DOMException('会话已切换', 'AbortError')
      if (result.status === 'rejected') throw new Error(`${result.reason.message}（${result.reason.code}）`)
      return result.data
    } finally { requests.current.delete(controller) }
  }
  async function refresh() {
    const value: Listing = await call({ action: 'list', archived })
    setList(value)
    setTemporaryBatch(old => Object.fromEntries(Object.entries(old).filter(([id, check]) => value.cards.some(c => c.cardId === id && c.versionId === check.versionId))))
    if (workspace.current !== value.workspace.id) {
      workspace.current = value.workspace.id
      const draft = drafts.get(value.workspace.id)
      if (draft) { setForm(draft); setMessage('已恢复本项目的内存草稿；提交前请核对卡片及 revision。') }
    }
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try { await fn() } catch (e) {
      if (mounted.current && !(e instanceof Error && e.name === 'AbortError')) setError(e instanceof Error ? e.message : '操作失败。')
    } finally { if (mounted.current) setBusy(false) }
  }
  useEffect(() => { void run(refresh) }, [archived])
  const canWrite = list?.workspace.writable === true
  const observed = card && temporary?.versionId === current(card).id ? temporary : card?.latestCheck
  const reviewAllowed = canWrite && card && !card.archived && card.latestCheck?.checkId
    && card.latestCheck.files.every(f => f.status === 'changed' || f.status === 'unchanged')
  const visible = list?.cards.map(c => {
    const candidate = temporaryBatch[c.cardId]
    const observed = candidate?.versionId === c.versionId ? candidate : undefined
    return observed ? { ...c, freshness: observed.freshness, needsAttention: observed.freshness !== 'unchanged' || ['unreviewed', 'uncertain'].includes(c.assessment) } : c
  }).filter(c => (!query || (c.title + '\n' + c.claim).toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    && (!attention || c.needsAttention) && (!filter || c.freshness === filter)) ?? []
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
  async function check(all = false) {
    const result = await call(all ? { action: 'check', scope: 'all', persist: canWrite }
      : { action: 'check', scope: 'card', cardId: card!.id, expectedRevision: card!.revision, persist: canWrite })
    if (result.persisted) clearTemporary(all ? undefined : card!.id)
    setMessage(`${result.persisted ? '检查结果已保存' : '本次检查结果未保存'}：完成 ${result.counts.checked} 张，冲突 ${result.counts.conflict} 张，错误 ${result.counts.error} 张，未知依据 ${result.counts.unknownFiles} 个。`)
    if (!canWrite && all) setTemporaryBatch(Object.fromEntries(result.results.filter((r: any) => r.outcome === 'checked').map((r: any) => [r.cardId, r])))
    if (!all && card) {
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
  function review() { setForm({ ...empty(), mode: 'review', cardId: card!.id, expectedRevision: card!.revision, checkId: card!.latestCheck!.checkId }) }
  async function submit() {
    if (!form) return
    const f = form
    const files = f.files.split('\n').map(s => s.trim()).filter(Boolean)
    let req: Request
    if (f.mode === 'create') req = { action: 'create', title: f.title, claim: f.claim, files, note: f.note }
    else if (f.mode === 'edit') req = { action: 'edit', cardId: f.cardId!, expectedRevision: f.expectedRevision!, title: f.title, claim: f.claim, files, note: f.note }
    else {
      if (!f.assessment) throw new Error('请主动选择复核意见。')
      req = { action: 'review', cardId: f.cardId!, expectedRevision: f.expectedRevision!, checkId: f.checkId!, assessment: f.assessment, note: f.note }
    }
    const value = await call(req)
    setCard(value); setForm(undefined); clearTemporary(value.id); setPreview(''); await refresh()
    setMessage('已保存。')
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
    <style>{`.recheck{padding:12px;max-width:800px;box-sizing:border-box;height:100%;overflow:auto;font:inherit;color:inherit}.recheck *{box-sizing:border-box}.recheck h2{font-size:18px}.recheck p{overflow-wrap:anywhere}.recheck button,.recheck select,.recheck input,.recheck textarea{font:inherit;color:inherit;background:transparent;border:1px solid #8886;border-radius:5px;padding:7px;max-width:100%}.recheck button{cursor:pointer;margin:3px}.recheck button:disabled{opacity:.5;cursor:default}.recheck input,.recheck textarea,.recheck select{display:block;width:100%;margin:6px 0 12px}.recheck input[type=checkbox]{display:inline;width:auto;margin-right:8px}.recheck textarea{min-height:100px}.recheck :focus-visible{outline:2px solid #448aff;outline-offset:2px}.recheck article{border-top:1px solid #8884;padding:10px 0}.recheck pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}.recheck [role=alert]{border-left:3px solid #df5050;padding:8px}.recheck label{display:block}.recheck .card-title{display:block;text-align:left;width:100%}.recheck fieldset{border:1px solid #8885;margin:12px 0;padding:10px}`}</style>
    <h2>Recheck · 结论保鲜盒</h2>
    <p>当前项目：{list?.workspace.name ?? (error ? '尚未连接到有效工作区' : '正在读取工作区…')}{list && !canWrite ? ' · 只读' : ''}</p>
    <p role="alert" tabIndex={-1} ref={focusError} hidden={!error}>{error}</p>
    <p role="status" aria-live="polite">{message}</p>
    {busy && <button onClick={() => { for (const request of requests.current) request.abort(); setMessage('取消已发出；如果提交已完成，请刷新确认实际保存结果。') }}>取消当前操作</button>}
    <button disabled={busy} onClick={() => void run(refresh)}>刷新列表</button>
    {form ? <form onSubmit={e => { e.preventDefault(); void run(submit) }}>
      <h3>{form.mode === 'create' ? '新建卡片' : form.mode === 'edit' ? '编辑卡片' : '记录复核'}</h3>
      <p>草稿自动保存在当前客户端的本项目内存中，切换会话后可恢复；刷新或关闭客户端会丢失。若不保留，请先点击“放弃草稿”。</p>
      {form.cardId && <>
        <p>草稿引用 revision：{form.expectedRevision}。{card ? `当前读到 revision：${card.revision}。` : ''}</p>
        <button type="button" disabled={busy} onClick={() => void run(async () => { await open(form.cardId!); setMessage('已重新读取卡片；草稿内容与提交 revision 保留，请核对后决定。') })}>重新读取卡片（保留草稿）</button>
        {form.mode === 'edit' && card?.id === form.cardId && card.revision !== form.expectedRevision && <button type="button" disabled={busy} onClick={() => change({ expectedRevision: card.revision })}>采用当前 revision 并保留输入</button>}
      </>}
      {form.mode !== 'review' ? <>
        <label>标题（最多 120 字符）<input value={form.title} onChange={e => change({ title: e.target.value })} required /></label>
        <label>结论（最多 2,000 字符）<textarea value={form.claim} onChange={e => change({ claim: e.target.value })} required /></label>
        <label>依据文件（项目相对路径，每行一个，1–8 个）<textarea value={form.files} onChange={e => change({ files: e.target.value })} required placeholder={'src/payment.ts\ntests/retry.test.ts'} /></label>
        {form.mode === 'edit' && <p>仅改标题保留原意见。修改结论或依据会建立新版本，重置意见与检查；变更说明必填。</p>}
      </> : <>
        <p>将记录为用户复核。引用检查：{form.checkId}；revision：{form.expectedRevision}。</p>
        <p>观察时间：{stamp(card?.latestCheck?.observedAt)} · 依据 {card ? current(card).evidence.length : '—'} 个。保存前将重新读取依据。</p>
        <label>复核意见<select required value={form.assessment} onChange={e => change({ assessment: e.target.value as Form['assessment'] })}>
          <option value="">请选择…</option><option value="supported">支持</option><option value="refuted">否定</option><option value="uncertain">不确定</option>
        </select></label>
      </>}
      <label>{form.mode === 'create' ? '初始说明（可选）' : form.mode === 'edit' ? '变更说明' : '复核说明（必填）'}<textarea value={form.note} onChange={e => change({ note: e.target.value })} required={form.mode === 'review'} /></label>
      <p>说明最多 4,000 字符。错误或冲突发生时输入会保留。</p>
      <button type="submit" disabled={busy || !canWrite}>保存</button>
      <button type="button" disabled={busy} onClick={() => setForm(undefined)}>放弃草稿</button>
    </form> : card ? <>
      <button disabled={busy} onClick={() => { setCard(undefined); setTemporary(undefined); setPreview('') }}>← 返回列表</button>
      <button disabled={busy} onClick={() => void run(() => open(card.id))}>重新读取卡片</button>
      <h3>{card.title}{card.archived ? '（已归档）' : ''}</h3>
      <Badge status={observed?.freshness ?? freshness(card)} assessment={current(card).assessment} />
      {temporary && <p><strong>临时观察，未保存；不能引用本次结果复核。</strong></p>}
      <p>当前版本：{current(card).id}<br />revision：{card.revision}<br />上次观察：{stamp(observed?.observedAt)}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{current(card).claim}</p>
      <p>意见来源：{current(card).actor.kind === 'user' ? '用户' : 'Agent'} · {stamp(current(card).createdAt)}<br />会话：{current(card).actor.sessionId}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>说明：{current(card).note || '（无）'}</p>
      <h4>依据文件</h4>
      {current(card).evidence.map(e => {
        const f = observed?.files.find(f => f.path === e.path)
        return <article key={e.path}><strong>{e.path}</strong><p>{copy.fresh[f?.status ?? 'unchecked']}{f?.reason ? ` · ${f.reason}` : ''}</p>
          <p>基线捕获：{stamp(e.capturedAt)}<br />本次观察：{stamp(f?.observedAt)}</p>
          <details><summary>指纹与字节详情</summary><pre>基线 SHA-256：{e.sha256}{'\n'}基线字节：{e.size}{'\n'}当前 SHA-256：{f?.sha256 ?? '未获得'}{'\n'}当前字节：{f?.size ?? '未获得'}</pre></details>
        </article>
      })}
      {observed && <p>覆盖 {observed.coverage.checkedFiles}/{observed.coverage.totalFiles} 个依据；未知 {observed.coverage.unknownFiles} 个。</p>}
      <button disabled={busy || card.archived} onClick={() => void run(() => check())}>{canWrite ? '检查依据并保存' : '临时检查依据'}</button>
      <button disabled={busy || !canWrite || card.archived} onClick={edit}>编辑</button>
      <button disabled={busy || !reviewAllowed} onClick={review}>记录复核</button>
      {!reviewAllowed && !card.archived && <p>复核需要当前版本最近保存的完整检查；缺失或未知的依据必须先处理。</p>}
      <button disabled={busy || !canWrite} onClick={() => void run(archive)}>{card.archived ? '恢复' : '归档'}</button>
      <p>{copy.limitation}</p>
      <details><summary>历史版本（{card.versions.length}）</summary>{card.versions.map((v, i) => <article key={v.id}>
        <h4>v{i + 1} · {copy.opinion[v.assessment]} · {v.reason}</h4><p>{v.id}<br />{v.actor.kind} · {stamp(v.createdAt)}<br />来源会话：{v.actor.sessionId}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{v.claim}</p><p style={{ whiteSpace: 'pre-wrap' }}>{v.note}</p>
        {v.evidence.map(e => <pre key={e.path}>{e.path}{'\n'}{e.sha256}{'\n'}{e.size} 字节 · {stamp(e.capturedAt)}</pre>)}
      </article>)}</details>
      <fieldset><legend>Markdown 导出</legend>
        <label><input type="checkbox" checked={fullHistory} onChange={e => { setFullHistory(e.target.checked); setPreview('') }} />包含完整历史</label>
        <button disabled={busy} onClick={() => void run(() => exportCard())}>生成预览</button>
        {preview && <>
          <label>导出文本<textarea readOnly value={preview} rows={16} /></label>
          <button disabled={busy} onClick={() => void run(async () => { await navigator.clipboard.writeText(preview); setMessage('已复制 Markdown。') })}>复制 Markdown</button>
          <label>新文件的项目相对路径<input value={outputPath} onChange={e => setOutputPath(e.target.value)} placeholder={`recheck-${card.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.md`} /></label>
          <button disabled={busy || !canWrite || !outputPath.trim()} onClick={() => void run(() => exportCard(outputPath.trim()))}>写入以上新文件（不覆盖）</button>
        </>}
      </fieldset>
    </> : <>
      <button disabled={busy || !canWrite || !list || list.counts.active >= 100 || list.counts.total >= 200} onClick={() => setForm(empty())}>新建卡片</button>
      {list && (list.counts.active >= 100 || list.counts.total >= 200) && <p>已达到卡片容量上限。活动上限 100 张，总量上限 200 张；现有记录会保留。</p>}
      <label>搜索标题或结论<input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索结论" /></label>
      <label>卡片范围<select disabled={busy} value={archived ? 'archived' : 'active'} onChange={e => setArchived(e.target.value === 'archived')}><option value="active">活动卡片</option><option value="archived">已归档</option></select></label>
      <label><input type="checkbox" checked={attention} onChange={e => setAttention(e.target.checked)} />只显示需要关注</label>
      <label>新鲜度<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">全部新鲜度</option>{Object.entries(copy.fresh).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
      <button disabled={busy || !list || list.counts.active === 0} onClick={() => void run(() => check(true))}>{canWrite ? '检查全部活动卡片并保存' : '临时检查全部活动卡片'}</button>
      <p>此操作检查所有活动卡片，不受搜索和筛选影响。</p>
      {list && <p>活动 {list.counts.active}/100 · 需要关注 {list.counts.needsAttention} · 已归档 {list.counts.archived} · 总量 {list.counts.total}/200</p>}
      {Object.keys(temporaryBatch).length > 0 && <p>下方带“未保存”的状态来自临时观察；上方数量统计来自已保存记录。</p>}
      {list && !visible.length && <p>{list.cards.length ? '当前筛选没有匹配的卡片，请调整搜索或筛选条件。' : archived ? '暂无归档卡片。' : '暂无活动卡片。收藏项目结论并绑定依据文件，下次检查时 Recheck 会指出哪些依据发生了变化。'}</p>}
      {visible.map(c => <article key={c.cardId}><button className="card-title" disabled={busy} onClick={() => void run(() => open(c.cardId))}>{c.title}</button>
        <Badge status={c.freshness} assessment={c.assessment} />{temporaryBatch[c.cardId] && <p>本次观察未保存。</p>}<p>{c.claim.slice(0, 120)}</p>
        <p>{c.evidenceCount} 个依据 · 最近检查 {stamp(c.observedAt)} · 来源 {c.actor.kind === 'user' ? '用户' : 'Agent'}</p>
      </article>)}
    </>}
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
      call: async (request, signal) => {
        const result = await connection.rpc.call('/api', 'recheck/dispatch', { sessionId, request }, signal)
        if (!result.ok) throw new Error(result.error.message)
        return result.value as Response
      },
    }),
  }, SessionPanel)))
  ctx.effect(() => () => drafts.clear())
}
