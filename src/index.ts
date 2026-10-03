import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { SessionId, type Session } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-client-connection'
import { clientRequestSchema } from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import { Recheck } from './recheck.js'
export { Recheck } from './recheck.js'
import { RecheckError, reject, text } from './cards.js'
import type { Environment } from './io.js'
import type { Response } from './types.js'

export const name = 'recheck'
export const inject = ['fs', 'tools', 'sandboxPolicy']

/** 只从宿主不可变会话头取 cwd；工具参数和网页都无权指定根目录。 */
export async function environment(ctx: Context, session: Session | undefined, kind: 'user' | 'agent', token: object, signal: AbortSignal): Promise<Environment> {
  if (!session?.header.cwd) reject('NO_WORKSPACE', '当前会话没有有效工作区，请创建带项目路径的会话。')
  if (ctx.fs.sandboxMode === undefined) reject('UNSUPPORTED_HOST', 'Recheck 需要 DSH 的沙箱文件系统和沙箱策略服务。')
  const root = await ctx.fs.resolve(session.header.cwd, { signal })
  const info = await ctx.fs.stat(root, signal)
  if (info?.type !== 'directory') reject('NO_WORKSPACE', '会话工作区不是有效目录。')
  return { ctx, fs: ctx.fs, cwd: ctx.fs.processPath(root), root, actor: { kind, sessionId: session.header.id }, token,
    policy: ctx.sandboxPolicy.resolve({ session }), signal }
}

