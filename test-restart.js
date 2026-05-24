#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('[Test] Restart Functionality Test');
console.log('==================================');

// 测试1: 检查重启管理器是否存在
console.log('\n[Test 1] Checking restart manager...');
const restartManagerPath = path.join(__dirname, 'src/main/utils/restartManager.ts');
if (fs.existsSync(restartManagerPath)) {
  console.log('✅ Restart manager found');
} else {
  console.log('❌ Restart manager not found');
}

// 测试2: 检查配置文件
console.log('\n[Test 2] Checking configuration file...');
const configPath = path.join(__dirname, 'restart.config.json');
if (fs.existsSync(configPath)) {
  console.log('✅ Configuration file found');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log('   Auto restart enabled:', config.restart.autoRestartOnTaskComplete);
  console.log('   Restart delay:', config.restart.restartDelay, 'ms');
} else {
  console.log('❌ Configuration file not found');
}

// 测试3: 检查外部监控脚本
console.log('\n[Test 3] Checking external monitor script...');
const monitorPath = path.join(__dirname, 'restart-manager.js');
if (fs.existsSync(monitorPath)) {
  console.log('✅ External monitor script found');
} else {
  console.log('❌ External monitor script not found');
}

// 测试4: 检查IPC集成
console.log('\n[Test 4] Checking IPC integration...');
const ipcPath = path.join(__dirname, 'src/main/ipc.ts');
if (fs.existsSync(ipcPath)) {
  const ipcContent = fs.readFileSync(ipcPath, 'utf-8');
  const hasRestartHandler = ipcContent.includes('system:restart');
  console.log('✅ IPC file found, restart handler:', hasRestartHandler ? 'added' : 'not added');
} else {
  console.log('❌ IPC file not found');
}

// 测试5: 检查Web API集成
console.log('\n[Test 5] Checking Web API integration...');
const webServerPath = path.join(__dirname, 'src/main/webServer.ts');
if (fs.existsSync(webServerPath)) {
  const webContent = fs.readFileSync(webServerPath, 'utf-8');
  const hasRestartAPI = webContent.includes('/api/system/restart');
  console.log('✅ Web server file found, restart API:', hasRestartAPI ? 'added' : 'not added');
} else {
  console.log('❌ Web server file not found');
}

// 测试6: 创建模拟任务完成状态
console.log('\n[Test 6] Creating simulated task completion...');
const taskStatePath = path.join(__dirname, '.task-state.json');
try {
  const taskState = {
    needsRestart: true,
    taskIds: ['test-task-1', 'test-task-2'],
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(taskStatePath, JSON.stringify(taskState, null, 2));
  console.log('✅ Task state file created for testing');
  console.log('   Run "npm run dev:watch" to test the restart functionality');
} catch (error) {
  console.log('❌ Failed to create task state file:', error.message);
}

// 测试7: 检查package.json脚本
console.log('\n[Test 7] Checking package.json scripts...');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  const scripts = packageJson.scripts || {};
  
  console.log('Available restart-related scripts:');
  Object.keys(scripts)
    .filter(key => key.includes('dev') || key.includes('restart'))
    .forEach(key => {
      console.log(`   ${key}: ${scripts[key]}`);
    });
} else {
  console.log('❌ package.json not found');
}

console.log('\n==================================');
console.log('[Test] Test completed!');
console.log('\nNext steps:');
console.log('1. Review the RESTART_GUIDE.md for detailed usage');
console.log('2. Adjust restart.config.json to your needs');
console.log('3. Test with: npm run dev (auto-restart) or npm run dev:watch (external monitor)');
console.log('4. Monitor logs for [RestartManager] messages');
