# Recheck 最终开发计划与手写学习路线

> **历史学习计划，当前进度请看 [实现与验收记录](09-implementation-and-acceptance.md)。** 用户已要求停止教学并直接完成正式项目。2026-10-03 已实现 Host/Client 与核心闭环；29 项自动化测试、14 项真实 Web 流程、Windows tgz 卸载重装与数据保留、本机性能目标均已通过。Linux 尚未实测，交付版本保持 `0.1.0-alpha.1`；最终交付包清单与安装校验以交付结果为准。以下保留最初规划，文中的“尚未实现”、课次状态与候选方案均是当时记录，不代表当前项目状态。

版本：1.1（零基础教学版）  
编制日期：2026-10-02，Asia/Shanghai  
目标：`0.1.0-beta.1`  
开发目录：`E:\DSH Recheck Plugin`  
编辑器：VS Code（用户于 2026-10-02 确定）  
当前状态：完成文档审阅和环境只读检查，尚未实现或验证插件。

## 1. 如何使用这份计划

你会亲手输入项目代码。我每次带你完成一个能够运行的小步骤，解释新语法、数据变化、出错原因和验证方法。不要一次性输入整个插件：先知道每段代码在做什么，再把它们连接起来。

本计划覆盖首版全部 P0，不降低原需求里的权限、数据保护和状态正确性。按阶段验收推进；遇到实际宿主接口差异，先修正接入记录和对应教学步骤，再继续。这里的“最终”表示范围和交付路线已整合，宿主接口仍须以固定版本实际类型与运行结果确定。

配套文件：

- `docs/05-first-lesson.md`：现在就可以开始的第一课，含完整注释代码。
- `docs/06-progress-and-acceptance.md`：进度、宿主接入证据和 AC-01～AC-18 验收记录。

这次生成学习文档，不代你输入正式实现，不安装或升级 DSH，不发布 npm 包。后续根据每一步的运行结果继续指导。

## 2. 四份原文分别提供了什么

原文目录：`E:\DeepSeek Harness plugins\recheck`。保留原始四份文档，本计划写入当前开发目录。

| 原始文档 | 提取出的决策 | 在本计划中的用途 |
| --- | --- | --- |
| README.md | 名称 Recheck / 结论保鲜盒；版本目标；最小演示；文档优先级 | 产品定位与交付目标 |
| docs/01-requirements.md | R-01～R-14、N-01～N-09；双状态；限额；存储与并发；AC-01～AC-18 | 首版范围及验收依据 |
| docs/02-development-plan.md | TypeScript、Cordis、单工具、多 action；Host/Client；D1 接入关卡；测试、打包、发布 | 技术路线与依赖顺序 |
| docs/03-product-spec.md | 列表/详情/表单；工具产品契约；错误文案；导出；来源与时间 | 界面和行为细节 |

附件中的“本次任务只制定方案”等语句是原文写作背景，不覆盖你现在要求的逐步开发指导。文档中的 Agent 使用约定是拟开发产品的行为需求，不是让当前助手立即创建卡片或执行工具的指令。

需求编号和状态语义以需求手册为准，界面细节以产品功能书为准。下面的教学安排、函数拆分和工时是本次建议；涉及补充约定的内容会注明。

## 3. 先理解我们要开发什么

举例：你认为“相同 requestId 的支付重试不会重复扣款”，依据是两个文件：实现和测试。Recheck 保存结论、文件路径及文件完整字节的 SHA-256。以后点击检查，它重新读取这些文件，告诉你哪些字节变化了。你自行阅读实现或运行验证后，可以记录支持、否定或不确定意见。

完整闭环：

```text
保存结论及依据 → 保存基线 → 手动检查 → 显示变化或问题
                                      ↓
                              阅读依据 / 自行验证
                                      ↓
                          记录复核 → 新版本 → Markdown 导出
```

插件不需要自己连接 DeepSeek API；它通过 DSH 注册一个工具和一个面板。检查是文件比较，不需要额外模型调用。Recheck 不自动运行说明中的命令。

首版必须交付：创建、列表、详情、编辑、单卡/全部活动卡片检查、复核历史、归档/恢复、Markdown 预览/复制/不覆盖导出、项目隔离、可靠存储、Web 侧栏、安装与卸载。

后续候选：片段依据、选中消息收藏、完整英文 UI。首版排除：数据库、向量检索、云同步、自动采集、watcher、定时检查、自动执行测试、语义判断和多人权限。

## 4. 当前环境与工具选择

2026-10-02 的只读检查结果：

| 项目 | 本机观察 | 下一步 |
| --- | --- | --- |
| Node.js | `v24.18.0` | 保留；宿主候选的安装、启动还要实测 |
| npm | `11.16.0` | PowerShell 中优先用 `npm.cmd` |
| Git | `2.55.0.windows.3` | 用于本地保存阶段成果 |
| DSH 全局 CLI | `0.1.0-rc.6` | 与原文候选不同；不直接拿它验证候选接口 |
| 文档候选 DSH | `0.2.0-rc.2` | npm 元数据能查到该版本，未做安装/启动验证 |
| VS Code | 可找到 `code.cmd` | 可打开当前目录；未读取编辑器 UI 状态 |
| IDEA | 未检查安装、版本和插件 | 若使用它，先确认 JavaScript/TypeScript 支持可用 |
| 当前目录 | 未发现实现文件 | 作为手写项目目录使用 |

npm 输出了旧 Puppeteer 用户配置的警告，此次查询仍成功；目前不需要修改用户的 npm 配置。

