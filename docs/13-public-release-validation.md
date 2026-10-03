# 0.1.0-alpha.2 公开发布验证

日期：2026-10-03，Asia/Shanghai。非官方社区插件。版本保持 alpha。

## 本次已执行

宿主均为 DSH 0.2.0-rc.2，Node.js 24.18.0。

| 环境 | 类型检查、构建及 29 项测试 | 实际 tgz 安装/卸载/重装 | 真实 Web 14 项流程 |
| --- | --- | --- | --- |
| 本机 Windows | 通过 | 通过 | 通过，Edge |
| GitHub windows-latest | 通过 | 通过 | 本作业未运行浏览器 |
| GitHub ubuntu-latest | 通过 | 通过 | 通过，Chromium |

公开证据：[CI 运行 37118953680](https://github.com/InInNHD/dsh-recheck/actions/runs/37118953680)，验证提交 `2371fdd`。后续修改为发布记录与仓库文档；发布 tag 的同提交检查可在仓库 Actions 查看。

- 从 npm 官方源创建全新隔离配置并安装实际 tgz，宿主 inventory 显示插件 active。
- 停止宿主、移除插件包与 bundle 后重新启动，inventory 不再列出插件。
- 重装后卡片 revision、完整版本历史、最新 checkId 与存储 SHA-256 保持一致。
- Web 流程涵盖宿主认证、拒绝伪造工作区、创建、完整文件检查、主动否定复核、并发冲突、导出不覆盖、归档恢复、真实只读模式、草稿隔离、窄栏焦点及时区展示；没有页面异常或模型消息。
- README 截图来自本次独立样例项目，没有日常项目或认证 URL。
- 依赖版本与 integrity 保持不变；锁文件 resolved 使用 npm 官方源。
- 私密运行目录、认证状态、依赖、构建产物和发布附件不进入 Git。

CI 定义见 `.github/workflows/ci.yml`。安装包只通过 GitHub Release 分发，附 SHA-256；本次不发布 npm。

## 历史证据与当前限制

alpha.1 的 Windows 14 项真实 Web 流程、12 项 Desktop 检查与生命周期已记录于 09/10 文档。运行 API 和 schemaVersion 1 在 alpha.2 保持不变；Desktop 12 项属于 alpha.1 的历史实测，本次未将其标为 alpha.2 重新验证。

尚需独立验收完整纯键盘全流程、卸载后的客户端页签注销、操作系统级拒读。未声明兼容其他 DSH 版本、多 Host 并发写同一存储、共享网络盘或远程 FS。本版 Ubuntu CI 通过不等于所有 Linux 桌面发行版通过。
