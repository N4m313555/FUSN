// 冒煙測試：用 Chromium 開 index.html，行勻每個畫面，睇有冇 JS 錯誤。
// 執行：node tests/smoke.mjs
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// 先試本地 node_modules，再試全域安裝（PLAYWRIGHT_GLOBAL 可以指定路徑）
const require = createRequire(import.meta.url);
let chromium;
for (const cand of ['playwright', process.env.PLAYWRIGHT_GLOBAL, '/opt/node22/lib/node_modules/playwright', '/usr/lib/node_modules/playwright', '/usr/local/lib/node_modules/playwright'].filter(Boolean)) {
  try { ({ chromium } = require(cand)); break; } catch (e) { /* try next */ }
}
if (!chromium) { console.error('搵唔到 playwright：npm i -D playwright，或者設 PLAYWRIGHT_GLOBAL'); process.exit(2); }
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
if (errors.length) { console.log('JS errors:\n' + errors.join('\n')); }
if (failures.length) { console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('smoke ok');