选 VS Code 是教学上的默认建议：本项目不需要 Java/JDK 或 Maven。IDEA 同样可以编辑文件、使用终端；其 JavaScript/TypeScript 支持取决于所用版本及可用插件，缺少支持时使用 VS Code 可减少配置工作。

| 操作 | VS Code | IDEA |
| --- | --- | --- |
| 打开目录 | File → Open Folder | File → Open，打开同一目录 |
| 创建文件 | Explorer 中新建文件 | Project 中 New → File |
| 打开终端 | Terminal → New Terminal | Terminal 工具窗口 |
| 运行命令 | PowerShell 终端 | 同样使用 PowerShell 终端 |
| 文件编码 | 保存为 UTF-8 | File Encoding 设为 UTF-8 |
| 初期调试 | 先看终端输出和报错 | 同样先看终端，不依赖运行配置 |

所有命令先确认终端所在目录。终端可以用当前目录执行命令；插件运行时不能用 `process.cwd()` 判断用户会话工作区。这是两件不同的事。

## 5. 审阅后需要统一的细节

### 5.1 熟练开发者工期不能直接套用

原计划 48 小时实现 + 12～24 小时缓冲，假设维护者熟悉 TypeScript。你的计划加入基础练习、报错处理和讲解。建议预留 80～140 小时功能与接入学习，另留 20～40 小时缓冲，总计约 100～180 小时。这是教学估算，不是保证。

每天 2 小时对应约 7～13 周；每天 4 小时对应约 4～7 周。按实际验收前进，不能到某个日期就称为 beta。

### 5.2 “复核后未变化”不等于“结论正确”

复核更新基线后，新观察和新基线相同，所以 freshness 可以为 unchanged。assessment 可以是 supported、refuted 或 uncertain。否定意见也可以对应 unchanged；两个状态必须独立。

### 5.3 只读检查必须显式选择临时模式

界面已知只读时，用 `persist: false` 请求并展示“本次结果未保存”。工具请求 `persist: true` 却不能写入时，明确拒绝，不偷偷切换为临时检查。临时观察没有可用于持久复核的 checkId，不修改已保存的 revision 或时间。

### 5.4 多种容量限制同时生效

200 张卡片 × 20 个版本 × 每次最多 4,000 字说明，可能在达到数量上限前就超过 8 MiB 存储限制。因此所有限额独立检查，先达到任何一个就拒绝对应操作。不能宣传“必定能装满 200 张、每张 20 个最大长度版本”。

### 5.5 归档释放的是活动名额

100 张活动卡片可以通过归档释放活动名额。总量 200 张或存储大小 8 MiB 达限时，归档不会降低总数量，不能提示“归档即可继续新建”。20 个版本达限时，标题修改与普通检查仍可进行；新增结论版本应拒绝。

### 5.6 没有变化的编辑不新增版本

建议补充约定：完全无变化的编辑返回当前身份，不写入，不递增 revision。只改变标题时改元数据、递增 revision；结论或依据集合实际变化时才追加版本。依据作为集合比较，调整输入顺序不应意外产生新语义版本；稳定目标变化必须视作依据变化。这些补充要在实现课中写入协议并验证。

### 5.7 列表草图的相对时间需要调整

产品草图有“今天/昨天”，后面的时间规范要求可识别的时间。教学实现统一显示日期与本地时间，展开可看 UTC。导出始终使用明确 UTC 或带偏移时间。来源会话无法定位时显示 ID，不伪造跳转链接。

### 5.8 单次观察不等于全项目快照

各文件在不同时间依次读取。同批次同一目标只读取一次，每张卡片仍与自己的基线比较。两张卡片绑定同一文件但基线不同，检查结果可以不同。文件在提交之后仍可能变化；不要把这点写成全项目事务快照保证。

## 6. 最终技术方案

| 领域 | 选定路线 | 说明 |
| --- | --- | --- |
| 正式语言 | TypeScript，开启 strict | 第一课先用无需安装依赖的 `.mjs` 理解核心行为 |
| Host | 普通 Cordis `apply` 插件 | 注册工具、可信调用入口和生命周期 |
| 工具 | `recheck`，8 个 action | create/list/get/edit/check/review/archive/export |
| Client | 宿主现有 React/TSX 与原生侧栏 | 不另建网站、路由服务或浏览器扩展 |
| 指纹、ID | Node `crypto` 标准库 | SHA-256、UUID；浏览器入口不能导入 Node 模块 |
| I/O | 经验证的 DSH 文件系统与政策路径 | 不在失败时回退 Node `fs` |
| 存储 | `<workspace>/.dsh/recheck/cards.json` | 有界 JSON、schemaVersion 1、版本保护 |
| 写入 | 同工作区提交队列 + revision + 文件版本 guard | 单 Host，多会话；不承诺跨 Host 并发 |
| 测试 | `node:test`、`node:assert/strict` | 真实临时文件 + 受控故障注入 + Host 集成 |
| 打包 | 优先用一个 tsdown 构建配置 | 先验证客户端格式和工具版本，再锁定依赖 |
| 分发 | 预构建 tgz，验证后才考虑 npm | package-lock 锁定插件开发依赖 |

选择 tsdown 的理由是官方客户端参考已有构建实现。需要把仓库外插件所需的最小客户端构建步骤保存在本项目内，并注明参考提交与许可证；不能让构建依赖旁边恰好存在一份 DSH 源码仓库。若固定版本实测需要调整构建工具，只调整这一处，不再维护两套构建系统。

