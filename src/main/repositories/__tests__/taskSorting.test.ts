import { describe, it, expect, beforeEach } from 'vitest'
import PouchDB from 'pouchdb'
import PouchDBMemory from 'pouchdb-adapter-memory'
import { BaseRepository } from '../baseRepository'

PouchDB.plugin(PouchDBMemory)

// Task sorting tests
interface TaskDoc {
  _id: string
  _rev: string
  type: 'task'
  title: string
  updatedAt: string
  projectId: string
}

describe('Task Sorting by updatedAt', () => {
  let db: PouchDB.Database
  let repo: BaseRepository<TaskDoc>

  beforeEach(async () => {
    db = new PouchDB('memory:task-sort-test', { adapter: 'memory' })
    repo = new BaseRepository<TaskDoc>(db, 'task')
  })

  it('sorts tasks by updatedAt in descending order (most recent first)', async () => {
    // Create tasks with different update times
    const task1 = await repo.create({
      type: 'task',
      title: 'Task 1 (oldest)',
      updatedAt: '2024-01-01T10:00:00.000Z',
      projectId: 'project1'
    })
    
    const task2 = await repo.create({
      type: 'task',
      title: 'Task 2 (middle)',
      updatedAt: '2024-01-02T12:00:00.000Z',
      projectId: 'project1'
    })
    
    const task3 = await repo.create({
      type: 'task',
      title: 'Task 3 (newest)',
      updatedAt: '2024-01-03T14:00:00.000Z',
      projectId: 'project1'
    })

    // Get all tasks and sort them
    let tasks = await repo.findAll()
    tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    // Verify the order is newest first
    expect(tasks[0]._id).toBe(task3._id)
    expect(tasks[0].title).toBe('Task 3 (newest)')
    expect(tasks[1]._id).toBe(task2._id)
    expect(tasks[1].title).toBe('Task 2 (middle)')
    expect(tasks[2]._id).toBe(task1._id)
    expect(tasks[2].title).toBe('Task 1 (oldest)')
  })

  it('sorts tasks correctly when filtering by projectId', async () => {
    // Create tasks for different projects
    const task1 = await repo.create({
      type: 'task',
      title: 'Project 1 Task (oldest)',
      updatedAt: '2024-01-01T10:00:00.000Z',
      projectId: 'project1'
    })
    
    const task2 = await repo.create({
      type: 'task',
      title: 'Project 2 Task (middle)',
      updatedAt: '2024-01-02T12:00:00.000Z',
      projectId: 'project2'
    })
    
    const task3 = await repo.create({
      type: 'task',
      title: 'Project 1 Task (newest)',
      updatedAt: '2024-01-03T14:00:00.000Z',
      projectId: 'project1'
    })

    // Get all tasks, filter by project1, and sort
    let tasks = await repo.findAll()
    tasks = tasks.filter((t) => t.projectId === 'project1')
    tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    // Verify only project1 tasks are included and sorted correctly
    expect(tasks).toHaveLength(2)
    expect(tasks[0]._id).toBe(task3._id)
    expect(tasks[0].title).toBe('Project 1 Task (newest)')
    expect(tasks[1]._id).toBe(task1._id)
    expect(tasks[1].title).toBe('Project 1 Task (oldest)')
  })
})
