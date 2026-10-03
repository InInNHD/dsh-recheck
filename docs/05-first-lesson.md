> 历史学习记录，示例配置不是当前实现。当前版本请看根目录 README 和 13-public-release-validation.md。

# 第 01 课：亲手写出 Recheck 的核心比较逻辑

对应计划：M0 / 第 01 课。  
建议时间：60～90 分钟，可分成两次。  
本课成果：你手写一个可以运行的 Node.js 练习，理解文件指纹和两条状态轴。  
它是内存中的教学程序，还没有注册 DSH 工具、读取真实依据或保存卡片。

## 1. 打开项目和终端

开发工具已确定为 VS Code，后续操作统一按 VS Code 说明。

### 使用 VS Code

1. 打开 VS Code。
2. 选择 File → Open Folder，打开 `E:\DSH Recheck Plugin`。
3. 选择 Terminal → New Terminal，终端使用 PowerShell。

也可以在已有 PowerShell 中执行：

```powershell
Set-Location -LiteralPath 'E:\DSH Recheck Plugin'
code .
```

`Set-Location` 切换终端目录；`-LiteralPath` 把路径按原样解释；单引号保护路径中的空格；`.` 代表当前目录。启动编辑器不等于保存了你正在输入的文件。

### 确认环境

在所选编辑器的终端执行：

```powershell
Set-Location -LiteralPath 'E:\DSH Recheck Plugin'
node --version
npm.cmd --version
git --version
```

本次助手检查到的版本分别是 `v24.18.0`、`11.16.0`、`2.55.0.windows.3`。你自己的终端应能找到这些命令，版本变化时记录实际值。本课只依赖 Node.js，npm 和 Git 的检查用于后续准备。

如果编辑器终端找不到 node，但系统终端能找到，先关闭并重新打开编辑器，让它读取新的 PATH；不要因此重装所有工具。

## 2. 创建练习文件

在编辑器的项目文件树中新建 `learning` 文件夹，再新建：

`E:\DSH Recheck Plugin\learning\01-fingerprint.mjs`

`.mjs` 让 Node 把文件作为 JavaScript 模块运行，可以使用 `import`。注意文件名不能变成 `01-fingerprint.mjs.txt`。文件保存为 UTF-8。

本课建议逐段手写。注释中的中文可以保留；它们说明代码的目的，运行时不执行。

## 3. 输入完整练习

### 第一次指导：先运行一个指纹

本轮只输入下面这一小段到练习文件，保存并运行。得到 64 个十六进制字符后，下一步再扩展成后面的完整练习；两段代码不要同时粘贴在同一文件里。

```javascript
// 从 Node.js 自带的模块中取出计算哈希的工具。
import { createHash } from 'node:crypto'

// 定义函数；bytes 表示传入的字节数据。
function fingerprint(bytes) {
  return createHash('sha256')
    .update(bytes)
    .digest('hex')
}

// 模拟文件内容：把文字按 UTF-8 编码变成字节。
const originalBytes = Buffer.from('requestId: same-id\n', 'utf8')

// 调用函数，得到内容指纹。
const sha256 = fingerprint(originalBytes)

// 打印到终端，方便观察运行结果。
console.log('内容指纹：', sha256)
console.log('指纹长度：', sha256.length)
```

执行 `node '.\learning\01-fingerprint.mjs'`，应输出“内容指纹”和“指纹长度：64”。执行前终端应位于开发目录。本轮暂不要求完成全部验收勾选。

### 第一课完整练习：后续逐段扩展的目标

下面是可以独立运行的完整程序。第一遍先输入并运行；第二遍结合下一节理解；第三遍做修改练习。

