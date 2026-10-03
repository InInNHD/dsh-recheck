# Windows Desktop 验收记录（alpha.1 历史）

记录日期：2026-10-03，Asia/Shanghai。插件 0.1.0-alpha.1，桌面内置 Harness 0.2.0-rc.2。本文件描述已有历史证据，不代表 alpha.2 重新执行过全部 Desktop 验收。

实际安装通过桌面自带 CLI 的 `plugin --profile desktop add` 完成，配置位于 `<DSH_HOME>/profiles/desktop`，包缓存在 DSH_HOME 内；安装前备份已有配置并保留 bundle 顺序。旧全局 CLI 0.1.0-rc.6 未用于安装。desktop 必须由 Electron 应用启动。

12 项实机检查通过：实际配置启用、安装文件哈希一致、原生页面与项目绑定、创建双状态、依据未变/变化检查、主动不确定复核、外部更新冲突及草稿保留、Markdown 新文件导出与拒绝覆盖、归档恢复及历史、UTC/时区展开、搜索、无页面异常。

Playwright Electron 启动真实应用；仅替代测试进程中的文件夹选择结果。宿主、RPC 和业务 FS 均真实，没有发送模型消息。fixture 为独立 .integration 项目。持久缓存更新后原卡片 revision 9、两版本和 unchanged/uncertain 仍可读取，公开 inventory 返回 HTTP 200 / ok。

原交付包 SHA-256：`72bec38affd59efc81ed8ec9789ecc479e9d1359423db36384a9494fb2b7c091`。本机原始报告与截图保留于忽略的 .integration 目录；不公开认证和真实运行状态。

当前安装说明见 12-installation.md，本版验收范围见 13-public-release-validation.md。Desktop 回归脚本需指定 `--app` 或 `RECHECK_DESKTOP_APP`，不依赖维护者磁盘路径。
