# Recheck · 结论保鲜盒

给项目结论绑定文件依据，在依据变化后提醒复核。插件提供一个 `recheck` 工具及 DSH 原生右侧栏页面。

当前为 **0.1.0-alpha.1 开发预览**，针对 **DeepSeek Harness 0.2.0-rc.2、Node.js 24**。发布状态和实测结果见 [验收记录](docs/09-implementation-and-acceptance.md)。原需求中的 beta 发布要求包含 Windows 和 Linux 实机验证；未满足前保留 alpha 标记。

核心与真实 Native/Node PTC 检查 **29/29 通过**，真实 Web 的 **14 项流程通过**，Windows tgz 安装、卸载、重装与数据保留已验证。25 张卡片、100 个 64 KiB 文件的完整持久检查，五轮中位数为 **587.08 ms**，本机达到原 2 秒目标。Linux 尚未实测。旧学习计划仅作历史资料，项目已转为正式开发。

## 开发与打包

在本项目目录运行：

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd pack
```

`check` 包含 Host/Client TypeScript 检查、两端构建、真实 DSH 文件系统回归测试，以及真实 Native/Node PTC 调用测试。构建产物位于 `lib/`，安装包名为 `dsh-recheck-0.1.0-alpha.1.tgz`。没有运行发布到 npm 的命令。

## 安装到独立 Web 配置

先构建和打包，再运行：

```powershell
node scripts/install-local.mjs
```

脚本会在项目的 `.integration/dsh-home/profiles/recheck-web` 安装本地 tgz 与固定版本 DSH，并写入该独立配置的 bundle 清单。使用安装好的本地 CLI 启动，可以让宿主和插件共用同一份 SDK；脚本不会改动日常 DSH 配置。

本机首次安装和重复运行均已通过，宿主与插件的 8 项 peer SDK 共用同一物理目录。最终交付包的内容与安装校验以交付时检查结果为准。

脚本按包内容 SHA-256 将安装副本暂存到 `.integration/packages`；重新打包同版本后再运行，也会更新实际插件内容，避免 npm 复用旧本地包缓存。

上述安装助手位于开发目录，作为本地试用入口；发行 tgz 包包含运行产物，不包含开发脚本或测试项目。

```powershell
$env:DSH_HOME = 'E:\DSH Recheck Plugin\.integration\dsh-home'
node '.\.integration\dsh-home\profiles\recheck-web\node_modules\@deepseek-ai\dsh\lib\bin.js' --profile recheck-web --port 31479 --no-open
```

用宿主输出的带认证 token 的 URL 打开浏览器。在会话中选择项目，再从右侧栏的页面入口打开 **Recheck · 结论保鲜盒**。不要发送模型消息来完成卡片操作，面板操作不会请求模型。

安装到已有配置时，应采用 DSH 当前版本的插件管理流程并确认 SDK 来自同一运行时。不要把另一套宿主核心模块混装进现有配置；当前 RC 的部分状态使用模块内的身份映射，混用两份 SDK 会导致会话或设置操作失败。

## 使用

1. 创建卡片：填写标题、结论和 1–8 个项目相对文件路径。
2. 检查依据：插件比较完整原始字节 SHA-256，显示未变化、变化、缺失或未知。
3. 阅读实际依据并自行判断后，选择支持、否定或不确定并填写复核说明。
4. 导出 Markdown 或归档；恢复后重新检查。

文件新鲜度与复核意见独立。`unchanged` 不证明结论正确；`refuted` 卡片也可能依据未变化。复核前会重新读取文件，拒绝过期的检查和卡片 revision。

Agent 工具示例：

```json
{"action":"create","title":"重试不会重复扣款","claim":"相同 requestId 的重试只扣款一次。","files":["src/payment.ts","tests/retry.test.ts"]}
```

其他 action 为 `list/get/edit/check/review/archive/export`。`edit/review/archive` 及单卡 `check` 必须使用刚读到的 `expectedRevision`；`review` 还必须引用最新持久检查返回的 `checkId`。所有操作自动使用调用会话的项目，不接受自定义根目录、来源、指纹或时间。

## 数据与边界

- 数据仅保存在项目内 `.dsh/recheck/cards.json`，不保存依据原文，不发送网络请求。
- 创建和语义编辑必须完整捕获全部依据；失败不会保存半张卡片。
- 所有业务 I/O 使用 `ctx.fs`，沿用宿主观察、写入意图及沙箱策略。禁止项目逃逸、符号链接、目录联接和插件自身存储作为依据。
- 存储使用版本 guard 原子写入；损坏 JSON 和不支持的 schema 不会被覆盖成空库。
- 只读模式只允许读取、复制导出和显式 `persist:false` 临时检查。临时检查不改变 revision，也没有可用于复核的 checkId。
- 上限：100 张活动卡片、200 张总卡片、每卡 20 个版本、每文件 2 MiB、存储 8 MiB；单次批量最多 200 个唯一文件、64 MiB 读取预算、10 秒读取时间预算。未覆盖部分如实显示 unknown。
- 标题、结论、说明分别最多 120、2,000、4,000 个 Unicode code point；达到容量后明确拒绝，不删除旧记录。
- 多文件分别观察，不提供全项目同一时刻快照；检查期间可能出现普通并发编辑。
- 若宿主在原子写入完成后将工具调用标为取消，插件最终文本会附实际已保存结果；请先重新读取卡片再重试。

备份前停用插件或确认没有提交进行，再复制 `.dsh/recheck/cards.json`。损坏文件先留副本，恢复备份时核对 schema 与结构；插件不会自动清空数据或丢弃历史。卸载保留项目数据。

## 代码位置

`src/index.ts` 负责宿主注册与可信会话绑定；`src/recheck.ts` 负责业务操作和提交队列；`src/io.ts` 负责安全路径和完整文件读取；`src/store.ts` 负责存储校验与原子提交；`src/export.ts` 生成安全 Markdown；`src/client.tsx` 注册原生侧栏及表单。关键边界在源码中有中文注释。`learning/` 保留原学习记录，不参与插件构建。
