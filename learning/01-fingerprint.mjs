// 从 Node.js 自带模块中引入计算哈希的工具。
import { createHash } from 'node:crypto'
// 引入检查工具：结果不符合预期时，程序会报错。
import assert from 'node:assert/strict'

// 定义函数：接收字节数据，返回它的内容指纹。
function fingerprint(bytes) {
  return createHash('sha256')
    .update(bytes)
    .digest('hex')
}

// 把示例文字转换成 UTF-8 字节，模拟文件内容。
// \n 表示一个换行符。
const originalBytes = Buffer.from('requestId: same-id\n', 'utf8')

// 调用函数，计算这些字节的指纹。
const sha256 = fingerprint(originalBytes)

// 把结果打印到终端。
console.log('内容指纹：', sha256)
console.log('指纹长度：', sha256.length)

// 保存基线：记录我们最初依据的内容指纹。
// sha256 是前面已经计算出来的变量。
const baseline = {
  path: 'sample/retry.txt',
  sha256: sha256,
  sizeBytes: originalBytes.length,
}

// 比较当前内容与保存的基线。
// 检查只返回结果，不修改基线。
function compareBytes(currentBytes, savedBaseline) {
  const currentSha256 = fingerprint(currentBytes)

  // === 表示严格相等。
  // 相等返回 unchanged，否则返回 changed。
  const status = currentSha256 === savedBaseline.sha256
    ? 'unchanged'
    : 'changed'

  return {
    path: savedBaseline.path,
    status: status,
  }
}

// 第一次：拿原内容与基线比较。
const firstCheck = compareBytes(originalBytes, baseline)
console.log('第 1 次检查：', firstCheck.status)

// 第二次：修改示例内容，再与同一个基线比较。
const modifiedBytes = Buffer.from(
  'requestId: different-id\n',
  'utf8',
)

const secondCheck = compareBytes(modifiedBytes, baseline)
console.log('第 2 次检查：', secondCheck.status)

// 第三次：恢复原内容，仍与最初的基线比较。
const thirdCheck = compareBytes(originalBytes, baseline)
console.log('恢复后检查：', thirdCheck.status)

// 自动检查结果。任何一项不符合预期，程序都会报错。
assert.equal(firstCheck.status, 'unchanged')
assert.equal(secondCheck.status, 'changed')
assert.equal(thirdCheck.status, 'unchanged')

// 确认检查过程中没有覆盖原始基线。
assert.equal(baseline.sha256, sha256)

console.log('内容比较检查全部通过。')

// 根据多个依据的状态，计算卡片总体状态。
// statuses 是一个状态数组，例如 ['unchanged', 'changed']。
function summarizeFreshness(statuses) {
  // undefined 表示尚没有检查记录。
  if (statuses === undefined) return 'unchecked'

  // 空结果不能证明依据未变化，按无法判断处理。
  if (statuses.length === 0) return 'unknown'

  // 按优先级检查；遇到匹配项就立即返回。
  if (statuses.includes('missing')) return 'missing'
  if (statuses.includes('changed')) return 'changed'
  if (statuses.includes('unknown')) return 'unknown'

  // 示例输入都是合法状态，排除以上情况后为全部未变化。
  return 'unchanged'
}

// 数组使用方括号，元素之间用逗号分隔。
// 模拟三个依据分别出现变化、无法检查、缺失。
const mixedStatuses = ['changed', 'unknown', 'missing']

console.log('尚未检查：', summarizeFreshness(undefined))
console.log('全部未变化：', summarizeFreshness(['unchanged', 'unchanged']))
console.log('包含未知：', summarizeFreshness(['unchanged', 'unknown']))
console.log('变化与未知：', summarizeFreshness(['changed', 'unknown']))
console.log('三种问题混合：', summarizeFreshness(mixedStatuses))
console.log('异常空结果：', summarizeFreshness([]))

// 自动验证：既检查正常情况，也检查优先级和空结果。
assert.equal(summarizeFreshness(undefined), 'unchecked')
assert.equal(summarizeFreshness(['unchanged', 'unchanged']), 'unchanged')
assert.equal(summarizeFreshness(['unchanged', 'unknown']), 'unknown')
assert.equal(summarizeFreshness(['changed', 'unknown']), 'changed')
assert.equal(summarizeFreshness(mixedStatuses), 'missing')
assert.equal(summarizeFreshness([]), 'unknown')

console.log('状态汇总检查全部通过。')

// 判断卡片是否需要关注。
// freshness 是文件状态，assessment 是复核意见。
function needsAttention(freshness, assessment) {
  return freshness !== 'unchanged'
    || assessment === 'unreviewed'
    || assessment === 'uncertain'
}

// 教学假设：此前有人记录了支持意见。
// 正式插件会通过复核流程记录意见及来源。
const assessment = 'supported'

// 使用前面第二次检查的结果：内容已经变化。
const freshness = secondCheck.status

console.log('当前文件状态：', freshness)
console.log('此前复核意见：', assessment)
console.log('需要关注：', needsAttention(freshness, assessment))

// 即使文件未变化，尚未复核的卡片仍需要关注。
console.log(
  '未变化但尚未复核：',
  needsAttention('unchanged', 'unreviewed'),
)

// 已有明确否定意见、文件也未变化时，不自动列为待复核。
console.log(
  '未变化且已有否定意见：',
  needsAttention('unchanged', 'refuted'),
)

// 检查关键组合，防止把文件状态和意见混为一谈。
assert.equal(needsAttention('changed', 'supported'), true)
assert.equal(needsAttention('unchanged', 'supported'), false)
assert.equal(needsAttention('unchanged', 'unreviewed'), true)
assert.equal(needsAttention('unchanged', 'uncertain'), true)
assert.equal(needsAttention('unchanged', 'refuted'), false)
assert.equal(needsAttention('unchecked', 'unreviewed'), true)
assert.equal(needsAttention('missing', 'refuted'), true)
assert.equal(needsAttention('unknown', 'supported'), true)

console.log('双状态检查全部通过。')