官方参考确认了以下机制，但没有替我们验证插件兼容性：

- [打包与安装参考](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/user/develop/basic/publish.zh.md)：bundle 通过 `dsh.bundle` 指向 patch；共享运行时依赖需要按分发规则处理。
- [工具参考](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/cookbook/adding-a-tool.zh.md)：`defineTool` 注册类型化工具、规范 JSON 返回和取消信号。
- [文件系统参考](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/fs/fs/README.md)：文件身份、版本、有界字节读取及原子写入；政策与底层服务分层。
- [侧栏参考](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/client/ui-sidebar-right/README.md)：页面类型与页面内容通过公共注册入口贡献。
- [客户端构建参考](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/docs/cookbook/adding-a-settings-card.zh.md)：客户端半侧的 `./client` 导出需要 lazy-CJS factory 格式；官方预设未作为发布包提供。

以上链接固定到原文参考提交。候选 npm 包的实际类型、启动行为和集成测试才是最终接入依据。

## 7. 只创建当前阶段需要的文件

下图是最终结构参考，现在不必一次创建全部空文件。

```text
E:\DSH Recheck Plugin\
├── package.json            # 版本、脚本、exports、DSH manifest
├── package-lock.json       # 安装时生成，不手写
├── tsconfig.json           # 类型检查
├── tsconfig.test.json      # 测试转译；需要时才创建
├── tsdown.config.ts        # Host / Client 构建
├── cordis.patch.yml        # 在 profile 中挂载插件
├── .gitignore              # 排除依赖、产物、测试数据和凭据
├── src/
│   ├── index.ts            # Host 接入、工具注册、可信身份
│   ├── types.ts            # 多处实际共享的领域类型
│   ├── cards.ts            # 操作、输入规则、状态与列表
│   ├── evidence.ts         # 路径、稳定读取、指纹、批次去重
│   ├── store.ts            # 校验、队列、原子保护提交
│   ├── export.ts           # Markdown 纯函数
│   └── client.tsx          # 面板、表单、错误与会话绑定
├── tests/
│   ├── core.test.ts        # 状态、版本、导出、预算
│   └── integration.test.ts # 存储和固定 Host 组装
├── learning/
│   └── 01-fingerprint.mjs  # 你手写的第一课练习，不随插件发布
├── lib/                    # 构建生成，不手改
├── lib-tests/              # 测试编译生成，不发布
├── README.md               # 项目实现后编写使用和兼容说明
└── docs/                   # 当前学习计划及验收记录
```

`types.ts` 只保存 Host/Client 真正共享的数据类型，纯类型 import 不带运行时代码。不要为了这几个文件引入 Repository 工厂、插件框架、全局状态库或自制 RPC 系统。工具和 UI 调用同一组操作函数。

## 8. 必须吃透的数据模型

### 8.1 三类版本号的区别

| 字段 | 管什么 | 何时改变 |
| --- | --- | --- |
| schemaVersion | JSON 的结构格式 | 数据格式升级时；首版固定 1 |
| storeRevision | 整个项目数据的提交序号 | 一次成功的存储提交递增一次 |
| card.revision | 某张卡片的持久修改序号 | 该卡片保存检查、编辑、复核、归档或恢复时递增 |
| versionId | 不可变结论版本的身份 | 创建、结论/依据编辑、复核时生成新的 ID |
| checkId | 当前版本最近一次持久检查的身份 | 保存检查时生成；临时观察没有持久 checkId |
| 宿主文件版本 | 文件系统观察与写入保护令牌 | 由宿主产生，不解析、不自制、不与 card.revision 混用 |

例如：创建后 revision=1、只有 v1；保存检查后 revision=2、仍然 v1；复核后 revision=3、追加 v2。版本 ID 用真实 UUID 等身份生成方式，`v1/v2` 这里只是便于解释的显示顺序。

### 8.2 领域类型草案

下面是学习和实现类型的起点，不是完整 JSON 校验器，也不是可注册的工具 schema。

```ts
// 联合类型：一个字段只能使用列出的字符串。
export type Assessment =
  | 'unreviewed'
  | 'supported'
  | 'refuted'
  | 'uncertain'

export type Freshness =
  | 'unchecked'
  | 'unchanged'
  | 'changed'
  | 'missing'
  | 'unknown'

// 单个文件没有 unchecked：那是“尚未发起检查”的卡片状态。
export type FileStatus = Exclude<Freshness, 'unchecked'>

export interface Evidence {
  path: string           // 只存项目相对路径。
  sha256: string         // 完整字节的指纹，表示为 64 个小写十六进制字符。
  sizeBytes: number      // 非负整数，按实际读取的字节计数。
  capturedAt: string     // 插件产生的 ISO UTC 时间。
}

export interface Actor {
  kind: 'user' | 'agent'  // 来源由 Host 可信入口决定。
  sessionId?: string     // 仅有真实会话事实时保存。
}

export interface ConclusionVersion {
  versionId: string
  reason: 'create' | 'edit' | 'review'
  claim: string
  assessment: Assessment
  note: string
  actor: Actor
  createdAt: string
  evidence: readonly Evidence[]
}
```

实现课补齐 Card、Store、逐文件观察与 Check。逐文件观察要记录时间范围；可靠读取包含 sha256/size，missing/unknown 包含机器可判定原因。Check 要绑定 versionId，保存观察时间、coverage 和逐文件结果。实际会话来源字段依据宿主事实确定，不能编造消息 ID。

