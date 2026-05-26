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

const STATUS_ORDER: TaskStatus[] = [
  'planned',
  'plan_required',
  'planning',
  'plan_reviewing',
  'pending',
  'developing',
  'reviewing',
  'completed',
  'closed',
  'stopped',
  'failed'
]

function getTreeStatus(task: Task, allTasks: Task[]): TaskStatus {
  const descendants = getAllDescendants(task, allTasks)
  const allStatuses = [task.status, ...descendants.map((d) => d.status)]

  let bestStatus: TaskStatus = task.status
  let bestIndex = STATUS_ORDER.indexOf(task.status)

  for (const status of allStatuses) {
    const index = STATUS_ORDER.indexOf(status)
    if (index !== -1 && index < bestIndex) {
      bestIndex = index
      bestStatus = status
    }
  }

  return bestStatus
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

    it('应该按 STATUS_ORDER 取排序最前的状态', () => {
      const parent = createTask('parent', 'reviewing')
      const child1 = createTask('child1', 'completed', 'parent')
      const child2 = createTask('child2', 'failed', 'parent')
      const allTasks = [parent, child1, child2]

      // reviewing (索引6) < completed (7) < failed (10)
      expect(getTreeStatus(parent, allTasks)).toBe('reviewing')
    })

    it('子任务状态排序靠前时应取子任务状态', () => {
      const parent = createTask('parent', 'completed')
      const child = createTask('child', 'developing', 'parent')
      const allTasks = [parent, child]

      // developing (索引5) < completed (7)
      expect(getTreeStatus(parent, allTasks)).toBe('developing')
    })

    it('父任务待审核、子任务已完成时应取待审核', () => {
      const parent = createTask('parent', 'reviewing')
      const child1 = createTask('child1', 'completed', 'parent')
      const child2 = createTask('child2', 'completed', 'parent')
      const allTasks = [parent, child1, child2]

      // reviewing (索引6) < completed (7)
      expect(getTreeStatus(parent, allTasks)).toBe('reviewing')
    })

    it('父任务待审核、子任务开发中时应取开发中', () => {
      const parent = createTask('parent', 'reviewing')
      const child = createTask('child', 'developing', 'parent')
      const allTasks = [parent, child]

      // developing (索引5) < reviewing (6)
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