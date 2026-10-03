import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initProfile } from '@deepseek-ai/dsh-app-boot'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const tarball = join(root, `${manifest.name}-${manifest.version}.tgz`)
const bytes = await readFile(tarball) // 未打包时立即停止，不安装不完整源码。
// 开发中同版本包会更新；内容独立文件名避免 npm 继续复用旧 file: 安装缓存。
const packageDir = join(root, '.integration/packages')
await mkdir(packageDir, { recursive: true })
const installTarball = join(packageDir, `${manifest.name}-${manifest.version}-${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.tgz`)
await writeFile(installTarball, bytes)
const profile = join(root, '.integration/dsh-home/profiles/recheck-web')
await mkdir(profile, { recursive: true })
let saved
try { saved = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) }
catch (error) { if (error.code !== 'ENOENT') throw error }
if (saved && saved.name !== 'dsh-profile-recheck-web') throw new Error('独立配置的名称不匹配，原配置已保留。')
if (!saved) { initProfile(profile, ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']); saved = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8')) }
const packageJson = { ...saved, name: 'dsh-profile-recheck-web', private: true,
  dsh: { ...saved.dsh, profile: { ...saved.dsh?.profile, bundles: [...new Set([...(saved.dsh?.profile?.bundles ?? []), '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-recheck'])] } } }
await writeFile(join(profile, 'package.json'), JSON.stringify(packageJson, null, 2) + '\n')
if (process.platform === 'win32') {
  // npm.cmd 是 Windows 命令脚本；通过 PowerShell 参数调用，避免字符串拼接执行路径。
  const quote = s => `'${s.replaceAll("'", "''")}'`
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `& npm.cmd install --prefix ${quote(profile)} --save-exact '@deepseek-ai/dsh@0.2.0-rc.2' ${quote(installTarball)}; exit $LASTEXITCODE`], { stdio: 'inherit' })
} else execFileSync('npm', ['install', '--prefix', profile, '--save-exact', '@deepseek-ai/dsh@0.2.0-rc.2', installTarball], { stdio: 'inherit' })
console.log(`独立 Web 配置安装完成：${profile}`)
console.log('使用该配置内的 DSH CLI 启动。启动命令见 README.md。')