const properties = {
  action: { type: 'string', enum: ['create', 'list', 'get', 'edit', 'check', 'review', 'archive', 'export'], required: true },
  title: { type: 'string' }, claim: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, note: { type: 'string' },
  query: { type: 'string' }, archived: { type: 'boolean' }, needsAttention: { type: 'boolean' },
  freshness: { type: 'string', enum: ['unchecked', 'unchanged', 'changed', 'missing', 'unknown'] },
  cardId: { type: 'string' }, expectedRevision: { type: 'integer' }, includeHistory: { type: 'boolean' },
  scope: { type: 'string', enum: ['card', 'all'] }, persist: { type: 'boolean' }, checkId: { type: 'string' },
  assessment: { type: 'string', enum: ['supported', 'refuted', 'uncertain'] }, path: { type: 'string' },
} as const
function branch(action: string, names: string[], required: string[], fixed: Record<string, unknown> = {}) {
  return { type: 'object', additionalProperties: false, properties: Object.fromEntries([
    ['action', { type: 'string', const: action }], ...names.map(key => {
      const { required: _required, ...value } = properties[key as keyof typeof properties] as { required?: boolean; [key: string]: unknown }
      return [key, key in fixed ? { ...value, const: fixed[key] } : value]
    }),
  ]), required: ['action', ...required] }
}
// root oneOf 保持产品的扁平 action API；执行函数仍做同等严格的领域校验。
export const parameters = { oneOf: [
  branch('create', ['title', 'claim', 'files', 'note'], ['title', 'claim', 'files']),
  branch('list', ['query', 'archived', 'needsAttention', 'freshness'], []),
  branch('get', ['cardId', 'includeHistory'], ['cardId']),
  branch('edit', ['cardId', 'expectedRevision', 'title', 'claim', 'files', 'note'], ['cardId', 'expectedRevision']),
  branch('check', ['scope', 'cardId', 'expectedRevision', 'persist'], ['scope', 'cardId', 'expectedRevision'], { scope: 'card' }),
  branch('check', ['scope', 'persist'], ['scope'], { scope: 'all' }),
  branch('review', ['cardId', 'expectedRevision', 'checkId', 'assessment', 'note'], ['cardId', 'expectedRevision', 'checkId', 'assessment', 'note']),
  branch('archive', ['cardId', 'expectedRevision', 'archived'], ['cardId', 'expectedRevision', 'archived']),
  branch('export', ['cardId', 'includeHistory', 'path'], ['cardId']),
] }
function rejected(action: string, error: RecheckError): Response {
  return { status: 'rejected', action, reason: { code: error.code, message: error.message, retryable: error.retryable } }
}
export function apply(ctx: Context): void {
  const service = new Recheck()
  // 注册表可能在提交完成后把调用标为取消；仍通过最终内容准确交代已保存事实。
  const committed = new WeakMap<object, Response>()
  const definition = defineTool({ name: 'recheck',
    description: '收藏项目结论并绑定本地文件依据。支持 create/list/get/edit/check/review/archive/export。完整字节变化与人工复核意见是独立状态；unchanged 不证明正确。写操作须遵循当前会话权限。',
    parameters: properties,
    output: { schema: { oneOf: [
      { type: 'object', additionalProperties: false, properties: {
        status: { type: 'string', const: 'ok', required: true }, action: { type: 'string', required: true }, data: { type: 'json', required: true },
      } },
      { type: 'object', additionalProperties: false, properties: {
        status: { type: 'string', const: 'rejected', required: true }, action: { type: 'string', required: true },
        reason: { type: 'object', required: true, additionalProperties: false, properties: {
          code: { type: 'string', required: true }, message: { type: 'string', required: true }, retryable: { type: 'boolean', required: true },
        } },
      } },
    ] }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    async execute(args, exec: ToolRunContext) {
      let value: Response
      try { value = await service.execute(await environment(ctx, exec.agent?.session, 'agent', exec, exec.signal), args) }
      catch (error) { if (!(error instanceof RecheckError)) throw error; value = rejected(args.action, error) }
      if (value.status === 'ok' && (['create', 'edit', 'review', 'archive'].includes(args.action)
        || (args.action === 'check' && args.persist !== false) || (args.action === 'export' && args.path))) committed.set(exec.token, value)
      return JSON.parse(JSON.stringify(value))
    },
  })
  ctx.effect(() => ctx.tools.register({ ...definition, parameters,
    finalizeContent(exec, result) {
      const value = committed.get(exec.token)
      if (value && result.isError) return [{ type: 'text', text: `宿主在操作完成后返回工具错误；本次保存已完成。实际结果：${JSON.stringify(value)}。请先读取卡片再决定是否重试。` }]
      return undefined
    },
  }))
  // headless 模式也能使用工具；Web 连接出现时再挂载经过宿主认证的 RPC。
  ctx.inject(['connection', 'sessionController', 'fs', 'sandboxPolicy'], (web) => {
    // 精确 Fetch 路由与 Gateway 的唯一共享拦截器共存；认证由已有 /api 载体执行。
    web.effect(() => web.connection.fetch.register({ path: '/api/recheck/dispatch', methods: ['POST'], requestBody: 'buffered',
      async fetch(http) {
        if (http.headers.get('content-type')?.split(';', 1)[0]?.trim() !== 'application/json') return new globalThis.Response('需要 JSON 请求。', { status: 415 })
        let raw: unknown
        try { raw = await http.json() } catch { return new globalThis.Response('JSON 无效。', { status: 400 }) }
        const parsed = clientRequestSchema.safeParse(raw)
        if (!parsed.success || parsed.data.method !== 'recheck/dispatch') return new globalThis.Response('RPC 请求无效。', { status: 400 })
        const result = await dispatch(parsed.data.payload, http.signal)
        return globalThis.Response.json({ type: 'server-response', rpcId: parsed.data.rpcId, result })
      },
    }))
    async function dispatch(payload: unknown, signal: AbortSignal) {
      try {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(k => !['sessionId', 'request'].includes(k))) reject('INVALID_INPUT', 'RPC 请求字段无效。')
        const p = payload as { sessionId: unknown; request: unknown }
        const id = SessionId(text(p.sessionId, 'sessionId', 256))
        // 公共 API 恢复普通会话并还原其权限投影；不会发送模型请求。
        const resolved = await web.sessionController.resolveAgent(id)
        if ('error' in resolved) reject('SESSION_UNAVAILABLE', '会话不存在、忙碌或由其他宿主占用。', true)
        signal.throwIfAborted()
        const env = await environment(web, resolved.agent.session, 'user', { agent: resolved.agent }, signal)
        return { ok: true, value: await service.execute(env, p.request) }
      } catch (error) {
        if (error instanceof RecheckError) return { ok: true, value: rejected('invalid', error) }
        return { ok: false, error: { code: signal.aborted ? 'CANCELLED' : 'INTERNAL', message: signal.aborted ? '请求已取消。' : 'Recheck 宿主操作失败。', details: {} } }
      }
    }
  })
  ctx.effect(() => () => service.dispose())
}
