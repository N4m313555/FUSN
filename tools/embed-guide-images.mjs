// 將 docs/images/*.jpg 以 base64 嵌入 js/guide-images.js，畀程式入面嘅「使用指南」頁用。
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs', 'images');
const map = {};
for (const f of fs.readdirSync(dir).filter((x) => /\.(jpe?g|png)$/i.test(x)).sort()) {
  const ext = /\.png$/i.test(f) ? 'png' : 'jpeg';
  map[f.replace(/\.(jpe?g|png)$/i, '')] = `data:image/${ext};base64,` + fs.readFileSync(path.join(dir, f)).toString('base64');
}
fs.writeFileSync(path.join(root, 'js', 'guide-images.js'), `/* 自動生成：node tools/embed-guide-images.mjs。使用指南截圖（base64）。 */\nwindow.GUIDE_IMAGES = ${JSON.stringify(map)};\n`);
console.log('js/guide-images.js', Object.keys(map).length, 'images', (fs.statSync(path.join(root, 'js', 'guide-images.js')).size / 1024).toFixed(0), 'KB');
