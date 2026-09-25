// 冒煙測試：用 Chromium 開 index.html，行勻每個畫面，睇有冇 JS 錯誤。
// 執行：node tests/smoke.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 先試本地 node_modules，再試全域安裝（PLAYWRIGHT_GLOBAL 可以指定路徑）
const require = createRequire(import.meta.url);
let chromium;
for (const cand of ['playwright', process.env.PLAYWRIGHT_GLOBAL, '/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'].filter(Boolean)) {
  try { ({ chromium } = require(cand)); break; } catch (e) { /* try next */ }
}
if (!chromium) { console.error('搵唔到 playwright：npm i -D playwright，或者設 PLAYWRIGHT_GLOBAL'); process.exit(2); }
const XLSX = require(path.join(root, 'vendor', 'xlsx.full.min.js'));
const JSZip = require(path.join(root, 'vendor', 'jszip.min.js'));
// 合成一個細 Excel 測試檔（格式跟公司嘅投訴登記表、工程項目、信件紀錄）
const fixture = path.join(root, 'tests', 'fixture.xlsx');
{
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['日期', '個案編號', '座數', '提出投訴單位', '負責同事', '反映個案', '投訴方式\n(T/M/L)', '第一次\n跟進日期', '第一次\n跟進進度', '第二次\n跟進日期', '第二次\n跟進進度', '第三次\n跟進日期', '第三次\n跟進進度', '已完成個案 / 後續跟進'],
    [new Date(2026, 0, 19), 'FUS26-005', '善景樓', '3211', 'Karen', '露台天花去水喉附近有水印及跌灰', 'T', new Date(2026, 0, 19), '懷疑樓上單位地台去水位有滲漏', '', '', '', '', '完成'],
    [new Date(2026, 8, 1), 'FUS26-700', '善群樓', '806', 'Ron', '走廊雜物阻塞', 'T', new Date(2026, 8, 2), '已上門傾', '', '', '', '', ''],
    [new Date(2026, 8, 2), 'FUS26-701', '', '', '', '', '', '', '', '', '', '', '', ''],
  ]), '工作表1');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['編號', '事發日期', '過會日期', '單位代號', '樓', '單位', '工程項目', '出標日期', '截標日期', '完工日期', '完工狀態', '工程類別', '座主', '承辦商'],
    [1, new Date(2026, 6, 5), new Date(2026, 6, 17), 'SN2702', '善雅樓', '2702', '善雅樓高層單位(2702室)更換4吋污水喉工程', new Date(2026, 6, 6), new Date(2026, 6, 7), new Date(2026, 6, 14), '', '喉管', 'Naylor', '展業工程公司'],
    [2, new Date(2026, 5, 10), new Date(2026, 6, 17), 'SL2118', '善鄰樓', '2118', '善鄰樓2118室廚房外牆防水工程', new Date(2026, 6, 8), new Date(2026, 6, 10), '', '約期中', '外牆', 'Naylor', '榮豐工程(亞洲)有限公司'],
  ]), '工程項目');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['屋苑文件監控中心'], ['文件總類：屋苑信件 (Site Letter)'], [],
    ['編號', '', '', '', '', '', '日期', '內容', '發件人', '收件人'],
    ['FUSN', '/', '26', '/', 'L', '0001', new Date(2026, 0, 2), '富善邨-邀請出席1月13日咨詢會', 'JOAN', '市建局'],
    ['FUSN', '/', '26', '/', 'L', '0002', new Date(2026, 0, 2), '檢驗修葺工程諮詢會事宜', 'JOAN', 'HAD'],
    ['FUSN', '/', '26', '/', 'L', '0003', '', '', '', ''],
  ]), 'LETTER');
  // 住戶登記表（2026 版式：第一行係座名，第二行先係表頭，每座一個工作表）
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['善群樓'],
    ['單位', '業住', '租戶', '65歲\n以上', '退休\n人士', '獨居\n人士', '姓名(1)', '電話(1)', '姓名(2)', '電話(2)', '緊急聯絡人(1)', '緊急聯絡電話(1)', '緊急聯絡人(2)', '緊急聯絡電話(2)', '備註'],
    ['0204', 'P', '', 'P', '', 'P', '梁慧玲', '9000 0001', '', '', '陳小姐', '9000 0002', '', '', '行動不便'],
    ['0205', '', 'P', '', '', '', '萬桂森', '9000 0003', '太太', '9000 0004', '', '', '', '', ''],
    ['0206', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ]), '善群');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['善鄰樓'],
    ['單位', '業住', '租戶', '65歲\n以上', '退休\n人士', '獨居\n人士', '姓名(1)', '電話(1)', '姓名(2)', '電話(2)', '緊急聯絡人(1)', '緊急聯絡電話(1)', '緊急聯絡人(2)', '緊急聯絡電話(2)', '備註'],
    ['1906', 'P', '', 'P', 'P', 'P', '梁業戶', '9000 0005', '', '', '', '', '', '', ''],
  ]), '善鄰');
  fs.writeFileSync(fixture, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}
