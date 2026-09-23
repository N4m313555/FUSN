// 將 templates/樓層雜物信範本.docx 以 base64 嵌入 js/debris-template.js，等網頁唔使 fetch 都攞到範本。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const b64 = fs.readFileSync(path.join(root, 'templates', '樓層雜物信範本.docx')).toString('base64');
fs.writeFileSync(path.join(root, 'js', 'debris-template.js'), `/* 自動生成：node tools/embed-template.mjs。樓層雜物信 Word 範本（base64）。 */\nwindow.DEBRIS_TEMPLATE_B64 = '${b64}';\n`);
console.log('js/debris-template.js', (b64.length / 1024).toFixed(0), 'KB');
