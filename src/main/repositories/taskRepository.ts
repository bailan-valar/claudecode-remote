import { BaseRepository } from './baseRepository'
import type { Task } from '../../shared/types'

export function createTaskRepository(db: PouchDB.Database) {
  return new BaseRepository<Task>(db, 'task')
}
