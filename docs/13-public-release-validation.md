# 0.1.0-alpha.2 公开发布验证

日期：2026-10-03，Asia/Shanghai。非官方社区插件。版本保持 alpha。

## 本次已执行

- Windows Node 24.18.0：Host/Client 类型检查、构建和 29 项真实 FS/Native/Node PTC 测试通过。
- Windows 从 npm 官方源创建全新隔离配置、安装 alpha.2 实际 tgz：插件 active；卸载后 inventory 不再列出插件；重装后卡片 revision、完整版本历史、最新 checkId 与存储 SHA-256 保持一致。
- Windows 真实 Web 14 项流程通过，无页面异常和模型消息；README 截图来自本次独立样例项目。
- 依赖版本与 integrity 保持不变；锁文件 resolved 使用 npm 官方源。
- 私密运行目录、认证状态、依赖、构建产物和发布附件不进入 Git。

GitHub Windows/Linux 的干净安装与 Linux Web 结果将在实际执行后更新；此处不提前宣称通过。CI 定义见 .github/workflows/ci.yml，公开运行记录见仓库 Actions。

## 历史证据与当前限制

alpha.1 的 Windows 14 项真实 Web 流程、12 项 Desktop 检查与生命周期已记录于 09/10 文档。运行 API 和 schemaVersion 1 在 alpha.2 保持不变；历史实测不能等同于新版在每个平台重新验证。

尚需独立验收完整纯键盘全流程、卸载后的客户端页签注销、操作系统级拒读。未声明兼容其他 DSH 版本、多 Host 并发写同一存储、共享网络盘或远程 FS。本版 CI 的 Ubuntu 通过也不等于所有 Linux 桌面发行版通过。
