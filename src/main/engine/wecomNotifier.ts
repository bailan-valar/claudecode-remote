/**
 * 企业微信机器人 Webhook 通知模块
 * 支持 text / markdown 两种消息类型
 */

export interface WecomMessage {
  msgtype: 'text' | 'markdown'
  text?: { content: string; mentioned_list?: string[]; mentioned_mobile_list?: string[] }
  markdown?: { content: string }
}

export const WECOM_WEBHOOK_HOST = 'qyapi.weixin.qq.com'

export function isValidWecomWebhookUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.hostname === WECOM_WEBHOOK_HOST && u.pathname.includes('/cgi-bin/webhook/send')
  } catch {
    return false
  }
}

export async function sendWecomMessage(
  webhookUrl: string,
  message: WecomMessage,
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: 'webhook URL 为空' }
  }
  if (!isValidWecomWebhookUrl(webhookUrl)) {
    return { success: false, error: '不是合法的企业微信机器人 URL (应为 qyapi.weixin.qq.com)' }
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
  taskDescription?: string
  logsCount: number
  commitMessage?: string
  durationMs?: number
  taskUrl?: string
  pendingCount?: number
}): WecomMessage {
  const durationStr = opts.durationMs != null ? formatDurationShort(opts.durationMs) : ''
  const pendingStr = opts.pendingCount != null ? `**待开发任务**: ${opts.pendingCount} 个` : ''

  // 处理任务标题显示：超过8个字则截断为「XXXXXXXX…」
  const displayTitle = opts.taskTitle.length > 8
    ? `「${opts.taskTitle.slice(0, 8)}…」`
    : opts.taskTitle

  // 构建任务内容摘要：标题 + 描述
  const taskContent = opts.taskDescription
    ? `${opts.taskTitle}\n${opts.taskDescription}`
    : opts.taskTitle

  const content = [
    `## ✅ ${displayTitle}开发完成`,
    ``,
    `**项目**: ${opts.projectName}`,
    `**任务**: ${opts.taskTitle}`,
    `**状态**: ${opts.status}`,
    durationStr ? `**耗时**: ${durationStr}` : '',
    `**日志条数**: ${opts.logsCount}`,
    opts.commitMessage ? `**Git Commit**: ${opts.commitMessage}` : '',
    opts.taskUrl ? `**任务详情**: [点击查看](${opts.taskUrl})` : '',
    pendingStr,
    ``,
    `---`,
    `**任务内容**:`,
    `> ${taskContent.slice(0, 300)}${taskContent.length > 300 ? '...' : ''}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    msgtype: 'markdown',
    markdown: { content },
  }
}

export function buildTaskFailedMarkdown(opts: {
  projectName: string
  taskTitle: string
  taskId: string
  taskDescription?: string
  error: string
  durationMs?: number
  taskUrl?: string
  pendingCount?: number
}): WecomMessage {
  const durationStr = opts.durationMs != null ? formatDurationShort(opts.durationMs) : ''
  const pendingStr = opts.pendingCount != null ? `**待开发任务**: ${opts.pendingCount} 个` : ''

  // 构建任务内容摘要：标题 + 描述
  const taskContent = opts.taskDescription
    ? `${opts.taskTitle}\n${opts.taskDescription}`
    : opts.taskTitle

  const content = [
    `## ❌ 任务执行失败`,
    ``,
    `**项目**: ${opts.projectName}`,
    `**任务**: ${opts.taskTitle}`,
    durationStr ? `**耗时**: ${durationStr}` : '',
    opts.taskUrl ? `**任务详情**: [点击查看](${opts.taskUrl})` : '',
    pendingStr,
    ``,
    `**错误**:`,
    `> <font color="warning">${opts.error.slice(0, 500)}</font>`,
    ``,
    `---`,
    `**任务内容**:`,
    `> ${taskContent.slice(0, 200)}${taskContent.length > 200 ? '...' : ''}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    msgtype: 'markdown',
    markdown: { content },
  }
}

export function buildMentionTextMessage(mentionedList: string[], content: string): WecomMessage {
  return {
    msgtype: 'text',
    text: {
      content,
      mentioned_list: mentionedList,
    },
  }
}

export function buildTestMessage(): WecomMessage {
  return {
    msgtype: 'markdown',
    markdown: {
      content: [
        `## 🔔 ClaudeCode Remote Webhook 测试`,
        ``,
        `如果你看到了这条消息，说明企业微信机器人 Webhook 已配置成功。`,
        ``,
        `> 当任务开发完成（进入待审核）时，将自动推送任务通知。`,
        ``,
        `**时间**: ${new Date().toLocaleString('zh-CN')}`,
      ].join('\n'),
    },
  }
}

function formatDurationShort(ms: number): string {
  if (ms < 0) ms = 0
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const s = sec % 60
  if (min < 60) return s ? `${min}m${s}s` : `${min}m`
  const hr = Math.floor(min / 60)
  const m = min % 60
  return m ? `${hr}h${m}m` : `${hr}h`
}