const url = 'file://' + path.join(root, 'index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); }); // 網絡資源（例如字型）載入失敗唔算 JS 錯誤
const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };
const go = async (h) => { await page.evaluate((h) => { location.hash = h; }, h); await page.waitForTimeout(80); };
const text = async () => page.locator('#main').innerText();

await page.goto(url);
check((await text()).includes('開始使用'), 'empty state shown');
await page.click('#loadDemo');
await page.waitForTimeout(100);
const st = await page.evaluate(() => window.PMO.state());
check(st.cases.length === 6, 'demo seeded 6 cases');
check((await text()).includes('安全個案'), 'safety banner on today');
check((await text()).includes('應承咗覆命'), 'promised-reply section');

// 個案列表 + 詳情
await go('#/cases');
check((await text()).includes('個案（5）'), 'open cases count 5, got: ' + (await text()).split('\n')[0]);
const seep = st.cases.find((c) => c.type === 'seepage');
await go('#/case/' + seep.id);
let t = await text();
check(t.includes('滲水專區') && t.includes('新程序'), 'seepage panel shows new procedure');
check(t.includes('手段階梯'), 'ladder rendered');
check(t.includes('接觸紀錄（4）'), 'log count');

// 新增紀錄
await page.click('#addLog');
await page.fill('#logForm [name=said]', '「星期四得」');
await page.fill('#logForm [name=outcome]', '同意星期四十點');
await page.click('#logForm button[type=submit]');
await page.waitForTimeout(100);
t = await text();
check(t.includes('接觸紀錄（5）'), 'log added');
check(t.includes('上門次數') && /上門次數\s*3/.test(t.replace(/\n/g, ' ')), 'attempt counted (上門 default channel)');

// 升級對話框
await page.click('#escUp');
await page.waitForTimeout(50);
check(await page.locator('#modal').innerText().then((s) => s.includes('借助第三方')), 'escalate dialog');
await page.fill('#escWhy', '兩次上門有紀錄');
await page.click('#escOk');
await page.waitForTimeout(100);
check((await page.evaluate(() => window.PMO.state().cases.find((c) => c.type === 'seepage').escalation)) === 1, 'escalated to 1');

// 新個案表單
await go('#/cases');
await page.click('#addCase');
await page.fill('#caseForm [name=title]', '測試個案');
await page.selectOption('#caseForm [name=type]', 'noise');
await page.click('#caseForm button[type=submit]');
await page.waitForTimeout(100);
check((await text()).includes('測試個案') && (await text()).includes('噪音'), 'new case created and opened');

// 巡查 → 開個案
await go('#/inspections');
await page.click('#addInsp');
await page.fill('#inspForm [name=block]', '7座');
await page.fill('#inspForm [name=area]', '天台');
await page.fill('#inspForm [name=findings]', '天台門被鎖鏈鎖住');
await page.check('#inspForm [name=safety]');
await page.click('#inspForm button[type=submit]');
await page.waitForTimeout(100);
check((await text()).includes('天台門被鎖鏈鎖住'), 'inspection saved');
await page.click('[data-mkcase]');
await page.waitForTimeout(100);
t = await text();
check(t.includes('安全同法定事項冇酌情') && t.includes('7座'), 'inspection converted to safety case');

// 承辦商工單
const con = st.contractors[0];
await go('#/contractors/' + con.id);
await page.click('#addWo');
await page.fill('#woForm [name=desc]', '測試工單');
await page.click('#woForm button[type=submit]');
await page.waitForTimeout(100);
check((await text()).includes('測試工單'), 'work order added');
check((await text()).includes('超出限期'), 'late orders fact summary');

