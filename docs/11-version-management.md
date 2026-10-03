# Git 与发布流程

仓库：https://github.com/InInNHD/dsh-recheck。默认分支 main。维护者身份使用 GitHub noreply 邮箱。

## 日常修改

```powershell
git switch main
git pull --ff-only
git switch -c fix/具体问题
# 修改后
npm.cmd run check
git add 具体文件
git commit -m 'fix: 具体行为'
git push -u origin fix/具体问题
```

在 GitHub 创建 PR，等待 CI 通过再合并。小型单人项目不维护长期 develop 分支。不要在已有未提交修改时盲目切换分支或 pull；先用 git status 检查。撤销已分享的提交优先用 git revert，避免重写公开历史。

## 版本发布

package.json、package-lock.json、Git tag 和 Release 保持一致。已经发布的 tag 和 tgz 不替换；修复后增加版本号。

```powershell
npm.cmd version 0.1.0-alpha.4 --no-git-tag-version
# 更新 README、CHANGELOG 和公开验收记录
npm.cmd run check
npm.cmd run test:package
npm.cmd pack
git add package.json package-lock.json README.md README.en.md CHANGELOG.md docs
git commit -m 'chore: prepare 0.1.0-alpha.4'
git push origin main
# 等待该提交的 CI 通过后
git tag -a v0.1.0-alpha.4 -m 'Recheck 0.1.0-alpha.4'
git push origin v0.1.0-alpha.4
```

在 GitHub 对同一 tag 创建预发布 Release，附真实 tgz、SHA-256 校验文件、变更摘要及验证范围。安装包必须由该 tag 源码构建。GitHub 自动源码 ZIP 不含忽略的 lib，不能直接当安装包。

生成校验文件（PowerShell）：

```powershell
$recheckPackage = 'dsh-recheck-0.1.0-alpha.4.tgz'
$recheckHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $recheckPackage).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$recheckPackage.sha256" -Value "$recheckHash  $recheckPackage" -Encoding ascii
```

## 跟踪边界

源码、测试、脚本、文档、锁文件、CI 和许可证进入 Git。node_modules、lib、tgz、校验附件、.integration、.reference、.dsh、.env 和 .npmrc 忽略。git add 前用 git diff 和 git status 核对；不要 git add -f 私密目录。

项目运行数据单独备份。git push 只同步已提交历史，不会备份忽略目录。

## npm 发布

alpha.2 仅在 GitHub 分发；alpha.3 移除 private 并设置 publishConfig 为官方 registry/public/alpha。先核对登录账号、包名和新版本，使用同一 tgz 发布到 npm 与 GitHub Release，避免同名同版本出现不同安装包。

```powershell
npm.cmd whoami --registry https://registry.npmjs.org
npm.cmd publish ./dsh-recheck-0.1.0-alpha.4.tgz --tag alpha --access public --registry https://registry.npmjs.org
npm.cmd view dsh-recheck@0.1.0-alpha.4 version dist.integrity --registry https://registry.npmjs.org
```

预发布不要默认标为 latest；凭据只使用本机登录或受控 CI 认证，不提交 .npmrc 或 token。若 CLI 要求浏览器或一次性验证码，在本机完成认证，不将凭据写进文档。GitHub 账号绑定与 npm Trusted Publisher 配置是不同操作；本次使用本机登录发布，不额外创建自动发布工作流。
