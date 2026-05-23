import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { readFile, stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { join, extname } from 'path'
import { mainEvents } from './events'
import * as api from './apiActions'
import type { LogEntry } from './engine/runner'

const PORT = parseInt(process.env.WEB_PORT || '3456', 10)
const STATIC_DIR = join(__dirname, '../renderer')

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
}

function setCors(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.setEncoding('utf-8')
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function sendSse(res: ServerResponse, event: string, data: any): void {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

async function serveStatic(reqPath: string, res: ServerResponse): Promise<boolean> {
  const safePath = join(STATIC_DIR, reqPath)
  if (!safePath.startsWith(STATIC_DIR)) {
    return false
  }

  let filePath = safePath
  try {
    const s = await stat(filePath)
    if (s.isDirectory()) {
      filePath = join(filePath, 'index.html')
    }
  } catch {
    return false
  }

  const ext = extname(filePath)
  const contentType = MIME_TYPES[ext] || 'application/octet-stream'

  try {
    const s = await stat(filePath)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': s.size,
    })
    createReadStream(filePath).pipe(res)
    return true
  } catch {
    return false
  }
}

const sseClients = new Set<ServerResponse>()

function broadcastToSse(channel: string, ...args: any[]) {
  const dead = new Set<ServerResponse>()
  for (const res of sseClients) {
    try {
      sendSse(res, channel, args.length === 1 ? args[0] : args)
    } catch {
      dead.add(res)
    }
  }
  for (const res of dead) {
    sseClients.delete(res)
  }
}

mainEvents.on('sync:status', (status) => broadcastToSse('sync:status', status))
mainEvents.on('engine:status', (status) => broadcastToSse('engine:status', status))
mainEvents.on('engine:task:completed', (taskId, result) => broadcastToSse('engine:task:completed', taskId, result))
mainEvents.on('engine:task:failed', (taskId, error) => broadcastToSse('engine:task:failed', taskId, error))
mainEvents.on('claude:chat:log', (entry: LogEntry) => broadcastToSse('claude:chat:log', entry))
mainEvents.on('claude:chat:done', (result: any) => broadcastToSse('claude:chat:done', result))