// 法規導航
await go('#/router');
await page.selectOption('#rPrem', 'ha_rental');
await page.selectOption('#rType', 'seepage');
await page.waitForTimeout(50);
t = await text();
const answer = t.slice(t.indexOf('歸邊條例／邊個部門'), t.indexOf('程序形狀同時限'));
check(answer.includes('房屋署／屋邨辦事處') && !answer.includes('聯合辦事處'), 'HA rental seepage routes to HD, not JO');
await page.selectOption('#rPrem', 'private');
await page.waitForTimeout(50);
check((await text()).includes('28 個曆日'), 'private seepage shows 28-day notice');

// 信件：承辦商警告信 + 掃描
const conCase = st.cases.find((c) => c.type === 'contractor');
await go('#/letters/' + conCase.id);
await page.click('[data-kind=warning]');
await page.waitForTimeout(50);
let body = await page.inputValue('#lBody');
check(body.includes('永固工程有限公司') && body.includes('超出限期'), 'warning letter pulls contractor facts');
check((await page.locator('#lWarn').innerText()).includes('未出過紀錄信') || (await text()).includes('未出過紀錄信'), 'warning gate flags missing record letter');
await page.fill('#lBody', body + '\n貴公司屢勸不聽，本處將盡快跟進。');
await page.waitForTimeout(50);
const warn = await page.locator('#lWarn').innerText();
check(warn.includes('屢勸不聽') && warn.includes('盡快'), 'banned phrase scanner catches words');
await page.click('#lSave');
await page.waitForTimeout(100);
check((await text()).includes('已出信件（1）'), 'letter saved to case');

// 對話準備 / 形勢判斷 / 設定
await go('#/prep/' + seep.id);
check((await text()).includes('上層住戶唔肯開門'), 'prep auto-selects seepage scenario');
await page.click('[data-tab=phrases]');
check((await text()).includes('Accusation Audit'), 'phrasebook tab');
await go('#/review');
check((await text()).includes('個案盤點'), 'review list');
await go('#/review/' + seep.id);
await page.click('[data-sv="0"][data-v="me"]');
await page.waitForTimeout(50);
check((await text()).includes('你贏 1'), 'seven-count updates');
await go('#/settings');
await page.fill('#setForm [name=officerName]', '測試主任');
await page.fill('#setForm [name=licenceNo]', 'PMP-000000');
await page.click('#setForm button[type=submit]');
await page.waitForTimeout(100);
await go('#/letters/' + seep.id);
body = await page.inputValue('#lBody');
check(body.includes('PMP-000000') && body.includes('測試主任'), 'settings feed into letters');

// 設定：套用預設 → 個案編號前綴
await go('#/settings');
await page.click('#presetBtn'); await page.click('#mYes'); await page.waitForTimeout(100);
let st2 = await page.evaluate(() => window.PMO.state().settings);
check(st2.blocks.length === 6 && st2.letterRefPrefix === 'FUSN/26/L' && st2.caseRefPrefix === 'FUS26-', 'estate preset applied');

// 工程項目
await go('#/works');
check((await text()).includes('工程項目（'), 'works list renders');
await page.click('#addWork');
await page.fill('#workForm [name=title]', '測試工程：善翠樓913室客廳外牆防水工程');
await page.fill('#workForm [name=block]', '善翠樓'); await page.fill('#workForm [name=unit]', '913');
await page.selectOption('#workForm [name=status]', '報價已發出');
await page.click('#workForm button[type=submit]'); await page.waitForTimeout(100);
t = await text();
check(t.includes('ST913') && t.includes('報價已發出'), 'work created with unit code ST913');
await page.click('[data-setst="法團投票中"]'); await page.waitForTimeout(80);
check((await text()).includes('狀態：報價已發出 → 法團投票中'), 'work status change logged');

