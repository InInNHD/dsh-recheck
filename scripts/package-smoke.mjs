import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { request as httpRequest } from 'playwright'
import { initProfile } from '@deepseek-ai/dsh-app-boot'

// All installs, sessions and fixture writes are isolated under the ignored .integration directory.
const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const home = join(root, '.integration', `package-smoke-${randomUUID()}`)
const profile = join(home, 'profiles/recheck-package')
const fixture = join(home, 'project')
await mkdir(profile, { recursive: true }); await mkdir(fixture)
await writeFile(join(fixture, 'evidence.txt'), 'original evidence\n')
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const tarball = join(root, `${manifest.name}-${manifest.version}.tgz`)
const env = { ...process.env, DSH_HOME: home, npm_config_cache: join(root, '.integration/npm-cache') }
const quote = value => `'${value.replaceAll("'", "''")}'`
function npm(args, capture = false) {
  const options = { cwd: root, env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', windowsHide: true }
  if (process.platform === 'win32') return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `& npm.cmd ${args.map(quote).join(' ')}; exit $LASTEXITCODE`], options)
  return execFileSync('npm', args, options)
}
npm(['pack', '--ignore-scripts', '--json'], true) // check/build must run before this script.
const configPath = join(profile, 'package.json')
const config = { name: 'dsh-profile-recheck-package', private: true, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-recheck'] } } }
initProfile(profile, config.dsh.profile.bundles)
const flags = ['--prefix', profile, '--save-exact', '--no-audit', '--no-fund', '--registry', 'https://registry.npmjs.org']
npm(['install', ...flags, '@deepseek-ai/dsh@0.2.0-rc.2', tarball])
const cli = join(profile, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
const server = createServer()
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
await new Promise(resolve => server.close(resolve))
const origin = `http://127.0.0.1:${port}`
let child, closed, client, authUrl
async function stop() {
  await client?.dispose(); client = undefined
  if (!child) return
  if (child.exitCode === null) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    else child.kill('SIGTERM')
  }
  await closed; child = undefined
}
async function start() {
  child = spawn(process.execPath, [cli, '--profile', 'recheck-package', '--port', String(port), '--no-open'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  closed = new Promise(resolve => child.once('exit', resolve))
  authUrl = await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`Isolated host startup timed out: ${output.replaceAll(/token=[A-Za-z0-9_-]+/g, 'token=[redacted]').slice(-2000)}`)), 90_000)
    const inspect = bytes => {
      output += bytes.toString()
      const match = output.match(new RegExp(`http://127\\.0\\.0\\.1:${port}/\\?token=[A-Za-z0-9_-]+`))
      if (match) { clearTimeout(timeout); resolve(match[0]) }
    }
    child.stdout.on('data', inspect); child.stderr.on('data', inspect)
    child.once('error', error => { clearTimeout(timeout); reject(error) })
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Host exited ${code}: ${output.replaceAll(/token=[A-Za-z0-9_-]+/g, 'token=[redacted]').slice(-2000)}`)) })
  })
  client = await httpRequest.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } })
  const auth = await client.get(authUrl)
  assert.ok(auth.ok(), 'Local authentication must succeed')
}
async function rpc(method, args, raw = false) {
  const response = await client.post(`/api/${method}`, {
    data: { type: 'client-request', rpcId: randomUUID(), method, payload: raw ? args : { args } }, timeout: 30_000 })
  assert.equal(response.status(), 200, `${method}: HTTP ${response.status()}`)
  const result = (await response.json()).result
  assert.equal(result.ok, true, JSON.stringify(result)); return result.value
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
let sessionId
const recheck = async request => {
  const result = await rpc('recheck/dispatch', { sessionId, request }, true)
  assert.equal(result.status, 'ok', JSON.stringify(result)); return result.data
}
const inventory = async () => (await rpc('pluginInventory/list', {})).entries.filter(entry => entry.moduleName === 'dsh-recheck')
const setBundle = async enabled => {
  const value = JSON.parse(await readFile(configPath, 'utf8'))
  value.dsh.profile.bundles = value.dsh.profile.bundles.filter(bundle => bundle !== 'dsh-recheck')
  if (enabled) value.dsh.profile.bundles.push('dsh-recheck')
  await writeFile(configPath, JSON.stringify(value, null, 2))
}
try {
  await start()
  assert.ok((await inventory()).some(entry => entry.fiberPhase === 'active'))
  const workspace = await rpc('workspace/create', { request: { path: fixture } })
  sessionId = (await rpc('session/create', { request: { workspaceId: workspace.workspace.workspaceId } })).sessionId
  const card = await recheck({ action: 'create', title: 'Packaged lifecycle check', claim: 'Project data survives reinstall', files: ['evidence.txt'] })
  await recheck({ action: 'check', scope: 'card', cardId: card.id, expectedRevision: card.revision })
  const checked = await recheck({ action: 'get', cardId: card.id, includeHistory: true })
  const reviewed = await recheck({ action: 'review', cardId: card.id, expectedRevision: checked.revision, checkId: checked.latestCheck.checkId, assessment: 'uncertain', note: 'Lifecycle fixture, no independent semantic verification' })
  const dataPath = join(fixture, '.dsh/recheck/cards.json'), before = hash(await readFile(dataPath))
  await stop(); await setBundle(false)
  npm(['uninstall', ...flags, 'dsh-recheck'])
  await start(); assert.equal((await inventory()).length, 0); assert.equal(hash(await readFile(dataPath)), before)
  await stop(); npm(['install', ...flags, tarball]); await setBundle(true)
  await start(); assert.ok((await inventory()).some(entry => entry.fiberPhase === 'active'))
  const restored = await recheck({ action: 'get', cardId: card.id, includeHistory: true })
  assert.deepEqual(restored.versions, reviewed.versions); assert.equal(restored.revision, reviewed.revision)
  assert.equal(restored.latestCheck.checkId, reviewed.latestCheck.checkId); assert.equal(hash(await readFile(dataPath)), before)
  if (process.argv.includes('--web')) {
    await mkdir(join(root, 'docs/assets'), { recursive: true })
    const web = spawn(process.execPath, [join(root, 'scripts/web-smoke.mjs'), '--url', authUrl, ...(process.argv.includes('--public-screenshot') ? ['--screenshot', join(root, 'docs/assets/recheck.png')] : [])], { cwd: root, env, stdio: 'inherit', windowsHide: true })
    const code = await new Promise((resolve, reject) => { web.once('exit', resolve); web.once('error', reject) })
    assert.equal(code, 0, 'Real Web smoke must pass')
  }
  const report = { passed: true, os: process.platform, node: process.version, plugin: manifest.version, dsh: '0.2.0-rc.2', packagedInstallation: true, absentAfterUninstall: true,
    activeAfterReinstall: true, historyPreserved: true, storeBytesPreserved: true, web: process.argv.includes('--web'), modelMessagesSent: false }
  await writeFile(join(root, `.integration/package-smoke-${process.platform}-result.json`), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  console.error(error); process.exitCode = 1
} finally { await stop() }
