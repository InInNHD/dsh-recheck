# 0.1.0 正式版准备与待验收清单

更新日期：2026-10-06。**状态：待验收，尚未发布 0.1.0 正式版。**

用户已确认尚未完成真实试用，继续准备并保留待验收状态。因此当前包版本、兼容清单仍为 `0.1.0-beta.1`，npm 渠道仍为 `beta`。不提前创建稳定版 tag、Release，也不移动 `latest`。本轮只收敛验证与文档，不新增业务功能、不改变 schema 1、宿主范围或运行依赖。

## 已有发布基线

- beta.1 发布提交：`a4093e4fad7944110c25c2e93a23f470700b3f21`。
- [GitHub Release](https://github.com/InInNHD/dsh-recheck/releases/tag/v0.1.0-beta.1) 与 npm `dsh-recheck@0.1.0-beta.1` 分发同一份 881717 字节的 tgz。
- SHA-256：`36e501d2de625298d7cb0a63656db1b9bbf0fc049dd283233688656f9e7df625`。
- [发布提交 CI](https://github.com/InInNHD/dsh-recheck/actions/runs/37344616666)：Windows/Ubuntu × 0.2.0-rc.2/0.2.1-alpha.1 四组通过，Ubuntu 包含完整 Web 流程。Ubuntu rc.2 首轮有一处 UI 瞬时断言失败，单组重跑通过；保留这项历史，不将重跑描述为已修复。
- 47 项自动化测试、本机两个 Web 宿主各 33 类检查、Windows rc.2 Desktop 29 类检查；具体范围和替代夹具见 [beta.1 验收](19-beta1-acceptance.md)。

公开发布基线和开发工作区是两回事。本轮新增文档、验收脚本不替换已经发布的 beta.1 tag 或安装包；工作区自行打包的 beta.1 只能用于隔离验收，不能重新发布同名版本。

## 本轮收敛内容

1. `review-queue-smoke.mjs` 的筛选数量、排序与选择清空断言等待实际界面结果，使用现有 Playwright 的自动重试断言，不增加固定延时、不重跑整套流程掩盖失败。
2. `package-smoke.mjs` 在实际 tgz 安装后的真实 Host 中执行完整恢复演练。先停止宿主再复制完整存储并核对字节；归档恢复、编辑和导出均走真实工具；注入损坏 JSON 后验证拒绝读取且原文件未被覆盖；保留损坏副本，再恢复备份。
3. 恢复时故意保留已变化的依据文件，验证历史检查不是当前验证：临时检查发现变化但不写入，旧 checkId 的复核被拒绝；重新持久检查后才能主动复核。恢复会丢弃备份后新增的卡片状态与历史，本轮明确验证这种时间点回退。
4. 提供 [真实试用与备份恢复指南](21-trial-and-recovery.md)，不增加遥测、自动导入或恢复向导。

自动演练只写入脚本创建的 `.integration/package-smoke-*` 目录，不操作日常 Desktop 配置或真实项目。演练成功后回到原始一次性样例继续卸载重装及 alpha.6 回退检查；保留演练备份、坏文件和 Markdown 导出。

## 验收表

| 门槛 | 当前状态 | 完成证据 |
| --- | --- | --- |
| beta.1 公开基线和分发一致性 | 已完成 | 上述固定提交、Release、CI 和 SHA-256 |
| 本轮类型、构建、47 项测试 | 待运行核对 | 本轮运行日志 |
| 两个精确 Host 的实际包恢复与生命周期演练 | 待运行核对 | 包验收报告的 `recovery` 和生命周期字段 |
| 本轮 Windows/Ubuntu CI | 待运行核对 | 本轮对应提交的四组结果，不引用旧提交代替 |
| 3 名真实用户，各使用真实项目至少一周 | **未完成** | 脱敏试用记录，不用自动测试或演示代替 |
| 每人至少 3 条有用结论并完成变化→检查→复核 | **未完成** | 试用记录中的实际次数与体验 |
| 能区分依据未变与结论被支持 | **未完成** | 用户用自己的话解释两种状态 |
| 已知数据丢失、越权、跨项目串数据、错误复核、支持组合加载失败 | 发布前复查 | 缺陷列表和对应修复/回归；没有已知问题不等于保证零风险 |
| 最终 0.1.0 tgz、版本与安装验证 | 等待试用结束 | 验收同一提交生成的包和哈希；不得复用 beta.1 包冒充正式版 |

这些是本项目的稳定版标准，不是官方社区的准入要求。不能因为版本号变为 0.1.0 就把等待项勾选为完成。

## 试用结束后的正式发布步骤

1. 收齐 3 份自愿提供的脱敏记录，确认各自一周使用与核心闭环。未达成目标时先记录原因；有关键问题继续 beta，必要时发布 beta.2 修复。
2. 根据反馈修复实际问题；若运行代码或依赖变化，重新执行受影响的 Desktop/Web 验收，更新截图与兼容说明。没有验证的 macOS/Linux Desktop 和 0.2.1-alpha.1 Desktop 仍不列为支持。
3. 通过门槛后才统一修改 package.json、package-lock.json、compatibility.json 为 `0.1.0`；将 publishConfig.tag 改为 `latest`，同步中英文 README、安装指南、变更记录和本文件状态。不要改写旧版本历史。
4. 在同一提交执行 `npm run check`，生成一次正式 tgz，核对内容与 SHA-256；两个精确宿主分别运行 `node scripts/package-smoke.mjs --host <版本> --no-pack --web`。确认实际安装版本，不仅检查 package.json。
5. 等待该提交 Windows/Ubuntu 四组 CI 通过。若变更了运行代码，补做已声明的 Windows rc.2 Desktop 验收；日志、哈希与支持范围必须一致。
6. 依照 [发布流程](11-version-management.md) 发布 `v0.1.0` 和同一 tgz 到 GitHub/npm，正式 Release 不标记 prerelease。复查 npm `latest`、重新下载两端包核对哈希，并完成发布包实际安装验证。
7. 完全退出日常 Desktop、备份配置和各项目数据后，才按用户授权升级日常配置。若升级失败，保留现场并按固定版本回退，不删除项目存储。

稳定的插件仍依赖预发布宿主。0.1.0 只表示 Recheck 在声明范围内达到本项目稳定标准，不表示宿主已稳定、不表示获得 DeepSeek 官方背书。

## English release status

Stable 0.1.0 is pending acceptance, not released. The package remains beta.1 until the planned three-user, one-week real-project trial is complete. This preparation improves UI assertions, exercises real packaged backup/recovery and documents voluntary trial feedback. It does not change runtime behavior, schema, supported hosts or production Desktop installations. The final stable artifact and matching-commit CI must be validated after the version bump; existing beta.1 artifacts are not a substitute.
