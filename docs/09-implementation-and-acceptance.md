# Recheck 实现与验收记录

记录日期：2026-10-03，Asia/Shanghai。插件版本：**0.1.0-alpha.1**。本文件取代旧教学文档中的实时进度描述；原始四份需求文档仍是产品需求依据。

项目已经进入正式实现与交付。工具闭环、Host/Client 源码、构建和自动化测试已经具备；以下区分代码实现、实际运行证据和未验证事项。尚未完成 Linux 安装与流程实测，因此当前不能称为 `0.1.0-beta.1`。

## 1. 交付范围与当前状态

| 部分 | 当前事实 | 验证方式 |
| --- | --- | --- |
| 领域操作 | create/list/get/edit/check/review/archive/export 已实现 | 真实 DSH 文件系统回归测试 |
| 文件指纹与双状态 | 完整原始字节 SHA-256；freshness 和 assessment 分别存储 | 相同字节、换行变化、mtime、恢复、缺失与未知反例 |
| 可靠存储 | schemaVersion 1、有界校验、提交队列、文件版本 guard、原子写入 | 实际本地 FS、外部改动竞态、故障注入 |
| Host 工具 | 一个 `recheck` 工具，8 个 action；check 单卡/全部分成独立 schema 分支 | 真实 Native ToolRuntime 与官方 Node PTC |
| Web 接口 | 认证 `/api/recheck/dispatch` 精确 fetch 路由可调用，实测 HTTP 200 | 固定版本 Web profile 的实际 RPC 请求 |
| 原生 Web 面板 | 14 项真实浏览器流程通过，含认证、主闭环、只读、草稿隔离、UTC 及窄栏 | Playwright 连接真实固定版本 DSH Web 与现有 Edge；完整范围见 Web 记录 |
| Windows 本地 tgz | 独立 profile 安装、启动、卸载、重装、数据重读通过；安装助手首次与重复运行均成功 | 真实预构建 tgz，插件 inventory 与存储 SHA-256 对照；最终交付包再核对清单 |
| Linux | 未实测 | 当前可用 Docker 引擎未启动；没有 Linux 成功证据 |
| 性能目标 | 本机持久检查中位数 587.08 ms、最慢 636.55 ms，达到 2 秒目标 | 预热一次、测量五次；见下方性能记录 |

已确认的自动化测试为 **29 项全部通过**：26 项核心测试、3 项真实 Host 集成测试。包括两会话并发复核、三种问题同卡混合、真实 ToolRuntime 在发布后取消的最终文本事实；另有 14 项真实 Web 流程通过。正式项目进度以本记录为准，最终交付包的清单及安装校验以交付时结果确认。

## 2. 已固定的环境

| 项目 | 版本 / 范围 |
| --- | --- |
| 操作系统 | 本机 Windows；Linux 未验证 |
| Node.js / npm | 24.18.0 / 11.16.0 |
| DeepSeek Harness | 0.2.0-rc.2，项目与独立 profile 本地依赖 |
| Cordis | peer 范围 `~4.0.4` |
| TypeScript / Node 类型 | 7.0.2 / 24.19.1 |
| esbuild | 0.28.2 |
| React / React 类型 | 18.3.1 / 18.3.31；运行时使用宿主共享 React |
| Zod | 4.6.5；存储结构校验 |
| Playwright | 1.63.0；本机 Edge 的本地 Web 验收工具 |

具体安装依赖由 `package-lock.json` 锁定。开发包不会捆绑另一套 DSH 核心 SDK。当前 RC 的部分服务保存模块身份，若宿主和插件混用不同物理位置的核心模块，会话恢复和设置操作可能失败；独立 profile 使用其自身安装的 CLI 启动，保证服务共用同一份 SDK。

