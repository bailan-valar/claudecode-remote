import type { TaskRunner } from './runner'
import { claudeRunner } from './claudeRunner'

const registry = new Map<string, TaskRunner>()

export function registerRunner(provider: string, runner: TaskRunner): void {
  registry.set(provider, runner)
}

export function getRunner(provider?: string): TaskRunner {
  // 当前只实现了 Claude Code 执行引擎，强制使用 anthropic
  return registry.get('anthropic')!
}

export function listRunners(): Array<{ provider: string; name: string }> {
  return Array.from(registry.entries()).map(([provider, runner]) => ({
    provider,
    name: runner.name,
  }))
}

// 注册内置执行引擎（当前仅支持 Claude Code）
registerRunner('anthropic', claudeRunner)