```javascript
// Node 自带的指纹函数；不需要 npm install。
import { createHash } from 'node:crypto'

// assert 是检查工具：实际结果不符合预期时，程序报错。
import assert from 'node:assert/strict'

// 这是函数定义。bytes 是传进来的“字节”。
// 每次创建一个新的哈希对象，避免不同文件的内容混在一起。
function fingerprint(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

// 把文件状态汇总成卡片状态。
// undefined 表示没有检查记录；[] 表示异常的空结果。
function summarizeFreshness(statuses) {
  if (statuses === undefined) return 'unchecked'
  if (statuses.length === 0) return 'unknown'
  if (statuses.includes('missing')) return 'missing'
  if (statuses.includes('changed')) return 'changed'
  if (statuses.includes('unknown')) return 'unknown'
  return 'unchanged'
}

// const 声明一个绑定不再重新赋值的变量。
// 这里把示例文件内容转换成 UTF-8 字节，模拟已读到的完整文件。
const originalBytes = Buffer.from('requestId: same-id\n', 'utf8')

// 对象用花括号表示，一项信息是一个“字段: 值”。
// 这里只存路径、哈希和大小；正式卡片还会保存时间等字段。
const baseline = {
  path: 'sample/retry.txt',
  sha256: fingerprint(originalBytes),
  sizeBytes: originalBytes.length,
}

// 一个“比较当前字节和原基线”的小函数。
// 它不修改 baseline，也不记录复核意见。
function compareBytes(currentBytes, savedBaseline) {
  const currentSha256 = fingerprint(currentBytes)
  const status = currentSha256 === savedBaseline.sha256
    ? 'unchanged'
    : 'changed'

  return {
    path: savedBaseline.path,
    status,
  }
}

// 第一次：字节没改，结果应为 unchanged。
const firstCheck = compareBytes(originalBytes, baseline)
console.log('第 1 次检查：', firstCheck.status)

// 第二次：示例内容变化，结果应为 changed。
const modifiedBytes = Buffer.from('requestId: different-id\n', 'utf8')
const secondCheck = compareBytes(modifiedBytes, baseline)
console.log('第 2 次检查：', secondCheck.status)

// 第三次：恢复原内容，结果应再次为 unchanged。
// 基线一直是最初的 baseline，没有在第二次检查时被覆盖。
const thirdCheck = compareBytes(originalBytes, baseline)
console.log('恢复后检查：', thirdCheck.status)

// 数组用方括号表示，这里模拟三个依据的检查结果。
// missing 的汇总优先级高于 changed，详情仍应保留其他问题。
const mixedStatuses = ['changed', 'unknown', 'missing']
console.log('混合情况汇总：', summarizeFreshness(mixedStatuses))

// 演示一种合法的组合；这不是实现正式的复核提交。
// 假设之前已有人记录支持意见，文件变化不会自动改写该意见。
const assessment = 'supported'
console.log('双状态：', assessment, '+', secondCheck.status)

// 下面是有效检查；修改比较逻辑或汇总优先级时应能暴露错误。
assert.equal(firstCheck.status, 'unchanged')
assert.equal(secondCheck.status, 'changed')
assert.equal(thirdCheck.status, 'unchanged')
assert.equal(summarizeFreshness(undefined), 'unchecked')
assert.equal(summarizeFreshness([]), 'unknown')
assert.equal(summarizeFreshness(['unchanged']), 'unchanged')
assert.equal(summarizeFreshness(['unchanged', 'unknown']), 'unknown')
assert.equal(summarizeFreshness(['changed', 'unknown']), 'changed')
assert.equal(summarizeFreshness(mixedStatuses), 'missing')
assert.equal(baseline.sha256, fingerprint(originalBytes))

console.log('本课检查全部通过。')
```

这段练习没有读取 `sample/retry.txt`：path 只是模拟的相对路径字段。真正的文件解析、权限、稳定读取、时间及存储保护在后续接入课实现。

## 4. 每段代码为什么这样写

### import 和标准库

`import { createHash } from 'node:crypto'` 从 Node 自带模块取出 createHash；`node:` 前缀说明这是 Node 标准库。Client 在浏览器中运行，不能把这个模块直接带入浏览器入口。

### SHA-256 的作用

`createHash('sha256')` 选择算法，`.update(bytes)` 喂入字节，`.digest('hex')` 得到 64 个十六进制字符的指纹。

指纹帮助检测字节差异，不评判文本含义、不证明结论正确，也不是内容备份。Recheck 检查完整字节，所以注释、空格和换行变化也会产生提醒。正式实现不会把文件内容先转换成字符串再归一化计算。

