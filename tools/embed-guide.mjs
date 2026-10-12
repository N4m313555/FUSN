// 將 docs/USER-GUIDE.md 嵌入 js/guide.js（window.GUIDE_MD），畀程式入面嘅「使用指南」頁用。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const md = fs.readFileSync(path.join(root, 'docs', 'USER-GUIDE.md'), 'utf8');
fs.writeFileSync(path.join(root, 'js', 'guide.js'), `/* 自動生成：node tools/embed-guide.mjs。使用指南內容（docs/USER-GUIDE.md）。 */\nwindow.GUIDE_MD = ${JSON.stringify(md)};\n`);
console.log('js/guide.js', (md.length / 1024).toFixed(0), 'KB of markdown');
