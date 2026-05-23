/**
 * 企业微信机器人 Webhook 通知模块
 * 支持 text / markdown 两种消息类型
 */

export interface WecomMessage {
  msgtype: 'text' | 'markdown'
  text?: { content: string; mentioned_list?: string[] }
  markdown?: { content: string }
}

export async function sendWecomMessage(
  webhookUrl: string,
  message: WecomMessage,
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: 'webhook URL 为空' }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    })

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` }
    }

    const data = (await res.json()) as { errcode: number; errmsg: string }
    if (data.errcode !== 0) {
      return { success: false, error: `[${data.errcode}] ${data.errmsg}` }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export function buildTaskCompletedMarkdown(opts: {
  projectName: string
  taskTitle: string
  taskId: string
  status: string
  prompt: string
  logsCount: number
  commitMessage?: string
}): WecomMessage {
  const content = [
    `## ✅ 任务开发完成`,
    ``,
    `**项目**: ${opts.projectName}`,
    `**任务**: ${opts.taskTitle}`,
    `**状态**: ${opts.status}`,
    `**日志条数**: ${opts.logsCount}`,
    opts.commitMessage ? `**Git Commit**: ${opts.commitMessage}` : '',
    ``,
    `---`,
    `**Prompt 摘要**:`,
    `> ${opts.prompt.slice(0, 300)}${opts.prompt.length > 300 ? '...' : ''}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    msgtype: 'markdown',
    markdown: { content },
  }
}