注意：TypeScript 的 `interface` 在运行时消失，`JSON.parse()` 出来的数据仍要完整校验。`as Store` 只是告诉编译器相信你，不能防止损坏 JSON 被写回。

### 8.3 双状态和需要关注

新鲜度汇总：无最近检查 → unchecked；有结果 → `missing > changed > unknown > unchanged`。空结果绝不算全部未变化。

```ts
// 示例纯函数：不读文件、不改数据，只根据状态计算结果。
export function summarizeFreshness(
  statuses: readonly FileStatus[] | undefined,
): Freshness {
  if (statuses === undefined) return 'unchecked'
  if (statuses.length === 0) return 'unknown'
  if (statuses.includes('missing')) return 'missing'
  if (statuses.includes('changed')) return 'changed'
  if (statuses.includes('unknown')) return 'unknown'
  return 'unchanged'
}

export function needsAttention(
  freshness: Freshness,
  assessment: Assessment,
): boolean {
  return freshness !== 'unchanged'
    || assessment === 'unreviewed'
    || assessment === 'uncertain'
}
```

前提是上游已校验枚举，且实际存储中的检查结果覆盖了本版本每个依据。未覆盖项补 unknown，不允许通过省略结果得到 unchanged。`refuted + unchanged` 返回不需要关注，仍可在列表查看否定意见。

### 8.4 固定限额

| 项目 | 限额 | 正确计量 |
| --- | --- | --- |
| 标题/正文/说明 | 120 / 2,000 / 4,000 | Unicode code point；字符串计数用 `[...text].length` |
| 每版本依据 | 1～8 | 按稳定目标判重，不只按输入字符串 |
| 文件大小 | 2 MiB | `2 * 1024 * 1024` 字节；有界完整读取 |
| 活动/总卡片 | 100 / 200 | 总量含归档 |
| 每卡版本 | 20 | 不自动清理旧版本 |
| 存储大小 | 8 MiB | `Buffer.byteLength(json, 'utf8')` |
| 批量去重目标 | 200 | 超预算依据保留并标 unknown |
| 批量实际读取 | 64 MiB | 计算实际数据读取，重读也要计入 |
| 单次读取阶段目标期限 | 10 秒 | 单卡创建/检查/复核同样遵守；宿主取消能力实测 |

10 秒是目标期限，不能用 `Promise.race()` 提前返回后，留下继续写入的后台操作。超时要中止并处理实际工作结束；原子提交开始前检查取消状态，提交后按真实结果报告。

## 9. 教学里程碑与逐课安排

一次课通常只写 30～80 行新增逻辑；复杂课拆为数个回合。代码行数只是教学节奏，不是实现上限。每课先写最小成功路径，再补影响判断或数据的失败路径。

| 阶段 | 课次 | 预计学习/实现时间 | 退出条件 |
| --- | --- | ---: | --- |
| M0 基础 | 01～03 | 8～12h | 能运行练习，理解指纹、状态、函数、类型和 async |
| M1 接入 | 04～06 | 12～20h | 固定宿主、工具、工作区、I/O 保护、最小侧栏与 tgz 加载通过 |
| M2 创建与数据 | 07～09 | 14～22h | 安全基线、可靠存储、create/get/list/edit 通过 |
| M3 检查 | 10～11 | 12～20h | 单卡、批量、预算、取消、版本冲突通过 |
| M4 工具 alpha | 12～14 | 10～18h | review/export/archive 闭环完成，工具可用 |
| M5 面板 | 15～17 | 14～26h | 全部 P0 人机流程与会话切换通过 |
| M6 候选交付 | 18～20 | 10～22h | 干净安装、跨平台、18 项验收、文档与候选包完成 |

### 第 01 课：看见文件指纹和状态变化

目的：先能说明插件的核心比较逻辑。操作：使用 VS Code 或 IDEA 打开开发目录，手写 `learning/01-fingerprint.mjs`，运行 Node，修改示例字符串，观察结果。学习：变量、对象、数组、函数、import、SHA-256、if 和断言。验收：相同字节 unchanged、修改字节 changed、恢复 unchanged；同时能解释 why 支持意见没有自动改变。详见配套第一课。

### 第 02 课：TypeScript 和项目配置

操作：创建 `.gitignore`、`package.json` 与 `tsconfig.json`；安装固定的 TypeScript 与 Node 类型开发依赖，记录实际版本；把第一课的状态函数转为 `.ts`。初期 package 保持 private，确定完整分发元数据后再进入候选打包。

注解：`package.json` 是包和命令说明书，JSON 不支持注释；`tsconfig` 管编译器；`strict` 帮你在运行前发现字段和类型错误；`.js` 导入后缀要与所选 ESM/Node 编译方式匹配。不关闭类型检查掩盖问题。

验收：人为把 freshness 拼错，类型检查报错；改正确后 `npm.cmd run typecheck` 成功。明确该脚本需先在本课 package.json 定义，当前还不能直接运行。

### 第 03 课：异步、异常和返回协议

操作：用 2～3 个内存对象学习 async/await；写规范成功结果与领域拒绝，学习 `try/catch`。先写 `summarizeFreshness` 和 `needsAttention` 的有效检查。

注解：await 等待操作结果；成功响应 `status: ok` 不等于结论正确；revision 冲突属于可判断的拒绝，底层故障按宿主工具错误机制处理。不要 catch 所有异常后返回空列表。

验收：undefined、空数组、混合文件状态和 refuted+unchanged 的结果正确。

### 第 04 课：固定宿主与最小工具

