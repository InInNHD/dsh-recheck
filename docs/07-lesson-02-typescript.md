> 历史学习记录，示例配置不是当前实现。当前版本请看根目录 README 和 13-public-release-validation.md。

# 第 02 课：建立正式 TypeScript 项目

开发工具：VS Code。  
目录：`E:\DSH Recheck Plugin`。  
前置结果：用户已完成第一课全部代码练习，输出符合预期。  
本轮目标：手写项目配置和双状态类型，安装编译器，完成一次成功及一次故意失败的类型检查。

第一课文件保留在 learning 中，作为学习记录。正式插件代码从 src 开始。本轮不安装 DSH；它在第 04 课的固定版本接入阶段处理。

## 1. 本轮文件结构

在 VS Code 的资源管理器中逐一创建：

```text
E:\DSH Recheck Plugin\
├── package.json       # 手写：包的元信息和执行命令
├── .gitignore         # 手写：Git 忽略规则
├── tsconfig.json      # 手写：TypeScript 检查配置
├── src\
│   └── types.ts       # 手写：正式领域类型
├── learning\         # 第一课，保留
└── docs\             # 已有计划与教程，保留
```

如果文件已经存在，先查看内容并反馈，不覆盖现有配置。助手的本地命令工具未能启动，因此尚未读到你当前目录的实际文件清单；本轮以你手写和运行结果为准。

## 2. 手写 package.json

文件完整路径：`E:\DSH Recheck Plugin\package.json`。

```json
{
  "name": "dsh-recheck",
  "version": "0.1.0-alpha.1",
  "private": true,
  "description": "Track conclusions and revisit them when evidence files change.",
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

说明：

| 字段 | 作用 |
| --- | --- |
| name | 当前包名；这里使用设计建议，不代表已在 npm 注册 |
| version | 内部开发版本；完成首版验收后才使用目标 beta 版本 |
| private | 当前阶段防止误发布 npm；后续准备分发时再调整 |
| description | 简短介绍 |
| type: module | 采用 JavaScript 模块语法，如 import/export |
| scripts | 给常用命令起名字 |
| typecheck | 执行 tsc；--noEmit 表示只检查，不生成 JavaScript |

JSON 文件不要写 // 注释，不要在最后一个字段后保留多余逗号。依赖字段在安装时由 npm 写入，不手抄虚构版本。

## 3. 手写 .gitignore

文件完整路径：`E:\DSH Recheck Plugin\.gitignore`。

```gitignore
# 安装依赖和生成的代码可以重新生成。
node_modules/
lib/
lib-tests/

# 本地打包产物。
*.tgz

# 本地环境配置与项目运行数据。
.env
.env.*
!.env.example
.dsh/

# 运行日志。
*.log
```

这里的 # 是 Git 忽略文件支持的注释。它不会删除文件，也不会阻止 Node 或 DSH 访问文件；只告诉 Git 哪些未跟踪文件不应纳入版本控制。已跟踪的文件不会因为新增忽略规则而自动取消跟踪。

package-lock.json 应保留，不加入忽略名单。node_modules 不需要手动创建。此时还未进行 git init；本轮先完成类型检查。

## 4. 手写 tsconfig.json

文件完整路径：`E:\DSH Recheck Plugin\tsconfig.json`。

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

说明：

| 设置 | 含义 |
| --- | --- |
| target | 使用 ES2022 作为基础目标 |
| lib | 当前 Host 代码使用 ES2022 标准类型；浏览器配置在客户端阶段添加 |
| module / moduleResolution | 按 Node.js 模块规则检查代码与导入路径 |
| strict | 开启严格类型检查，及时发现遗漏和不匹配 |
| types: node | 使用 Node.js API 的类型说明 |
| include | 只把 src 下的 .ts 文件纳入当前项目检查 |

include 中的 ** 表示任意层级子目录。learning 中的 .mjs 不在本轮检查范围，仍可单独运行。

上述配置依据 [TypeScript 模块参考](https://www.typescriptlang.org/docs/handbook/modules/reference.html#node16-nodenext) 和 [strict 配置说明](https://www.typescriptlang.org/tsconfig/strict.html) 选取。当前仅建立 Node Host 的基础配置；还没有验证 DSH 接入或客户端构建。

## 5. 手写 src/types.ts

先新建 src 文件夹，然后新建 `E:\DSH Recheck Plugin\src\types.ts`。

```typescript
// 文件新鲜度：只能使用下面五种字符串。
export type Freshness =
  | 'unchecked'
  | 'unchanged'
  | 'changed'
  | 'missing'
  | 'unknown'