## 3. 实际架构与接入决策

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | Cordis 插件、工具 schema、Native/PTC 注册、认证 Web 路由、可信会话与沙箱上下文 |
| `src/types.ts` | 双状态、卡片/版本/检查类型、请求联合及固定限额 |
| `src/cards.ts` | 严格 action 字段校验、路径规则、状态汇总、关注条件和 revision 检查 |
| `src/io.ts` | 宿主解析与边界校验、稳定有界读取、观察事件、写入意图和 guarded write |
| `src/store.ts` | 有界 UTF-8 JSON、Zod 完整结构与关系校验、宿主文件版本保护 |
| `src/recheck.ts` | 各 action、版本规则、批量去重与预算、每项目提交队列、卸载清理 |
| `src/export.ts` | 含来源、时间、指纹、检查与限制的 Markdown；用户文本转义 |
| `src/client.tsx` | DSH 右侧栏注册、列表/详情、创建/编辑/复核、草稿、复制和导出 |
| `scripts/build.mjs` | Host ESM、Client 公共模块加载 factory；外置宿主共享依赖 |
| `scripts/install-local.mjs` | 在专用 `.integration` DSH home 内安装本地 tgz 和固定宿主 |
| `scripts/benchmark.mjs` | 25 卡/100 文件的真实 DSH FS 持久检查基准与覆盖断言 |
| `scripts/web-smoke.mjs` | 通过本机真实 Web 页面的可复跑 GUI 流程，不发送模型消息 |
| `tests/core.test.mjs` | 真实文件系统上的核心行为、限额、故障与竞态回归 |
| `tests/host.test.mjs` | 真实 Cordis/ToolRuntime 生命周期与官方 Node PTC 调用 |

与最初计划的实际差异：构建采用已锁定的 esbuild；测试直接使用 Node 内置 `node:test`；没有新增数据库、后台 watcher 或独立网页。Client 通过 `sidebarRightTabs` 和 keyed slot 加入宿主原生右侧栏，构建为宿主 `window.__ModuleLoader__.load` 支持的 factory 格式。

Web 调用复用宿主认证 `/api` 通道，注册一个精确 fetch 路由，不占用 API Gateway 的共享拦截器。入口仅接受会话 ID 与领域请求，调用公共 `sessionController.resolveAgent` 恢复会话及权限事实，再使用会话不可变 header 的 cwd。面板来源固定为 `user`，工具来源固定为 `agent`；请求不能自带工作区、来源、时间或指纹。

面板复核显示所引用检查的观察时间与依据数量，不默认选择支持意见。容量达到上限时说明原因；筛选无匹配与项目真正空列表使用不同提示。临时观察按 cardId/versionId 绑定，版本变化后清除，持久检查或编辑/复核成功也清除旧临时投影，避免把过期观察显示在新版本上。

生产业务 I/O 全部走 `ctx.fs`。创建、存储与导出写入发布 `fs/observed`，经 `fs/write-intent` 及宿主 sandboxPolicy，使用 `createIfAbsent` 或 `replaceIfVersion`。测试布置临时文件使用 Node fs；这不是生产 I/O 的回退路径。

## 4. 行为合同

| action | 必需的关键参数 | 持久行为 |
| --- | --- | --- |
| create | title、claim、files；note 可选 | 全部依据成功才创建；初始 unchecked/unreviewed |
| list | 无；query、archived、needsAttention、freshness 可选 | 只读存储，不扫描依据；默认活动卡片 |
| get | cardId；includeHistory 可选 | 只读；默认只回当前版本，历史需显式请求 |
| edit | cardId、expectedRevision；至少一个 title/claim/files | 仅标题改元数据；结论或依据变化追加版本并重置双状态 |
| check(card) | scope:card、cardId、expectedRevision | 默认保存 latestCheck，不增加结论版本；persist:false 为临时结果 |
| check(all) | scope:all | 检查全部活动卡片；不受列表搜索筛选影响；一次提交 |
| review | cardId、expectedRevision、checkId、assessment、note | 只能引用当前版本最近保存的完整检查，重新读取一致才追加版本 |
| archive | cardId、expectedRevision、archived | 归档保留数据；恢复清除最近检查，回到 unchecked |
| export | cardId；includeHistory、path 可选 | 默认只生成文本；指定相对 path 才创建新文件，不覆盖 |

所有未知字段和与 action 不适用的字段都会被拒绝。领域拒绝返回 `status:rejected` 及 `reason.code/message/retryable`；基础设施异常不会伪装为成功。读取失败原因只报告类别和显式依据路径，不附文件正文或主机根目录。

`missing > changed > unknown > unchanged` 是有检查记录时的汇总优先级；没有检查记录为 `unchecked`。`supported + changed` 和 `refuted + unchanged` 都是合法组合。需要关注等于新鲜度非 unchanged，或意见为 unreviewed/uncertain；单靠时间流逝不改变状态。

完全相同的编辑不写入、不增加 revision。当前依据路径列表按输入顺序比较，重新排列同一批路径也可能追加版本；原教学计划中的“集合比较”是建议补充约定，尚未作为实现承诺。标题修改不追加版本；语义编辑要求变更说明。

