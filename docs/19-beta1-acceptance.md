# 0.1.0-beta.1：复核队列

本版落实路线图的 beta.1 范围，保持八种业务动作和存储 schema 1。公开分发使用 [GitHub beta.1 Release](https://github.com/InInNHD/dsh-recheck/releases/tag/v0.1.0-beta.1) 和固定 npm 版本 `dsh-recheck@0.1.0-beta.1`（`beta` 渠道）。Release 附同一 tgz、SHA-256、版本说明、发布提交与对应远端 CI 链接；只有该提交的四组 CI 成功后才完成发布。

## 使用方式

1. 在活动卡片列表组合搜索、新鲜度和复核意见，按需要关注、最近检查或最近更新排序。
2. 勾选卡片，点击“检查选中的 N 张并保存”。按钮只处理选中的卡片；“检查全部活动卡片”始终覆盖全部活动卡片，不受筛选影响。
3. 查看逐卡结果。文件变更不改变已有复核意见，也不自动作出支持或否定判断。
4. 打开详情，保存当前版本的完整检查，在编辑器中阅读依据，进入“记录复核”，确认已阅读、主动选择意见并填写说明，最后保存。

需要关注仍为“新鲜度不是 unchanged，或意见为 unreviewed/uncertain”。依据未变且已有否定意见的卡片不自动成为待办。项目统计基于保存记录；显示数和选中数另列，临时观察有明确标记。

筛选、排序、切换活动/归档范围和刷新会清空选择。归档卡片没有选择控件。选中项保存的是选择时的 revision，Host 会在读取前和提交前验证；列表过期不会误覆盖最新记录。

## 请求与返回契约

旧 `scope:card/all` 请求继续有效。新增请求示例：

```json
{"action":"check","scope":"selected","targets":[{"cardId":"卡片ID","expectedRevision":3}],"persist":true}
```

- `targets` 必须是 1–100 个对象，每项仅有 `cardId` 和正安全整数 `expectedRevision`。重复 ID（含去掉首尾空白后重复）、空列表、超限、未知字段或混入 card/all 参数均拒绝为 INVALID_INPUT，不静默去重或扩大范围。
- 缺失/归档目标逐卡返回 CARD_NOT_FOUND/ARCHIVED_CARD，过期 revision 返回 REVISION_CONFLICT；其他合法目标继续读取。读取期间变更、归档或删除也会在提交前被检查并返回单卡冲突。
- `results` 保持 targets 的输入顺序，包含每卡 `outcome`、`saved`、检查覆盖或明确 `reason`；`counts.saved` 才是实际保存数量。顶层 `persisted` 保留旧协议的持久检查模式含义，不保证每卡成功；顶层 `saved` 表示至少一张保存，`cancelled` 表示取消。
- 临时或取消后的观察没有 checkId，逐卡 `persisted/saved` 为 false。用户取消时只返回已完整观察的卡片和其余卡片的 CANCELLED；提交前取消不保存本批观察。网络连接本身被中断时客户端可能收不到返回，应刷新确认实际磁盘状态。原子保存已完成后的晚到取消不声称回滚。
- 一次请求共享 Host 文件缓存：最多 200 个唯一文件、64 MiB 许可读取总量和 10 秒读取预算，每文件仍最多 2 MiB。失败读取保守扣除其许可额度；超限/未覆盖项记为 unknown，READ_BUDGET/TIME_BUDGET 给出具体原因。没有客户端逐卡并发绕过预算。
- 合法结果在一次带 CAS 的存储提交中保存，提交前逐卡重新验证。各依据分别读取，不提供项目同一时刻快照，不承诺多 Host 全局事务。
- 只读会话须显式 `persist:false`；要求保存仍拒绝 READ_ONLY。检查不会增加结论版本或自动复核。

列表新增可选参数 `assessment:unreviewed/supported/refuted/uncertain`、`sort:attention/checked/updated`，可与原筛选组合。排序规则：关注优先再更新倒序；检查倒序且未检查在后，再更新倒序；更新倒序。最终都以 cardId 升序打破平局。

`list.capabilities` 声明 `selectedCheck/assessmentFilter/listSort`。新客户端仅在 Host 声明 selectedCheck 时启用选择与选中检查；旧 Host 缺少声明时给升级提示，仍可使用旧列表和 card/all 请求。界面筛选与排序复用本地完整列表，不向旧 Host 发送新增参数。

已阅读勾选是本次客户端复核操作的确认，不新增存储字段，不被解释为自动验证；工具调用继续要求主动意见与说明。Host 保存复核前仍重新读取并拒绝过期检查或依据变更。

## 验收办法与证据

运行 `npm.cmd run check` 验证类型、构建、真实 Host FS/ToolRuntime/Node PTC。新增回归覆盖筛选组合与稳定排序、选择参数边界、共享读一次、未选中保护、混合无效目标、读取中更新/归档、只读、中途取消，以及 selected 与旧范围的 200 文件/64 MiB/10 秒预算。

实际包验收：

```powershell
npm.cmd run check
npm.cmd pack --ignore-scripts
node scripts/package-smoke.mjs --host 0.2.0-rc.2 --no-pack --web
node scripts/package-smoke.mjs --host 0.2.1-alpha.1 --no-pack --web
```

包脚本在 `.integration` 创建隔离配置，使用真正安装包及对应 SDK，检查 20 次启停、卸载重装保留字节、回退 alpha.6 再升级和真实 Web 流程。共存可追加 `--coexist <本地启动动画tgz>`。Desktop 用已安装 rc.2 应用及隔离 home/user-data 运行 `scripts/desktop-smoke.mjs`，只替代系统文件夹选择结果。

Web/Desktop 共用 `scripts/review-queue-smoke.mjs`，验证组合筛选、键盘勾选、排序与清空、精确选中写入、逐卡冲突、全部范围、真实只读选中结果、缺失依据门槛、阅读确认、宿主主题令牌和 300px 窄栏。旧 Host 能力回退通过 Web HTTP 响应拦截验证；Electron 走原生 IPC，不伪称该拦截覆盖 Desktop。初始意见使用隔离项目夹具布置，被测检查/复核/保存走真实宿主。已有 alpha.5/6 核心流程继续回归。构建包和实测记录的 SHA-256 必须一致。

最终运行结果、源码哈希及截图保存于忽略提交的 `.integration/beta1-release-result.json` 和 `.integration/beta1-final-acceptance.md`；每轮失败日志保留，不将中断结果当作通过。支持组合见 compatibility.json；本机验收包括 47 项测试、两个 Windows Web 宿主各 33 类检查、基线 Windows Desktop 29 类检查。远端 Windows/Ubuntu × 两个精确宿主由 `.github/workflows/ci.yml` 运行；Ubuntu 另跑完整 Web 流程。CI 状态以 Release 链接的对应提交运行结果为准，本机结果不替代远端 CI。发布文档与展示材料更新后，运行文件需逐字节匹配本机已验收包，公开包另做实际安装验证。

## 安装与回退

从对应 Release 下载 `dsh-recheck-0.1.0-beta.1.tgz` 和同名 SHA-256 文件后，先备份项目 `.dsh/recheck/cards.json`，校验哈希，用桌面应用自带的匹配 CLI 安装到所需 profile，再完全重启。示例（按本机实际 CLI 路径调整）：

```powershell
& 'E:\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add '.\dsh-recheck-0.1.0-beta.1.tgz'
```

可将上述 add 参数替换为固定 `dsh-recheck@0.1.0-beta.1`。`beta` 是会移动的预发布标签；需要复现时固定版本。发布不会自动修改用户的日常 Desktop；本机完整回归使用隔离配置。

回退仍使用同一 Host 的 CLI 安装固定 `dsh-recheck@0.1.0-alpha.6`，重启并核对历史与数据文件；schema 1 无迁移，选中结果只是原有 latestCheck，alpha.6 能读取。为避免丢失之后新增记录，回退前也保存当前数据副本。若已损坏，先保留坏文件并恢复经过验证的完整备份，勿只改 schemaVersion。

## 验证边界

不增加模型调用、测试执行、遥测、云同步或额外运行依赖。没有验证的 macOS/Linux Desktop、0.2.1-alpha.1 Desktop 不列为已验证。旧 Host 回退界面通过移除真实 list 返回中的能力声明验证，不代表所有任意旧宿主可用。系统输入法沿用合成 composition 保护回归，没有全系统输入法手工测试。读取权限错误采用受控注入，普通文件读取和预算使用真实 Host FS。沿用 alpha.6 针对 Windows ReplaceFileW 1175 的有限重试，没有扩大重试范围。