操作：把 DSH 候选作为项目内开发依赖；不升级全局 CLI。按候选的实际依赖和声明写最小 Host、patch 与 manifest。只返回小型接入测试 JSON，命名和最终工具契约的转换在后续课完成。

候选安装命令在执行这课时使用：

```powershell
Set-Location -LiteralPath 'E:\DSH Recheck Plugin'
npm.cmd install --save-dev --save-exact '@deepseek-ai/dsh@0.2.0-rc.2'
npx.cmd --no-install dsh --version
```

前提：第 02 课已有有效 package.json。`--save-exact` 固定版本；`--no-install` 要求使用已安装的本地命令，避免临时下载另一版本。安装成功仍不等于宿主启动成功。

验收：本地显示选定版本；专用测试 profile 可启动；Native 和程序化调用得到同一种规范 JSON；释放插件后工具注销。记录启动命令、依赖版本和实际输出。

### 第 05 课：会话工作区、权限与受保护 I/O

操作：从实际执行上下文解析可信工作区；识别稳定根与文件目标；试读样例文件；在专用样例项目内试写插件自己的测试存储；证明初次创建、已有版本更新和外部变化拒绝。

注解：模型参数不接收 workspaceRoot、actor、sha256 和时间。Node `crypto` 可以使用，实际文件读取/写入必须走经验证的宿主路径。`ctx.fs` 有服务能力不代表自动通过全部模型工具政策。

验收：两项目分离，同项目两会话共享；越界、无权限、只读、非普通文件拒绝；外部修改导致写入冲突；无法确认工作区时不访问磁盘。

### 第 06 课：最小客户端与真正打包

操作：只做显示“Recheck 接入成功”的最小侧栏；构建正确客户端格式；声明 `./client` 和 `dsh.client`；检查最终 patch 根行与包名一致；产生 tgz 并在测试 Web profile 加载。

注解：Host 是 Node 环境，Client 是浏览器环境。把整个 Host 导入 Client 会把文件系统和 crypto 带进浏览器。TSX 只是一种源码写法，不保证 bundle 可被宿主加载。

验收：页面能加载、关闭、注销；包中包含正确入口；没有额外一份 React/Cordis/宿主共享实例。至此 M1 才通过。若身份、政策、原子 guard 或稳定读取不成立，继续接入排查，不能以假 API 接着写可运行教程。

### 第 07 课：领域类型与安全依据捕获

操作：写领域类型、限额、路径格式检查和 `captureEvidence`。按固定宿主能力解析边界与普通文件，读取前后验证文件版本，计算完整字节哈希。

注解：`.length` 不等于 Unicode code point 数量；mtime 不等于内容；拼接根路径或 startsWith 不能证明边界；稳定 targetKey 是不透明值。叶符号链接拒绝，不能可靠证明内部链接边界时拒绝。

验收：正常、空文件、二进制完整字节、重复目标、目录、超限、权限拒绝、不稳定、路径逃逸都有正确结果；失败不生成可靠基线。

### 第 08 课：Store 校验与原子提交

操作：写有界读、完整结构校验、队列与 `commitStore`。只在确认不存在时初始化；损坏、未知 schema 不能初始化为空。写入前重新读版本，先构造候选数据，检查 JSON 字节大小，再原子保护提交。

注解：队列防同进程并发，card revision 防过期表单，文件 guard 防外部修改。它们不能彼此代替。一次任务失败不能使队列永久拒绝后续操作；释放无用队列引用。

验收：首次创建竞态、外部修改、原子写入失败、截断 JSON、未知 schema、8 MiB 上限和重启读取通过；失败后原数据逐字节保持。

### 第 09 课：create/get/list/edit

操作：创建全部依据一次成功后才提交的卡片；列表返回有界摘要，详情按选项返回历史；编辑遵守标题与结论版本区别。

注解：创建是捕获基线，freshness 仍为 unchecked；初始 note 不自动让 assessment 变 supported。只改标题不重写历史、不清空检查。修改结论/依据要说明，并完整重建新基线。

验收：AC-01；任何一个依据失败时创建/内容编辑不提交；总量、活动、版本和字段限额正确；标题编辑保留意见与检查；正文编辑重置为 unreviewed/unchecked。

### 第 10 课：单卡检查

操作：绑定当前 versionId 和 expectedRevision；对每个依据生成结果、reason、时间和覆盖信息；持久与临时两种模式；保存成功后更新 revision。

注解：check 不改基线、不改 assessment、不加结论版本。ENOENT 类稳定不存在才是 missing，其他读取失败 unknown，不能把所有错误当成 missing。

验收：AC-02～AC-08、AC-17、AC-18；修改还原能恢复 unchanged；保存后用于 review 的 revision 来自本次返回。

### 第 11 课：全部活动卡片检查

操作：先固定卡片/版本观察集合；按稳定目标去重；限制 200 目标、64 MiB、10 秒；给每个未覆盖依据 unknown；一次原子提交仍匹配版本的卡片；明确 conflict/error/checked。

注解：去重的是文件观察，不是不同卡片的基线。搜索条件不缩小检查全部的范围。预算耗尽可以保存部分 unknown，用户取消则整批不提交。不要边读取边落盘。

验收：共享文件只读一次、不同基线各自比较、归档不参与、超预算不伪装完整、编辑冲突排除单卡、取消无半份存储、晚到取消如实报告已提交。

### 第 12 课：复核与不可变历史

操作：校验 checkId 属于当前版本、是完整持久检查；重新读取并与引用观察比较；提交时再核对 revision；追加 review 版本和新基线，保留旧版本。

