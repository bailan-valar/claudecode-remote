const fs = require('fs');
const path = 'src/main/engine/taskEngine.ts';
let c = fs.readFileSync(path, 'utf-8');

// Fix else branch
const m1 = '        // 如果是被停止的任务，提供更清晰的错误信息';
const idx1 = c.indexOf(m1);
if (idx1 > -1) {
  const before = c.lastIndexOf('      } else {', idx1);
  const after = c.indexOf('      }', idx1);
  const block = c.substring(before, after + 7);
  
  const newBlock = `      } else {
        const currentTask = await taskRepo.findById(task._id) ?? latestTask
        const isStopped = this.stoppedTaskIds.has(task._id)

        if (isStopped) {
          const endTimeChanges = computeTimeTrackingChanges(currentTask, TASK_STATUS.STOPPED)
          if (endTimeChanges.statusHistory && result.error) {
            const history = endTimeChanges.statusHistory as any[]
            const closedEntry = history[history.length - 2]
            if (closedEntry && (closedEntry.status === TASK_STATUS.DEVELOPING || closedEntry.status === TASK_STATUS.PLANNING)) {
              closedEntry.result = \`任务已停止: \${result.error}\`
            }
          }
          await taskRepo.update(task._id, {
            status: TASK_STATUS.STOPPED,
            reviewFeedback: '任务已停止',
            claudeSessionId: result.sessionId ?? inheritedSessionId,
            logs,
            updatedAt: new Date().toISOString(),
            ...endTimeChanges,
          })
          this.emit('task:stopped', task._id)
        } else {
          const errorStatus = isPlanTask ? TASK_STATUS.PLAN_REQUIRED : TASK_STATUS.PENDING
          const endTimeChanges = computeTimeTrackingChanges(currentTask, errorStatus)
          if (endTimeChanges.statusHistory && result.error) {
            const history = endTimeChanges.statusHistory as any[]
            const closedEntry = history[history.length - 2]
            if (closedEntry && (closedEntry.status === TASK_STATUS.DEVELOPING || closedEntry.status === TASK_STATUS.PLANNING)) {
              closedEntry.result = \`执行失败: \${result.error}\`
            }
          }

          await taskRepo.update(task._id, {
            status: errorStatus,
            reviewFeedback: result.error ?? '执行失败',
            claudeSessionId: result.sessionId ?? inheritedSessionId,
            logs,
            updatedAt: new Date().toISOString(),
            ...endTimeChanges,
          })

          // 失败通知（默认开启，可通过 webhookNotifyOnFailure=false 关闭）
          if (
            project.webhookEnabled &&
            project.webhookUrl &&
            project.webhookNotifyOnFailure !== false
          ) {
            const totalSec = endTimeChanges.totalDuration ?? currentTask.totalDuration ?? 0
            const pendingCount = await getProjectPendingCount(taskRepo, task.projectId)
            const failMsg = buildTaskFailedMarkdown({
              projectName: project.name,
              taskTitle: task.title,
              taskId: task._id,
              prompt: task.prompt ?? '',
              error: result.error ?? '执行失败',
              durationMs: totalSec * 1000,
              taskUrl: buildTaskUrl(project, task._id),
              pendingCount,
            })
            void sendWecomMessage(project.webhookUrl, failMsg).then((res) => {
              if (!res.success) {
                console.error('[wecom] 失败通知发送失败:', res.error)
              }
            })
          }

          this.emit('task:failed', task._id, result.error)
        }
      }`;
  c = c.substring(0, before) + newBlock + c.substring(after + 7);
  console.log('Replaced else');
}

// Fix catch branch
const m2 = '    } catch (err: any) {';
const idx2 = c.indexOf(m2);
if (idx2 > -1) {
  const endCatch = c.indexOf('      this.emit(\'task:failed\', task._id, err.message)', idx2);
  const blockEnd = c.indexOf('}', endCatch) + 1;
  const newCatch = `    } catch (err: any) {
      const currentTask = await taskRepo.findById(task._id) ?? latestTask
      const wasStopped = this.stoppedTaskIds.has(task._id)
      const errorStatus = wasStopped ? TASK_STATUS.STOPPED : (isPlanTask ? TASK_STATUS.PLAN_REQUIRED : TASK_STATUS.PENDING)
      const endTimeChanges = computeTimeTrackingChanges(currentTask, errorStatus)
      if (endTimeChanges.statusHistory && err.message) {
        const history = endTimeChanges.statusHistory as any[]
        const closedEntry = history[history.length - 2]
        if (closedEntry && (closedEntry.status === TASK_STATUS.DEVELOPING || closedEntry.status === TASK_STATUS.PLANNING)) {
          closedEntry.result = wasStopped ? \`任务已停止: \${err.message}\` : \`执行异常: \${err.message}\`
        }
      }
      await taskRepo.update(task._id, {
        status: errorStatus,
        reviewFeedback: wasStopped ? '任务已停止' : \`异常: \${err.message}\`,
        logs,
        updatedAt: new Date().toISOString(),
        ...endTimeChanges,
      })

      // 异常情况下的失败通知
      if (
        project.webhookEnabled &&
        project.webhookUrl &&
        project.webhookNotifyOnFailure !== false
      ) {
        const totalSec = endTimeChanges.totalDuration ?? currentTask.totalDuration ?? 0
        const pendingCount = await getProjectPendingCount(taskRepo, task.projectId)
        const failMsg = buildTaskFailedMarkdown({
          projectName: project.name,
          taskTitle: task.title,
          taskId: task._id,
          prompt: task.prompt ?? '',
          error: wasStopped ? '任务已停止' : \`异常: \${err.message}\`,
          durationMs: totalSec * 1000,
          taskUrl: buildTaskUrl(project, task._id),
          pendingCount,
        })
        void sendWecomMessage(project.webhookUrl, failMsg).catch(() => undefined)
      }

      this.emit('task:failed', task._id, err.message)
    }`;
  c = c.substring(0, idx2) + newCatch + c.substring(blockEnd);
  console.log('Replaced catch');
}

// Fix resumeTask
const oldRes = '    const canResume = task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.PLAN_REQUIRED';
c = c.replace(oldRes, '    const canResume = task.status === TASK_STATUS.PENDING || task.status === TASK_STATUS.PLAN_REQUIRED || task.status === TASK_STATUS.STOPPED');
console.log('Replaced resume condition');

const oldBody = `    // 从停止列表中移除
    this.stoppedTaskIds.delete(taskId)

    // 重新加入队列
    this._enqueue(task)`;
const newBody = `    // 如果是 stopped 状态，先恢复为可执行状态
    if (task.status === TASK_STATUS.STOPPED) {
      const resumeStatus = task.isPlan ? TASK_STATUS.PLAN_REQUIRED : TASK_STATUS.PENDING
      await taskRepo.update(taskId, {
        status: resumeStatus,
        reviewFeedback: undefined,
        updatedAt: new Date().toISOString(),
      })
      task = { ...task, status: resumeStatus }
    }

    // 从停止列表中移除
    this.stoppedTaskIds.delete(taskId)

    // 重新加入队列
    this._enqueue(task)`;
c = c.replace(oldBody, newBody);
console.log('Replaced resume body');

fs.writeFileSync(path, c, 'utf-8');
console.log('Done');