这里的使用方式参考 [Node.js crypto 文档](https://nodejs.org/api/crypto.html#cryptocreatehashalgorithm-options)，方法在本机 Node 上已执行验证。

### const、对象和数组

`const baseline = { ... }` 保存一个基线对象。const 禁止重新给 baseline 赋另一个对象，但并不禁止修改对象内部字段；正式实现通过构造新对象及规则校验保护已提交历史，不仅依赖 const。

`mixedStatuses` 是状态数组；`.includes('missing')` 表示数组中是否出现 missing。if 的顺序就是优先级。

### Buffer 与字符串

字符串是文字，Buffer 保存字节。UTF-8 中一个中文通常占多个字节，因此文件限额要按字节计量。标题限额按 Unicode code point 计量，两种计数不能混用。

`'requestId: same-id\n'` 末尾的 `\n` 是换行，不是反斜杠和 n 两个普通字符。改变换行也属于字节变化。

### function、return 与严格比较

function 定义可以重复调用的操作。return 把结果交给调用者。`===` 表示严格相等，不允许 JavaScript 悄悄把数字变成字符串来判断。

`条件 ? A : B` 是简短的二选一：哈希相同用 unchanged，否则 changed。本课函数只比较可靠的已知字节；正式读取失败还会产生 missing/unknown。

### 不覆盖基线

检查如果自动把基线改成最新内容，下一次就看不到相对原依据的变化。只有创建、结论/依据编辑及成功复核才能建立对应版本的新基线。普通检查只保存最近观察。

### 双状态为什么独立

freshness 表示文件观察，assessment 表示提交者意见。`supported + changed` 表示此前有人支持结论，但依据现在与基线不同。程序不能直接把它改写为 refuted。

同样，`refuted + unchanged` 合法：提交者否定该结论，而文件在观察时没有变化。创建时则应该是 unchecked/unreviewed。

### 为什么要写 assert

只打印结果需要人每次仔细看，容易漏错。assert 在结果不正确时停止程序，让这个小练习留下可重复检查。这几条检查对应产品的关键语义，后续会迁移到正式测试。

这里 `summarizeFreshness` 只接受我们自己给出的合法状态；正式 Host 接收输入和读取 JSON 时还需要运行时校验，不能把未知字符串当 unchanged。

## 5. 运行与预期结果

按 Ctrl+S 保存，在终端执行：

```powershell
Set-Location -LiteralPath 'E:\DSH Recheck Plugin'
node '.\learning\01-fingerprint.mjs'
```

预期结果：

```text
第 1 次检查： unchanged
第 2 次检查： changed
恢复后检查： unchanged
混合情况汇总： missing
双状态： supported + changed
本课检查全部通过。
```

命令执行后终端回到提示符就是程序结束。检查结果没有写到磁盘，练习也没有连接 DSH 或调用模型。

## 6. 做三个小实验

每次只做一个实验。记录结果后恢复，保证最终检查回到全部通过。

1. 把 modifiedBytes 的内容改成与 originalBytes 完全相同：第二次结果将变 unchanged，对应断言应失败。这说明检查比较字节，而不是变量名字。
2. 把 mixedStatuses 改为 `['changed', 'unknown']`：汇总应为 changed；原来的 missing 断言应失败。理解后把对应断言改为 changed，或把数组恢复。
3. 在 baseline 后增加 `console.log('基线指纹：', baseline.sha256)`，连续运行两次：相同字节指纹相同。代码输出里不会出现所谓“结论真实性百分比”。

断言失败不是“程序全坏了”，而是检查发现结果和预期不一致。先读实际与预期的差异，再检查修改。

## 7. 常见报错

| 报错或现象 | 原因 | 处理 |
| --- | --- | --- |
| node 无法识别 | 终端没有正确 PATH | 重新开编辑器或确认 Node 安装路径 |
| MODULE_NOT_FOUND | 文件没保存、名称/路径错误或目录错误 | 核对完整文件路径和 `.mjs` 后缀 |
| Unexpected token | 引号、括号、逗号或手写字符有误 | 定位报错行，确认使用英文半角标点 |
| assert / AssertionError | 结果与预期不一致 | 对照实验和实际输出，不删除检查掩盖问题 |
| 运行没有新变化 | 修改没有保存或执行了其他文件 | Ctrl+S，再核对命令 |
| npm.ps1 被禁止 | PowerShell 脚本策略 | 用 npm.cmd；本课运行 Node 不受它影响 |

## 8. 本课通过条件与下一步

- [ ] 能在选择的编辑器里打开项目并找到终端。
- [ ] 能自己运行练习并得到六行预期输出。
- [ ] 能解释 baseline、SHA-256、changed、unchecked 和 assessment。
- [ ] 能做一次修改实验并看懂断言失败。
- [ ] 恢复代码后所有检查再次通过。

第一次运行后先反馈两行指纹输出，我们继续扩展比较逻辑。完整练习完成后再反馈六行输出；有报错时发命令和报错文字，我会根据你实际写的版本指导下一步。整课验收通过后进入第 02 课：建立 TypeScript 项目。

本课范例已由助手从文档代码块提取并在本机 Node 执行；你手写文件是否正确仍要以自己的运行结果为准。
