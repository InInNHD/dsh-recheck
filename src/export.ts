import { current, freshness } from './cards.js'
import type { Card, CardVersion } from './types.js'

// 任意人类输入都作为文字呈现；不会把说明里的 HTML、链接或代码执行起来。
const escape = (s: string) => s.replace(/[\\`*_{}\[\]()#+.!|<>~-]/g, '\\$&').replaceAll('\n', ' ')
function block(s: string): string {
  const runs = s.match(/`+/g) ?? []
  const fence = '`'.repeat(Math.max(3, ...runs.map(r => r.length + 1)))
  return `${fence}text\n${s}\n${fence}`
}
function version(v: CardVersion): string {
  return `### 版本 ${v.id}\n\n意见：${v.assessment} · 原因：${v.reason}\n\n来源：${v.actor.kind} · 会话 ${escape(v.actor.sessionId)} · ${v.createdAt}\n\n结论：\n\n${block(v.claim)}\n\n说明：\n\n${block(v.note || '（无）')}\n\n依据：\n\n| 路径 | SHA-256 | 字节 | 捕获时间 |\n| --- | --- | --- | --- |\n`
    + v.evidence.map(e => `| ${escape(e.path)} | ${e.sha256} | ${e.size} | ${e.capturedAt} |`).join('\n')
}
export function markdown(card: Card, history = false): string {
  const latest = card.latestCheck
  let result = `# ${escape(card.title)}\n\n卡片：${card.id} · revision：${card.revision} · ${card.archived ? '已归档' : '活动'}\n\n新鲜度：${freshness(card)} · 复核意见：${current(card).assessment}\n\n创建：${card.createdAt} · 更新：${card.updatedAt}\n\n${version(current(card))}\n\n## 最近保存的检查\n\n`
  result += latest ? `检查：${latest.checkId} · ${latest.observedAt}\n\n覆盖：${latest.coverage.checkedFiles}/${latest.coverage.totalFiles}；未知：${latest.coverage.unknownFiles}\n\n| 路径 | 状态 | 当前 SHA-256 | 当前字节 | 原因 |\n| --- | --- | --- | --- | --- |\n`
    + latest.files.map(f => `| ${escape(f.path)} | ${f.status} | ${f.sha256 ?? '—'} | ${f.size ?? '—'} | ${escape(f.reason ?? '')} |`).join('\n') + '\n\n' : '尚未检查。\n\n'
  result += '## 历史版本摘要\n\n' + card.versions.map((v, i) => `- v${i + 1} · ${v.id} · ${v.assessment} · ${v.actor.kind} · ${v.createdAt}`).join('\n')
  if (history) result += '\n\n## 完整历史\n\n' + card.versions.slice(0, -1).map(version).join('\n\n')
  return result + '\n\n## 观察限制\n\n文件状态只表示观察时的完整字节比较；未变化不证明结论正确。多个文件分别读取，不构成全项目同一时刻快照。复核意见来自提交者，Recheck 没有执行说明中的命令或独立验证业务行为。导出没有重新检查文件。\n'
}
