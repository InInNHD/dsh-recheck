import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { cpus, platform, release, tmpdir, totalmem } from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'
import { Context } from '@deepseek-ai/cordis'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import * as observationPolicy from '@deepseek-ai/dsh-fs-observation-policy'
import { Recheck } from '../lib/index.js'

// Node fs 只布置/清理临时依据；计时涵盖真实 DSH FS 的全量读取和原子持久提交。
const project = dirname(dirname(fileURLToPath(import.meta.url)))
const tempRoot = await realpath(tmpdir())
const cwd = await mkdtemp(join(tempRoot, 'dsh-recheck-benchmark-'))
const service = new Recheck()
try {
  const ctx = new Context()
  const fs = new LocalFileSystem(ctx, LocalFileSystem.Config({ cwd }))
  observationPolicy.apply(ctx)
  const env = { ctx, fs, cwd, root: await fs.resolve(cwd), actor: { kind: 'user', sessionId: 'benchmark-session' },
    token: { agent: { session: {} } }, policy: { mode: 'workspace-write', workspaceRoot: cwd }, signal: new AbortController().signal }
  const call = async request => {
    const response = await service.execute(env, request)
    assert.equal(response.status, 'ok', JSON.stringify(response))
    return response.data
  }
  const files = Array.from({ length: 100 }, (_, i) => `evidence-${i}.bin`)
  const bytes = Buffer.alloc(64 * 1024, 65)
  await Promise.all(files.map(file => writeFile(join(cwd, file), bytes)))
  for (let i = 0; i < 25; i++) await call({ action: 'create', title: `基准卡片 ${i + 1}`, claim: '依据内容未改变。', files: files.slice(i * 4, i * 4 + 4) })
  await call({ action: 'check', scope: 'all' }) // 预热不计入统计。

  const originalReadBytes = fs.readBytes.bind(fs)
  let meter
  fs.readBytes = async (...args) => {
    const result = await originalReadBytes(...args)
    if (meter && args[0].displayPath.endsWith('.bin')) {
      meter.unique.add(args[0].targetKey)
      meter.bytes += result.byteLength
      meter.reads++
    }
    return result
  }
  const samples = []
  for (let i = 0; i < 5; i++) {
    meter = { unique: new Set(), bytes: 0, reads: 0 }
    const started = performance.now()
    const result = await call({ action: 'check', scope: 'all' })
    const durationMs = performance.now() - started
    assert.equal(result.persisted, true)
    assert.equal(result.counts.checked, 25)
    assert.equal(result.counts.conflict, 0)
    assert.equal(result.counts.error, 0)
    assert.equal(result.counts.unknownFiles, 0)
    assert.equal(meter.unique.size, 100)
    assert.equal(meter.reads, 100)
    assert.equal(meter.bytes, 100 * 64 * 1024)
    assert.ok(result.results.every(check => check.freshness === 'unchanged' && check.checkId && check.persisted))
    samples.push({ run: i + 1, durationMs: Number(durationMs.toFixed(2)), uniqueFiles: meter.unique.size,
      actualEvidenceBytes: meter.bytes, evidenceReadCalls: meter.reads, unknownFiles: result.counts.unknownFiles })
  }
  const saved = JSON.parse(await readFile(join(cwd, '.dsh/recheck/cards.json'), 'utf8'))
  assert.ok(saved.cards.every(card => card.revision === 7 && card.latestCheck.persisted))
  const readPackage = async path => JSON.parse(await readFile(join(project, path), 'utf8'))
  const plugin = await readPackage('package.json'), dsh = await readPackage('node_modules/@deepseek-ai/dsh/package.json')
  const fsPackage = await readPackage('node_modules/@deepseek-ai/dsh-fs-local/package.json')
  const sorted = samples.map(sample => sample.durationMs).sort((a, b) => a - b)
  console.log(JSON.stringify({ fixture: { cards: 25, evidencePerCard: 4, uniqueFiles: 100, bytesPerFile: bytes.length,
    totalEvidenceBytes: files.length * bytes.length, totalMiB: files.length * bytes.length / 1024 / 1024, warmupRuns: 1, measuredRuns: 5,
    operation: '持久化 check all，包含读取、哈希、JSON 校验及原子写入' },
    environment: { os: `${platform()} ${release()}`, cpu: cpus()[0]?.model, logicalCpus: cpus().length,
      memoryGiB: Number((totalmem() / 1024 ** 3).toFixed(2)), node: process.version,
      dsh: dsh.version, dshFsLocal: fsPackage.version, plugin: `${plugin.name}@${plugin.version}` },
    samples, medianMs: sorted[2], slowestMs: sorted.at(-1), medianUnder2Seconds: sorted[2] < 2000 }, null, 2))
} finally {
  await service.dispose()
  const resolved = await realpath(cwd), withinTemp = relative(tempRoot, resolved)
  assert.ok(withinTemp && !isAbsolute(withinTemp) && !withinTemp.startsWith('..') && withinTemp.startsWith('dsh-recheck-benchmark-'), '拒绝清理临时目录以外的路径')
  await rm(resolved, { recursive: true, force: true })
}