复核在取得项目提交队列之后重新捕获全部依据，再校验被引用的检查指纹和卡片 revision。这样避免排队期间的旧观察被直接提交。多个依据仍是分别读取，无法保证全项目同一时刻快照。

## 5. 数据、容量与权限边界

唯一数据路径为 `<workspace>/.dsh/recheck/cards.json`。其中保存相对路径、完整字节哈希、大小、观察时间、结论和说明、user/agent 与来源会话、历史版本、当前版本最近检查。依据文件正文不进入存储，也不修改会话日志。

| 限额 | 实现值 | 达限行为 |
| --- | --- | --- |
| 标题 / 结论 / 说明 | 120 / 2,000 / 4,000 Unicode code point | 明确拒绝；不按 UTF-16 长度计算 |
| 每版本依据 | 1–8 个，稳定目标不得重复 | 拒绝创建或语义编辑 |
| 单依据 | 2 MiB 完整字节 | 创建/复核拒绝；检查 unknown，不生成截断哈希 |
| 活动 / 总卡片 | 100 / 200 | 独立限制；归档仅释放活动名额 |
| 每卡版本 | 20 | 拒绝新增版本；不删除历史；普通检查与标题修改仍可进行 |
| JSON 数据文件 | 8 MiB UTF-8 | 读取或提交超限均拒绝，保留原文件 |
| 单次检查 | 200 个去重目标、64 MiB 读取预算、10 秒读取期限 | 未覆盖项 unknown；返回覆盖与冲突统计 |

失败读取可能消耗部分字节，批量预算保守扣减该次读取许可额度；因此实际有效检查覆盖可能少于理论 64 MiB。读取预算和用户取消不同：预算到期可以提交明确的 unknown；用户在提交前取消则整次不提交。

拒绝绝对路径、URL、盘符/UNC、上级目录、NUL/控制字符、设备名、尾部点/空格、非普通文件、符号链接及目录联接。存储自身不能作为依据或导出目标。宿主解析后的稳定目标必须在可信项目内；不能证明边界时拒绝，不用 Node fs 绕过。

只读会话可以 list/get、生成 Markdown、执行显式 `persist:false` 临时检查；不能创建、编辑、复核、归档或写导出。临时检查没有 checkId，不更新 revision、storeRevision 或持久观察时间，不能用于复核。

文件版本 guard 保护首次确认不存在和后续替换。损坏 JSON、未来 schema、不合法关系或超限存储不会自动重建为空库。卸载取消未完成的读取，等待在途工作，注销入口并保留已提交数据。跨 Host 写入、共享网络盘和远程文件系统未声明支持。

## 6. 需求与 AC 验收映射

下表的“通过”只对应列出的验证范围。自动化测试包含真实宿主 FS 与受控故障注入，并不等于所有操作系统权限场景、浏览器行为或跨平台发布门槛通过。

