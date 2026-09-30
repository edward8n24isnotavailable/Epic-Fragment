'use strict'

// 单文件可执行版（Node SEA）的入口：整个 dist 以 SEA asset 的形式内嵌在 exe 里，
// 这里只负责把它们通过本地 HTTP 端口提供给浏览器，并自动打开游戏页面。

const http = require('node:http')
const path = require('node:path')
const { spawn } = require('node:child_process')
const sea = require('node:sea')

const DEFAULT_PORT = 5173
const MAX_PORT_ATTEMPTS = 20
const HOST = '127.0.0.1'
const INDEX_KEY = 'index.html'
const MANIFEST_KEY = '__manifest__'

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
}

const assetKeys = new Set(JSON.parse(sea.getAsset(MANIFEST_KEY, 'utf8')))

function parseArgs(argv) {
  const options = { open: true, port: DEFAULT_PORT }
  for (const arg of argv) {
    if (arg === '--no-open') {
      options.open = false
      continue
    }
    const portMatch = /^--port=(\d+)$/.exec(arg)
    if (portMatch) {
      options.port = Number(portMatch[1])
    }
  }
  return options
}

function mimeFor(key) {
  return MIME_TYPES[path.posix.extname(key).toLowerCase()] ?? 'application/octet-stream'
}

// 把请求路径映射成 asset key；越界路径一律拒绝，未命中的无扩展名路径回退到 index.html。
function resolveAssetKey(requestUrl) {
  const rawPath = requestUrl.split('?')[0].split('#')[0]
  let decoded
  try {
    decoded = decodeURIComponent(rawPath)
  } catch {
    return null
  }
  const normalized = path.posix.normalize(decoded).replace(/^\/+/, '')
  if (normalized === '' || normalized === '.') return INDEX_KEY
  if (normalized === '..' || normalized.startsWith('../')) return null
  if (assetKeys.has(normalized)) return normalized
  if (path.posix.extname(normalized) === '') return INDEX_KEY
  return null
}

function handleRequest(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8', allow: 'GET, HEAD' })
    res.end('Method not allowed')
    return
  }

  const key = resolveAssetKey(req.url ?? '/')
  if (!key) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Not found')
    return
  }

  const body = Buffer.from(sea.getRawAsset(key))
  res.writeHead(200, {
    'content-type': mimeFor(key),
    'content-length': body.length,
    'cache-control': 'no-store',
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(body)
}

// 端口被占用时顺延，避免玩家还开着另一个实例时直接启动失败。
function listenWithFallback(server, port, attemptsLeft) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening)
      if (error.code === 'EADDRINUSE' && attemptsLeft > 0) {
        listenWithFallback(server, port + 1, attemptsLeft - 1).then(resolve, reject)
        return
      }
      reject(error)
    }
    const onListening = () => {
      server.removeListener('error', onError)
      resolve(port)
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port, HOST)
  })
}

function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? { file: 'cmd', args: ['/c', 'start', '', url] }
      : process.platform === 'darwin'
        ? { file: 'open', args: [url] }
        : { file: 'xdg-open', args: [url] }

  try {
    const child = spawn(command.file, command.args, { stdio: 'ignore', detached: true })
    child.on('error', () => {
      console.log(`无法自动打开浏览器，请手动访问 ${url}`)
    })
    child.unref()
  } catch {
    console.log(`无法自动打开浏览器，请手动访问 ${url}`)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const server = http.createServer(handleRequest)

  let port
  try {
    port = await listenWithFallback(server, options.port, MAX_PORT_ATTEMPTS)
  } catch (error) {
    console.error(`启动本地服务器失败：${error.message}`)
    process.exitCode = 1
    return
  }

  const url = `http://${HOST}:${port}/`
  console.log('史诗碎片 · 本地服务器已启动')
  console.log(`地址：${url}`)
  console.log('关闭这个窗口或按 Ctrl+C 结束游戏。')

  if (options.open) openBrowser(url)

  const shutdown = () => {
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main()
