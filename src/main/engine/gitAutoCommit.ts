import { simpleGit, type SimpleGit } from 'simple-git'
import type { TaskKind } from '../../shared/constants'

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

export interface GitPushResult {
  success: boolean
  message?: string
  error?: string
  pushedCommits?: string[]
}

/**
 * 对指定项目目录执行自动 git 提交。
 * 失败时不抛异常，仅返回错误信息，避免阻塞主流程。
 */
export async function autoCommit(
  projectPath: string,
  taskTitle: string,
  durationSeconds?: number,
  taskKind?: TaskKind,
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

    // 生成任务类型标签
    const kindLabelMap: Record<TaskKind, string> = {
      epic: '[史诗]',
      requirement: '[需求]',
      story: '[故事]',
      bug: '[缺陷]',
      task: '[任务]',
      chat: '[对话]',
    }
    const typeLabel = taskKind ? kindLabelMap[taskKind] : '[任务]'

    // 优化后的提交信息格式：类型+标题+执行时长
    const commitMsg = durationText
      ? `${typeLabel} ${taskTitle} (${durationText})`
      : `${typeLabel} ${taskTitle}`

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

/**
 * 推送指定项目目录的 git 提交到远程仓库。
 * 失败时不抛异常，仅返回错误信息。
 */
export async function pushToRemote(
  projectPath: string,
  remote?: string,
  branch?: string
): Promise<GitPushResult> {
  try {
    const git: SimpleGit = simpleGit(projectPath)

    // 检查是否为 git 仓库
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      return { success: false, error: '项目目录不是 git 仓库' }
    }

    // 获取默认远程仓库和分支
    const targetRemote = remote || 'origin'
    let targetBranch = branch

    if (!targetBranch) {
      // 获取当前分支
      const branchSummary = await git.branch()
      targetBranch = branchSummary.current || 'main'
    }

    // 检查远程仓库是否存在
    try {
      const remotes = await git.getRemotes(true)
      const remoteExists = remotes.some(r => r.name === targetRemote)
      if (!remoteExists) {
        return { success: false, error: `远程仓库 '${targetRemote}' 不存在` }
      }
    } catch (err: any) {
      return { success: false, error: `获取远程仓库信息失败: ${err.message}` }
    }

    // 执行推送
    const pushResult = await git.push(targetRemote, targetBranch, {
      '--force-with-lease': null // 使用更安全的强制推送
    })

    // 解析推送结果
    const pushedCommits: string[] = []

    // 尝试从推送结果中获取信息
    try {
      // @ts-ignore - simple-git类型定义可能不完整
      if (pushResult.repo?.pushed && typeof pushResult.repo.pushed === 'object') {
        // @ts-ignore
        for (const [ref, result] of Object.entries(pushResult.repo.pushed)) {
          if (result && typeof result === 'object') {
            // @ts-ignore
            const local = result.local
            // @ts-ignore
            const remote = result.remote
            if (local && remote) {
              pushedCommits.push(`${local} -> ${remote}`)
            }
          }
        }
      }
    } catch (err) {
      // 忽略解析错误，使用默认信息
    }

    // 如果没有详细的推送信息，但推送成功，提供基本信息
    if (pushedCommits.length === 0) {
      pushedCommits.push(`${targetBranch} -> ${targetRemote}/${targetBranch}`)
    }

    return {
      success: true,
      message: `已推送到 ${targetRemote}/${targetBranch}`,
      pushedCommits
    }
  } catch (err: any) {
    // 处理常见错误
    let errorMessage = `git 推送失败: ${err.message}`

    if (err.message?.includes('rejected')) {
      errorMessage = '推送被拒绝，可能需要先拉取远程更新或处理冲突'
    } else if (err.message?.includes('authentication')) {
      errorMessage = '认证失败，请检查 Git 凭据配置'
    } else if (err.message?.includes('connection')) {
      errorMessage = '网络连接失败，请检查网络或远程仓库地址'
    } else if (err.message?.includes('nothing to push')) {
      return {
        success: true,
        message: '没有需要推送的内容',
        pushedCommits: []
      }
    }

    return { success: false, error: errorMessage }
  }
}
