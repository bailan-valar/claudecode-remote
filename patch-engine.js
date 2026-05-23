const fs = require('fs');
const path = 'src/main/engine/taskEngine.ts';
let content = fs.readFileSync(path, 'utf-8');

const oldElse = '        // 如果是被停止的任务，提供更清晰的错误信息';
if (content.includes(oldElse)) {
  console.log('found marker');
}
