import { build } from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

await mkdir('lib', { recursive: true })
const manifest = JSON.parse(await readFile('package.json', 'utf8'))
const compatibility = JSON.parse(await readFile('compatibility.json', 'utf8'))
if (compatibility.pluginVersion !== manifest.version) throw new Error('compatibility.json 与包版本不一致')
const define = { __RECHECK_VERSION__: JSON.stringify(manifest.version), __RECHECK_SUPPORTED_HOSTS__: JSON.stringify(compatibility.supportedHosts) }
await build({ entryPoints: ['src/index.ts'], outfile: 'lib/index.js', bundle: true, platform: 'node', target: 'node24', format: 'esm', packages: 'external', sourcemap: true, define })
const client = await build({ entryPoints: ['src/client.tsx'], bundle: true, platform: 'browser', target: 'es2022', format: 'cjs', write: false,
  external: ['react', 'react/jsx-runtime'], jsx: 'automatic', define })
// DSH Web 的公共模块装载协议；React 来自宿主共享模块表。
await writeFile('lib/client.js', `window.__ModuleLoader__.load({id:"dsh-recheck",factory:(require)=>{const module={exports:{}};const exports=module.exports;\n${client.outputFiles[0].text}\nreturn module.exports;}});\n`)
console.log('已构建 Host 插件和 DSH 原生 Web 侧栏。')