// 樓層雜物：新增 → 出信（自動編號）→ 第二次信 → 批量
await go('#/debris');
const before = await page.evaluate(() => window.PMO.state().settings.letterSeq);
await page.click('#addDebris');
await page.fill('#debrisForm [name=block]', '善群樓'); await page.fill('#debrisForm [name=floor]', '9樓'); await page.fill('#debrisForm [name=unit]', '912');
await page.fill('#debrisForm [name=items]', '鞋櫃一個、紙箱兩個'); await page.check('#debrisForm [name=escape]');
await page.click('#debrisForm button[type=submit]'); await page.waitForTimeout(100);
t = await text();
check(t.includes('SK912') && t.includes('鞋櫃一個'), 'debris entry listed with code SK912');
const dEntry = await page.evaluate(() => window.PMO.state().debris.find((d) => d.unit === '912'));
await go('#/letters/d/' + dEntry.id);
body = await page.inputValue('#lBody');
check(body.includes('有關 業戶佔用公眾地方') && body.includes('善群樓912室') && body.includes('鞋櫃一個、紙箱兩個') && body.includes('2661 1393') && body.includes('P1-091046') && body.includes('富善邨業主立案法團'), 'debris letter follows the office template');
const refShown = await page.inputValue('#lRef');
check(refShown === 'FUSN/26/L' + String(before).padStart(4, '0'), 'letter ref preview uses prefix + seq, got ' + refShown);
await page.click('#lSave'); await page.waitForTimeout(150);
let dAfter = await page.evaluate((id) => window.PMO.state().debris.find((d) => d.id === id), dEntry.id);
check(dAfter.status === '已出第一次信' && dAfter.letter1Ref === refShown, 'first letter recorded on debris entry');
check((await page.evaluate(() => window.PMO.state().settings.letterSeq)) === before + 1, 'letter seq advanced');
await go('#/letters/d/' + dEntry.id);
body = await page.inputValue('#lBody');
check(body.includes('本處已於') && body.includes('惟至今仍未見處理'), 'second notice adds prior-letter sentence');
await go('#/debris');
await page.check('[data-sel="' + dEntry.id + '"]'); await page.click('#batchLetters'); await page.click('#mYes'); await page.waitForTimeout(150);
t = await text();
check(t.includes('雜物信（1 封）') && t.includes('本公司檔號：FUSN/26/L'), 'batch letters page');
dAfter = await page.evaluate((id) => window.PMO.state().debris.find((d) => d.id === id), dEntry.id);
check(dAfter.status === '已出第二次信' && !!dAfter.letter2Ref, 'batch issued second letter');
await go('#/register');
check((await text()).includes(refShown) && (await text()).includes('有關 業戶佔用公眾地方（SK912）'), 'letter register lists issued letters');
await go('#/debris/table');
check((await text()).includes('善群樓 9樓') && (await text()).includes('SK912'), 'printable debris table grouped by block/floor');

