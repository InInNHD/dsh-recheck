# 安装、卸载与回退 / Installation

版本：Recheck 0.1.0-alpha.4。宿主：DSH 0.2.0-rc.2，Node.js 24。非官方社区插件。

此页对应 alpha.4 UI 改版。界面与实机验证范围见 [UI 改版说明](15-ui-refresh.md)。

## npm 安装

Web：`npx.cmd --yes --package=@deepseek-ai/dsh@0.2.0-rc.2 dsh plugin --profile web add dsh-recheck@0.1.0-alpha.4`。Linux 用 `npx`。Desktop 将下文 bundled CLI 的 add 参数替换为 `dsh-recheck@0.1.0-alpha.4`。预发布使用固定版本或 `dsh-recheck@alpha`；`latest` 可能仍指向旧版，不用于选择本次 UI 改版。

## GitHub Release 安装包

从 https://github.com/InInNHD/dsh-recheck/releases/tag/v0.1.0-alpha.4 下载 tgz 和 `.tgz.sha256`。不要将自动生成的 Source code ZIP 当作预构建插件。

PowerShell 校验：

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath './dsh-recheck-0.1.0-alpha.4.tgz'
Get-Content -LiteralPath './dsh-recheck-0.1.0-alpha.4.tgz.sha256'
```

Linux 校验：`sha256sum -c dsh-recheck-0.1.0-alpha.4.tgz.sha256`。

## 普通 Web 配置

以下命令使用固定宿主，不依赖旧的全局 dsh 命令。先停止已有 Web 服务；升级前备份 profile 的 package/lock/patch 配置和项目数据。

```powershell
npx.cmd --yes --package=@deepseek-ai/dsh@0.2.0-rc.2 dsh plugin --profile web add './dsh-recheck-0.1.0-alpha.4.tgz'
npx.cmd --yes --package=@deepseek-ai/dsh@0.2.0-rc.2 dsh web
```

Linux 将 `npx.cmd` 改为 `npx`。用宿主输出的认证 URL 打开浏览器，选择项目会话，从右侧栏打开“Recheck · 结论保鲜盒”。不要公开认证 URL。

卸载：停止 Web，再执行匹配宿主的命令，然后重启：

```powershell
npx.cmd --yes --package=@deepseek-ai/dsh@0.2.0-rc.2 dsh plugin --profile web remove dsh-recheck
```

## Windows Desktop

先退出桌面应用。使用安装目录内的 `resources/runtime/cli/bin/dsh.cmd`，它与桌面宿主共用运行时。将下方路径替换为自己的安装位置与下载文件：

```powershell
$recheckDesktopCli = 'C:\Path\To\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $recheckDesktopCli --version
& $recheckDesktopCli plugin --profile desktop add 'C:\Downloads\dsh-recheck-0.1.0-alpha.4.tgz'
```

版本须为 0.2.0-rc.2。然后从桌面应用入口启动，选择项目会话并打开原生右侧栏。不能用普通 CLI 启动 Electron 的 desktop profile。

卸载时退出桌面，再执行 `& $recheckDesktopCli plugin --profile desktop remove dsh-recheck`，随后重新启动应用。安装目录布局来自已验证的 Windows 0.2.0-rc.2 Desktop；其他布局或平台请使用该应用自己的插件管理入口，勿猜测全局 CLI。

## 从源码开发试用

克隆源码后执行 `npm ci`、`npm run check`、`npm pack`，再执行 `node scripts/install-local.mjs`。它只安装到源码目录的 `.integration/dsh-home/profiles/recheck-web`。

PowerShell 启动独立配置：

```powershell
$env:DSH_HOME = Join-Path (Get-Location) '.integration/dsh-home'
node './.integration/dsh-home/profiles/recheck-web/node_modules/@deepseek-ai/dsh/lib/bin.js' --profile recheck-web --port 31479 --no-open
```

Linux：

```sh
DSH_HOME="$PWD/.integration/dsh-home" node .integration/dsh-home/profiles/recheck-web/node_modules/@deepseek-ai/dsh/lib/bin.js --profile recheck-web --port 31479 --no-open
```

宿主和插件必须共享 SDK 实例。该 RC 的独立开发配置使用配置内的 CLI 启动，避免混用开发目录或全局 SDK。

## 数据备份与回退

停用插件或确认没有写入，复制每个项目的 `.dsh/recheck/cards.json`。卸载不删除该文件。恢复前保留现有文件副本，核对 schemaVersion 和结构；没有自动清空或丢弃历史的恢复方式。

回退使用同一宿主安装先前 Release 的 tgz，重启后读取数据。alpha.1 与 alpha.2 都使用 schemaVersion 1。未来版本若升级 schema，须按迁移文档判断，不能假定旧插件仍可读取。

遇到冲突先重新读取卡片；损坏存储先留副本。卡片操作无需配置模型消息或额外模型调用。
