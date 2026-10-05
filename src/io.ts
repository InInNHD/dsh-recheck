import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { FileSystem, FsTarget, FsObservation, FsWriteIntent } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import { LIMITS, type Actor, type Evidence } from './types.js'
import { relativePath, reject, RecheckError } from './cards.js'

export interface Environment {
  ctx: Context; fs: FileSystem; cwd: string; root: FsTarget; actor: Actor; token: object
  policy: SandboxExecutionPolicy; signal: AbortSignal
}
export const now = () => new Date().toISOString()
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
export function observe(env: Environment, target: FsTarget, observation: FsObservation): void {
  env.ctx.emit('fs/observed', target, observation, env.token)
}
export function writable(env: Environment): void {
  if (env.policy.mode === 'read-only') reject('READ_ONLY', '当前会话只读；可使用 persist:false 临时检查或复制导出。')
  env.signal.throwIfAborted()
}
export async function target(env: Environment, input: string, internal = false): Promise<FsTarget> {
  const path = relativePath(input, internal)
  const parts = path.split('/')
  for (let i = 1; i <= parts.length; i++) {
    const info = await env.fs.lstat(parts.slice(0, i).join('/'), { cwd: env.cwd }, env.signal)
    if (info?.type === 'symlink') reject('UNSAFE_PATH', '不能使用符号链接或目录联接路径。')
    if (i < parts.length && info && info.type !== 'directory') reject('INVALID_PATH', '文件路径的父级不是普通目录。')
    if (i === parts.length && info && info.type !== 'file') reject('NOT_REGULAR_FILE', '目标必须是普通文件。')
  }
  const resolved = await env.fs.resolve(path, { cwd: env.cwd, signal: env.signal })
  if (!env.fs.contains(env.root, resolved) || resolved.targetKey === env.root.targetKey) reject('WORKSPACE_ESCAPE', '目标不在当前项目内。')
  return resolved
}
export interface Snapshot { evidence: Evidence; target: FsTarget }
export async function readEvidence(env: Environment, path: string, resolved?: FsTarget, maxBytes = LIMITS.fileBytes): Promise<Snapshot> {
  env.signal.throwIfAborted()
  const file = resolved ?? await target(env, path)
  const before = await env.fs.stat(file, env.signal)
  if (!before) { observe(env, file, { kind: 'absent' }); reject('MISSING', '依据文件不存在。') }
  if (before.type !== 'file') reject('NOT_REGULAR_FILE', '依据不是普通文件。')
  if (before.size !== undefined && before.size > LIMITS.fileBytes) reject('TOO_LARGE', '依据文件超过 2 MiB。')
  const bytes = await env.fs.readBytes(file, env.signal, maxBytes)
  const after = await env.fs.stat(file, env.signal)
  const resolvedAfter = await target(env, path)
  if (!after || before.version !== after.version || resolvedAfter.targetKey !== file.targetKey)
    reject('UNSTABLE_FILE', '读取期间文件改变，请重新检查。', true)
  observe(env, file, { kind: 'present', version: after.version })
  return { evidence: { path, sha256: sha256(bytes), size: bytes.byteLength, capturedAt: now() }, target: file }
}
export async function guardedWrite(env: Environment, file: FsTarget, content: string, observed: FsObservation): Promise<void> {
  writable(env)
  observe(env, file, observed)
  const own: FsWriteIntent = observed.kind === 'absent' ? { kind: 'createIfAbsent' } : { kind: 'replaceIfVersion', version: observed.version }
  // 宿主策略拥有决定权；插件的 CAS 条件只能收紧，不能绕过策略。
  const intent = await env.ctx.waterfall('fs/write-intent', file, env.token, () => own)
  if (intent && (intent.kind !== own.kind || (intent.kind === 'replaceIfVersion' && own.kind === 'replaceIfVersion' && intent.version !== own.version)))
    reject('REVISION_CONFLICT', '宿主文件观察已改变，请重新读取后提交。', true)
  env.signal.throwIfAborted()
  let result: Awaited<ReturnType<FileSystem['writeText']>>
  for (let attempt = 0; ; attempt++) {
    try { result = await env.fs.writeText(file, content, own, env.signal, env.policy); break }
    catch (error) {
      // Win32 1175 表示替换未发布、原文件仍在；只重试这一明确错误。
      // 每次仍通过宿主 FS 校验同一版本，不绕过 CAS、权限或原子写入。
      if (own.kind !== 'replaceIfVersion' || typeof error !== 'object' || error === null
        || !('code' in error) || error.code !== 'EIO' || !('syscall' in error) || error.syscall !== 'ReplaceFileW'
        || !('win32Code' in error) || error.win32Code !== 1175) throw error
      if (attempt === 2) reject('WRITE_BUSY', 'Windows 暂时无法替换数据文件，本次未保存。请稍后重新读取后重试。', true)
      await delay(100 * (attempt + 1), undefined, { signal: env.signal })
    }
  }
  // 原子发布完成后不再 throwIfAborted，避免将已保存结果误报为未保存。
  observe(env, file, { kind: 'present', version: result.version })
}
export function errorCode(error: unknown): string {
  if (error instanceof RecheckError) return error.code
  return typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'IO_ERROR'
}
export function fileFailure(error: unknown): { status: 'missing' | 'unknown'; reason: string } {
  const code = errorCode(error)
  return { status: ['MISSING', 'FS_NOT_FOUND'].includes(code) ? 'missing' : 'unknown', reason: code }
}
