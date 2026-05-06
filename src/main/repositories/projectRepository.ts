import { BaseRepository } from './baseRepository'
import type { Project } from '../../shared/types'

export function createProjectRepository(db: PouchDB.Database) {
  return new BaseRepository<Project>(db, 'project')
}
