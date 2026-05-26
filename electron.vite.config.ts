import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
      },
    },
    plugins: [vue()],
    publicDir: resolve(__dirname, 'public'),
    server: {
      port: 3456,
      strictPort: true, // 端口被占用时报错而不是自动切换
      host: '0.0.0.0',   // 监听所有接口，支持通过反向代理/远程域名访问
      allowedHosts: true, // 允许任意 host 访问（开发环境）
      proxy: {
        // 开发模式下，API 由主进程 webServer 提供
        // dev:hmr 模式使用 3458 端口，正式构建使用 3457 端口
        '/api': {
          target: `http://localhost:${process.env.WEB_PORT || '3457'}`,
          changeOrigin: true,
        },
      },
    }
  }
})
