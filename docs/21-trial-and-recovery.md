# 真实试用与手动备份恢复

本页供 0.1.0 正式版前的试用使用。当前安装固定 `dsh-recheck@0.1.0-beta.1`，见 [安装指南](12-installation.md)。本页不是自动恢复工具；没有收集业务数据或遥测。

## 一周试用

邀请 3 名真实用户，每人在自己的真实项目中使用至少一周。先备份项目数据；不要求公开结论、依据正文、绝对路径或会话标识。

1. 每人录入至少 3 条确实值得再次查看的结论，并绑定 1–8 个依据文件。记录“结论与依据已准备好”之后的建卡耗时，目标是多数操作一分钟内完成，未达成时记录具体障碍。
2. 在正常项目工作中发生依据变化后，完成一次“检查→阅读依据→主动选择意见→保存说明”，不能为测试目的破坏真实代码。没有自然变化时可在单独样例项目演练，并注明样例不能代替真实项目使用。
3. 使用筛选、选中检查、历史、归档恢复和 Markdown 导出，记录是否容易找到需要复核的结论。遇到冲突先重新读取，不循环覆盖保存。
4. 在一次性副本中演练下述备份恢复；不要故意损坏真实项目的数据。
5. 用自己的话说明：“依据未变化”是字节观察；“支持/否定/不确定”是人工复核意见。能区分后才认为概念理解目标达成。
6. 一周结束后自愿提供下面的脱敏记录；如发生数据丢失、跨项目串数据或错误复核，立即停止该项操作、保留文件副本并报告。

## 试用记录模板

每位用户复制一份，保存在自己的本地记录中。维护者公开汇总只写人数、日期范围、已验证环境、问题编号与处理结果；不上传原始 cards.json。

| 项目 | 填写内容 |
| --- | --- |
| 匿名用户编号 | A / B / C |
| 开始与结束日期 | 待填写；至少一周 |
| 插件、Host、系统与界面 | 精确版本；Web 或 Desktop |
| 项目用途 | 一句话，可省略名称和路径 |
| 实际有用结论数量 | 待填写；目标至少 3 条 |
| 变化→检查→人工复核次数 | 待填写；至少 1 次 |
| 建卡时间与障碍 | 已准备好结论/依据后的耗时与主要困难 |
| 对两种状态的理解 | 用自己的话解释依据未变与结论被支持 |
| 无关文件改动造成的提醒 | 次数、是否影响使用；无需正文 |
| 筛选、选择与冲突处理 | 成功/困难/未遇到；不能把未遇到写成已验证 |
| 归档恢复、导出 | 是否成功 |
| 副本上的备份恢复 | 哈希是否一致、历史是否恢复、是否重新检查依据 |
| 数据或权限问题 | 无 / Issue 编号 / 最小复现；不贴业务正文 |
| 是否愿意继续使用 | 是/否及原因 |

小样本反馈用于修复与取舍，不宣称统计效果。至少两名用户反复遇到整文件变化造成无关提醒时，才按路线图考虑 0.2.0 的片段依据。

## 备份：先退出写入者，再复制完整文件

退出所有会写该项目的 Desktop/Web 宿主；多进程共享项目时只停用一个客户端不够。备份包含结论与复核历史，选择自己的私有位置保存，不能放进公开仓库。以下 PowerShell 示例需要将两个目录换成自己的实际位置：

```powershell
$recheckProject = (Resolve-Path -LiteralPath 'E:\你的项目' -ErrorAction Stop).Path
$recheckStore = Join-Path $recheckProject '.dsh\recheck\cards.json'
$recheckBackupDir = 'E:\你的私有备份目录'
New-Item -ItemType Directory -Path $recheckBackupDir -Force -ErrorAction Stop | Out-Null
$recheckStamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$recheckBackup = Join-Path $recheckBackupDir "cards-$recheckStamp.json"
if (Test-Path -LiteralPath $recheckBackup) { throw '备份路径已存在，请更换文件名。' }
Copy-Item -LiteralPath $recheckStore -Destination $recheckBackup -ErrorAction Stop
$recheckSourceHash = (Get-FileHash -LiteralPath $recheckStore -Algorithm SHA256).Hash
$recheckBackupHash = (Get-FileHash -LiteralPath $recheckBackup -Algorithm SHA256).Hash
if ($recheckSourceHash -ne $recheckBackupHash) { throw '哈希不一致，不能把此副本当成有效备份。' }
Write-Output "已备份，SHA-256：$recheckBackupHash"
```

还需单独备份宿主 profile 的 package/lock/patch 配置，以及你自己的项目文件。cards.json 不包含依据正文，不能恢复代码、测试或其他依据文件。记录本次插件/Host 版本和备份日期；已有异常时先留现场，不把损坏数据当成健康备份。

## 恢复：保留当前副本，明确回到备份时间点

先在一次性项目副本中演练。退出所有写入者，选定本项目的完整备份，核对之前记录的 SHA-256，并做 JSON/schema 初检。恢复会覆盖当前卡片状态，丢弃备份后新增的结论和历史；如果需要这些新增记录，先停止恢复并人工确认保存方式。Markdown 导出用于阅读，不能当作 cards.json 的可恢复备份。

```powershell
# 沿用上面的 $recheckProject 和 $recheckStore，重新指定实际备份及记录的哈希。
$recheckRestoreFile = 'E:\你的私有备份目录\cards-实际日期.json'
$recheckExpectedHash = '填写备份时记录的完整SHA256'
if ((Get-FileHash -LiteralPath $recheckRestoreFile -Algorithm SHA256).Hash -ne $recheckExpectedHash) {
    throw '备份校验失败，停止恢复。'
}
$recheckJson = Get-Content -LiteralPath $recheckRestoreFile -Raw -Encoding utf8 | ConvertFrom-Json -ErrorAction Stop
if ($recheckJson.schemaVersion -ne 1) { throw '该版本仅支持 schema 1，不修改 schema 字段来强制兼容。' }
$recheckCurrentCopy = "$recheckStore.before-restore-$(Get-Date -Format 'yyyyMMdd-HHmmss-fff').json"
if (Test-Path -LiteralPath $recheckCurrentCopy) { throw '当前副本路径已存在，停止恢复。' }
if (Test-Path -LiteralPath $recheckStore) {
    Copy-Item -LiteralPath $recheckStore -Destination $recheckCurrentCopy -ErrorAction Stop
}
Copy-Item -LiteralPath $recheckRestoreFile -Destination $recheckStore -ErrorAction Stop
if ((Get-FileHash -LiteralPath $recheckStore -Algorithm SHA256).Hash -ne $recheckExpectedHash) {
    throw '恢复后哈希不一致，保留现场并停止启动。'
}
```

JSON/schema 初检不替代插件的完整结构校验。重启后查看“版本与诊断”：若存储损坏/未来 schema，停止写入并保留副本；不要清空文件。读取历史核对卡片、版本、意见和归档状态，再检查实际依据文件。

**恢复出来的 unchanged 是备份时的历史观察，不是恢复后的即时验证。** 即使旧意见是 supported，也要阅读当前依据、重新检查后再决定是否主动复核。临时检查不会保存，不能用于持久复核。恢复 cards.json 和恢复项目文件是两个独立动作，不能假设一方恢复就意味着另一方匹配。

## 发布前核对

维护者将三份记录汇总到 [正式版待验收清单](20-stable-release-readiness.md)。缺失项保持未完成；修复实际问题后再验证。未经试用完成，不发布稳定版或移动 npm `latest`。问题可通过现有 GitHub Issue 模板报告，只附允许公开的诊断摘要和脱敏复现。
