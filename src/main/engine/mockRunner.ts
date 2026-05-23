import type { TaskRunner, LogEntry, RunResult, RunOptions } from './runner'
import type { Project, Task } from '../../shared/types'

async function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export const mockRunner: TaskRunner = {
  name: 'mock',
  async runTask(task: Task, _project: Project, options?: RunOptions): Promise<RunResult> {
    const { onLog, abortSignal } = options ?? {}
    const steps = ['初始化环境', '分析需求', '生成代码', '运行测试', '完成任务']
    const sessionId = `mock-${Date.now()}`

    for (const step of steps) {
      if (abortSignal?.aborted) {
        return { success: false, error: '用户取消', sessionId }
      }
      await delay(600)
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `[Mock] ${step}`,
      }
      onLog?.(entry)
    }

    return {
      success: true,
      result: `Mock 执行完成：${task.title}`,
      sessionId,
    }
  },
}
