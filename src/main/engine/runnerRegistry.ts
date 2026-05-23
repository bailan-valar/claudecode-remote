import type { TaskRunner, RunResult } from './runner'
import { claudeRunner } from './claudeRunner'
import { mockRunner } from './mockRunner'

class PlaceholderRunner implements TaskRunner {
  readonly name: string

  constructor(name: string) {
    this.name = name
  }

  async runTask(): Promise<RunResult> {
    return {
      success: false,
      error: `${this.name} 执行引擎尚未实现，请切换为 anthropic (Claude Code)`,
    }
  }
}

const registry = new Map<string, TaskRunner>()

export function registerRunner(provider: string, runner: TaskRunner): void {
  registry.set(provider, runner)
}

export function getRunner(provider?: string): TaskRunner {
  if (!provider || !registry.has(provider)) {
    return registry.get('anthropic') ?? new PlaceholderRunner('默认')
  }
  return registry.get(provider)!
}

export function listRunners(): Array<{ provider: string; name: string }> {
  return Array.from(registry.entries()).map(([provider, runner]) => ({
    provider,
    name: runner.name,
  }))
}

// 注册内置执行引擎
registerRunner('anthropic', claudeRunner)
registerRunner('mock', mockRunner)
registerRunner('zhipu', new PlaceholderRunner('智谱 GLM'))
registerRunner('kimi', new PlaceholderRunner('Kimi K2'))
