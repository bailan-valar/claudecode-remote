import type { BaseDoc } from '../../shared/types'

export class BaseRepository<T extends BaseDoc> {
  constructor(
    private db: PouchDB.Database,
    private type: string,
  ) {}

  async findAll(): Promise<T[]> {
    const result = await this.db.allDocs({
      startkey: `${this.type}:`,
      endkey: `${this.type}:￯`,
      include_docs: true,
    })
    return result.rows.map((r) => r.doc as T)
  }

  async findById(id: string): Promise<T | null> {
    try {
      return (await this.db.get(id)) as T
    } catch (err: any) {
      if (err.status === 404) return null
      throw err
    }
  }

  async create(doc: Omit<T, '_id' | '_rev'>): Promise<T> {
    const id = `${this.type}:${crypto.randomUUID()}`
    const toInsert = { ...doc, _id: id } as unknown as T
    const result = await this.db.put(toInsert)
    return { ...toInsert, _rev: result.rev } as T
  }

  async update(id: string, changes: Partial<Omit<T, '_id' | '_rev'>>): Promise<T> {
    const existing = await this.db.get(id)
    const updated = { ...existing, ...changes, _id: id, _rev: existing._rev }
    const result = await this.db.put(updated)
    return { ...updated, _rev: result.rev } as T
  }

  async delete(id: string): Promise<void> {
    const doc = await this.db.get(id)
    await this.db.remove(doc)
  }
}
