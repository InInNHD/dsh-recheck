// 构建时从 package.json / compatibility.json 注入，两端不各自维护版本字符串。
declare const __RECHECK_VERSION__: string
declare const __RECHECK_SUPPORTED_HOSTS__: string[]
export const pluginVersion = __RECHECK_VERSION__
export const supportedHosts = __RECHECK_SUPPORTED_HOSTS__
export interface DiagnosticInfo {
  hostPluginVersion: string
  hostPackageVersion: string | null
  installedPluginVersion: string | null
  profile: null
  supportedHosts: string[]
  supportedSchema: 1
  access: 'read-only' | 'write-permitted' | 'unknown'
  storage: 'valid' | 'absent' | 'unavailable'
  reasonCode: string | null
}
export function guidance(code: string): string {
  const advice: Record<string, string> = {
    REVISION_CONFLICT: '重新读取卡片并核对变化；草稿会保留，再决定是否重新提交。',
    READ_ONLY: '可查看、复制导出和临时检查；需要保存时，请在宿主切换到允许写入的模式。',
    PERMISSION_DENIED: '在宿主核对当前会话的访问权限；不要通过关闭沙箱绕过限制。',
    CORRUPT_STORE: '原数据已保留。暂停写入并先备份，再按安装指南检查或恢复数据。',
    UNSUPPORTED_SCHEMA: '原数据已保留。使用支持该数据格式的插件版本，或恢复升级前的备份。',
    STORE_TOO_LARGE: '原数据已保留。先备份并核对数据规模，不要直接删除历史记录。',
    NO_WORKSPACE: '在宿主选择项目并打开该项目的会话，然后刷新列表。',
    SESSION_UNAVAILABLE: '确认会话仍存在且可访问，稍后刷新；不要同时用多个 Host 写同一项目。',
    UNSUPPORTED_HOST: '使用兼容清单中的宿主组合，并完全重启对应的客户端。',
    CANCELLED: '先刷新确认实际保存结果，再决定是否重试。',
    UNLOADED: '插件已停用，请重新启用后刷新；如刚升级，请完全重启客户端。',
  }
  return advice[code] ?? '核对提示后重试；持续失败时可展开“版本与诊断”，复制诊断摘要反馈。'
}
