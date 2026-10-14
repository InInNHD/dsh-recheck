# 0.1.0 正式版验收与限制

更新日期：2026-10-14。**发布决策：按已验证的技术范围准备并发布 0.1.0，真实试用仍未完成。** 最终发布提交、安装包 SHA-256、对应 CI 和安装核验结果以 [0.1.0 Release](https://github.com/InInNHD/dsh-recheck/releases/tag/v0.1.0) 为准；准备提交的结果不能替代最终包验收。

维护者于 2026-10-14 明确调整原计划：接受现有技术验收范围，发布 `0.1.0` 并公开说明试用不足。原计划的 3 名用户各使用真实项目一周、每人至少 3 条有用结论、完成变化→检查→人工复核以及概念理解目标，均保留为未完成，改为发布后持续验证。自动测试、截图和演示不能代替这些记录。包版本与兼容清单统一为 `0.1.0`，npm 渠道为 `latest`；既有 beta.1 安装包与 `beta` 标签保留。业务行为、schema 1、宿主范围及运行依赖沿用 beta.1。

## 已有发布基线

- beta.1 发布提交：`a4093e4fad7944110c25c2e93a23f470700b3f21`。
- [GitHub Release](https://github.com/InInNHD/dsh-recheck/releases/tag/v0.1.0-beta.1) 与 npm `dsh-recheck@0.1.0-beta.1` 分发同一份 881717 字节的 tgz。
- SHA-256：`36e501d2de625298d7cb0a63656db1b9bbf0fc049dd283233688656f9e7df625`。
- [发布提交 CI](https://github.com/InInNHD/dsh-recheck/actions/runs/37344616666)：Windows/Ubuntu × 0.2.0-rc.2/0.2.1-alpha.1 四组通过，Ubuntu 包含完整 Web 流程。Ubuntu rc.2 首轮有一处 UI 瞬时断言失败，单组重跑通过；保留这项历史，不将重跑描述为已修复。
- 47 项自动化测试、本机两个 Web 宿主各 33 类检查、Windows rc.2 Desktop 29 类检查；具体范围和替代夹具见 [beta.1 验收](19-beta1-acceptance.md)。

公开发布基线和开发工作区是两回事。新增文档、验收脚本不替换已经发布的 beta.1 tag 或安装包；历史工作区自行打包的 beta.1 仅供隔离验收。0.1.0 必须重新构建、打包和验证。

## 本轮收敛内容

1. `review-queue-smoke.mjs` 的筛选数量、排序与选择清空断言等待实际界面结果，使用现有 Playwright 的自动重试断言，不增加固定延时、不重跑整套流程掩盖失败。
2. `package-smoke.mjs` 在实际 tgz 安装后的真实 Host 中执行完整恢复演练。先停止宿主再复制完整存储并核对字节；归档恢复、编辑和导出均走真实工具；注入损坏 JSON 后验证拒绝读取且原文件未被覆盖；保留损坏副本，再恢复备份。
3. 恢复时故意保留已变化的依据文件，验证历史检查不是当前验证：临时检查发现变化但不写入，旧 checkId 的复核被拒绝；重新持久检查后才能主动复核。恢复会丢弃备份后新增的卡片状态与历史，本轮明确验证这种时间点回退。
4. 提供 [真实试用与备份恢复指南](21-trial-and-recovery.md)，不增加遥测、自动导入或恢复向导。

自动演练只写入脚本创建的 `.integration/package-smoke-*` 目录，不操作日常 Desktop 配置或真实项目。演练成功后回到原始一次性样例继续卸载重装，分别回退 beta.1 和 alpha.6，再升级到 0.1.0；每次确认实际加载版本以及数据、历史保留。演练备份、坏文件和 Markdown 导出保留在本机。

## 验收表

| 门槛 | 当前状态 | 完成证据 |
| --- | --- | --- |
| beta.1 公开基线和分发一致性 | 已完成 | 上述固定提交、Release、CI 和 SHA-256 |
| 准备提交的类型、构建、47 项测试 | 已通过 | 本机检查与下述准备提交 CI；最终包须重新执行 |
| 准备提交的两个精确 Host 包恢复与生命周期 | 已通过 | 两个 Windows 隔离配置均完成 9 项恢复检查、20 次启停、卸载重装、alpha.6 回退再升级与 33 类 Web 检查 |
| 准备提交 Windows/Ubuntu CI | 已通过 | [准备提交四组 CI](https://github.com/InInNHD/dsh-recheck/actions/runs/37428485849)；[后续文档提交四组 CI](https://github.com/InInNHD/dsh-recheck/actions/runs/37430525208)，均首轮通过 |
| 3 名真实用户，各使用真实项目至少一周 | **未完成** | 脱敏试用记录，不用自动测试或演示代替 |
| 每人至少 3 条有用结论并完成变化→检查→复核 | **未完成** | 试用记录中的实际次数与体验 |
| 能区分依据未变与结论被支持 | **未完成** | 用户用自己的话解释两种状态 |
| 已知数据丢失、越权、跨项目串数据、错误复核、支持组合加载失败 | 发布前复查 | 缺陷列表和对应修复/回归；没有已知问题不等于保证零风险 |
| 最终 0.1.0 tgz、版本、安装验证与四组 CI | 发布技术门槛 | 在最终提交重新执行；通过后发布，证据和哈希附于 0.1.0 Release；不得复用 beta.1 包冒充正式版 |

这些是本项目的验收记录，不是官方社区的准入要求。调整发布计划不等于完成真实试用，不因版本号变为 0.1.0 就将等待项勾选为完成。

### 本轮技术验收记录

历史被测准备提交为 `7315f249bedf4853d6949320d0be1f4652a10b2d`；当时 [PR #5](https://github.com/InInNHD/dsh-recheck/pull/5) 为待验收草稿。该次本机两组验收正常结束，远端四组首轮通过；`fab91516cfbb18338e9f9f1ad01586dd3772a55b` 仅记录这些验收事实。本次正式发布继续使用 PR #5，版本及验收脚本有变化，必须验证新的提交。

历史冻结的**仅供隔离验收的工作区包**共 36 个文件、887065 字节，SHA-256 `8c83b3bad9c4770cabe688554988fdd869d287bb4fbd0645bddedff869fbb236`。全部打包文件匹配当时工作区，lib 与 patch 逐字节匹配公开 beta.1。该包不是公开 beta.1，也不是 0.1.0，不上传、不替换已发布版本。最终 0.1.0 使用新的版本常量与发布文档，必须单独生成并验证。

本机记录保存在忽略的 `.integration/stable-readiness-result.json`、`stable-prep-package-audit.json` 和 `stable-prep-baseline/candidate-result.json`。两个 PowerShell 示例经过静态语法解析，没有在真实项目执行。首次受限环境不能结束测试子进程，保留 `stable-prep-*-sandbox-failed.log`；使用允许管理自己子进程的环境重新完整运行后通过，不把中断记为成功。此次没有重新运行 Desktop UI；运行代码不变，沿用 beta.1 的平台验收范围，不扩大支持声明。

## 本次正式发布步骤

1. 记录维护者调整发布范围的决定，公开说明三人一周真实试用未完成。持续收集自愿提供的脱敏记录，不编造试用结果；发现关键问题先修复，再重新验证受影响范围。
2. 根据反馈修复实际问题；若运行代码或依赖变化，重新执行受影响的 Desktop/Web 验收，更新截图与兼容说明。没有验证的 macOS/Linux Desktop 和 0.2.1-alpha.1 Desktop 仍不列为支持。
3. 统一修改 package.json、package-lock.json、compatibility.json 为 `0.1.0`；将 publishConfig.tag 改为 `latest`，同步中英文 README、安装指南、变更记录和本文件状态。不要改写旧版本历史或删除试用不足说明。
4. 在同一提交执行 `npm run check`，生成一次正式 tgz，核对内容与 SHA-256；两个精确宿主分别运行 `node scripts/package-smoke.mjs --host <版本> --no-pack --web`。确认实际安装版本，不仅检查 package.json。
5. 等待该提交 Windows/Ubuntu 四组 CI 通过。若变更了运行代码，补做已声明的 Windows rc.2 Desktop 验收；日志、哈希与支持范围必须一致。
6. 依照 [发布流程](11-version-management.md) 发布 `v0.1.0` 和同一 tgz 到 GitHub/npm，正式 Release 不标记 prerelease。复查 npm `latest`、重新下载两端包核对哈希，并完成发布包实际安装验证。
7. 完全退出日常 Desktop、备份配置和各项目数据后，才按用户授权升级日常配置。若升级失败，保留现场并按固定版本回退，不删除项目存储。

本次正式版仍依赖预发布宿主。0.1.0 表示维护者在明确技术验收范围内选择正式分发，不表示真实试用目标已完成、宿主已稳定或获得 DeepSeek 官方背书。macOS/Linux Desktop、0.2.1-alpha.1 Desktop 未验证；权限和输入法边界的替代夹具说明仍见 beta.1 验收，不扩大支持范围。

## English release status

On 2026-10-14 the maintainer explicitly chose to release 0.1.0 on npm latest within the existing technical validation scope. The planned three-user, one-week real-project trial and its usability goals remain incomplete and continue after release. Automated checks do not replace that feedback. This version improves UI acceptance assertions, exercises packaged backup/recovery and validates rollback to both beta.1 and alpha.6. Runtime behavior, schema and exact supported Hosts remain unchanged; build-time version metadata changes to 0.1.0. The final artifact and matching-commit CI must pass before publication; the Release records that evidence and checksum. No official endorsement or untested Desktop compatibility is claimed.
