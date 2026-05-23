import { spawn, type ChildProcess } from 'node:child_process'
import type { Project, Task } from '../../shared/types'
import type { TaskRunner, LogEntry, RunResult, RunOptions } from './runner'

function buildEnv(project: Project): NodeJS.ProcessEnv {
  const env = { ...process.env }
  if (project.llmConfig) {
    const { baseUrl, apiKey, model } = project.llmConfig
    if (baseUrl) env.ANTHROPIC_BASE_URL = baseUrl
    if (apiKey) env.ANTHROPIC_API_KEY = apiKey
    if (model) env.ANTHROPIC_MODEL = model
  }
  return env
}

function buildArgs(project: Project, resumeSessionId?: string): string[] {
  const args: string[] = [
    '-p',
    '--output-format', 'stream-json',
    '--bare',
    '--allowedTools', project.allowedTools?.join(',') ?? 'Read,Edit,Bash',
    '--verbose',
  ]
  if (resumeSessionId) {
    args.push('--resume', resumeSessionId)
  }
  return args
}

interface RunClaudeOptions {
  project: Project
  prompt: string
  resumeSessionId?: string
  onLog?: (entry: LogEntry) => void
  abortSignal?: AbortSignal
}

function runClaude(options: RunClaudeOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    const args = buildArgs(options.project, options.resumeSessionId)
    const env = buildEnv(options.project)

    const child = spawn('claude', args, {
      cwd: options.project.path,
      env,
      shell: process.platform === 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // 通过 stdin 传递 prompt，避免 Windows 命令行截断多行参数
    if (options.prompt) {
      child.stdin.write(options.prompt)
    }
    child.stdin.end()

    let capturedSessionId: string | undefined
    let capturedResult: string | undefined
    let stderrBuf = ''
    const logBuffer: LogEntry[] = []
    let stdoutBuf = ''
    let finished = false

    function finish(result: RunResult) {
      if (finished) return
      finished = true
      try {
        child.kill()
      } catch {}
      resolve(result)
    }

    options?.abortSignal?.addEventListener('abort', () => {
      finish({ success: false, error: '用户取消', sessionId: capturedSessionId })
    })

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdoutBuf += chunk
      const lines = stdoutBuf.split(/\r?\n/)
      stdoutBuf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const json = JSON.parse(line)
          // 提取 session_id
          if (json.type === 'system' && json.session_id && !capturedSessionId) {
            capturedSessionId = json.session_id
          }
          // 提取最终结果
          if (json.type === 'result' && typeof json.result === 'string') {
            capturedResult = json.result
          }
          // 实时日志
          const msg = extractReadableMessage(json)
          if (msg) {
            const entry: LogEntry = {
              timestamp: new Date().toISOString(),
              level: json.type === 'result' && json.is_error ? 'error' : 'info',
              message: msg,
            }
            logBuffer.push(entry)
            options?.onLog?.(entry)
          }
        } catch {
          const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: line.trim(),
          }
          logBuffer.push(entry)
          options?.onLog?.(entry)
        }
      }
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderrBuf += chunk
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'error',
        message: chunk.trim(),
      }
      logBuffer.push(entry)
      options?.onLog?.(entry)
    })

    child.on('error', (err) => {
      finish({ success: false, error: `spawn 失败: ${err.message}`, sessionId: capturedSessionId })
    })

    child.on('close', (code) => {
      if (finished) return
      if (code !== 0) {
        const errMsg = stderrBuf.trim() || `claude 进程退出码 ${code}`
        finish({ success: false, error: errMsg, sessionId: capturedSessionId })
        return
      }
      finish({
        success: true,
        result: capturedResult ?? '（无输出）',
        sessionId: capturedSessionId,
      })
    })
  })
}

function runClaudeTask(
  task: Task,
  project: Project,
  options?: RunOptions,
): Promise<RunResult> {
  return runClaude({
    project,
    prompt: task.prompt,
    resumeSessionId: task.claudeSessionId ?? undefined,
    onLog: options?.onLog,
    abortSignal: options?.abortSignal,
  })
}

export function runClaudeChat(
  project: Project,
  message: string,
  resumeSessionId?: string,
  options?: RunOptions,
): Promise<RunResult> {
  return runClaude({
    project,
    prompt: message,
    resumeSessionId,
    onLog: options?.onLog,
    abortSignal: options?.abortSignal,
  })
}

export const claudeRunner: TaskRunner = {
  name: 'Claude Code',
  runTask: runClaudeTask,
}

function extractReadableMessage(json: any): string | null {
  if (json.type === 'assistant' && json.message?.content) {
    const parts: string[] = []
    for (const c of json.message.content) {
      if (c.type === 'thinking') parts.push(`[思考] ${c.thinking}`)
      else if (c.type === 'text') parts.push(c.text)
      else if (c.type === 'tool_use') parts.push(`[工具] ${c.name}: ${JSON.stringify(c.input)}`)
    }
    return parts.join('\n') || null
  }
  if (json.type === 'user' && json.message?.content) {
    for (const c of json.message.content) {
      if (c.type === 'tool_result') {
        return `[工具结果] ${c.content ?? '(无内容)'}`
      }
    }
  }
  if (json.type === 'result') {
    return `[完成] ${json.result ?? ''}`
  }
  return null
}
