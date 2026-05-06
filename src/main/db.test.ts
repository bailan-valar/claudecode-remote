import { describe, it, expect } from 'vitest'
import { SyncManager } from './db'

describe('SyncManager', () => {
  it('emits connecting status when start() is called', () => {
    // Arrange
    const sm = new SyncManager('memory:local', 'memory:remote')
    const events: string[] = []
    sm.on('status', (s) => events.push(s.phase))

    // Act
    sm.start()

    // Assert
    expect(events[0]).toBe('connecting')
  })
})
