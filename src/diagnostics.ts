import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-plugin-manager'
import type { Environment } from './io.js'
import { loadStore } from './store.js'
import { pluginVersion, supportedHosts, type DiagnosticInfo } from './diagnostic-info.js'

/** 仅返回固定字段，不返回项目路径、会话身份、卡片、文件正文或底层异常文本。 */
export async function diagnostics(ctx: Context, environment: () => Promise<Environment>, signal: AbortSignal): Promise<DiagnosticInfo> {
  let hostPackageVersion: string | null = null
  try {
    const version = ctx.get('pluginPackages')?.packageOf('@deepseek-ai/dsh', import.meta.url)?.version
    if (version && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) hostPackageVersion = version
  } catch { /* 可选的包元数据服务不可用时，不根据开发依赖或环境变量猜版本。 */ }
  const result: DiagnosticInfo = { hostPluginVersion: pluginVersion, hostPackageVersion, installedPluginVersion: null, profile: null,
    supportedHosts: [...supportedHosts], supportedSchema: 1, access: 'unknown', storage: 'unavailable', reasonCode: null }
  try {
    const bundles = await ctx.get('pluginManager')?.listBundles()
    const installed = bundles?.find(bundle => bundle.name === 'dsh-recheck')?.version
    if (installed && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(installed)) result.installedPluginVersion = installed
  } catch { /* headless 或可选管理服务不可用时保留未知，不把加载版本当作安装版本。 */ }
  try {
    const env = await environment()
    result.access = env.policy.mode === 'read-only' ? 'read-only' : 'write-permitted'
    const loaded = await loadStore(env)
    result.storage = loaded.observation.kind === 'absent' ? 'absent' : 'valid'
  } catch (error) {
    signal.throwIfAborted()
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
    const allowed = ['CORRUPT_STORE', 'UNSUPPORTED_SCHEMA', 'STORE_TOO_LARGE', 'NO_WORKSPACE', 'SESSION_UNAVAILABLE', 'UNSUPPORTED_HOST', 'REVISION_CONFLICT']
    result.reasonCode = allowed.includes(code) ? code : ['FS_PERMISSION_DENIED', 'FS_SANDBOX_DENIED'].includes(code) ? 'PERMISSION_DENIED' : 'IO_ERROR'
  }
  signal.throwIfAborted()
  return result
}
