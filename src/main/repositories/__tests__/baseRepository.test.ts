import { describe, it, expect, beforeEach } from 'vitest'
import PouchDB from 'pouchdb'
import PouchDBMemory from 'pouchdb-adapter-memory'
import { BaseRepository } from '../baseRepository'

PouchDB.plugin(PouchDBMemory)

interface TestDoc {
  _id: string
  _rev: string
  type: 'test'
  name: string
}

describe('BaseRepository', () => {
  let db: PouchDB.Database
  let repo: BaseRepository<TestDoc>

  beforeEach(async () => {
    db = new PouchDB('memory:test', { adapter: 'memory' })
    repo = new BaseRepository<TestDoc>(db, 'test')
  })

  it('findAll returns empty array when no docs', async () => {
    const docs = await repo.findAll()
    expect(docs).toEqual([])
  })

  it('creates and finds a doc', async () => {
    const created = await repo.create({ type: 'test', name: 'hello' })
    expect(created._id).toMatch(/^test:/)
    expect(created.name).toBe('hello')

    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].name).toBe('hello')
  })

  it('findById returns null for missing doc', async () => {
    const doc = await repo.findById('test:nonexistent')
    expect(doc).toBeNull()
  })

  it('updates a doc', async () => {
    const created = await repo.create({ type: 'test', name: 'before' })
    const updated = await repo.update(created._id, { name: 'after' })
    expect(updated.name).toBe('after')
    expect(updated._rev).not.toBe(created._rev)
  })

  it('deletes a doc', async () => {
    const created = await repo.create({ type: 'test', name: 'todelete' })
    await repo.delete(created._id)
    const doc = await repo.findById(created._id)
    expect(doc).toBeNull()
  })

})
