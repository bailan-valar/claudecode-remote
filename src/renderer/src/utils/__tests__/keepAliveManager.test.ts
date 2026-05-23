/**
 * Keep-Alive 管理器单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useKeepAliveManager, getCacheStatistics } from '../keepAliveManager'

// Mock Vue Router
vi.mock('vue-router', () => ({
  useRouter: () => ({
    isReady: vi.fn().mockResolvedValue(undefined),
    resolve: vi.fn((name) => ({
      meta: { keepAlive: true, cacheName: name },
      name
    }))
  }),
  useRoute: () => ({
    meta: { keepAlive: true, cacheName: 'test-route' },
    name: 'test-route'
  }),
  createRouter: vi.fn(),
  createWebHashHistory: vi.fn()
}))

describe('KeepAliveManager', () => {
  let manager: ReturnType<typeof useKeepAliveManager>

  beforeEach(() => {
    // 重置管理器状态
    manager = useKeepAliveManager()
    manager.clearAllCache()
  })

  describe('基本缓存操作', () => {
    it('应该能够添加组件到缓存列表', () => {
      manager.addToCache('TestComponent')
      expect(manager.cacheComponents.value).toContain('TestComponent')
    })

    it('不应该重复添加相同的组件', () => {
      manager.addToCache('TestComponent')
      manager.addToCache('TestComponent')
      expect(manager.cacheComponents.value.filter(c => c === 'TestComponent').length).toBe(1)
    })

    it('应该能够从缓存列表中移除组件', () => {
      manager.addToCache('TestComponent')
      manager.removeFromCache('TestComponent')
      expect(manager.cacheComponents.value).not.toContain('TestComponent')
    })

    it('应该能够添加组件到排除列表', () => {
      manager.addToExclude('ExcludedComponent')
      expect(manager.excludeComponents.value).toContain('ExcludedComponent')
    })

    it('应该能够从排除列表中移除组件', () => {
      manager.addToExclude('ExcludedComponent')
      manager.removeFromExclude('ExcludedComponent')
      expect(manager.excludeComponents.value).not.toContain('ExcludedComponent')
    })
  })

  describe('缓存管理', () => {
    it('应该能够清空所有缓存', () => {
      manager.addToCache('Component1')
      manager.addToCache('Component2')
      manager.addToExclude('ExcludedComponent')
      
      manager.clearAllCache()
      
      expect(manager.cacheComponents.value).toHaveLength(0)
      expect(manager.excludeComponents.value).toHaveLength(0)
    })
  })

  describe('错误处理', () => {
    it('应该处理空组件名称', () => {
      // 这些调用不应该抛出错误
      expect(() => manager.addToCache('')).not.toThrow()
      expect(() => manager.removeFromCache('')).not.toThrow()
      expect(() => manager.addToExclude('')).not.toThrow()
      expect(() => manager.removeFromExclude('')).not.toThrow()
    })

    it('应该处理预加载失败的情况', async () => {
      // 即使路由解析失败，也不应该抛出错误
      await expect(manager.preloadCache('non-existent-route')).resolves.toBeUndefined()
    })
  })

  describe('缓存统计', () => {
    it('应该提供缓存统计信息', () => {
      manager.addToCache('Component1')
      manager.addToCache('Component2')
      
      const stats = getCacheStatistics()
      
      expect(stats.currentCacheCount).toBe(2)
      expect(stats.totalHits).toBeGreaterThanOrEqual(0)
      expect(stats.totalMisses).toBeGreaterThanOrEqual(0)
      expect(stats.hitRate).toBeGreaterThanOrEqual(0)
      expect(stats.hitRate).toBeLessThanOrEqual(100)
    })
  })

  describe('单例模式', () => {
    it('全局管理器应该是单例', () => {
      const { getGlobalKeepAliveManager } = require('../keepAliveManager')
      const instance1 = getGlobalKeepAliveManager()
      const instance2 = getGlobalKeepAliveManager()
      
      expect(instance1).toBe(instance2)
    })
  })
})
