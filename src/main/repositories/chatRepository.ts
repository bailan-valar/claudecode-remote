import { createRepository } from './baseRepository'
import type { ChatMessage, ChatSession } from '../../shared/types'

export function createChatRepository(db: PouchDB.Database) {
  const repo = createRepository<ChatMessage>(db, 'chat-message')
  
  return {
    ...repo,
    findByProjectId: async (projectId: string) => {
      const result = await db.find({
        selector: {
          type: 'chat-message',
          projectId: projectId
        },
        sort: [{ timestamp: 'asc' }]
      })
      return result.docs
    },
    findBySessionId: async (sessionId: string) => {
      const result = await db.find({
        selector: {
          type: 'chat-message',
          sessionId: sessionId
        },
        sort: [{ timestamp: 'asc' }]
      })
      return result.docs
    },
    findLatestSession: async (projectId: string) => {
      const result = await db.find({
        selector: {
          type: 'chat-message',
          projectId: projectId
        },
        sort: [{ timestamp: 'desc' }],
        limit: 1
      })
      return result.docs[0] as ChatMessage | undefined
    },
    deleteByProjectId: async (projectId: string) => {
      const messages = await repo.findByProjectId(projectId)
      for (const message of messages) {
        if (message._id && message._rev) {
          await db.remove(message._id, message._rev)
        }
      }
    }
  }
}

export function createChatSessionRepository(db: PouchDB.Database) {
  const repo = createRepository<ChatSession>(db, 'chat-session')
  
  return {
    ...repo,
    findByProjectId: async (projectId: string) => {
      const result = await db.find({
        selector: {
          type: 'chat-session',
          projectId: projectId
        },
        sort: [{ updatedAt: 'desc' }]
      })
      return result.docs
    }
  }
}
