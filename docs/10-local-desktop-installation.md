# 本机桌面客户端安装与功能验收

记录日期：2026-10-03，Asia/Shanghai。安装目标是用户确认的 **desktop 桌面客户端**。

## 安装结果

- 应用：`E:\DeepSeek Harness\DeepSeek Harness.exe`，内置 Harness **0.2.0-rc.2**。
- 插件：`dsh-recheck@0.1.0-alpha.1`。
- 实际配置：`C:\Users\29483\.dsh\profiles\desktop\package.json`，依赖及 bundle 清单已添加 Recheck，已有 bundle 顺序保留。
- 持久安装包：`C:\Users\29483\.dsh\cache\recheck\dsh-recheck-0.1.0-alpha.1-72bec38affd59efc.tgz`。
- 包 SHA-256：`72bec38affd59efc81ed8ec9789ecc479e9d1359423db36384a9494fb2b7c091`。
- 安装使用桌面自带的官方 `dsh plugin --profile desktop add` 命令。
- 安装前配置备份：`C:\Users\29483\.dsh\profiles\desktop\.plugin-manager\recheck-backup-20261003-1245`，含 package、lock、workspace 及已有 Cordis 配置文件。

本机全局 npm 安装的 `dsh` 命令为较旧的 **0.1.0-rc.6**；本次使用桌面内置 CLI，保持同一运行时。desktop 是 Electron 专用配置，不能通过普通 CLI 的 `--profile desktop` 启动。

## 实机功能验证

通过项目已有的 Playwright Electron 开发测试接口启动真实应用，加载实际 `.dsh/profiles/desktop`，没有用浏览器测试配置代替桌面客户端。

以下 **12 项检查通过**：实际 desktop 配置启用、安装文件哈希一致、原生页面与项目绑定、创建双状态、依据未变/变化检查、主动选择不确定复核、外部更新造成的冲突及草稿保留、Markdown 新文件导出及拒绝覆盖、归档恢复及完整历史、UTC/时区展开、列表搜索、无页面异常。

测试文件位于独立项目 `.integration/Recheck安装验收-86c74238`，没有修改已有项目的结论或依据。为了自动提供测试文件夹，仅在测试进程内替代 Electron 文件夹选择返回值；宿主、RPC、业务处理和文件系统均为真实服务。测试没有向聊天输入框发送模型消息，也没有修改权限设置。

持久缓存引用更新后重新启动真实客户端：原卡片 revision **9**、两个历史版本及 unchanged/uncertain 状态仍可读取。桌面协议内的公开 `/api/pluginInventory/list` 返回 **HTTP 200 / ok**，清单包含 Recheck。

本机详细结果：`.integration/desktop-smoke-result.json`；截图位于测试项目内 `desktop-result.png`。测试脚本为 `scripts/desktop-smoke.mjs`，复跑会创建新的专用验收项目。

## 使用入口

从开始菜单或安装目录打开 **DeepSeek Harness**，选择项目工作区及会话，打开右侧栏，选择 **Recheck · 结论保鲜盒**。可以先打开名为“Recheck安装验收-86c74238”的测试工作区查看验收卡片，再切换到自己的项目创建卡片。

卡片数据保存于对应项目的 `.dsh/recheck/cards.json`。依据文件未变化不代表结论正确；支持、否定或不确定需要主动选择并填写说明。

本次桌面安装不改变 alpha 发布标记；Linux 及跨平台 beta 门槛见 `09-implementation-and-acceptance.md`。
