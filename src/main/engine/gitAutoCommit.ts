import { simpleGit, type SimpleGit } from 'simple-git'

function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours}小时`)
  if (minutes > 0 || hours > 0) parts.push(`${minutes}分钟`)
  parts.push(`${seconds}秒`)
  return parts.join('')
}

export interface GitCommitResult {
  success: boolean
  commitHash?: string
  message?: string
  error?: string
}

/**
 * 对指定项目目录执行自动 git 提交。
 * 失败时不抛异常，仅返回错误信息，避免阻塞主流程。
 */
export async function autoCommit(
  projectPath: string,
  taskTitle: string,
  durationSeconds?: number,
): Promise<GitCommitResult> {
  try {
    const git: SimpleGit = simpleGit(projectPath)

    // 检查是否为 git 仓库
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      return { success: false, error: '项目目录不是 git 仓库' }
    }

    // 获取当前状态
    const status = await git.status()

    const hasChanges =
      status.modified.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.renamed.length > 0

    const durationText =
      typeof durationSeconds === 'number' && durationSeconds > 0
        ? formatDuration(durationSeconds)
        : ''
    const commitMsg = durationText
      ? `auto: complete task "${taskTitle}" (${durationText})`
      : `auto: complete task "${taskTitle}"`

    // 如果有变更，先添加到暂存区
    if (hasChanges) {
      await git.add('.')
    }

    // 提交；若工作区干净则创建空提交
    const commitResult = hasChanges
      ? await git.commit(commitMsg)
      : await git.commit(commitMsg, undefined, { '--allow-empty': null })

    if (commitResult.commit) {
      return {
        success: true,
        commitHash: commitResult.commit,
        message: hasChanges
          ? `已提交: ${commitMsg} (${commitResult.commit})`
          : `工作区干净，已创建空提交: ${commitMsg} (${commitResult.commit})`,
      }
    }

    return { success: false, error: 'git commit 未返回 commit hash' }
  } catch (err: any) {
    return { success: false, error: `git 自动提交失败: ${err.message}` }
  }
}