| AC | 对应需求 | 当前证据与结果 |
| --- | --- | --- |
| AC-01 创建后状态与基线 | R-01/02/04 | 通过：完整工作流测试断言 revision 1、完整哈希、unchecked/unreviewed |
| AC-02 未改内容检查 | R-03/04 | 通过：保存 unchanged、意见不变、检查与版本分别更新 |
| AC-03 一个依据变化 | R-03/04 | 通过：CRLF/LF 字节变化及完整工作流显示 changed，基线保留 |
| AC-04 依据删除 | R-03/04 | 通过：实际删除 fixture 文件，保留依据并记录 missing |
| AC-05 超限或拒绝读取 | R-02/04/10 | 部分通过：实际超 2 MiB 文件为 unknown，基线失败不留半卡；操作系统级拒读场景未单独实测 |
| AC-06 只改 mtime | R-04 | 通过：实际 utimes 后仍按字节判 unchanged |
| AC-07 恢复基线字节 | R-04 | 通过：修改后恢复 CRLF 字节，重新检查为 unchanged |
| AC-08 三种问题混合 | R-04 | 通过：同卡实际缺失、变化、超限三项，汇总 missing，逐项保留 missing/changed/unknown |
| AC-09 复核期间再次变化 | R-05/06 | 通过：检查后修改依据再复核，CHECK_CONFLICT，旧存储逐字节不变 |
| AC-10 同 revision 并发复核 | R-05/06/07 | 通过：同项目两来源会话并发 review，一胜一 REVISION_CONFLICT，原历史完整；并发编辑另测 |
| AC-11 取消批量 | R-03/06 | 通过：真实读取钩子注入取消，保存内容不变；已发布后的取消在业务与真实 ToolRuntime 路径分别验证事实返回 |
| AC-12 导出不覆盖 | R-08 | 通过：实际创建导出后重试返回 FILE_EXISTS，保留原文本；恶意 Markdown 文本也已测 |
| AC-13 项目隔离/同项目共享 | R-07 | 通过：核心项目隔离与共享；真实 GUI A/B 草稿隔离及同项目新会话恢复通过，A 草稿不会写入 B 或被 B 草稿覆盖 |
| AC-14 损坏/未知 schema | R-06/10 | 通过：损坏 JSON、schema 9、不合法结构均明确拒绝并保留字节 |
| AC-15 归档/恢复 | R-09 | 通过：列表范围、归档、历史保留与恢复 unchecked；真实 GUI 归档/恢复通过 |
| AC-16 卸载/重新安装 | R-12、N-09 | 通过 Host/安装范围：真实 Cordis dispose 注销工具；独立 tgz 卸载后 inventory 不再含插件，重装重启后 active，旧会话/卡片/检查/历史与字节哈希不变；页签注销未自动 GUI 确认 |
| AC-17 读取期间变化 | R-02/04/10 | 通过：真实 FS 读取钩子在读取中修改文件，结果 unknown，无可靠哈希 |
| AC-18 只读临时检查 | R-03/10 | 通过：核心政策与真实宿主只读切换均验证临时结果未保存；GUI 存储字节不变，恢复可写后持久检查清除临时显示 |

R-11 的真实浏览器主流程已通过；详见 Web 记录。R-12 的 Windows tgz 安装、重启、卸载、重装已实际执行；页面卸载注销未自动 GUI 确认，Linux 仍没有验证证据。R-13/14 为 P1，未实现。

| 非功能需求 | 当前结论 |
| --- | --- |
| N-01 正确性 | 已有反例测试，未知与缺失不被转换为正常 |
| N-02 可靠性 | 真实 FS 原子故障、外部版本 guard、损坏保护、限额与取消已测 |
| N-03 权限 | 使用真实 FS/观察政策路径；可信会话来源、路径与只读策略已测，真实 GUI 只读切换通过；OS 拒读仍未单独实测 |
| N-04 隔离 | 核心隔离/共享与 Native 来源绑定已测；GUI 项目身份、A/B 草稿隔离、同项目新会话草稿恢复通过 |
| N-05 性能 | 本机指定基准中位数与最慢值均小于 2 秒；覆盖完整，无 unknown；见性能记录 |
| N-06 可访问性 | 有文字状态、label、焦点样式和错误区域；900×850 下窄栏无横向溢出，标题聚焦后 Tab 到结论输入通过；完整纯键盘流程未单独验收 |
| N-07 可维护性 | 一个发布包，标准库测试，单业务服务；源码有关键中文注释 |
| N-08 隐私 | 业务无外发/遥测，不输出原始依据内容；导出仍包含用户主动填写的文本 |
| N-09 生命周期 | 核心取消/等待/注销与实际 tgz 卸载重装已测，数据保留；页签注销未自动 GUI 确认 |

## 7. 可复现的检查与安装

以下命令在本开发目录运行，使用 Windows PowerShell。不会执行 npm publish。

```powershell
Set-Location -LiteralPath 'E:\DSH Recheck Plugin'
npm.cmd ci
npm.cmd run check
npm.cmd pack
node '.\scripts\install-local.mjs'
```

`check` 执行两端类型检查、构建与 29 项自动化测试；`prepack` 会再次执行检查，失败不会正常产出候选包。`npm ci` 需要可访问依赖源，使用锁文件安装。npm 的旧 Puppeteer 用户配置警告不属于本插件代码。

安装助手只操作 `.integration/dsh-home/profiles/recheck-web`，采用公共 profile 初始化，安装本地 tgz 和固定版本 DSH，合并 bundle 清单。脚本重复执行时保留已有的其他 bundle；如果独立配置名称不匹配会停止。项目源代码包含此助手；tgz 只包含运行产物和必要说明。

安装前将包复制到 `.integration/packages`，文件名包含内容 SHA-256 的前 16 位。开发中重新生成相同版本号 tgz 后再运行，npm 会按内容变化安装新副本，避免旧 `file:` 包缓存继续保留上一轮代码。临时安装副本仍在独立测试目录中，不改动日常配置，也不进入发行包。

