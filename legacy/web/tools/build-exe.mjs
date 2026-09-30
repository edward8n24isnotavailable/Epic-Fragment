// 把 dist 打包进一个单文件可执行程序（Node SEA + postject）。
// 玩家机器不需要安装 Node.js，双击即玩。

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST_DIR = path.join(ROOT, 'dist')
const BUILD_DIR = path.join(ROOT, 'build', 'sea')
const RELEASE_DIR = path.join(ROOT, 'release')
const ENTRY = path.join(ROOT, 'tools', 'sea-entry.cjs')
const MANIFEST_KEY = '__manifest__'
const SENTINEL_FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
const EXE_NAME = process.platform === 'win32' ? 'EpicFragment.exe' : 'EpicFragment'

function run(file, args, label, options = {}) {
  process.stdout.write(`\n> ${label}\n`)
  execFileSync(file, args, { cwd: ROOT, stdio: 'inherit', ...options })
}

function collectDistFiles(dir, prefix = '') {
  const keys = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const key = prefix === '' ? entry.name : `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      keys.push(...collectDistFiles(path.join(dir, entry.name), key))
    } else if (entry.isFile()) {
      keys.push(key)
    }
  }
  return keys
}

// 直接驱动本地的 tsc / vite，避免在 Windows 上 spawn .cmd 包装器。
// 与 package.json 的 build 脚本保持一致。
function buildWebAssets() {
  const tsc = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
  const vite = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')
  run(process.execPath, [tsc, '-b'], '类型检查（tsc -b）')
  run(process.execPath, [vite, 'build'], '构建网页产物（vite build）')
}

function writeSeaConfig(assetKeys) {
  fs.mkdirSync(BUILD_DIR, { recursive: true })

  const manifestPath = path.join(BUILD_DIR, 'manifest.json')
  fs.writeFileSync(manifestPath, JSON.stringify(assetKeys))

  const assets = { [MANIFEST_KEY]: manifestPath }
  for (const key of assetKeys) {
    assets[key] = path.join(DIST_DIR, ...key.split('/'))
  }

  const blobPath = path.join(BUILD_DIR, 'sea-prep.blob')
  const configPath = path.join(BUILD_DIR, 'sea-config.json')
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        main: ENTRY,
        output: blobPath,
        disableExperimentalSEAWarning: true,
        useSnapshot: false,
        useCodeCache: false,
        assets,
      },
      null,
      2,
    ),
  )
  return { configPath, blobPath }
}

function injectBlob(exePath, blobPath) {
  const postjectCli = path.join(ROOT, 'node_modules', 'postject', 'dist', 'cli.js')
  const args = [postjectCli, exePath, 'NODE_SEA_BLOB', blobPath, '--sentinel-fuse', SENTINEL_FUSE]
  if (process.platform === 'darwin') args.push('--macho-segment-name', 'NODE_SEA')
  run(process.execPath, args, '注入资源到可执行文件（postject）')
}

function main() {
  buildWebAssets()

  if (!fs.existsSync(DIST_DIR)) {
    console.error('找不到 dist 目录，网页产物构建失败。')
    process.exit(1)
  }

  const assetKeys = collectDistFiles(DIST_DIR)
  if (!assetKeys.includes('index.html')) {
    console.error('dist 中缺少 index.html，无法打包。')
    process.exit(1)
  }
  console.log(`\n> 收集到 ${assetKeys.length} 个资源文件`)

  const { configPath, blobPath } = writeSeaConfig(assetKeys)
  run(process.execPath, ['--experimental-sea-config', configPath], '生成 SEA 资源包')

  fs.mkdirSync(RELEASE_DIR, { recursive: true })
  const exePath = path.join(RELEASE_DIR, EXE_NAME)
  fs.rmSync(exePath, { force: true })
  fs.copyFileSync(process.execPath, exePath)
  fs.chmodSync(exePath, 0o755)

  injectBlob(exePath, blobPath)

  const sizeMb = (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
  console.log(`\n完成：${exePath}（${sizeMb} MB）`)
  console.log('把这个文件单独发给玩家，双击即可开始游戏。')
}

main()
