import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    // 配置主进程的监听文件
    watch: {
      // 监听任务相关的文件变化
      ignored: ['**/node_modules/**', '**/out/**', '**/.git/**']
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [vue()],
    // 配置渲染进程的热重载
    server: {
      watch: {
        // 监听特定目录的文件变化
        ignored: ['**/node_modules/**', '**/out/**']
      }
    }
  },
})
