/**
 * Keep-Alive 相关类型定义
 */

import { Ref } from 'vue'

/**
 * 缓存管理器接口
 */
export interface KeepAliveManager {
  /** 需要缓存的组件名称列表 */
  cacheComponents: Ref<string[]>
  /** 需要排除的组件名称列表 */
  excludeComponents: Ref<string[]>
  
  /** 添加组件到缓存列表 */
  addToCache(componentName: string): void
  
  /** 从缓存列表中移除组件 */
  removeFromCache(componentName: string): void
  
  /** 添加组件到排除列表 */
  addToExclude(componentName: string): void
  
  /** 从排除列表中移除组件 */
  removeFromExclude(componentName: string): void
  
  /** 清空所有缓存 */
  clearAllCache(): void
  
  /** 根据路由元信息自动管理缓存 */
  autoManageCache(): void
  
  /** 预加载指定路由的缓存 */
  preloadCache(routeName: string): Promise<void>
}

/**
 * Keep-Alive 路由元信息类型
 */
export interface KeepAliveRouteMeta {
  /** 是否启用缓存 */
  keepAlive?: boolean | undefined
  /** 缓存名称（可选，默认使用路由名称） */
  cacheName?: string
}

/**
 * 组件缓存状态
 */
export interface ComponentCacheState {
  /** 组件名称 */
  name: string
  /** 是否已缓存 */
  isCached: boolean
  /** 最后激活时间 */
  lastActivated?: number
  /** 缓存命中次数 */
  cacheHits: number
}

/**
 * 缓存统计信息
 */
export interface CacheStatistics {
  /** 当前缓存数量 */
  currentCacheCount: number
  /** 总缓存命中次数 */
  totalHits: number
  /** 总缓存未命中次数 */
  totalMisses: number
  /** 缓存命中率 */
  hitRate: number
}
