import { simpleGit, type SimpleGit } from 'simple-git'

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

    // 如果没有变更，跳过提交
    if (
      status.modified.length === 0 &&
      status.created.length === 0 &&
      status.deleted.length === 0 &&
      status.renamed.length === 0
    ) {
      return { success: true, message: '没有文件变更，跳过提交' }
    }

    // 添加所有变更
    await git.add('.')

    // 提交，使用任务标题作为提交信息
    const commitMsg = `auto: complete task "${taskTitle}"`
    const commitResult = await git.commit(commitMsg)

    if (commitResult.commit) {
      return {
        success: true,
        commitHash: commitResult.commit,
        message: `已提交: ${commitMsg} (${commitResult.commit})`,
      }
    }

    return { success: false, error: 'git commit 未返回 commit hash' }
  } catch (err: any) {
    return { success: false, error: `git 自动提交失败: ${err.message}` }
  }
}
