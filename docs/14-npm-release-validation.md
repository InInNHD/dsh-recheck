# 0.1.0-alpha.3 npm 发布验证

日期：2026-10-03，Asia/Shanghai。非官方社区插件，继续保持 alpha。

本版仅调整发布元数据、版本号和安装文档；src、测试及构建逻辑与 alpha.2 相同。宿主仍限定 DSH 0.2.0-rc.2 / Node.js 24，schemaVersion 1 不变。

类型检查、构建、29 项测试、实际 tgz 安装/卸载/重装与数据保留及 Ubuntu 真实 Web 流程由同提交 CI 执行；公开结果见[仓库 Actions](https://github.com/InInNHD/dsh-recheck/actions)。alpha.2 已通过的 Windows/Ubuntu 证据见 [13 文档](13-public-release-validation.md)。

本版移除 private，并固定 publishConfig 的官方 registry、public 访问与 alpha 标签。目标为同一个 tgz 在 npm 与 GitHub Release 分发；发布结果以 [npm 包页面](https://www.npmjs.com/package/dsh-recheck) 和对应 Release 为准。凭据与测试 profile 不进入包或 Git。

完整纯键盘全流程、卸载后的客户端页签注销、操作系统级拒读及 alpha.3 Desktop 实机验收仍未声明通过。
