# ClaudeCode Remote — 国产 LLM 兼容性报告

> 本文件记录 Claude Code 在智谱 GLM / Kimi K2 Claude 兼容端点的实际测试结果。

## 测试环境

- Claude Code 版本: 2.1.129
- 测试日期: 2026-05-06
- 测试方式: `claude -p "list files in current dir" --output-format stream-json --bare --allowedTools Read,Bash --verbose`

---

## 智谱 GLM (Zhipu)

**端点配置**
- Base URL: `https://open.bigmodel.cn/api/paas/v4/chat/completions`
- 环境变量: `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 基础对话 | ❓ 待测试 | |
| Read 工具调用 | ❓ 待测试 | |
| Bash 工具调用 | ❓ 待测试 | |
| 工具调用链（多轮） | ❓ 待测试 | |
| `--resume <session_id>` | ❓ 待测试 | |
| stream-json 输出格式 | ❓ 待测试 | |
| session_id 持久化 | ❓ 待测试 | |

**已知差异**
- （待补充）

---

## Kimi K2 (Moonshot)

**端点配置**
- Base URL: `https://api.moonshot.cn/v1/chat/completions`
- 环境变量: `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 基础对话 | ❓ 待测试 | |
| Read 工具调用 | ❓ 待测试 | |
| Bash 工具调用 | ❓ 待测试 | |
| 工具调用链（多轮） | ❓ 待测试 | |
| `--resume <session_id>` | ❓ 待测试 | |
| stream-json 输出格式 | ❓ 待测试 | |
| session_id 持久化 | ❓ 待测试 | |

**已知差异**
- （待补充）

---

## 测试脚本

在项目根目录执行：

```bash
# 1. 测试 Anthropic 官方（基准）
claude -p "list files in current dir" --output-format stream-json --bare --allowedTools Read,Bash --verbose

# 2. 测试智谱 GLM
$env:ANTHROPIC_BASE_URL="https://open.bigmodel.cn/api/paas/v4/chat/completions"
$env:ANTHROPIC_API_KEY="<your-zhipu-key>"
claude -p "list files in current dir" --output-format stream-json --bare --allowedTools Read,Bash --verbose

# 3. 测试 Kimi K2
$env:ANTHROPIC_BASE_URL="https://api.moonshot.cn/v1/chat/completions"
$env:ANTHROPIC_API_KEY="<your-moonshot-key>"
claude -p "list files in current dir" --output-format stream-json --bare --allowedTools Read,Bash --verbose
```

观察要点：
1. 输出是否为合法的 NDJSON（每行一个 JSON）
2. 是否包含 `type: "system"` 且带有 `session_id`
3. 是否包含 `type: "assistant"` 且 `content` 中有 `tool_use`
4. 是否包含 `type: "user"` 且 `content` 中有 `tool_result`
5. 最终是否包含 `type: "result"`
6. `--resume <session_id>` 是否能复用上下文

---

## 结论

- Anthropic 官方: ✅ 完全支持
- 智谱 GLM: ❓ 待验证
- Kimi K2: ❓ 待验证

**若某端点不支持 `--resume`**：Phase 8 子任务继承将对该 provider 自动降级为新建 session（不传递 `--resume` 参数）。
