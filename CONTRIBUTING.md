# Contributing / 参与贡献

Recheck is an unofficial community plugin. Issues and focused pull requests are welcome.

Use Node.js 24.18.0 and the committed lockfile:

```sh
npm ci
npm run check
npm run test:package
```

Create a short-lived branch from main. Keep each change focused and include a meaningful regression check for behavior changes. Pull requests must pass Windows/Linux CI. Never commit credentials, real sessions, browser storage state, node_modules, lib or .integration.

请从 main 创建短期分支，一个 PR 处理一个明确问题。报告问题时说明插件、DSH、Node 和系统版本，提供最小复现与脱敏日志。业务文件访问必须继续使用宿主 ctx.fs；不要通过 Node fs 绕过权限，也不要把文件未变化解释为结论正确。

CI 的核心测试不等于桌面客户端、操作系统权限或所有宿主版本均经过验证。发布记录必须写明实际范围。发布与版本管理见 docs/11-version-management.md。
