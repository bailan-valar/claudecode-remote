import { createRepository, BaseRepository } from './baseRepository'
import type { ChatMessage, ChatSession } from '../../shared/types'

type ChatRepository = BaseRepository<ChatMessage> & {
  findByProjectId: (projectId: string) => Promise<ChatMessage[]>
  findBySessionId: (sessionId: string) => Promise<ChatMessage[]>
  findLatestSession: (projectId: string) => Promise<ChatMessage | undefined>
  deleteByProjectId: (projectId: string) => Promise<void>
}

export function createChatRepository(db: PouchDB.Database): ChatRepository {
  const repo = createRepository<ChatMessage>(db, 'chat-message')

  const custom = {
    findByProjectId: async (projectId: string) => {
      const result = await db.find({
        selector: {
          type: 'chat-message',
          projectId: projectId,
        },
        sort: [{ timestamp: 'asc' }],
      })
      return result.docs as ChatMessage[]
    },
    findBySessionId: async (sessionId: string) => {
      const result = await db.find({
        selector: {
          type: 'chat-message',
          sessionId: sessionId,
        },
        sort: [{ timestamp: 'asc' }],
      })
      return result.docs as ChatMessage[]
    },
    findLatestSession: async (projectId: string) => {
      const result = await db.find({
        selector: {
          type: 'chat-message',
          projectId: projectId,
        },
        sort: [{ timestamp: 'desc' }],
        limit: 1,
      })
      return (result.docs[0] as ChatMessage | undefined) ?? undefined
    },
    deleteByProjectId: async (projectId: string) => {
      const result = await db.find({
        selector: { type: 'chat-message', projectId },
      })
      for (const doc of result.docs) {
        if (doc._id && doc._rev) {
          await db.remove(doc._id, doc._rev)
        }
      }
    },
  }

  return Object.assign(repo, custom) as ChatRepository
}

type ChatSessionRepository = BaseRepository<ChatSession> & {
  findByProjectId: (projectId: string) => Promise<ChatSession[]>
}

export function createChatSessionRepository(db: PouchDB.Database): ChatSessionRepository {
  const repo = createRepository<ChatSession>(db, 'chat-session')

  const custom = {
    findByProjectId: async (projectId: string) => {
      const result = await db.find({
        selector: {
          type: 'chat-session',
          projectId: projectId,
        },
        sort: [{ updatedAt: 'desc' }],
      })
      return result.docs as ChatSession[]
    },
  }

  return Object.assign(repo, custom) as ChatSessionRepository
}