// 快速出雜物信：相片 + 座 + 單位 → Word
await go('#/debris');
const jpegB64 = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480; const c = cv.getContext('2d'); c.fillStyle = '#888'; c.fillRect(0, 0, 640, 480); c.fillStyle = '#c33'; c.fillRect(200, 150, 240, 180); return cv.toDataURL('image/jpeg', 0.8).split(',')[1]; });
await page.selectOption('#qBlock', '善群樓');
await page.fill('#qUnit', '2118'); await page.waitForTimeout(50);
t = await page.locator('#qDerived').innerText();
check(t.includes('SK2118') && t.includes('21樓') && t.includes('A翼') && t.includes('第一次通知'), 'quick panel derives floor/wing for SK2118: ' + t);
await page.fill('#qUnit', '707'); await page.waitForTimeout(50);
check((await page.locator('#qDerived').innerText()).includes('7樓 B翼'), 'SK707 derives 7樓 B翼 (01–12 = B翼 below 21/F)');
await page.selectOption('#qBlock', '善景樓'); await page.fill('#qUnit', '1512'); await page.waitForTimeout(50);
check((await page.locator('#qDerived').innerText()).includes('15樓 A翼'), 'SG1512 derives 15樓 A翼');
await page.selectOption('#qBlock', '善群樓'); await page.fill('#qUnit', '2905'); await page.fill('#qItems', '木櫃一個');
await page.setInputFiles('#qPhotos', { name: 'debris.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpegB64, 'base64') });
const seqBefore = await page.evaluate(() => window.PMO.state().settings.letterSeq);
const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#qGo')]);
const docxPath = path.join(root, 'tests', 'out.docx'); await download.saveAs(docxPath);
check(/FUSN26L\d{4}_SK2905\.docx/.test(download.suggestedFilename()), 'docx filename uses ref and unit code: ' + download.suggestedFilename());
{
  const zip = await JSZip.loadAsync(fs.readFileSync(docxPath));
  const doc = await zip.file('word/document.xml').async('string');
  const d = new Date(); const cn = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  const expectRef = 'FUSN/26/L' + String(seqBefore).padStart(4, '0');
  check(doc.includes('本公司檔號：' + expectRef) || doc.includes(expectRef), 'docx carries letter ref ' + expectRef);
  check(doc.includes('善群樓') && doc.includes('2905') && doc.includes('木櫃一個'), 'docx carries block, unit and items');
  check(doc.includes(`<w:t xml:space="preserve">${d.getFullYear()}</w:t>`) && doc.includes(`<w:t xml:space="preserve">${d.getMonth() + 1}</w:t>`), 'docx carries today\'s date');
  check(doc.includes('P1-091046') && doc.includes('吳泰豐') && doc.includes('2661 1393') && doc.includes('富善邨業主立案法團'), 'docx carries signatory, licence, phone, IO');
  check(!/\{\{[A-Z_]+\}\}/.test(doc), 'no unfilled placeholders left');
  check(!!zip.file('word/media/photo1.jpeg') && doc.includes('r:embed="rIdPhoto1"') && doc.includes('<w:drawing>'), 'photo embedded as attachment');
  check(!!zip.file('word/media/image3.jpeg'), 'letterhead image kept');
  const rels = await zip.file('word/_rels/document.xml.rels').async('string');
  check(rels.includes('Target="media/photo1.jpeg"'), 'photo relationship added');
}
fs.unlinkSync(docxPath);
await page.waitForTimeout(200);
const q = await page.evaluate(() => window.PMO.state().debris.find((d) => d.unit === '2905'));
check(q && q.floor === '29樓' && q.wing === 'B翼' && q.status === '已出第一次信' && q.photoCount === 1 && /^FUSN\/26\/L\d{4}$/.test(q.letter1Ref), 'quick letter recorded on debris register with derived floor/wing');
check((await page.evaluate(() => window.PMO.state().letters.slice(-1)[0].debrisId)) === q.id, 'letter register entry links to debris entry');
check((await page.evaluate(async (id) => (await window.PMO.PhotoDB.get(id)).length, q.id)) === 1, 'photo stored in IndexedDB');
// 第二次：同一單位再出 → 第二次通知
await page.selectOption('#qBlock', '善群樓'); await page.fill('#qUnit', '2905'); await page.waitForTimeout(50);
check((await page.locator('#qDerived').innerText()).includes('第二次通知'), 'same unit again is a second notice');

// 樓層雜物表 Excel（用公司剔格表範本填入）
await go('#/debris');
await page.click('#tickXlsx'); await page.waitForTimeout(80);
await page.selectOption('#tickForm [name=scope]', 'all');
const [tickDl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.click('#tickForm button[type=submit]')]);
const tickPath = path.join(root, 'tests', 'out-tick.xlsx'); await tickDl.saveAs(tickPath);
check(/^debris-sheet_\d{4}-\d{2}-\d{2}\.xlsx$/.test(tickDl.suggestedFilename()), 'tick sheet filename: ' + tickDl.suggestedFilename());
{
  const wb2 = XLSX.read(fs.readFileSync(tickPath), { type: 'buffer' });
  check(wb2.SheetNames.join(',') === '總表,善雅樓,善翠樓,善美樓,善景樓,善群樓,善鄰樓', 'template sheets preserved');
  const master = XLSX.utils.sheet_to_json(wb2.Sheets['總表'], { header: 1, raw: true, defval: '' });
  const blk = XLSX.utils.sheet_to_json(wb2.Sheets['善群樓'], { header: 1, raw: true, defval: '' });
  // SK912 = 9樓 B翼 → 總表 第 9 樓行、善群樓 B翼 欄；SK707 = 7樓 B翼
  const row9 = master.find((r) => /^9\s*樓/.test(String(r[0]))); const hdrBlocks = master[4]; const hdrWings = master[5];
  const skCol = hdrBlocks.indexOf('善群樓'); const bCol = hdrWings.findIndex((v, i) => i >= skCol && v === 'B翼');
  check(row9 && String(row9[bCol]).includes('912'), '總表 marks SK912 under 善群樓 B翼 on 9樓: ' + (row9 && row9[bCol]));
  const row7 = master.find((r) => /^7\s*樓/.test(String(r[0])));
  check(row7 && String(row7[bCol]).includes('707'), '總表 marks SK707 on 7樓');
  check(String(master[0][0]).includes('樓層雜物表') && master.some((r) => r.some((v) => /2026年|年/.test(String(v)))), 'title replaced and date filled');
  const b9 = blk.find((r) => /^9\s*樓/.test(String(r[0])));
  check(b9 && String(b9[2]).includes('912') && String(b9[4]).includes('鞋櫃一個') && /L\d{4}/.test(String(b9[4])), '善群樓 sheet has unit in B翼 and remark with items and letter ref: ' + (b9 && b9[4]));
  const sn = XLSX.utils.sheet_to_json(wb2.Sheets['善雅樓'], { header: 1, raw: true, defval: '' });
  check(!sn.slice(5).some((r) => r.slice(1, 4).some((v) => v !== '')), 'other block sheet untouched');
}
fs.unlinkSync(tickPath);

// 樓層巡查剔格表
await go('#/rounds');
check((await text()).includes('樓層巡查剔格表'), 'rounds view');
await page.click('[data-block="善雅樓"]'); await page.waitForTimeout(80);
await page.click('#roundForm button[type=submit]'); await page.waitForTimeout(100);
await page.click('[data-cell="12-A翼"]'); await page.waitForTimeout(80);
check((await page.locator('[data-cell="12-A翼"]').innerText()) === '✓', 'cell cycles to ok');
await page.click('[data-cell="12-A翼"]'); await page.waitForTimeout(80);
check(await page.locator('#debrisForm').count() === 1 && (await page.inputValue('#debrisForm [name=floor]')) === '12樓' && (await page.inputValue('#debrisForm [name=wing]')) === 'A翼', 'debris cell opens prefilled debris form');
await page.click('#mCancel'); await page.waitForTimeout(50);
check((await page.evaluate(() => window.PMO.state().rounds.find((r) => r.block === '善雅樓').cells['12-A翼'])) === 'debris', 'cell state saved');
await go('#/rounds/print');
check((await text()).includes('善雅樓　樓層巡查剔格表') && (await text()).includes('35 樓'), 'printable tick sheet');
await go('#/rounds'); await page.screenshot({ path: path.join(root, 'tests', 'shot-rounds.png') });

// 匯入 Excel
await go('#/import');
await page.setInputFiles('#impFile', fixture); await page.waitForTimeout(500);
await page.selectOption('#impSheet', '工作表1'); await page.waitForTimeout(300);
check((await page.inputValue('#impKind')) === 'cases', 'import auto-detects complaint register');
await page.click('#impGo'); await page.waitForTimeout(150);
let cs = await page.evaluate(() => window.PMO.state().cases);
check(cs.some((c) => c.ref === 'FUS26-005' && c.status === 'closed' && c.type === 'seepage' && c.log.length === 1) && cs.some((c) => c.ref === 'FUS26-700' && c.status === 'open'), 'cases imported with status and log');
check(!cs.some((c) => c.ref === 'FUS26-701'), 'empty formula rows skipped');
await page.selectOption('#impSheet', '工程項目'); await page.waitForTimeout(300);
check((await page.inputValue('#impKind')) === 'works', 'import auto-detects works sheet');
await page.click('#impGo'); await page.waitForTimeout(150);
const ws = await page.evaluate(() => window.PMO.state().works);
check(ws.some((w) => w.unitCode === 'SN2702' && w.status === '完工' && w.doneAt === '2026-07-14') && ws.some((w) => w.unitCode === 'SL2118' && w.status === '約期/工程中'), 'works imported with normalised status');
await page.selectOption('#impSheet', 'LETTER'); await page.waitForTimeout(300);
check((await page.inputValue('#impKind')) === 'letters', 'import auto-detects letter log');
await page.click('#impGo'); await page.waitForTimeout(150);
const ls = await page.evaluate(() => window.PMO.state().letters);
check(ls.some((l) => l.ref === 'FUSN/26/L0001' && l.recipient === '市建局') && !ls.some((l) => l.ref === 'FUSN/26/L0003'), 'letter log imported, blank pre-numbered rows skipped');
await page.selectOption('#impSheet', '工程項目'); await page.waitForTimeout(300); await page.click('#impGo'); await page.waitForTimeout(150);
check((await page.evaluate(() => window.PMO.state().works.filter((w) => w.unitCode === 'SN2702').length)) === 1, 'reimport does not duplicate works');
check((await page.evaluate(() => window.PMO.state().contractors.some((k) => k.name === '展業工程公司') && window.PMO.state().contractors.some((k) => k.name === '榮豐工程(亞洲)有限公司'))), 'works import registers contractors');
// 住戶登記表：偵測 + 一併匯入其他座
await page.selectOption('#impSheet', '善群'); await page.waitForTimeout(300);
check((await page.inputValue('#impKind')) === 'residents', 'import auto-detects resident registry');
check(await page.locator('#impAll').count() === 1 && (await page.isChecked('#impAll')), 'other resident sheets offered and pre-ticked');
await page.click('#impGo'); await page.waitForTimeout(200);
const res = await page.evaluate(() => window.PMO.state().residents);
check(res.length === 3, 'residents imported from both sheets, blank unit skipped: ' + res.length);
const r204 = await page.evaluate(() => window.PMO.residentFor('善群樓', '204'));
check(r204 && r204.owner && !r204.tenant && r204.elderly && r204.alone && r204.people[0].name === '梁慧玲' && r204.emergency[0].name === '陳小姐' && r204.note === '行動不便', 'resident record parsed (owner, flags, people, emergency)');
check((await page.evaluate(() => window.PMO.residentFor('善群樓', '0205'))) && (await page.evaluate(() => window.PMO.residentFor('善群樓', '205').tenant)), 'unit lookup tolerates leading zero and reads tenant flag');
// 單位查詢
await page.fill('#unitSearch', 'SK204'); await page.press('#unitSearch', 'Enter'); await page.waitForTimeout(150);
t = await text();
check(t.includes('SK204') && t.includes('業戶') && t.includes('65歲以上') && t.includes('獨居') && t.includes('梁慧玲') && t.includes('9000 0001') && t.includes('陳小姐'), 'unit view shows owner, age flags, residents and emergency contact');
await page.fill('#unitSearch', '善群樓 205'); await page.press('#unitSearch', 'Enter'); await page.waitForTimeout(150);
t = await text();
check(t.includes('租戶') && t.includes('萬桂森') && t.includes('太太'), 'unit view via Chinese query shows tenant and both residents');
await page.fill('#unitSearch', 'SL1906'); await page.press('#unitSearch', 'Enter'); await page.waitForTimeout(150);
t = await text();
check(t.includes('退休') && t.includes('梁業戶'), 'second sheet block imported');
// 相關紀錄：個案 + 工程按單位連結
await page.fill('#unitSearch', 'SL2118'); await page.press('#unitSearch', 'Enter'); await page.waitForTimeout(150);
t = await text();
check(t.includes('善鄰樓2118室廚房外牆防水工程') && t.includes('相關紀錄（'), 'unit view lists linked works');
await page.fill('#unitSearch', 'SG3211'); await page.press('#unitSearch', 'Enter'); await page.waitForTimeout(150);
t = await text();
check(t.includes('FUS26-005') && t.includes('露台天花去水喉'), 'unit view lists linked cases by unit');
await page.screenshot({ path: path.join(root, 'tests', 'shot-unit.png') });
await go('#/today');
check((await text()).includes('樓層雜物') && (await text()).includes('工程項目'), 'today shows works and debris sections');
await page.screenshot({ path: path.join(root, 'tests', 'shot-today.png'), fullPage: true });
await go('#/works'); await page.screenshot({ path: path.join(root, 'tests', 'shot-works.png') });
await go('#/debris'); await page.screenshot({ path: path.join(root, 'tests', 'shot-debris.png') });

// 手機闊度
await page.setViewportSize({ width: 390, height: 800 });
await go('#/today');
await page.waitForTimeout(400); // 等側欄滑走嘅過渡動畫
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
check(!overflow, 'no horizontal overflow at phone width');
await page.screenshot({ path: path.join(root, 'tests', 'shot-mobile.png') });
await page.click('#menuBtn'); await page.waitForTimeout(300);
check(await page.locator('#sidebar').evaluate((el) => el.classList.contains('open') && el.getBoundingClientRect().left === 0), 'mobile menu opens');
await page.screenshot({ path: path.join(root, 'tests', 'shot-mobile-menu.png') });
await page.click('#sidebar a[data-route=cases]'); await page.waitForTimeout(100);
check(!(await page.locator('#sidebar').evaluate((el) => el.classList.contains('open'))), 'mobile menu closes after navigation');
await page.setViewportSize({ width: 1280, height: 900 });
await go('#/case/' + seep.id);
await page.screenshot({ path: path.join(root, 'tests', 'shot-case.png'), fullPage: true });

await browser.close();
if (!process.env.KEEP_FIXTURE) { try { fs.unlinkSync(fixture); } catch (e) { /* ignore */ } }
if (errors.length) { console.log('JS errors:\n' + errors.join('\n')); }
if (failures.length) { console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('smoke ok');