本机首次安装及重复运行实测均以 exit code 0 结束；8 项 peer SDK 与宿主解析到同一物理目录，安装的 `lib/index.js`、`lib/client.js`、`cordis.patch.yml` 的 SHA-256 与本次构建一致。`recheck-web` 安装配置和用于 RPC 验证的 `recheck-smoke` 配置相互独立；安装助手验收本身不代表该 profile 已做 GUI 操作。

```powershell
$env:DSH_HOME = 'E:\DSH Recheck Plugin\.integration\dsh-home'
node '.\.integration\dsh-home\profiles\recheck-web\node_modules\@deepseek-ai\dsh\lib\bin.js' --profile recheck-web --port 31479 --no-open
```

用终端打印的带 token URL 打开浏览器，添加或选择项目工作区及普通会话，打开右侧栏，选择 **Recheck · 结论保鲜盒**。卡片操作无需发送模型消息；首次 API Key 引导可稍后配置，模型对话是否可用由宿主另行管理。

自动化测试使用独立临时目录；Web 测试使用 `.integration` 专用项目。日常 DSH home/profile 和真实项目数据未作为测试目标。认证 token、浏览器 storage state 与测试数据不进入包。

额外验证脚本：`npm.cmd run benchmark` 会构建并重新测量；`npm.cmd run test:web -- --url '启动时输出的完整本机 URL'` 在已启动的独立 Web profile 上创建专用验收项目。URL 参数需要替换为本次启动输出，包含必要认证信息。浏览器可用 `--browser` 指定已有 Chromium/Edge 路径；`--state` 可指定本机已认证的 Playwright storage state 文件。Web 脚本限制连接 localhost，并把结果和截图保存在 `.integration`，这些文件不发布。

## 8. Windows 安装生命周期记录

2026-10-03，在独立 `recheck-web` profile、端口 31479、专用 `.integration/lifecycle-project` 完成真实 tgz 安装与生命周期验证；结果保存于 `.integration/lifecycle-result.json`。这轮测试结束后专用 31479 服务已停止。

- 正常运行时创建卡片，检查并记录 uncertain 复核；revision 为 3，历史为 2 个版本。
- 停止测试服务，移除该 profile 的插件 bundle 并执行 npm uninstall；重启后插件 inventory 不再包含 Recheck。
- 卸载前后 `.dsh/recheck/cards.json` 的 SHA-256 完全相同。
- 从实际 tgz 重新安装，恢复 bundle 后重启；inventory 为 active，原会话通过公共 RPC 读取的卡片、revision、latestCheck 和完整历史与卸载前完全一致。

存储对照哈希为 `10e21209bed15fd1befdee3c60fd1c556fc09b00920c2ecca98aac2df2037a88`。没有清空数据或重新创建替代卡片来模拟恢复。工具注销另有真实 Cordis 自动化测试，客户端页签在卸载后的 GUI 注销尚未单独自动验收。

## 9. 真实 Web 记录

2026-10-03，独立 `recheck-smoke` Web profile 安装 preview7 tgz，在本机 Edge 上执行 `scripts/web-smoke.mjs`，结果 **14 项流程全部通过**。报告保存于开发目录 `.integration/web-smoke-result.json`，测试项目为 `.integration/web-smoke-ad392a7b`，截图为该项目的 `web-result.png`。这些文件只作本机验收资料，不随包分发。

1. 宿主原生侧栏入口可打开，RPC HTTP 200，面板绑定脚本创建的项目与普通会话。
2. 未认证浏览器请求被宿主以 401/403 拒绝；已认证请求仍不能携带伪造 cwd。
3. 表单创建卡片后显示 unchecked/unreviewed，真实存储来源为 user。
4. 完整检查先为 unchanged，改动 fixture 后显示 changed，意见不被自动提升。
5. 复核不预选支持；显式选择否定、填写说明，形成新版本及 unchanged/refuted。
6. 另一次请求更新卡片后，旧编辑保存冲突，输入保留；重新读取仍保留草稿，只有显式采用当前 revision 后保存成功。
7. 导出预览与新文件逐字节相同；重复目标被拒绝，已有内容未变。
8. GUI 归档与恢复成功，历史保留。
9. 使用宿主真实只读设置后，GUI 显式临时检查，存储文件逐字节不变。
10. 恢复可写设置后持久检查成功，旧临时投影清除。
11. 900×850 视口下插件窄栏无横向溢出，标题输入聚焦后 Tab 正确进入结论 textarea。
12. 点击 UTC 时间详情按钮，展开完整 ISO 时间与本地时区。
13. 在 A 填写未保存草稿，切至 B 时表单为空；B 的新草稿不会覆盖 A，回到 A 的新会话时恢复 A 草稿。
14. 无浏览器 pageerror，也没有向宿主发送模型会话消息。

