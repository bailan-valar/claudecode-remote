/**
 * Keep-Alive 缓存管理工具
 * 提供页面缓存的生命周期管理功能
 */

import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { KeepAliveManager } from './keepAliveTypes'

// 缓存状态管理
const cacheComponents = ref<string[]>([])
const excludeComponents = ref<string[]>([])

// 缓存统计信息
const cacheStats = {
  totalHits: 0,
  totalMisses: 0,
  componentStates: new Map<string, { lastActivated: number, cacheHits: number }>()
}

/**
 * 使用 Keep-Alive 管理器的组合式函数
 */
export function useKeepAliveManager(): KeepAliveManager {
  const router = useRouter()
  const route = useRoute()

  /**
   * 添加组件到缓存列表
   */
  const addToCache = (componentName: string) => {
    if (!componentName) {
      console.warn('addToCache: 组件名称不能为空')
      return
    }

    if (!cacheComponents.value.includes(componentName)) {
      cacheComponents.value.push(componentName)
      console.debug(`添加组件到缓存: ${componentName}`)
    }
  }

  /**
   * 从缓存列表中移除组件
   */
  const removeFromCache = (componentName: string) => {
    if (!componentName) {
      console.warn('removeFromCache: 组件名称不能为空')
      return
    }

    const index = cacheComponents.value.indexOf(componentName)
    if (index > -1) {
      cacheComponents.value.splice(index, 1)
      cacheStats.componentStates.delete(componentName)
      console.debug(`从缓存中移除组件: ${componentName}`)
    }
  }

  /**
   * 添加组件到排除列表
   */
  const addToExclude = (componentName: string) => {
    if (!componentName) {
      console.warn('addToExclude: 组件名称不能为空')
      return
    }

    if (!excludeComponents.value.includes(componentName)) {
      excludeComponents.value.push(componentName)
      console.debug(`添加组件到排除列表: ${componentName}`)
    }
  }

  /**
   * 从排除列表中移除组件
   */
  const removeFromExclude = (componentName: string) => {
    if (!componentName) {
      console.warn('removeFromExclude: 组件名称不能为空')
      return
    }

    const index = excludeComponents.value.indexOf(componentName)
    if (index > -1) {
      excludeComponents.value.splice(index, 1)
      console.debug(`从排除列表中移除组件: ${componentName}`)
    }
  }

  /**
   * 清空所有缓存
   */
  const clearAllCache = () => {
    const clearedCount = cacheComponents.value.length
    cacheComponents.value = []
    excludeComponents.value = []
    cacheStats.componentStates.clear()
    cacheStats.totalHits = 0
    cacheStats.totalMisses = 0
    console.debug(`清空所有缓存，共清除 ${clearedCount} 个组件`)
  }

  /**
   * 根据路由元信息自动管理缓存
   */
  const autoManageCache = () => {
    watch(() => route.meta.keepAlive, (shouldCache, oldShouldCache) => {
      const cacheName = (route.meta.cacheName as string) || (route.name as string)

      if (!cacheName) {
        console.warn('autoManageCache: 无法确定缓存名称')
        return
      }

      // 记录缓存统计
      if (shouldCache === true && oldShouldCache !== true) {
        cacheStats.totalHits++
        cacheStats.componentStates.set(cacheName, {
          lastActivated: Date.now(),
          cacheHits: (cacheStats.componentStates.get(cacheName)?.cacheHits || 0) + 1
        })
      } else if (shouldCache === false) {
        cacheStats.totalMisses++
        addToExclude(cacheName)
        removeFromCache(cacheName)
      } else {
        removeFromExclude(cacheName)
        // 只有在路由配置中明确启用keepAlive时才添加到缓存
        if (shouldCache === true) {
          addToCache(cacheName)
        }
      }
    }, { immediate: true })
  }

  /**
   * 预加载指定路由的缓存
   */
  const preloadCache = async (routeName: string) => {
    if (!routeName) {
      console.warn('preloadCache: 路由名称不能为空')
      return
    }

    try {
      await router.isReady()
      const targetRoute = router.resolve({ name: routeName })

      if (!targetRoute) {
        console.warn(`preloadCache: 未找到路由: ${routeName}`)
        return
      }

      if (targetRoute.meta.keepAlive !== false) {
        const cacheName = (targetRoute.meta.cacheName as string) || routeName
        addToCache(cacheName)
        console.debug(`预加载路由缓存: ${routeName} -> ${cacheName}`)
      }
    } catch (error) {
      console.warn(`预加载路由缓存失败: ${routeName}`, error)
    }
  }

  return {
    cacheComponents,
    excludeComponents,
    addToCache,
    removeFromCache,
    addToExclude,
    removeFromExclude,
    clearAllCache,
    autoManageCache,
    preloadCache
  }
}

/**
 * 全局 keep-alive 管理器实例
 */
let globalManager: KeepAliveManager | null = null

/**
 * 获取全局 keep-alive 管理器实例
 * @returns KeepAliveManager 实例
 */
export function getGlobalKeepAliveManager(): KeepAliveManager {
  if (!globalManager) {
    globalManager = useKeepAliveManager()
  }
  return globalManager
}

/**
 * 获取缓存统计信息（用于调试和监控）
 */
export function getCacheStatistics() {
  const totalRequests = cacheStats.totalHits + cacheStats.totalMisses
  return {
    currentCacheCount: cacheComponents.value.length,
    totalHits: cacheStats.totalHits,
    totalMisses: cacheStats.totalMisses,
    hitRate: totalRequests > 0 ? (cacheStats.totalHits / totalRequests) * 100 : 0,
    componentStates: Array.from(cacheStats.componentStates.entries())
  }
}