注解：文件现在有新内容不代表可以偷偷更新基线继续接受旧意见。changed 可以复核，missing/unknown 不允许。supported/refuted/uncertain 都走同一安全流程。

验收：AC-09、AC-10；旧 checkId、临时结果、依据再次变化、过期 revision、20 版本上限拒绝；旧历史没有就地修改。

### 第 13 课：安全 Markdown 导出

操作：写 `renderMarkdown` 纯函数；含结论、来源、版本、路径、指纹、观察时间、覆盖范围和限制。默认返回字符串；给定 path 才用“确认不存在”写入。

注解：用户文本可能含反引号、表格竖线或 HTML。按所处 Markdown 上下文转义，可用动态围栏或安全引用。UI 预览先展示文本，不能未经处理用 innerHTML 执行输入。

验收：AC-12；同名目标原字节不变；HTML/反引号/Unicode 不破坏结构；不附源码/主机绝对路径；导出不触发检查、不改数据。

### 第 14 课：搜索、筛选、归档与恢复

操作：标题和当前结论不区分大小写搜索；分别筛新鲜度与归档；needsAttention 排序，updatedAt 降序和 id 稳定排序；归档/恢复带 revision。

注解：归档保留历史；恢复检查活动名额并清空 latestCheck，意见不因此自动重置或支持。总量达限不能靠归档解决。

验收：AC-15；筛选与统计口径明确；恢复显示 unchecked；重复归档请求按已定的无变化约定处理。至此工具 alpha 必须完整演示一次。

### 第 15 课：面板列表与详情

操作：先用已验证客户端通道调 list/get；显示双状态、项目、时间、依据、历史；加入手动检查和取消；loading/空态/错误。

注解：页面打开只读卡片存储，不扫描证据；一次异步请求可能在切换项目后返回，旧响应不能更新新项目页面。按可信会话绑定请求，丢弃过期响应。

验收：无工作区时解释原因；双状态带文字；用户能指出具体问题与上次观察时间；同项目另一会话刷新可见更新；不同项目不串数据。

### 第 16 课：创建/编辑/复核表单

操作：路径输入添加依据；逐字段错误；复核不预选支持；先检查取得有效 checkId；错误、取消、冲突时保留输入。

注解：前端校验帮助使用者，Host 校验防止无效操作，两边都需要。actor 由入口决定，表单没有自由修改来源的字段。不能自动换 revision 然后重试覆盖用户的旧判断。

验收：创建、内容编辑、完整复核闭环；版本与 revision 显示正确；缺失/未知禁用并解释；键盘可操作，标签和错误关联明确。

### 第 17 课：归档、导出与会话切换

操作：UI 接 archive/export；导出预览和复制失败回退；只读项目临时观察标记；会话切换时按项目隔离未保存表单与请求。

注解：不能把项目 A 的输入交给项目 B。首版草稿仅保存在当前内存，不承诺重启恢复。复制成功仅在剪贴板实际成功后显示。

验收：窄侧栏、Tab/Enter、焦点、冲突恢复、项目切换、只读、重复导出、取消和支持+变化提示通过。M5 结束时完整人机闭环成立。

### 第 18 课：生命周期与干净安装

操作：停止未完成读取；等待已进入原子提交的操作结束；注销工具、页面、事件及临时状态；产生预构建 tgz，在新 profile 从实际文件安装；重启、卸载、再安装。

注解：关闭插件不删除项目数据。不能只测开发 link 安装。正式包不含 learning、测试项目、node_modules、凭据或本机绝对路径配置。

验收：AC-16；旧会话正常、数据保留、无重复注册、包中 Host/Client/patch 齐全；headless 工具路径通过。

### 第 19 课：验收、Linux 冒烟与性能

操作：运行有效检查并逐项填写 AC-01～AC-18；Windows 主验证；有可用 Linux 环境时完成真实安装与核心闭环。未有环境的项目标记未验证，不能作为通过。

性能样例：25 张卡、100 个去重文件，每个 64 KiB；预热一次，测 5 次，记录中位数和最慢值，目标完整检查 ≤2 秒。另做预算超限样例。

注解：权限失败用实际受限提供方或明确故障注入，不能把管理员下的 chmod 结果当权限证明。模拟文件系统测试不能代替真实宿主版本保护证明。

验收：全部 P0 有证据，阻塞缺陷为零；跳过项写清原因。性能未达目标要记录真实值并分析，不提前宣称达标。

### 第 20 课：文档、候选包与交付

操作：完善使用 README、兼容矩阵、已知限制、数据备份/恢复、45～90 秒演示步骤、变更日志和包清单。检查名称可用性；生成 `0.1.0-beta.1` 本地候选。

注解：本地打包不需要发布账号。只有实际完成 Linux、安装、功能等门槛才能称完整 beta 候选；否则标记 alpha 或未完成候选。公开仓库、推送及 npm publish 在你实际要求发布时再执行。

验收：别人只看 README 能安装、完成演示、理解双状态与边界；tgz 能独立使用，构建可从干净目录复现。

## 10. M1 接入关卡：必须留下实测答案

