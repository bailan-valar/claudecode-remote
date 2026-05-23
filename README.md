# ClaudeCode Remote

ClaudeCode 多项目桌面客户端，基于 Electron + Vue 3 + PouchDB。

## 开发启动

1. 复制 `.env.example` 为 `.env` 并填入自建 CouchDB 凭据
2. `npm install`
3. `npm run dev`

## 当前阶段（Phase 1）

- Electron 窗口启动后会自动 sync 到 `${COUCHDB_URL}` 指定的 CouchDB 实例
- 首屏卡片实时显示 sync 状态
- 任务/用户/项目相关功能在 Phase 2+ 加入

## 故障排查

- `Module did not self-register` 或 `NODE_MODULE_VERSION` 报错 -> 运行 `npx electron-rebuild`
- sync 卡在 `connecting` -> 检查 `COUCHDB_URL` 是否可访问、HTTPS 证书有效、CouchDB CORS 允许
- CouchDB 默认未开 CORS；需在 `local.ini` 加 `[chttpd] enable_cors = true` 和 `[cors] origins = *`（dev 阶段）

"env": {
      "CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS": "300000000",
        "ANTHROPIC_AUTH_TOKEN": "sk-kimi-dKvRvifDWX3ef6AJvtwGz9gPHYUFoUd4PYlSWKMCaFnYB1rTwctnZgqXDuDOkwH5",
        "ANTHROPIC_BASE_URL": "https://api.kimi.com/coding/"
    },