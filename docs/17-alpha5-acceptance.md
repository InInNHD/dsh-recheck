# alpha.5：版本诊断与兼容性验收

版本：`0.1.0-alpha.5`。预发布通过 npm `alpha` 与 GitHub Release 分发。本文件记录本版隔离验收范围；发布 PR 还须通过下述远端 CI。早期版本的报告不代替本版结果。

## 功能

- 原生侧栏增加默认折叠的“版本与诊断”，手动读取，避免常驻轮询。
- 客户端和 Host 加载版本来自同一份 package.json 构建信息，安装版本来自宿主公开 `pluginManager.listBundles()`。不可用时显示“无法读取”，不拿加载版本代替。
- 宿主包版本来自可选的公开运行时包解析器；profile 没有可靠的公开读取入口，因此显示“无法读取”。这不影响卡片操作。
- 显示会话写入策略、支持的 schema 和当前存储校验结果。允许写入仅表示会话策略，不保证文件系统一定允许写入；真正写入仍经过原有 FS、沙箱和观察策略。
- 诊断复制内容为固定字段，不包含绝对项目路径、会话 ID、卡片/依据正文或底层异常文本。读取失败只返回受控错误码。
- 客户端/Host 版本不同或安装版本尚未加载时，提示保存工作后完全重启。冲突、只读、权限不足、损坏或未来 schema 给出可操作的说明。
- 取消请求后，即使底层传输迟到也不再更新页面。插件卸载取消未完成诊断，业务提交继续遵循原有原子写入规则。

## 验收方式与隔离

`npm run check` 检查两端类型、构建和核心测试。`package-smoke` 在忽略的 `.integration` 下创建独立配置，安装实际 tgz，将测试代码放入该配置的依赖树运行，从而使用该宿主的真实 SDK。裸 npm 配置显式锁定匹配宿主的整组 SDK/Cordis，避免 peer 自动选择另一宿主版本；不使用 `--force` 或 `--legacy-peer-deps`。

实际包验收检查 Host/Client 注册、诊断返回、20 次通过宿主公开管理接口启停、停用后路由撤销、卸载重装、字节/历史保留与完整 Web 流程。Web 流程另外检查诊断认证、拒绝自带 cwd、版本不一致提示、300px 窄栏、20 次会话切换无重复列表请求和迟到响应隔离。

桌面验收使用本机安装的真正 Electron 应用，使用独立的 Harness home、Electron user-data 和测试项目。只替代系统文件夹选择的结果，其他宿主流程保持真实。本次不升级或重启用户日常 desktop 配置。

共存测试使用本机已安装的 `dsh-boot-animation@0.4.2` 重新打包为测试夹具；不是从 npm 安装不存在的同名版本。界面通过按钮真实命中测试确认可交互，不把 DOM 可见当作启动动画覆盖层已经消失。该第三方包不随 Recheck 发布。

## 结果

| 组合 | 本机结果 | 限制 |
| --- | --- | --- |
| Node 24.18.0 / Windows / 开发基线 | 两端类型、构建、32 项测试通过 | Node PTC 为官方真实后端；测试不调用模型 |
| Harness 0.2.0-rc.2 / Windows Web | 32 项隔离 SDK 测试、真实包生命周期、20 次 Host 启停及完整 Web 回归通过 | 共存 `dsh-boot-animation@0.4.2`，使用本地测试包 |
| Harness 0.2.1-alpha.1 / Windows Web | 同样通过隔离 SDK、真实包和完整 Web 回归，加入支持清单 | 不代表此宿主版本的 Desktop 已验收 |
| Harness 0.2.0-rc.2 / Windows Desktop | 真正 Electron 中 15 项检查通过，包含实际版本、诊断白名单、窄栏和共存 | 文件夹选择结果使用测试夹具；版本不一致的 HTTP 注入用例只在 Web 测，Desktop 使用真实 IPC |
| Windows / Ubuntu 远端 CI | 发布 PR 必须通过两个精确宿主的类型、32 项测试和真实包生命周期；Ubuntu 另跑完整 Web 回归 | 以该发布提交的 Actions 结果为准；不含 Linux Desktop |
| macOS / Linux Desktop、0.2.1-alpha.1 Desktop | 未验证 | 不作兼容承诺 |

Web 回归覆盖原有 14 项流程及新增 4 类检查。核心新增用例包含真实 Cordis 连续启停、诊断无写入/内容泄露、取消，以及错误/未来 schema 保留。会话切换计数验证没有重复的初始列表请求，不等于对全部内存行为做了 GC 或长期压力证明。

验收期间修正了两处测试前置条件：窄窗口验收后恢复宽窗口再操作宿主项目侧栏；Electron 原生 IPC 不用 HTTP 响应拦截来假装制造版本不一致。未通过的中间运行保存在忽略目录，最终安装包报告以 `package-smoke-win32-<宿主版本>-result.json` 为准。

公开发布包的 SHA-256 随 GitHub Release 附件提供；npm 与 GitHub 使用同一 tgz。此前本机候选验收记录保存在忽略目录，发布版仅更新分发文档和清单，Host/Client 运行文件须与该验收候选逐字节一致。

已知记录：此前两次 Web 运行在冲突恢复保存时返回通用 Host 错误，未捕获根因，不宣称已修复。两个宿主的隔离复测、最终包验收和额外 100 轮冲突恢复均通过；正式运行文件不含排查期间的私有日志。若再次出现，需继续定位。

## 重现命令

```powershell
npm.cmd ci
npm.cmd run check
node scripts/package-smoke.mjs --host 0.2.0-rc.2 --web
node scripts/package-smoke.mjs --host 0.2.1-alpha.1 --web
```

需要测试启动动画共存时，提供已经信任的本地安装包：

```powershell
node scripts/package-smoke.mjs --host 0.2.0-rc.2 --web --coexist 'C:\Path\dsh-boot-animation-0.4.2.tgz'
```

桌面验收前，先在独立、已经由桌面应用初始化的测试 home 安装对应包；不要把下面两个隔离路径替换成日常配置：

```powershell
node scripts/desktop-smoke.mjs --app 'C:\Path\DeepSeek Harness.exe' --home '.integration\desktop-test-home' --user-data-dir '.integration\desktop-test-user-data'
```

## 安装与回退

从 [alpha.5 Release](https://github.com/InInNHD/dsh-recheck/releases/tag/v0.1.0-alpha.5) 获取 `dsh-recheck-0.1.0-alpha.5.tgz` 和同名 `.sha256`，或在匹配宿主中安装固定 npm 版本 `dsh-recheck@0.1.0-alpha.5`。`latest` 可能仍指向旧版；使用固定版本或 `alpha`。

桌面用户保存工作并完全退出后，使用该桌面应用自带 CLI，安装到实际使用的 desktop profile，再启动应用：

```powershell
& 'C:\Path\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add 'C:\Path\dsh-recheck-0.1.0-alpha.5.tgz'
```

本版保持 schema 1，不迁移或重写现有卡片。回退先保存工作并退出宿主，保留项目数据备份，再安装 alpha.4 并重启；详情见 [安装与恢复指南](12-installation.md)。只回退插件，不自动更换宿主版本：alpha.4 的宿主支持仍限于 `0.2.0-rc.2`。

诊断是一次读取时的状态，不是持续健康监控，也不证明文件依据或结论正确。认证不可用、旧 Host 未提供诊断接口时，界面给出连接提示；不会绕过宿主访问配置文件。
