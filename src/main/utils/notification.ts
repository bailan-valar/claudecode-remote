import { Notification } from 'electron'
import { loadConfig } from '../configStore'
import { createTaskRepository } from '../repositories/taskRepository'
import type PouchDB from 'pouchdb'

/**
 * 发送任务完成通知
 */
export async function sendTaskCompletedNotification(
  db: PouchDB.Database,
  taskId: string,
  success: boolean = true
): Promise<void> {
  try {
    // 检查是否启用了通知
    const config = loadConfig()
    if (config.enableTaskNotification === false) {
      console.log('[notification] 任务通知已禁用')
      return
    }

    // 获取任务信息
    const taskRepo = createTaskRepository(db)
    const task = await taskRepo.findById(taskId)
    if (!task) {
      console.log('[notification] 任务不存在，无法发送通知')
      return
    }

    // 构建通知内容
    const title = success ? '任务已完成' : '任务失败'
    const body = `${task.title}${task.description ? `\n${task.description}` : ''}`

    // 发送通知
    const notification = new Notification({
      title,
      body,
      icon: undefined, // 使用应用默认图标
      silent: false,
    })

    notification.show()
    console.log('[notification] 任务通知已发送:', taskId)
  } catch (error: any) {
    console.error('[notification] 发送任务通知失败:', error.message)
  }
}
