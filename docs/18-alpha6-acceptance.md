# alpha.6：依据录入与来源导航

版本 `0.1.0-alpha.6`，通过 npm `alpha` 与 GitHub Release 分发。数据格式仍为 schema 1；八种业务动作及已有请求格式保持兼容。

## 本版行为

- 依据仍按每行一个项目相对路径录入。空行、非法路径、标准化后的重复路径、超过 8 个条目会逐行提示；接受粘贴末尾的一个换行，不悄悄删除中间空行。
- 输入端仅作格式检查。Host 保存时通过原有 `ctx.fs`、沙箱和路径边界重新读取完整文件，返回缺失、超过 2 MiB、目录/链接、权限不足等逐项错误。任何依据失败都不写入新卡片或修改原卡片。
- 新增可选拒绝字段 `reason.evidenceIssues`：每项包含从 0 开始的 `index`、受控 `code` 与中文 `message`。工具和侧栏使用同一校验，不暴露未知底层错误文本或主机路径；旧客户端仍可显示原来的总错误。
- 保存失败保留全部输入，焦点定位到错误字段，路径错误选中对应行。点击行号可再次定位。提交期间禁用表单编辑，避免错误对应到已变化的输入。
- 标题、结论、说明沿用 Unicode code point 长度限制；输入法组合输入期间不提交表单。草稿只在当前客户端内存中保存，切换同项目会话可恢复，刷新或关闭会丢失。
- 当前版本和历史版本均可打开各自 `actor.sessionId` 对应的来源会话。这是记录该版本的会话，不是原始论据消息；仅改标题不建立版本，因此不改变该来源。
- 导航前刷新宿主公开会话目录。不存在、归档或不可访问的来源给出说明并保留当前页面；取消或切换页面后不会继续跳转。不扫描会话日志，不构造未公开的链接。

## SDK 核查与范围取舍

针对安装的 `0.2.0-rc.2` SDK，核查了公开类型声明及实现：

- `@deepseek-ai/dsh-client-ui-workspace/client` 的 `UiWorkspace.openSession(target)` 用于来源导航。
- `@deepseek-ai/dsh-api-session-controller/client` 的 `ISessions.refresh()` 与 `list.getSnapshot()` 用于检查来源是否在当前可见目录中。
- 会话目录包括归档项，另用 `@deepseek-ai/dsh-api-workspace-controller/client` 的 `workspaces.list.getSnapshot().archivedSessionIds` 排除归档来源；工作区快照未就绪或同步失败时保留当前页面。
- `UiWorkspace.pickDirectory()` 只选择目录；聊天 composer 的 `pickFiles()` 属于附件输入，并不返回 Recheck 所需的项目相对路径列表。

因此本版不添加文件选择按钮，也不自行建立文件浏览器。文件选择取消及选择结果跨项目回填用例不适用；逐行录入、错误修正、草稿隔离、取消与迟到响应继续验收。新宿主使用同样接口的实际包回归核验，未扩大 Desktop 支持范围。

## 验收方法

1. `npm.cmd run check`：两端类型、构建与 37 项测试。新增格式反馈、多项实际文件错误、权限与异常脱敏检查；真实 ToolRuntime 验证可选拒绝字段通过输出 schema。
2. `node scripts/package-smoke.mjs --host <版本> --web`：安装 tgz，在相应 SDK 内运行测试；20 次启停、卸载重装、回退 alpha.5、重新升级与数据字节/历史保留。
3. Web 在真实宿主中验证原有流程、alpha.6 错误行定位、失败输入保留、中文空格路径、300px 窄栏、修正后保存、来源导航和来源不可用反馈。
4. Desktop 使用独立 Harness home、Electron user-data 和项目；不更换用户日常安装。通过共享表单检查验证上述录入行为，系统文件夹选择结果使用测试夹具。

输入法检查使用合成 composition/Enter 事件验证提交保护，中文文件通过实际 FS 读取；不能将此描述为已经测试所有系统输入法。权限错误使用受控 FS 故障注入，路径逃逸、链接、原子写入和冲突继续运行既有真实 FS 回归。

本机 Windows / Node 24 验收结果如下；旧版报告不代替本版运行。

| 组合 | 实际完成范围 |
| --- | --- |
| 开发基线 | 两端类型、构建、37 项核心测试通过 |
| Harness 0.2.0-rc.2 / Web | 同一 tgz 的 37 项隔离 SDK 测试、20 次启停、卸载重装、alpha.5 回退重升、22 类 Web 检查通过；本地启动动画 0.4.2 共存 |
| Harness 0.2.1-alpha.1 / Web | 同一 tgz、37 项隔离 SDK、上述生命周期与 22 类 Web 检查通过 |
| Harness 0.2.0-rc.2 / Desktop | 独立配置的真实 Electron 19 项检查通过 |
| 保存复测 | 100 轮导出拒绝后的归档/恢复与冲突恢复保存通过；该通过运行未再次触发 1175 |
| Windows / Ubuntu 发布 CI | 发布 PR 须通过两个精确宿主的类型、37 项测试与实际包生命周期；Ubuntu 另跑完整 Web 回归，以发布提交 Actions 结果为准 |

本机 Web 生命周期与完整界面回归分阶段完成，使用同一安装包。早先测试夹具在卡片读取完成前修改存储，触发正确的冲突保护；补充等待条件后，在原隔离安装重跑完整 Web 并通过。机器记录保留两阶段日志，不将早先失败写成一次完整通过。

公开发布包仅更新分发文档和清单，其 Host/Client 运行文件须与本机验收候选逐字节一致。npm 与 GitHub 使用相同 tgz，SHA-256 随 Release 附件提供。原本机记录保留在忽略目录中。macOS/Linux Desktop 与 0.2.1-alpha.1 Desktop 未验证，Web 检查不代表这些组合已支持。

本轮复现并捕获了此前通用保存错误的一种具体原因：宿主 Windows FS 的 ReplaceFileW 返回 EIO / Win32 1175。此错误表示原子替换未完成、原文件保留，依据 [Microsoft ReplaceFile 文档](https://learn.microsoft.com/zh-cn/windows/win32/api/winbase/nf-winbase-replacefilea)。共享写入入口仅对这一明确错误延迟 100 / 200ms、最多重试两次，始终沿用原 CAS 版本、宿主 FS 与权限边界。外部修改、取消或其他错误不会被放宽；连续失败返回脱敏 WRITE_BUSY，提醒重新读取后再提交。

新增故障注入测试覆盖成功只提交一次、重试耗尽保留原字节、其他错误不重试、并发更新不覆盖、取消不再写入。具体哪个 Windows 进程/条件触发 1175 尚未确定，不声称修复了宿主实现或所有 I/O 错误。本版未迁移存储，也不增加模型调用或后台扫描。

## 安装与回退

从 [alpha.6 Release](https://github.com/InInNHD/dsh-recheck/releases/tag/v0.1.0-alpha.6) 下载 `dsh-recheck-0.1.0-alpha.6.tgz` 与同名 `.sha256`，或使用固定 npm 版本 `dsh-recheck@0.1.0-alpha.6`。`latest` 可能仍指向旧版，应指定固定版本或 `alpha`。桌面用户保存工作并完全退出后，用匹配桌面安装的自带 CLI 安装到实际 desktop profile，然后重启：

```powershell
& 'C:\Path\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'C:\Path\dsh-recheck-0.1.0-alpha.6.tgz'
```

需要回退时先备份项目数据并退出宿主，安装 alpha.5 后重启；不自动替换宿主。更多说明见 [安装指南](12-installation.md)。
