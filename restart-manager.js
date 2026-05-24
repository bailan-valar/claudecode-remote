#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONFIG = {
  checkInterval: 5000, // 检查间隔（毫秒）
  restartDelay: 3000,  // 重启延迟（毫秒）
  maxRestarts: 10,     // 最大重启次数
  taskWatchDirs: [
    path.join(process.cwd(), 'cc-remote-admin'),
    path.join(process.cwd(), 'cc-remote-local'),
    path.join(process.cwd(), 'cc-remote-nick')
  ],
  watchPatterns: [
    'package.json',
    'dist/**/*',
    'out/**/*'
  ]
};

class RestartManager {
  constructor() {
    this.isRunning = false;
    this.restartCount = 0;
    this.devProcess = null;
    this.lastRestartTime = null;
    this.isRestarting = false;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('uncaughtException', (err) => {
      console.error('[RestartManager] Uncaught exception:', err);
      this.shutdown('uncaughtException');
    });
  }

  async start() {
    console.log('[RestartManager] Starting development environment...');
    this.isRunning = true;

    // 启动初始的 npm run dev
    await this.startDevProcess();

    // 开始监控任务状态
    this.startMonitoring();
  }

  async startDevProcess() {
    return new Promise((resolve, reject) => {
      console.log('[RestartManager] Starting npm run dev...');

      this.devProcess = spawn('npm', ['run', 'dev'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: true
      });

      this.devProcess.on('error', (err) => {
        console.error('[RestartManager] Failed to start dev process:', err);
        reject(err);
      });

      this.devProcess.on('exit', (code, signal) => {
        console.log(`[RestartManager] Dev process exited with code ${code}, signal ${signal}`);

        if (!this.isRestarting) {
          console.log('[RestartManager] Unexpected exit, attempting to restart...');
          this.scheduleRestart('unexpected_exit');
        }
      });

      this.devProcess.on('spawn', () => {
        console.log('[RestartManager] Dev process started successfully');
        resolve();
      });
    });
  }

  startMonitoring() {
    console.log('[RestartManager] Starting task monitoring...');

    // 定期检查任务状态
    setInterval(() => {
      this.checkTaskStatus();
    }, CONFIG.checkInterval);

    // 监控文件变化
    this.watchFiles();
  }

  async checkTaskStatus() {
    if (!this.isRunning || this.isRestarting) return;

    try {
      // 这里可以添加检查任务状态的逻辑
      // 例如检查某个状态文件或调用API

      const taskStateFile = path.join(process.cwd(), '.task-state.json');
      if (fs.existsSync(taskStateFile)) {
        const state = JSON.parse(fs.readFileSync(taskStateFile, 'utf-8'));

        if (state.needsRestart) {
          console.log('[RestartManager] Task completion detected, scheduling restart...');
          this.scheduleRestart('task_completion', state.taskIds);

          // 清除状态文件
          fs.unlinkSync(taskStateFile);
        }
      }
    } catch (error) {
      // 忽略错误，继续监控
    }
  }

  watchFiles() {
    console.log('[RestartManager] Starting file watcher...');

    // 使用简单的轮询文件变化检测
    let lastStates = new Map();

    setInterval(async () => {
      for (const dir of CONFIG.taskWatchDirs) {
        if (!fs.existsSync(dir)) continue;

        try {
          const files = this.getAllFiles(dir);
          const currentState = new Map();

          for (const file of files) {
            const stats = fs.statSync(file);
            currentState.set(file, stats.mtime.getTime());
          }

          const previousState = lastStates.get(dir) || new Map();

          // 检查是否有文件变化
          for (const [file, newMtime] of currentState) {
            const oldMtime = previousState.get(file);
            if (oldMtime && newMtime !== oldMtime) {
              // 检查是否匹配监控模式
              if (this.shouldWatchFile(file)) {
                console.log(`[RestartManager] File changed: ${file}`);
                this.scheduleRestart('file_change', [file]);
                return;
              }
            }
          }

          lastStates.set(dir, currentState);
        } catch (error) {
          console.error(`[RestartManager] Error watching directory ${dir}:`, error);
        }
      }
    }, CONFIG.checkInterval);
  }

  getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        arrayOfFiles = this.getAllFiles(filePath, arrayOfFiles);
      } else {
        arrayOfFiles.push(filePath);
      }
    });

    return arrayOfFiles;
  }

  shouldWatchFile(filePath) {
    return CONFIG.watchPatterns.some(pattern => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filePath);
    });
  }

  scheduleRestart(reason, details = []) {
    if (this.isRestarting) return;

    console.log(`[RestartManager] Scheduling restart: ${reason}`);

    // 检查重启次数限制
    if (this.restartCount >= CONFIG.maxRestarts) {
      console.error('[RestartManager] Max restart limit reached, shutting down...');
      this.shutdown('max_restarts');
      return;
    }

    this.isRestarting = true;
    this.lastRestartTime = Date.now();

    setTimeout(() => {
      this.performRestart(reason, details);
    }, CONFIG.restartDelay);
  }

  async performRestart(reason, details) {
    console.log(`[RestartManager] Performing restart: ${reason}`);

    try {
      // 停止当前进程
      if (this.devProcess) {
        console.log('[RestartManager] Stopping current dev process...');
        this.devProcess.kill('SIGTERM');

        // 等待进程退出
        await new Promise(resolve => {
          const timeout = setTimeout(() => {
            console.log('[RestartManager] Force killing process...');
            this.devProcess.kill('SIGKILL');
            resolve();
          }, 5000);

          this.devProcess.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      // 重新启动
      this.restartCount++;
      console.log(`[RestartManager] Restart count: ${this.restartCount}`);

      await this.startDevProcess();

      this.isRestarting = false;

    } catch (error) {
      console.error('[RestartManager] Restart failed:', error);
      this.isRestarting = false;
    }
  }

  shutdown(signal) {
    console.log(`[RestartManager] Shutting down (${signal})...`);

    this.isRunning = false;

    if (this.devProcess) {
      console.log('[RestartManager] Killing dev process...');
      this.devProcess.kill('SIGTERM');
    }

    setTimeout(() => {
      console.log('[RestartManager] Exit');
      process.exit(0);
    }, 2000);
  }
}

// 启动管理器
const manager = new RestartManager();
manager.start().catch(console.error);

module.exports = RestartManager;