| 问题 | 合格证据 | 无法确认时 |
| --- | --- | --- |
| 固定版本是否实际启动 | 版本、启动命令、profile、日志摘要 | 暂停正式接入，记录安装阻塞 |
| 工具如何注册和退出 | 候选类型、Native/PTC 响应、卸载结果 | 先修最小插件 |
| 可信工作区在哪里 | 工具与 UI 的真实上下文来源，A/B 测试 | 返回 WORKSPACE_UNAVAILABLE，不访问磁盘 |
| UI 来源如何可信 | 认证入口、会话权限、user/agent 映射 | 不开放能伪造来源的接口 |
| I/O 如何遵循政策 | 实际提供方与政策路径；允许/拒绝证据 | 不绕过、不回退 Node fs |
| 边界与普通文件如何证明 | Windows 链接/连接点及普通文件事实 | 无法证明的目标不支持 |
| 稳定读取怎样确认 | 前后版本、取消、大小限制试验 | 不生成可靠基线 |
| 原子写入如何受保护 | 首次不存在 guard、现存版本 guard、失败保留旧数据 | 不启用持久写入 |
| Client 构建怎样加载 | 清洁包、factory 格式、共享依赖清单 | 完整 beta 继续待接入 |
| 页面生命周期是否正确 | 注册、卸载、重载无重复和残留 | 修正 effect 和清理流程 |

这些是原需求的接入门槛，不是要求你为普通教学操作反复确认。门槛通过以后，不重复进行相同环境检查，除非依赖或宿主版本发生变化。

## 11. 各 action 的最终行为合同

工具参数用 action 分支，明确拒绝未知及不适用字段。具体 `ParameterSchemaSpec` 写法在第 04/09 课按候选类型生成，不能直接把本节表格当宿主 schema。

| action | 关键输入 | 成功效果 / 失败保护 |
| --- | --- | --- |
| create | title/claim/files/note? | 全部依据成功才新建；返回 ID、revision、versionId；unchecked/unreviewed |
| list | query?/archived?/needsAttention?/freshness? | 返回有界摘要和定义清楚的统计，不读依据 |
| get | cardId/includeHistory? | 当前版本和最近检查；按选项带历史，不产生修改 |
| edit | cardId/expectedRevision/修改字段/note? | 标题只改元数据；正文/依据追加版本并重置；失败不动旧数据 |
| check | scope/cardId?/expectedRevision?/persist? | card 必须带 cardId 和 revision；all 不接无意义单卡参数；默认持久 |
| review | cardId/expectedRevision/checkId/assessment/note | 完整持久观察、重新核对后追加版本；意见仅三选一 |
| archive | cardId/expectedRevision/archived | true 归档，false 恢复；恢复清检查，不删除历史 |
| export | cardId/includeHistory?/path? | 默认 Markdown；指定路径才创建新文件；不覆盖、不检查 |

边界字符串非空、整数字段、跨字段关系和容量，除 schema 校验外都要验证。get/list 不回传文件正文。所有 ID、时间、意见来源、文件指纹与工作区均来自 Host。

领域响应草案：

```json
{
  "status": "rejected",
  "action": "review",
  "reason": {
    "code": "REVISION_CONFLICT",
    "message": "卡片已更新，请重新读取后复核。",
    "retryable": true
  }
}
```

错误依代码分支，不解析自然语言。卡片 ID 未找到和旧检查不再有效也要在实现课中明确领域代码、文案和 schema，加入协议记录，避免凭字符串猜测。

## 12. 写操作和读取算法的实现次序

### 12.1 依据读取

输入校验 → 可信工作区 → 宿主解析目标 → 边界/普通文件/自有存储拒绝 → 稳定身份去重 → 读取前版本 → 有界完整字节 → 读取后版本 → SHA-256/大小/观察时间。

创建、内容编辑和复核要求全部可靠，任何一个失败整体不提交。检查保留 missing/unknown 与具体原因，不沿用上次正常结果。不能把“截断的前 2 MiB”当完整指纹。

拒绝绝对路径、URL、NUL、盘符、UNC 输入和逃逸工作区的路径；Windows 连接点、大小写和稳定身份最终交给已验证的宿主事实。导出也验证父路径与目标类型；确认目标不存在必须由原子 guard 保障，不能仅靠 exists 后写入。

### 12.2 数据提交

1. 读取阶段在有界、可取消环境产生候选观察。
2. 进入稳定工作区的共享提交队列，重新读取最新 Store 和宿主文件版本。
3. 校验完整结构、卡片 revision、versionId、checkId 适用性及容量。
4. 构造新对象；保留旧历史，不就地修改已提交对象。
5. 检查序列化 UTF-8 字节大小；提交前确认取消状态。
6. 用真实文件版本 guard 执行原子写入；初次用 confirmed absent guard。
7. 只有写入完成才返回成功、更新 UI；失败保持旧文件和已提交状态。

review 在读取前固定引用检查，在提交阶段再次核对它还属于当前版本且 revision 匹配。读取后至提交完成间仍不是外部证据文件的全局事务锁；响应报告真实观察时间，不承诺之后不会变化。

### 12.3 批量提交

先读取去重目标并收集结果，再入队一次提交。只保存仍匹配原 card revision 和 versionId 的卡片；冲突卡片单独返回，不自动覆盖。Store 文件版本外部冲突导致整次写入拒绝，不把已读取观察说成已保存。

一次成功 Store 写入的 storeRevision 加一；每张实际保存检查的 card.revision 加一。未保存、冲突或归档变化导致被排除的卡片不增加 revision。

## 13. 最少但有意义的验证

不为每个 UI 标签建立快照，不写只重复实现步骤的测试。测试要能在关键行为被改错时失败。