以上为真实 UI、认证 RPC、宿主服务与文件系统连通验证；不是用 mock 响应代替宿主。表单明确提示草稿自动保留、刷新关闭会丢失，以及可先放弃草稿；不拦截宿主导航，也不弹出阻塞确认。仍未独立验收的 UI 细节是完整纯键盘全流程、卸载后的页签注销重载。

## 10. 性能记录

2026-10-03，在 Windows `10.0.26200`、AMD Ryzen 7 5800H、16 逻辑核、15.86 GiB 内存、Node 24.18.0、DSH/本地文件系统 0.2.0-rc.2、Recheck 0.1.0-alpha.1 上执行 `node scripts/benchmark.mjs`。磁盘型号未采集，文件位于本机系统临时目录；不能据此推算其他机器的延迟。

布置 25 张卡，每卡 4 个独立文件，共 100 个唯一文件，每文件 64 KiB，总依据字节 6,553,600（6.25 MiB）。创建和一次预热不计时，之后测量五次 `check(scope:all)`，计时包含真实 DSH FS 读取、哈希、JSON 校验与原子持久提交，不包含浏览器/RPC 往返。

| 轮次 | 完整操作耗时 |
| --- | --- |
| 1 | 606.88 ms |
| 2 | 636.55 ms |
| 3 | 583.16 ms |
| 4 | 577.04 ms |
| 5 | 587.08 ms |

**中位数 587.08 ms，最慢 636.55 ms，本机达到 N-05 的 2 秒目标。** 每轮均断言 100 个去重目标、100 次完整依据读取、6,553,600 个实际依据字节、25 张 unchanged、无冲突、无错误、无 unknown；保存后的 revision 与检查身份也经过断言。所有容量/超时反例仍由核心测试单独覆盖。

## 11. 发布门槛、限制与备份

当前交付标记为 alpha，允许本地试用。升到 beta 前必须补齐表中未验证项并记录真实证据，尤其 Linux 安装与核心流程，以及剩余 UI 细节。单机通过不等于跨平台兼容。

已知限制：

- 完整文件任何字节变化都会提示，包括格式与注释；不做语义判断、自动测试或文件更名追踪。
- 各文件分时读取，检查/提交后仍可能变化；显示的状态只覆盖所列文件的上次观察。
- 单 Host 共享提交队列；不承诺多个 Host 同时写入同一存储。
- 草稿只保存在当前客户端内存，按项目隔离；刷新浏览器、重启或卸载会丢失草稿。
- 草稿提示位于表单中，按项目自动保留在内存映射，不使用会话切换时的独立确认弹窗。
- 界面日期显示本地时间，可通过 UTC 按钮展开完整时间与本地时区；导出保存明确 UTC，该展开交互已实际通过。
- RC 宿主必须与插件共享同一份 SDK；目前只声明固定版本，未测试新版或全局旧版。
- 取消恰逢原子发布完成时，宿主 ToolRuntime 可能标记结构化调用为取消；插件最终文本保留实际已保存结果。重新读取后再决定重试，避免误以为没有保存。
- 原始 SHA-256 不是签名或防篡改账本；本机用户可以手工改 JSON，插件仅负责严格校验后接受。
- 不包含片段指纹、消息选区收藏、语言切换、自动扫描/定时、云同步或数据库。

备份时先停用插件或确认没有写入，把 `.dsh/recheck/cards.json` 复制到自己选定的位置。恢复前保留现有或损坏文件副本，再核对备份的 schemaVersion 和完整结构。插件没有自动清空、自动迁移或删除历史按钮；卸载保留数据。

包清单由 `package.json.files` 限定为 Host/Client、source map、Cordis patch、README、LICENSE 及本验收文档。最终打包与安装检查以交付时结果确认，检查实际 tar 清单及安装文件哈希，排除源码 fixture、learning、node_modules、凭据及 `.integration`；本记录不把未来检查提前写为成功。
