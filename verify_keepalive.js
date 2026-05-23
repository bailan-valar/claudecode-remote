/**
 * Keep-Alive 功能验证脚本
 * 检查所有必要的文件和配置是否正确
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始验证 Keep-Alive 功能实现...\n');

const checks = [
  {
    name: 'App.vue 集成',
    file: 'src/renderer/src/App.vue',
    check: (content) => {
      return content.includes('keep-alive') && 
             content.includes('include') && 
             content.includes('exclude');
    }
  },
  {
    name: '路由配置',
    file: 'src/renderer/src/router/index.ts',
    check: (content) => {
      return content.includes('keepAlive') && 
             content.includes('cacheName');
    }
  },
  {
    name: '缓存管理器',
    file: 'src/renderer/src/utils/keepAliveManager.ts',
    check: (content) => {
      return content.includes('useKeepAliveManager') && 
             content.includes('getGlobalKeepAliveManager') &&
             content.includes('getCacheStatistics');
    }
  },
  {
    name: '类型定义',
    file: 'src/renderer/src/utils/keepAliveTypes.ts',
    check: (content) => {
      return content.includes('KeepAliveManager') && 
             content.includes('KeepAliveRouteMeta');
    }
  },
  {
    name: 'HomeView 组件名称',
    file: 'src/renderer/src/views/HomeView.vue',
    check: (content) => {
      return content.includes("name: 'HomeView'");
    }
  },
  {
    name: 'ProjectsView 组件名称',
    file: 'src/renderer/src/views/ProjectsView.vue',
    check: (content) => {
      return content.includes("name: 'ProjectsView'");
    }
  },
  {
    name: 'TasksView 组件名称',
    file: 'src/renderer/src/views/TasksView.vue',
    check: (content) => {
      return content.includes("name: 'TasksView'");
    }
  },
  {
    name: 'ProjectDetailView 组件名称',
    file: 'src/renderer/src/views/ProjectDetailView.vue',
    check: (content) => {
      return content.includes("name: 'ProjectDetailView'");
    }
  },
  {
    name: 'TaskDetailView 组件名称',
    file: 'src/renderer/src/views/TaskDetailView.vue',
    check: (content) => {
      return content.includes("name: 'TaskDetailView'");
    }
  },
  {
    name: 'LoginView 组件名称',
    file: 'src/renderer/src/views/LoginView.vue',
    check: (content) => {
      return content.includes("name: 'LoginView'");
    }
  }
];

let passed = 0;
let failed = 0;

checks.forEach(({ name, file, check }) => {
  try {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${name}: 文件不存在 (${file})`);
      failed++;
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    if (check(content)) {
      console.log(`✅ ${name}: 通过`);
      passed++;
    } else {
      console.log(`❌ ${name}: 检查失败 (${file})`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ${name}: 错误 - ${error.message}`);
    failed++;
  }
});

console.log(`\n📊 验证结果: ${passed} 通过, ${failed} 失败`);

if (failed === 0) {
  console.log('\n🎉 所有检查通过！Keep-Alive 功能已正确实现。');
  process.exit(0);
} else {
  console.log('\n⚠️  存在一些问题，请检查上述错误。');
  process.exit(1);
}