| 验证组 | 关键反例 | 对应需求 / 验收 |
| --- | --- | --- |
| 字节与状态 | 相同、变化、恢复、mtime、混合、空结果 | R-02/03/04；AC-01～08、17 |
| 路径与稳定读取 | 越界、目录、叶链接、连接点、重复稳定目标、读取期间变化 | R-10、N-03；AC-05、17 |
| 原子与存储 | 首次创建竞态、旧 revision、外部文件改动、写失败、未知 schema、超限 | R-06、N-02；AC-10、14 |
| 检查与取消 | 去重、预算、范围、编辑并发、用户取消、晚到取消 | R-03/04；AC-11 |
| 版本与复核 | 旧 checkId、临时观察、再次变化、20 版本、三种意见 | R-05/06；AC-09、10 |
| 工作区与只读 | A/B、同项目多会话、无工作区、明确临时模式 | R-07/10；AC-13、18 |
| 导出 | 同名文件、反引号、HTML、表格、路径、Unicode | R-08；AC-12 |
| 归档与生命周期 | 恢复名额、历史保留、卸载/重装、取消清理 | R-09/12；AC-15、16 |
| UI 与组装 | 身份来源、表单保留、切换会话、焦点、窄栏、tgz | R-11/12、N-06 |

学习期测试允许用 Node fs 创建和改动专用临时文件，这是测试安排；正式插件访问用户文件仍走宿主路径。mock 用于注入错误，不可把 mock 通过说成原子提交/权限真实通过。

脚本配置好后，每阶段通常执行一次 `npm.cmd run typecheck` 和 `npm.cmd test`，构建相关变更执行 `npm.cmd run build`；修复新失败后重跑相关检查。没有新变更或不确定性，不反复跑全部测试。

## 14. 打包、安装与发布门槛

第 06 课先证明最小包结构，第 18～20 课验证完整包。以下命令需要当时已配置的构建脚本和本地 DSH：

```powershell
Set-Location -LiteralPath 'E:\DSH Recheck Plugin'
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd pack --dry-run
npm.cmd pack
```

以上只生成本地包，不公开上传。包名仍需核实；tgz 文件名以 `npm pack` 实际输出为准，不照抄不存在的文件。

后续安装在专用 Web 测试 profile，先依据固定版本 `--help` 验证 profile 的创建方式和 Web 模板；普通新 profile 的基础组合不一定包含 Web 页面。不要直接改现有日常 profile。原文的安装参考命令是 `dsh plugin --profile web add <tgz>`；教学中使用项目本地 CLI 和测试 profile，替换成实际存在的包路径。

公开 beta 的完成条件：

- 所有 R-01～R-12 与相关 N 要求落实，AC-01～AC-18 有记录及证据。
- Windows 完整流程、Linux 安装和核心流程至少一次真实验证。
- 固定 Host/Node/构建依赖明确，Native/PTC/headless/Web 所声明路径实际通过。
- 干净 profile 的真实 tgz 安装、重启、卸载、重装通过。
- JSON 失败保护、版本冲突、取消及只读结果不误导，无越界读取或错误 unchanged。
- Host/Client/patch/文档齐全，不依赖本机其他仓库和绝对路径。
- 发布文案只写已经验证的能力，缺项明确，性能只写实测值。

若 M1 的客户端仅能加载但认证写路径尚不明确，不称为完整 beta。若 Linux 尚未验证，继续保留内部候选状态。

## 15. 故障排查与备份

| 症状 | 优先检查 | 不应采取的做法 |
| --- | --- | --- |
| npm.ps1 执行策略报错 | 使用 npm.cmd；Node PATH | 修改整台机器执行策略来跳过问题 |
| 找不到文件 | 终端路径、文件扩展名、是否保存、空格路径引用 | 到处复制项目文件 |
| TypeScript 报错 | 文件/行号、缺字段、类型、导入路径、宿主版本 | 关闭 strict 或随意 as any |
| 工具没出现 | 本地版本、patch、注入、profile、加载日志 | 修改宿主源代码绕过 |
| Client 加载失败 | manifest、根行、./client、factory 格式、externals | 再加一套独立网页服务 |
| REVISION_CONFLICT | 重新读取、对比输入与当前版本 | 自动换最新 revision 覆盖 |
| STORE_INVALID | 保留原文件，先复制备份，再人工检查 | 覆盖成空 cards |
| missing/unknown | 对应文件原因、权限、预算、稳定性 | 把失败当 unchanged |
| 复制失败 | 保留 Markdown 文本供手动复制 | 显示已复制 |

备份在教学中的专用项目里练习：停用插件或确认无提交进行，把 `.dsh/recheck/cards.json` 复制到明确的备份位置。恢复是使用者独立操作，先保留损坏文件，再校验备份与 schema，不提供自动清空或自动修复按钮。

报错反馈只需命令、文件/行号、实际输出和期望结果；无需提供 API 密钥、完整私密会话或真实源码。若宿主启动需要凭据，按照该版本的正常配置流程在本机设置，不写入教学代码和 Git。

## 16. 我们后续每一步的固定教学格式

每次指导包含：本次目标 → 需要改的具体文件 → 你输入的短代码 → 关键语法和逐段注释 → 执行命令 → 预期结果 → 一个有效检查 → 常见报错 → 完成勾选。

你完成当前步骤后，把终端输出或报错文字发来。我先核对结果，再接下一步；若你修改了代码，解释它对状态或数据的影响。没有实际输出时不把学习任务标成完成。

现在的第一步是打开 `docs/05-first-lesson.md`，完成第 01 课。宿主依赖安装从第 04 课开始；第一课无需 API key、npm 包或 DSH 启动。