// 复核意见：独立于文件新鲜度。
export type Assessment =
  | 'unreviewed'
  | 'supported'
  | 'refuted'
  | 'uncertain'
```

type 定义一个类型名称；| 表示允许其中任意一种；export 让其他代码文件可以导入此类型。它与第一课的 || 不同：| 在这里描述允许的类型，|| 在运行代码里做逻辑“或者”。

这些类型在编译后不会成为运行时数据；来自模型输入或 JSON 的值仍需在后续课进行运行时校验。

## 6. 安装两项开发依赖

先 Ctrl+S 保存所有文件，再在 VS Code 的 PowerShell 终端运行：

```powershell
Set-Location -LiteralPath 'E:\DSH Recheck Plugin'
npm.cmd install --save-dev --save-exact typescript '@types/node@24'
```

本机此前观察到 Node 24，因此安装 Node 24 系列类型。若你的 Node 主版本已改变，先反馈，不盲目套用类型版本。

| 参数 / 包 | 作用 |
| --- | --- |
| --save-dev | 记录为开发依赖 |
| --save-exact | 将实际安装版本写成精确版本 |
| typescript | 提供 TypeScript 编译器 tsc |
| @types/node@24 | 为 Node 24 系列 API 提供类型定义 |

安装时解析实际可用的包版本，然后固定到 package.json 和 package-lock.json；并不是每次都自动升级。npm 会生成 node_modules 和 package-lock.json。参考 [npm install 官方说明](https://docs.npmjs.com/cli/v11/commands/npm-install/)。

使用 npm.cmd 可避免 PowerShell 对 npm.ps1 的执行策略问题。安装本身需要你本机网络能访问已配置的 npm registry。

如果安装失败，反馈报错并先解决，不继续执行缺少依赖的类型检查。不使用 npm audit fix --force，也不更改全局 DSH 或系统设置来掩盖失败。

## 7. 第一次类型检查

安装成功后运行：

```powershell
npm.cmd run typecheck
npx.cmd --no-install tsc --version
npm.cmd list --depth=0
```

npm run 会优先找到项目内安装的 tsc，不需要全局安装编译器。--no-install 要求 npx 使用已安装的命令。

typecheck 的常见成功输出：

```text
> dsh-recheck@0.1.0-alpha.1 typecheck
> tsc --noEmit
```

之后回到 PowerShell 提示符，没有 TypeScript 错误即为本次检查成功。它只进行静态检查，不会打印第一课的指纹，不执行插件，也不证明逻辑已经正确。

记录 tsc 和两项依赖的实际版本。当前助手没有运行这些命令，不能把未执行的安装或检查记为通过。

## 8. 验证类型检查真的能发现错误

在 types.ts 末尾临时增加：

```typescript
const exampleFreshness: Freshness = 'unchanged'
```

冒号后的 Freshness 说明这个变量只能使用前面列出的五个值。保存后检查应通过。

然后故意拼错：

```typescript
const exampleFreshness: Freshness = 'unchange'
```

再次保存并运行 npm.cmd run typecheck。预期编译器指出 'unchange' 不能赋给 Freshness；具体错误格式按实际 TypeScript 版本可能不同。

理解错误后删除这条临时测试变量，再运行检查，应恢复成功。正式 types.ts 只保留上面的两项类型声明。

这是一次编译器验证实验，不是插件的运行时测试，也不需要永久增加一个样例变量。

## 9. 常见问题

| 问题 | 检查方法 |
| --- | --- |
| EJSONPARSE | 检查 package.json 引号、逗号、括号和不允许的注释 |
| TS18003 / No inputs | src/types.ts 是否存在、是否保存、路径是否匹配 include |
| Cannot find type definition file for node | @types/node 是否安装成功，npm list 实际结果 |
| tsc 无法识别 | 依赖是否安装在当前目录；使用 npm run typecheck |
| 网络、证书或 registry 错误 | 发具体错误，不直接改全局配置或关闭 TLS 验证 |
| VS Code 与终端提示不同 | 打开 .ts 文件，通过命令面板选择项目安装的 TypeScript 版本 |

## 10. 本轮完成条件

- [ ] 已手写 4 个文件，learning 和 docs 保留。
- [ ] 安装成功，记录实际 TypeScript / Node 类型版本。
- [ ] 正确代码类型检查通过。
- [ ] 故意拼错状态时出现类型错误。
- [ ] 删除临时实验变量后再次检查通过。

反馈最终 typecheck、tsc --version、npm list 输出，以及错误实验是否出现预期提示。下一轮将第一课的状态函数迁移为带参数和返回值类型的正式 TypeScript 函数；第 02 课仍需完成这一迁移，之后才进入异步与宿主接入。
