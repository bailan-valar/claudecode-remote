import { describe, it, expect } from 'vitest'
import type { Task } from '../../../../shared/types'
import type { TaskStatus } from '../../../../shared/constants'

// 模拟 TaskTreeList 中的辅助函数进行测试

function getAllDescendants(task: Task, allTasks: Task[]): Task[] {
  const children = allTasks.filter((t) => t.parentTaskId === task._id)
  const descendants = [...children]

  children.forEach(child => {
    descendants.push(...getAllDescendants(child, allTasks))
  })

  return descendants
}

function hasStatusInconsistency(task: Task, allTasks: Task[]): boolean {
  const children = allTasks.filter((t) => t.parentTaskId === task._id)
  if (children.length === 0) return false

  const directChildrenHaveDifferentStatus = children.some(
    child => child.status !== task.status
  )

  if (directChildrenHaveDifferentStatus) return true

  return children.some(child => hasStatusInconsistency(child, allTasks))
}

function getTreeStatus(task: Task, allTasks: Task[]): TaskStatus {
  const children = allTasks.filter((t) => t.parentTaskId === task._id)

  if (children.length === 0) {
    return task.status
  }

  const childStatuses = children.map(child => getTreeStatus(child, allTasks))
  const hasDifferentStatus = childStatuses.some(status => status !== task.status)

  if (hasDifferentStatus) {
    if (childStatuses.includes('failed')) return 'failed'
    if (childStatuses.includes('stopped')) return 'stopped'

    if (childStatuses.every(s => s === 'completed' || s === 'closed')) {
      return 'developing'
    }

    const activeStatuses: TaskStatus[] = ['developing', 'planning', 'reviewing', 'plan_reviewing']
    const hasActiveChild = childStatuses.some(s => activeStatuses.includes(s))
    if (hasActiveChild) {
      for (const activeStatus of activeStatuses) {
        if (childStatuses.includes(activeStatus)) {
          return activeStatus
        }
      }
    }
  }

  return task.status
}

describe('父子任务状态处理', () => {
  // 创建测试任务
  const createTask = (id: string, status: TaskStatus, parentId?: string | null): Task => ({
    _id: id,
    _rev: '',
    type: 'task',
    projectId: 'project1',
    title: `Task ${id}`,
    status,
    priority: 'medium',
    kind: 'task',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [],
    createdVia: 'desktop',
    parentTaskId: parentId
  })

  describe('hasStatusInconsistency', () => {
    it('应该识别父子任务状态不一致', () => {
      const parent = createTask('parent', 'developing')
      const child = createTask('child', 'completed', 'parent')
      const allTasks = [parent, child]

      expect(hasStatusInconsistency(parent, allTasks)).toBe(true)
    })

    it('应该识别父子任务状态一致', () => {
      const parent = createTask('parent', 'developing')
      const child = createTask('child', 'developing', 'parent')
      const allTasks = [parent, child]

      expect(hasStatusInconsistency(parent, allTasks)).toBe(false)
    })

    it('应该处理没有子任务的情况', () => {
      const task = createTask('task', 'developing')
      const allTasks = [task]

      expect(hasStatusInconsistency(task, allTasks)).toBe(false)
    })

    it('应该识别多层嵌套中的状态不一致', () => {
      const parent = createTask('parent', 'developing')
      const child = createTask('child', 'developing', 'parent')
      const grandchild = createTask('grandchild', 'completed', 'child')
      const allTasks = [parent, child, grandchild]

      expect(hasStatusInconsistency(parent, allTasks)).toBe(true)
    })
  })

  describe('getTreeStatus', () => {
    it('应该返回单个任务的状态', () => {
      const task = createTask('task', 'developing')
      const allTasks = [task]

      expect(getTreeStatus(task, allTasks)).toBe('developing')
    })

    it('应该优先显示失败的子任务状态', () => {
      const parent = createTask('parent', 'developing')
      const child1 = createTask('child1', 'completed', 'parent')
      const child2 = createTask('child2', 'failed', 'parent')
      const allTasks = [parent, child1, child2]

      expect(getTreeStatus(parent, allTasks)).toBe('failed')
    })

    it('应该显示活跃的子任务状态', () => {
      const parent = createTask('parent', 'completed')
      const child = createTask('child', 'developing', 'parent')
      const allTasks = [parent, child]

      expect(getTreeStatus(parent, allTasks)).toBe('developing')
    })

    it('应该处理所有子任务完成的情况', () => {
      const parent = createTask('parent', 'developing')
      const child1 = createTask('child1', 'completed', 'parent')
      const child2 = createTask('child2', 'completed', 'parent')
      const allTasks = [parent, child1, child2]

      expect(getTreeStatus(parent, allTasks)).toBe('developing')
    })
  })

  describe('getAllDescendants', () => {
    it('应该获取所有后代任务', () => {
      const parent = createTask('parent', 'developing')
      const child1 = createTask('child1', 'developing', 'parent')
      const child2 = createTask('child2', 'developing', 'parent')
      const grandchild = createTask('grandchild', 'completed', 'child1')
      const allTasks = [parent, child1, child2, grandchild]

      const descendants = getAllDescendants(parent, allTasks)
      expect(descendants).toHaveLength(3)
      expect(descendants.map(t => t._id)).toContain('child1')
      expect(descendants.map(t => t._id)).toContain('child2')
      expect(descendants.map(t => t._id)).toContain('grandchild')
    })

    it('应该处理没有子任务的情况', () => {
      const task = createTask('task', 'developing')
      const allTasks = [task]

      const descendants = getAllDescendants(task, allTasks)
      expect(descendants).toHaveLength(0)
    })
  })
})