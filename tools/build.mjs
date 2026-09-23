// 將 index.html + css + js 合併成一個獨立 HTML 檔（dist/pmo-workbench.html），
// 方便複製去公司電腦或者用電郵傳送。另外可以輸出畀 claude.ai artifact 用嘅版本（冇 doctype／html／head／body 骨架）。
// 用法：node tools/build.mjs [--artifact 輸出路徑] [--autoseed]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const args = process.argv.slice(2);
const artifactOut = args.includes('--artifact') ? args[args.indexOf('--artifact') + 1] : null;
const autoseed = args.includes('--autoseed');

const html = read('index.html');
const css = read('css/style.css');
const data = read('js/data.js');
const app = read('js/app.js');
// SheetJS 嘅代碼頁表入面有大量 U+FFFD 字元，轉成 \uFFFD 轉義（喺 JS 字串入面意思一樣），方便發佈到唔接受呢個字元嘅平台
const xlsx = read('vendor/xlsx.full.min.js').replace(/\uFFFD/g, '\\uFFFD');
const jszip = read('vendor/jszip.min.js');
const tpl = read('js/debris-template.js');

const title = html.match(/<title>([^<]*)<\/title>/)[1];
const description = html.match(/<meta name="description" content="([^"]*)">/)[1];
const favicon = html.match(/<link rel="icon" href="([^"]*)">/)[1];
const fontLink = html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script src="vendor\/xlsx\.full\.min\.js"><\/script>\s*/, '')
  .replace(/<script src="vendor\/jszip\.min\.js"><\/script>\s*/, '')
  .replace(/<script src="js\/debris-template\.js"><\/script>\s*/, '')
  .replace(/<script src="js\/data\.js"><\/script>\s*/, '')
  .replace(/<script src="js\/app\.js"><\/script>\s*/, '');
const scripts = `<script>\n${xlsx}\n</script>\n<script>\n${jszip}\n</script>\n<script>\n${tpl}\n</script>\n<script>\n${data}\n</script>\n<script>\n${app}\n</script>`;
// --autoseed 只影響 artifact 版本：第一次打開自動載入示範資料，等人一睇就知個系統點運作
const seed = autoseed ? '<script>window.PMO_AUTOSEED = true;</script>\n' : '';

const standalone = `<!DOCTYPE html>
<html lang="zh-Hant-HK">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="icon" href="${favicon}">
${fontLink}
<style>
${css}
</style>
</head>
<body>${body}${scripts}
</body>
</html>
`;
fs.writeFileSync(path.join(root, 'dist', 'pmo-workbench.html'), standalone);
console.log('dist/pmo-workbench.html', (standalone.length / 1024).toFixed(0) + ' KB');

if (artifactOut) {
  const artifact = `<title>${title}</title>
${fontLink}
<style>
html, body { margin: 0; }
${css}
</style>
${body}${seed}${scripts}
`;
  fs.mkdirSync(path.dirname(artifactOut), { recursive: true });
  fs.writeFileSync(artifactOut, artifact);
  console.log(artifactOut, (artifact.length / 1024).toFixed(0) + ' KB');
}
