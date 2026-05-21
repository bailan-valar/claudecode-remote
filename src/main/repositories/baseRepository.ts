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
    let attempt = 0
    while (true) {
      try {
        const existing = await this.db.get(id)
        // 去掉 changes 中可能误传的 _rev，避免覆盖最新版本
        const { _rev: _, ...safeChanges } = changes as any
        const updated = { ...existing, ...safeChanges, _id: id, _rev: existing._rev }
        const result = await this.db.put(updated)
        console.log(`[repo:${this.type}] update ${id} ok (rev=${result.rev})`)
        return { ...updated, _rev: result.rev } as T
      } catch (err: any) {
        if (err.name === 'conflict' && attempt < 2) {
          attempt++
          console.warn(`[repo:${this.type}] update ${id} conflict, retry ${attempt}/2`)
          continue
        }
        console.error(`[repo:${this.type}] update ${id} failed:`, err.message)
        throw err
      }
    }
  }

  async delete(id: string): Promise<void> {
    let attempt = 0
    while (true) {
      try {
        const doc = await this.db.get(id)
        await this.db.remove(doc)
        console.log(`[repo:${this.type}] delete ${id} ok`)
        return
      } catch (err: any) {
        if (err.name === 'conflict' && attempt < 2) {
          attempt++
          console.warn(`[repo:${this.type}] delete ${id} conflict, retry ${attempt}/2`)
          continue
        }
        console.error(`[repo:${this.type}] delete ${id} failed:`, err.message)
        throw err
      }
    }
  }
}
