// 將範本檔以 base64 嵌入 js/*.js，等網頁唔使 fetch 都攞到範本。
//  - templates/樓層雜物信範本.docx      → js/debris-template.js  (window.DEBRIS_TEMPLATE_B64)
//  - templates/樓層巡查剔格表範本.xlsx  → js/tick-template.js    (window.TICK_TEMPLATE_B64)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const embed = (src, out, name, label) => {
  const b64 = fs.readFileSync(path.join(root, 'templates', src)).toString('base64');
  fs.writeFileSync(path.join(root, 'js', out), `/* 自動生成：node tools/embed-template.mjs。${label}（base64）。 */\nwindow.${name} = '${b64}';\n`);
  console.log('js/' + out, (b64.length / 1024).toFixed(0), 'KB');
};
embed('樓層雜物信範本.docx', 'debris-template.js', 'DEBRIS_TEMPLATE_B64', '樓層雜物信 Word 範本');
embed('樓層巡查剔格表範本.xlsx', 'tick-template.js', 'TICK_TEMPLATE_B64', '樓層巡查剔格表 Excel 範本');