export function startWebServer(): void {
  const server = createServer(async (req, res) => {
    setCors(res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`)
    const pathname = url.pathname

    // SSE endpoint
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      sseClients.add(res)
      req.on('close', () => sseClients.delete(res))
      // Send initial keep-alive comment
      res.write(':ok\n\n')
      return
    }

    // REST API
    if (pathname.startsWith('/api/')) {
      try {
        const body = req.method !== 'GET' && req.method !== 'DELETE' ? await readBody(req) : {}

        // Auth
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          const result = await api.loginAction(body.username, body.password)
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/auth/register' && req.method === 'POST') {
          const result = await api.registerAction(body.username, body.password)
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/auth/logout' && req.method === 'POST') {
          const result = await api.logoutAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/auth/session' && req.method === 'GET') {
          const result = await api.getSessionAction()
          sendJson(res, 200, result)
          return
        }

        // Projects
        if (pathname === '/api/projects' && req.method === 'GET') {
          const result = await api.listProjectsAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/projects' && req.method === 'POST') {
          const result = await api.createProjectAction(body)
          sendJson(res, 200, result)
          return
        }
        if (pathname.startsWith('/api/projects/') && req.method === 'PATCH') {
          const id = pathname.slice('/api/projects/'.length)
          const result = await api.updateProjectAction(id, body)
          sendJson(res, 200, result)
          return
        }
        if (pathname.startsWith('/api/projects/') && req.method === 'DELETE') {
          const id = pathname.slice('/api/projects/'.length)
          const result = await api.deleteProjectAction(id)
          sendJson(res, 200, result)
          return
        }

        // Tasks
        if (pathname === '/api/tasks' && req.method === 'GET') {
          const projectId = url.searchParams.get('projectId') || undefined
          const result = await api.listTasksAction(projectId)
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/tasks' && req.method === 'POST') {
          const result = await api.createTaskAction(body)
          sendJson(res, 200, result)
          return
        }
        if (pathname.startsWith('/api/tasks/') && req.method === 'PATCH') {
          const id = pathname.slice('/api/tasks/'.length)
          const result = await api.updateTaskAction(id, body)
          sendJson(res, 200, result)
          return
        }
        if (pathname.startsWith('/api/tasks/') && req.method === 'DELETE') {
          const id = pathname.slice('/api/tasks/'.length)
          const result = await api.deleteTaskAction(id)
          sendJson(res, 200, result)
          return
        }
        if (pathname.startsWith('/api/tasks/') && pathname.endsWith('/resume') && req.method === 'POST') {
          const id = pathname.slice('/api/tasks/'.length, -'/resume'.length)
          const result = await api.resumeTaskAction(id)
          sendJson(res, 200, result)
          return
        }

        // Engine
        if (pathname === '/api/engine/status' && req.method === 'GET') {
          const result = await api.getEngineStatusAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/engine/start' && req.method === 'POST') {
          const result = await api.startEngineAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/engine/stop' && req.method === 'POST') {
          const result = await api.stopEngineAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/engine/pause' && req.method === 'POST') {
          const result = await api.pauseEngineAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/engine/resume' && req.method === 'POST') {
          const result = await api.resumeEngineAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/engine/concurrency' && req.method === 'POST') {
          const result = await api.setEngineConcurrencyAction(body.n)
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/engine/providers' && req.method === 'GET') {
          const result = await api.listEngineProvidersAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/engine/provider' && req.method === 'GET') {
          const result = await api.getEngineProviderAction()
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/engine/provider' && req.method === 'POST') {
          const result = await api.setEngineProviderAction(body.name)
          sendJson(res, 200, result)
          return
        }

        // Webhook
        if (pathname === '/api/webhook/test' && req.method === 'POST') {
          const result = await api.testWebhookAction(body.webhookUrl)
          sendJson(res, 200, result)
          return
        }

        // Claude Chat
        if (pathname === '/api/claude/chat' && req.method === 'POST') {
          const result = await api.chatWithClaudeAction(body.projectId, body.message, body.sessionId)
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/claude/history' && req.method === 'GET') {
          const projectId = url.searchParams.get('projectId') || ''
          const result = await api.getChatHistoryAction(projectId)
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/claude/messages' && req.method === 'POST') {
          const result = await api.saveChatMessageAction(body)
          sendJson(res, 200, result)
          return
        }
        if (pathname === '/api/claude/history' && req.method === 'DELETE') {
          const projectId = url.searchParams.get('projectId') || ''
          const result = await api.clearChatHistoryAction(projectId)
          sendJson(res, 200, result)
          return
        }

        // Terminal
        if (pathname === '/api/terminal/execute' && req.method === 'POST') {
          const result = await api.executeTerminalCommandAction(body.projectId, body.command, body.workingDir)
          sendJson(res, 200, result)
          return
        }

        // Sync
        if (pathname === '/api/sync/refresh' && req.method === 'POST') {
          // imported dynamically to avoid circular dep at module level if needed
          const { syncManager } = await import('./index')
          syncManager.restart()
          sendJson(res, 200, { ok: true })
          return
        }

        sendJson(res, 404, { ok: false, error: 'Not Found' })
      } catch (err: any) {
        console.error('[web] API error:', err)
        sendJson(res, 500, { ok: false, error: err.message || 'Internal Server Error' })
      }
      return
    }

    // Static files
    const served = await serveStatic(pathname === '/' ? '/index.html' : pathname, res)
    if (!served) {
      // Fallback to index.html for unknown paths (SPA support for non-hash routes if any)
      const fallback = await serveStatic('/index.html', res)
      if (!fallback) {
        sendJson(res, 404, { ok: false, error: 'Not Found' })
      }
    }
  })

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[web] Server listening on http://0.0.0.0:${PORT}`)
  })
}
