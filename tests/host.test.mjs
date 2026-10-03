import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import { ToolRuntime, renderToolsSdk } from '@deepseek-ai/dsh-tools'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import SandboxedFileSystem from '@deepseek-ai/dsh-fs-sandbox'
import * as observationPolicy from '@deepseek-ai/dsh-fs-observation-policy'
import { apply, parameters } from '../lib/index.js'
import * as plugin from '../lib/index.js'
import { readFile } from 'node:fs/promises'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import LocalSandboxProvider from '@deepseek-ai/dsh-sandbox-local'
import NodePtcRuntime from '@deepseek-ai/dsh-ptc-runtime-node'

test('真实 ToolRuntime 注册、Native 分发和 Host 来源绑定', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'recheck-host-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(join(cwd, 'source.txt'), 'native tool evidence')
  const ctx = new Context()
  ctx.provide('sandboxPolicy', { defaultMode: 'workspace-write', resolve: ({ session } = {}) => ({ mode: 'workspace-write', workspaceRoot: session?.header.cwd ?? cwd }) })
  new SandboxedFileSystem(ctx, LocalFileSystem.Config({ cwd }))
  new SystemPrompt(ctx, SystemPrompt.Config({}))
  const tools = new ToolRuntime(ctx, { mode: 'native' }), sessions = new SessionStore(ctx)
  observationPolicy.apply(ctx)
  const fiber = await ctx.plugin(plugin)
  t.after(() => fiber.dispose())
  const session = sessions.create(undefined, { meta: { cwd } }), agent = { session, ctx }
  let index = 0
  const invoke = arguments_ => tools.execute({ name: 'recheck', callId: ToolCallId(`test-${++index}`), arguments: arguments_, agent, signal: new AbortController().signal })
  const result = await invoke({ action: 'create', title: '原生工具卡片', claim: '来源为当前 Agent', files: ['source.txt'], note: 'Host 测试' })
  assert.equal(result.isError, false, JSON.stringify(result))
  assert.equal(result.value.status, 'ok'); assert.equal(result.value.data.versions[0].actor.kind, 'agent')
  assert.equal(result.value.data.versions[0].actor.sessionId, session.header.id)
  const listed = await invoke({ action: 'list' })
  assert.equal(listed.value.data.cards.length, 1)
  assert.equal(parameters.oneOf.length, 9)
  const definition = tools.get('recheck')
  const sdk = renderToolsSdk([{ ...definition, output: definition.output.schema }])
  assert.match(sdk, /recheck/); assert.match(sdk, /create/); assert.match(sdk, /review/); assert.match(sdk, /retryable/)
  const spoof = await invoke({ action: 'list', actor: 'user' })
  assert.ok(spoof.isError || spoof.value?.status === 'rejected')
  const missing = await tools.execute({ name: 'recheck', callId: ToolCallId('no-session'), arguments: { action: 'list' }, signal: new AbortController().signal })
  assert.equal(missing.value.reason.code, 'NO_WORKSPACE')
  await fiber.dispose()
  assert.equal(tools.get('recheck'), undefined)
  assert.ok((await readFile(join(cwd, '.dsh/recheck/cards.json'), 'utf8')).includes('原生工具卡片'))
})

test('官方 Node PTC 后端通过 tools.recheck 调用同一工具', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'recheck-ptc-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  const ctx = new Context()
  // 此程序是固定的测试代码，隔离工作目录中无需启动操作系统级沙箱。
  ctx.provide('sandboxPolicy', { defaultMode: 'danger-full-access', resolve: () => ({ mode: 'danger-full-access', workspaceRoot: cwd }) })
  new SandboxedFileSystem(ctx, LocalFileSystem.Config({ cwd }))
  new SystemPrompt(ctx, SystemPrompt.Config({}))
  new LocalSubprocessRuntime(ctx)
  new LocalSandboxProvider(ctx, LocalSandboxProvider.Config({}))
  new NodePtcRuntime(ctx, NodePtcRuntime.Config({ timeoutMs: 10_000, maxTimeoutMs: 10_000 }))
  const tools = new ToolRuntime(ctx, { mode: 'both' }), sessions = new SessionStore(ctx)
  observationPolicy.apply(ctx); apply(ctx)
  const session = sessions.create(undefined, { meta: { cwd } }), agent = { session, ctx }
  const result = await tools.execute({ name: 'run_code', callId: ToolCallId('ptc-check'),
    arguments: { code: 'return await tools.recheck({ action: "list" })', description: 'List Recheck cards through official program tools' }, agent, signal: new AbortController().signal })
  assert.equal(result.isError, false, JSON.stringify(result))
  assert.match(JSON.stringify(result.value), /status.*ok/)
  assert.match(JSON.stringify(result.value), /cards/)
})

test('真实 ToolRuntime 晚到取消保留已提交结果的最终文本及可读存储', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'recheck-host-late-cancel-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  await writeFile(join(cwd, 'source.txt'), 'published before cancellation')
  const ctx = new Context()
  ctx.provide('sandboxPolicy', { defaultMode: 'workspace-write', resolve: ({ session } = {}) => ({ mode: 'workspace-write', workspaceRoot: session?.header.cwd ?? cwd }) })
  const fs = new SandboxedFileSystem(ctx, LocalFileSystem.Config({ cwd }))
  new SystemPrompt(ctx, SystemPrompt.Config({}))
  const tools = new ToolRuntime(ctx, { mode: 'native' }), sessions = new SessionStore(ctx)
  observationPolicy.apply(ctx)
  const fiber = await ctx.plugin(plugin)
  t.after(() => fiber.dispose())
  const session = sessions.create(undefined, { meta: { cwd } }), agent = { session, ctx }
  const controller = new AbortController(), originalWrite = fs.writeText.bind(fs)
  // 保留真实原子写入，仅在提供方已成功发布并返回结果后触发调用者取消。
  fs.writeText = async (...args) => {
    const published = await originalWrite(...args)
    controller.abort()
    return published
  }
  const result = await tools.execute({ name: 'recheck', callId: ToolCallId('late-cancel-create'),
    arguments: { action: 'create', title: '已保存的取消测试', claim: '原子发布成功后取消不能回滚存储', files: ['source.txt'] }, agent, signal: controller.signal })
  assert.equal(controller.signal.aborted, true)
  assert.equal(result.isError, true, '宿主注册表仍保留取消的结构化错误')
  const finalText = result.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
  assert.match(finalText, /本次保存已完成/)
  const prefix = '实际结果：', suffix = '。请先读取卡片'
  const committed = JSON.parse(finalText.slice(finalText.indexOf(prefix) + prefix.length, finalText.indexOf(suffix)))
  assert.equal(committed.status, 'ok')
  assert.equal(committed.action, 'create')
  const store = JSON.parse(await readFile(join(cwd, '.dsh/recheck/cards.json'), 'utf8'))
  assert.equal(store.cards.length, 1)
  assert.equal(store.cards[0].id, committed.data.cardId)
  assert.equal(store.cards[0].revision, committed.data.revision)
  assert.equal(store.cards[0].versions[0].id, committed.data.versionId)
  fs.writeText = originalWrite
  const reread = await tools.execute({ name: 'recheck', callId: ToolCallId('late-cancel-reread'),
    arguments: { action: 'get', cardId: committed.data.cardId }, agent, signal: new AbortController().signal })
  assert.equal(reread.isError, false)
  assert.equal(reread.value.status, 'ok')
  assert.equal(reread.value.data.revision, committed.data.revision)
  assert.equal(reread.value.data.title, '已保存的取消测试')
})
