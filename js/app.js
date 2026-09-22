/* 物管日常工作台 —— 主程式。純前端，資料存喺 localStorage。 */
(function () {
  'use strict';
  const R = window.REF;
  const STORE_KEY = 'pmo.workbench.v1';

  // ---------- 工具 ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoDate(new Date());
  const parseDate = (s) => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
  const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const addWorkingDays = (s, n) => { const d = parseDate(s); let c = 0; while (c < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) c++; } return isoDate(d); };
  const fmtDate = (s) => s ? s.replace(/-/g, '/') : '—';
  const cnDate = (s) => { const d = parseDate(s || today()); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; };
  const nowStamp = () => { const d = new Date(); return `${isoDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2200); }
  function openModal(html) { $('#modal').innerHTML = html; $('#modalBackdrop').classList.remove('hidden'); const f = $('#modal input, #modal select, #modal textarea'); if (f) f.focus(); }
  function closeModal() { $('#modalBackdrop').classList.add('hidden'); $('#modal').innerHTML = ''; }
  function confirmDialog(msg, onYes) {
    openModal(`<h2>確認</h2><p>${esc(msg)}</p><div class="btn-row"><button class="btn danger" id="mYes">確定</button><button class="btn" id="mNo">取消</button></div>`);
    $('#mYes').onclick = () => { closeModal(); onYes(); }; $('#mNo').onclick = closeModal;
  }
  function formData(form) { const o = {}; new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); $$('input[type=checkbox]', form).forEach((c) => { o[c.name] = c.checked; }); return o; }
  const opt = (obj, sel, labelKey = 'label') => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(typeof v === 'string' ? v : v[labelKey])}</option>`).join('');

  // ---------- 狀態 ----------
  const blank = () => ({ version: 1, settings: { officerName: '', licenceNo: '', estate: '', office: '', phone: '', email: '', theme: 'auto' }, cases: [], contractors: [], inspections: [], letters: [], seq: 1 });
  let S = blank();
  function load() { try { const raw = localStorage.getItem(STORE_KEY); if (raw) S = Object.assign(blank(), JSON.parse(raw)); } catch (e) { console.warn('load failed', e); } applyTheme(); }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { toast('儲存失敗：瀏覽器儲存空間可能已滿或被封鎖'); } }
  function applyTheme() { const t = S.settings.theme || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
  const caseById = (id) => S.cases.find((c) => c.id === id);
  const contractorById = (id) => S.contractors.find((c) => c.id === id);
  const STATUS = { open: '跟進中', waiting: '等第三方', escalated: '已升級', closed: '已結案' };
  const CHANNELS = ['上門', '電話', '櫃檯', '書面', 'WhatsApp／短訊', '會議', '巡查'];

  function newCase(partial) {
    const ref = `C${String(S.seq++).padStart(4, '0')}`;
    return Object.assign({ id: uid(), ref, title: '', type: 'other', premises: 'private', block: '', unit: '', complainant: '', complainantContact: '', respondent: '', respondentContact: '', contractorId: '', openedAt: today(), status: 'open', escalation: 0, nextAction: '', nextDue: '', promisedReplyBy: '', notes: '', safety: false, vulnerable: false, prep: { goal: '', bottom: '', batna: '', theirBatna: '', interest: '' }, seven: {}, five: {}, triage: '', triageReason: '', log: [], lastProgressAt: today(), closedAt: '', closedReason: '', attempts: 0, seepage: { moisture: '', noticeAt: '', complaintAt: '' }, angerNote: '' }, partial || {});
  }
  const isSafety = (c) => c.safety || (R.CASE_TYPES[c.type] && R.CASE_TYPES[c.type].safety);
  const isOpen = (c) => c.status !== 'closed';
  const stalledDays = (c) => daysBetween(c.lastProgressAt || c.openedAt, today());

  // ---------- 示範資料 ----------
  function seedDemo() {
    const t = today();
    const con = { id: uid(), name: '永固工程有限公司', contact: '陳生', phone: '9123 4567', contract: '2026 年度水電維修合約', slaDays: 3, notes: '', orders: [
      { id: uid(), desc: '3座 12樓 走廊水喉漏水', issuedAt: addDays(t, -12), dueAt: addDays(t, -9), doneAt: addDays(t, -7), status: 'done' },
      { id: uid(), desc: '5座 地下 大堂燈掣', issuedAt: addDays(t, -10), dueAt: addDays(t, -7), doneAt: '', status: 'open' },
      { id: uid(), desc: '2座 天台 排水渠淤塞', issuedAt: addDays(t, -4), dueAt: addDays(t, -1), doneAt: '', status: 'open' },
    ] };
    S.contractors.push(con);
    const c1 = newCase({ title: '3座 15樓 天花滲水（樓上 16樓）', type: 'seepage', premises: 'private', block: '3座', unit: '15樓 A室', complainant: '李太', complainantContact: '6xxx xxxx', respondent: '16樓 A室 陳生', openedAt: addDays(t, -34), escalation: 0, nextAction: '第三次上門，約咗星期四朝早十點', nextDue: addDays(t, 2), promisedReplyBy: addDays(t, 1), attempts: 2, lastProgressAt: addDays(t, -6), seepage: { moisture: '48', noticeAt: '', complaintAt: addDays(t, -34) },
      prep: { goal: '陳生星期四畀我哋入去望廁所同露台，半個鐘', bottom: '如果第三次都唔得，記錄後轉上級行正式程序', batna: '書面通知＋轉介聯辦處', theirBatna: '拒絕 → 聯辦處程序，可申請手令入屋', interest: '驚查出露台改動；驚要賠' },
      log: [
        { at: addDays(t, -34) + ' 10:20', channel: '電話', party: '李太', said: '天花滴水兩星期，朝早明顯', outcome: '開案，同日上去睇', next: '上 16 樓' },
        { at: addDays(t, -30) + ' 15:00', channel: '上門', party: '16樓 陳生', said: '「唔關我事，你哋自己搞掂佢」', outcome: '冇入到，有應門', next: '再約' },
        { at: addDays(t, -14) + ' 11:00', channel: '上門', party: '16樓 陳生', said: '「上次都係咁講」；問清楚後係驚露台改動被查', outcome: '答應考慮星期四', next: '星期四十點' },
        { at: addDays(t, -6) + ' 09:30', channel: '電話', party: '李太', said: '問進度', outcome: '應承星期五前覆，有冇結果都覆', next: '覆李太' },
      ] });
    const c2 = newCase({ title: '5座 8樓 走廊雜物阻塞', type: 'obstruction', premises: 'ha_rental', block: '5座', unit: '8樓 F室', complainant: '同層住戶', respondent: '陳婆婆', openedAt: addDays(t, -20), nextAction: '星期一上去望一望有冇搬返入去', nextDue: addDays(t, -1), vulnerable: true, lastProgressAt: addDays(t, -8),
      log: [{ at: addDays(t, -20) + ' 14:00', channel: '巡查', party: '—', said: '走廊有三個紙箱同一張摺凳，未阻走火通道', outcome: '拍照，分類為觀感問題', next: '上門傾' }, { at: addDays(t, -8) + ' 16:00', channel: '上門', party: '陳婆婆', said: '「冇地方放」；獨居，行動不便', outcome: '同意留摺凳，紙箱清潔隊幫手搬', next: '星期日前搬' }] });
    const c3 = newCase({ title: '2座 地下 商舖裝修噪音超時', type: 'renovation', premises: 'commercial', block: '2座', unit: '地下 3號舖', complainant: '2座 1樓 多戶', respondent: '祥記茶餐廳（裝修承辦商）', openedAt: addDays(t, -75), status: 'open', escalation: 1, nextAction: '', nextDue: '', lastProgressAt: addDays(t, -65),
      log: [{ at: addDays(t, -75) + ' 20:30', channel: '電話', party: '1樓 住戶', said: '晚上八點半仍然鑽牆', outcome: '即時上去叫停', next: '通知承辦商' }, { at: addDays(t, -65) + ' 10:00', channel: '書面', party: '承辦商', said: '—', outcome: '出咗提示信', next: '' }] });
    const c4 = newCase({ title: '1座 3樓 走火通道被單車阻塞', type: 'escape', premises: 'private', block: '1座', unit: '3樓 樓梯', complainant: '保安', respondent: '3樓 C室', openedAt: t, nextAction: '即時清走，通知住戶', nextDue: t, lastProgressAt: t, log: [] });
    const c5 = newCase({ title: '承辦商三單工單超時', type: 'contractor', premises: 'private', block: '—', unit: '—', complainant: '本處', respondent: '永固工程有限公司', contractorId: con.id, openedAt: addDays(t, -9), escalation: 0, nextAction: '口頭傾完出紀錄信', nextDue: t, lastProgressAt: addDays(t, -2), log: [{ at: addDays(t, -2) + ' 15:00', channel: '電話', party: '陳生', said: '「人手唔夠，下星期補返」', outcome: '應承星期五前補返兩單', next: '紀錄信' }] });
    const c6 = newCase({ title: '6座 10樓 裝修按金扣減爭拗', type: 'fee', premises: 'private', block: '6座', unit: '10樓 B室', complainant: '黃先生', openedAt: addDays(t, -40), status: 'closed', closedAt: addDays(t, -5), closedReason: '已提供逐項明細，住戶接受分期', lastProgressAt: addDays(t, -5), log: [] });
    S.cases.push(c1, c2, c3, c4, c5, c6);
    S.demo = true;
    S.inspections.push({ id: uid(), at: addDays(t, -1), block: '1座', area: '地下大堂、3樓樓梯', findings: '3樓樓梯有單車阻塞走火通道', safety: true, caseId: c4.id }, { id: uid(), at: t, block: '4座', area: '天台、水錶房', findings: '無異常', safety: false, caseId: '' });
    save();
  }

  // ---------- 路由 ----------
  const TITLES = { today: '今日', cases: '個案', inspections: '巡查紀錄', contractors: '承辦商', router: '法規導航', letters: '信件草擬', prep: '對話準備', review: '形勢判斷', settings: '設定／備份' };
  function route() {
    const hash = location.hash.replace(/^#\/?/, '') || 'today';
    const [name, arg] = hash.split('/');
    $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    $('#topbarTitle').textContent = TITLES[name] || '';
    $('#sidebar').classList.remove('open');
    $('#brandEstate').textContent = S.settings.estate || '未設定屋邨';
    const view = VIEWS[name] || VIEWS.today;
    $('#main').innerHTML = '';
    view(arg);
    window.scrollTo(0, 0);
  }
  const VIEWS = {};

  // ---------- 今日 ----------
  VIEWS.today = function () {
    const t = today();
    const open = S.cases.filter(isOpen);
    const safety = open.filter(isSafety);
    const overdue = open.filter((c) => c.nextDue && c.nextDue < t);
    const dueToday = open.filter((c) => c.nextDue === t);
    const promised = open.filter((c) => c.promisedReplyBy && c.promisedReplyBy <= t);
    const stalled = open.filter((c) => !isSafety(c) && stalledDays(c) >= 60);
    const soon = open.filter((c) => c.nextDue && c.nextDue > t && daysBetween(t, c.nextDue) <= 7);
    const woOverdue = S.contractors.flatMap((k) => k.orders.filter((o) => o.status !== 'done' && o.dueAt && o.dueAt < t).map((o) => ({ k, o })));

    let html = `<h1>${cnDate(t)}</h1>`;
    if (S.demo) html += `<div class="banner info"><strong>而家顯示嘅係示範資料</strong>個案、承辦商、巡查紀錄全部係虛構例子。開始真正使用之前，去「設定」按「清除全部資料」。</div>`;
    if (!S.cases.length) html += `<div class="banner info"><strong>開始使用</strong>未有個案。可以先去「設定」填姓名、牌照號碼同屋邨名稱，或者<a href="#" id="loadDemo">載入示範資料</a>睇下個系統點運作。</div>`;
    if (safety.length) html += `<div class="banner danger"><strong>安全個案：${safety.length} 宗——即時處理，唔入酌情計算</strong>${safety.map((c) => `<a href="#/case/${c.id}">${esc(c.ref)} ${esc(c.title)}</a>`).join('、')}</div>`;
    html += `<div class="grid cols-4" style="margin-bottom:16px">
      <div class="stat danger" data-go="overdue"><div class="n">${overdue.length}</div><div class="l">逾期跟進</div></div>
      <div class="stat warn" data-go="promised"><div class="n">${promised.length}</div><div class="l">應承咗覆嘅（到期）</div></div>
      <div class="stat accent" data-go="today"><div class="n">${dueToday.length}</div><div class="l">今日要做</div></div>
      <div class="stat" data-go="stalled"><div class="n">${stalled.length}</div><div class="l">兩個月冇進展</div></div>
    </div>`;
    const section = (id, title, arr, note) => `<div class="card" id="sec-${id}"><div class="card-head"><h3>${title}</h3>${note ? `<span class="muted small">${note}</span>` : ''}</div>${arr.length ? `<div class="list">${arr.map(caseItem).join('')}</div>` : '<div class="empty">冇</div>'}</div>`;
    html += section('promised', '應承咗覆命', promised, '投訴人最記得嘅唔係你幾快解決，係你有冇主動覆返佢。就算冇進展都覆。');
    html += section('overdue', '逾期跟進', overdue);
    html += section('today', '今日到期', dueToday);
    if (woOverdue.length) html += `<div class="card"><div class="card-head"><h3>承辦商工單超時</h3></div><div class="list">${woOverdue.map(({ k, o }) => `<div class="item overdue" data-href="#/contractors/${k.id}"><div class="body"><div class="title">${esc(o.desc)}</div><div class="meta"><span>${esc(k.name)}</span><span>限期 ${fmtDate(o.dueAt)}（超 ${daysBetween(o.dueAt, t)} 日）</span></div></div></div>`).join('')}</div></div>`;
    html += section('stalled', '連續兩個月冇實質進展——要決定升級定結案', stalled, '唔升級又唔結案，每個月出一封同樣嘅信，係純損耗。去「形勢判斷」盤點。');
    html += section('soon', '未來七日', soon);
    $('#main').innerHTML = html;
    const ld = $('#loadDemo'); if (ld) ld.onclick = (e) => { e.preventDefault(); seedDemo(); route(); toast('已載入示範資料'); };
    $$('.stat').forEach((s) => s.onclick = () => { const el = $('#sec-' + s.dataset.go); if (el) el.scrollIntoView({ behavior: 'smooth' }); });
    bindItems();
  };

  function caseItem(c) {
    const t = today();
    const cls = isSafety(c) ? 'safety' : (c.nextDue && c.nextDue < t) ? 'overdue' : (c.nextDue === t) ? 'due' : '';
    const ct = R.CASE_TYPES[c.type] || R.CASE_TYPES.other;
    return `<div class="item ${cls}" data-href="#/case/${c.id}"><div>${ct.icon}</div><div class="body"><div class="title">${esc(c.ref)} · ${esc(c.title || '（未命名）')}</div><div class="meta"><span>${esc(ct.label)}</span><span>${esc(c.block)} ${esc(c.unit)}</span>${c.nextAction ? `<span>下一步：${esc(c.nextAction)}</span>` : ''}${c.nextDue ? `<span>期限 ${fmtDate(c.nextDue)}</span>` : ''}${c.promisedReplyBy ? `<span>應承 ${fmtDate(c.promisedReplyBy)} 前覆</span>` : ''}<span class="tag ${c.status === 'closed' ? '' : 'accent'}">${STATUS[c.status]}</span></div></div></div>`;
  }
  function bindItems() { $$('[data-href]').forEach((el) => el.onclick = () => { location.hash = el.dataset.href; }); }

  // ---------- 個案列表 ----------
  let caseFilter = { q: '', type: '', status: 'openOnly', premises: '' };
  VIEWS.cases = function () {
    const f = caseFilter;
    let list = S.cases.slice();
    if (f.status === 'openOnly') list = list.filter(isOpen); else if (f.status) list = list.filter((c) => c.status === f.status);
    if (f.type) list = list.filter((c) => c.type === f.type);
    if (f.premises) list = list.filter((c) => c.premises === f.premises);
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter((c) => [c.ref, c.title, c.block, c.unit, c.complainant, c.respondent, c.notes].join(' ').toLowerCase().includes(q)); }
    list.sort((a, b) => (isSafety(b) - isSafety(a)) || ((a.nextDue || '9') > (b.nextDue || '9') ? 1 : -1));
    $('#main').innerHTML = `<div class="card-head"><h1>個案（${list.length}）</h1><button class="btn primary" id="addCase">新個案</button></div>
      <div class="filters"><input id="fq" placeholder="搜尋編號、座、單位、人名…" value="${esc(f.q)}">
      <select id="ft"><option value="">全部類型</option>${opt(R.CASE_TYPES, f.type)}</select>
      <select id="fp"><option value="">全部處所</option>${opt(R.PREMISES, f.premises)}</select>
      <select id="fs"><option value="openOnly" ${f.status === 'openOnly' ? 'selected' : ''}>未結案</option><option value="" ${f.status === '' ? 'selected' : ''}>全部</option>${opt(STATUS, f.status)}</select></div>
      ${list.length ? `<div class="list">${list.map(caseItem).join('')}</div>` : '<div class="empty">冇符合嘅個案</div>'}`;
    $('#addCase').onclick = () => caseForm();
    $('#fq').oninput = (e) => { caseFilter.q = e.target.value; VIEWS.cases(); $('#fq').focus(); $('#fq').setSelectionRange(99, 99); };
    $('#ft').onchange = (e) => { caseFilter.type = e.target.value; VIEWS.cases(); };
    $('#fp').onchange = (e) => { caseFilter.premises = e.target.value; VIEWS.cases(); };
    $('#fs').onchange = (e) => { caseFilter.status = e.target.value; VIEWS.cases(); };
    bindItems();
  };

  function caseForm(existing, presets) {
    const c = existing || newCase(presets);
    openModal(`<h2>${existing ? '編輯個案' : '新個案'}</h2><form id="caseForm">
      <div class="row full"><div><label>標題</label><input name="title" value="${esc(c.title)}" placeholder="例：3座 15樓 天花滲水（樓上 16樓）" required></div></div>
      <div class="row"><div><label>類型</label><select name="type">${opt(R.CASE_TYPES, c.type)}</select></div>
      <div><label>處所類型（決定晒之後所有嘢）</label><select name="premises">${opt(R.PREMISES, c.premises)}</select></div></div>
      <div class="row"><div><label>座</label><input name="block" value="${esc(c.block)}"></div><div><label>樓層／單位／位置</label><input name="unit" value="${esc(c.unit)}"></div><div><label>開立日期</label><input type="date" name="openedAt" value="${esc(c.openedAt)}"></div></div>
      <div class="row"><div><label>投訴人</label><input name="complainant" value="${esc(c.complainant)}"></div><div><label>投訴人聯絡</label><input name="complainantContact" value="${esc(c.complainantContact)}"></div></div>
      <div class="row"><div><label>被投訴方／對方</label><input name="respondent" value="${esc(c.respondent)}"></div><div><label>對方聯絡</label><input name="respondentContact" value="${esc(c.respondentContact)}"></div></div>
      <div class="row"><div><label>相關承辦商</label><select name="contractorId"><option value="">—</option>${S.contractors.map((k) => `<option value="${k.id}" ${k.id === c.contractorId ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></div><div><label>狀態</label><select name="status">${opt(STATUS, c.status)}</select></div></div>
      <div class="row"><div><label>下一步</label><input name="nextAction" value="${esc(c.nextAction)}" placeholder="邊個、做咩"></div><div><label>下一步期限</label><input type="date" name="nextDue" value="${esc(c.nextDue)}"></div><div><label>應承咗幾時覆投訴人</label><input type="date" name="promisedReplyBy" value="${esc(c.promisedReplyBy)}"></div></div>
      <div class="row"><label class="check"><input type="checkbox" name="safety" ${c.safety ? 'checked' : ''}> 涉及安全（走火通道、消防、結構）——即時處理</label><label class="check"><input type="checkbox" name="vulnerable" ${c.vulnerable ? 'checked' : ''}> 涉及弱勢住戶——要轉介支援</label></div>
      <div class="row full"><div><label>備註</label><textarea name="notes">${esc(c.notes)}</textarea></div></div>
      <div class="btn-row"><button class="btn primary" type="submit">儲存</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`);
    $('#mCancel').onclick = closeModal;
    $('#caseForm').onsubmit = (e) => {
      e.preventDefault(); const d = formData(e.target);
      Object.assign(c, d);
      if (!existing) S.cases.push(c);
      if (existing && d.status === 'closed' && !c.closedAt) c.closedAt = today();
      save(); closeModal(); location.hash = '#/case/' + c.id; if (location.hash === '#/case/' + c.id) route(); toast('已儲存');
    };
  }

  // ---------- 個案詳情 ----------
  VIEWS.case = function (id) {
    const c = caseById(id); if (!c) { $('#main').innerHTML = '<div class="empty">搵唔到個案</div>'; return; }
    const t = today(); const ct = R.CASE_TYPES[c.type]; const pm = R.PREMISES[c.premises];
    const routeInfo = findRoute(c.type, c.premises);
    const k = c.contractorId ? contractorById(c.contractorId) : null;
    let html = `<div class="card-head"><div><div class="muted small">${esc(c.ref)} · ${esc(ct.label)} · ${esc(pm.label)}</div><h1>${esc(c.title)}</h1></div>
      <div class="btn-row no-print"><button class="btn" id="editCase">編輯</button><a class="btn" href="#/letters/${c.id}">出信</a><a class="btn" href="#/prep/${c.id}">準備對話</a><a class="btn" href="#/review/${c.id}">判斷</a>${isOpen(c) ? `<button class="btn" id="closeCase">結案</button>` : `<button class="btn" id="reopenCase">重開</button>`}<button class="btn danger ghost" id="delCase">刪除</button></div></div>`;
    if (isSafety(c)) html += `<div class="banner danger"><strong>安全同法定事項冇酌情</strong>走火通道、消防設備、結構危險——即時處理、記錄、上報。唔好攞去做「值唔值得」嘅計算。</div>`;
    if (c.vulnerable) html += `<div class="banner warn"><strong>涉及弱勢住戶</strong>除咗程序之外要轉介支援（房署社區服務隊、社工、長者支援）。目標係搞掂件事同轉介，唔係贏一場對話。</div>`;
    if (isOpen(c) && !isSafety(c) && stalledDays(c) >= 60) html += `<div class="banner warn"><strong>已經 ${stalledDays(c)} 日冇實質進展</strong>再拖三個月會唔會變好？會（等緊報告／工程）→ 定死檢查點。唔會 → 而家決定升級定結案。<a href="#/review/${c.id}">去判斷</a></div>`;
    if (c.promisedReplyBy && c.promisedReplyBy <= t && isOpen(c)) html += `<div class="banner warn"><strong>應承咗 ${fmtDate(c.promisedReplyBy)} 前覆投訴人</strong>就算未有結果都要覆。一次 miss 咗你講嘅死線，之後所有嘢都唔會信你。</div>`;

    html += `<div class="grid cols-2"><div>`;
    html += `<div class="card"><h3>基本資料</h3><dl class="kv">
      <dt>位置</dt><dd>${esc(c.block)} ${esc(c.unit)}</dd>
      <dt>投訴人</dt><dd>${esc(c.complainant) || '—'} ${c.complainantContact ? '· ' + esc(c.complainantContact) : ''}</dd>
      <dt>對方</dt><dd>${esc(c.respondent) || '—'} ${c.respondentContact ? '· ' + esc(c.respondentContact) : ''}</dd>
      ${k ? `<dt>承辦商</dt><dd><a href="#/contractors/${k.id}">${esc(k.name)}</a></dd>` : ''}
      <dt>開立</dt><dd>${fmtDate(c.openedAt)}（${daysBetween(c.openedAt, t)} 日）</dd>
      <dt>狀態</dt><dd><span class="tag accent">${STATUS[c.status]}</span> ${c.closedAt ? '結案 ' + fmtDate(c.closedAt) + '：' + esc(c.closedReason) : ''}</dd>
      <dt>下一步</dt><dd>${esc(c.nextAction) || '—'} ${c.nextDue ? `<span class="tag ${c.nextDue < t ? 'danger' : c.nextDue === t ? 'warn' : ''}">${fmtDate(c.nextDue)}</span>` : ''}</dd>
      <dt>應承覆</dt><dd>${c.promisedReplyBy ? fmtDate(c.promisedReplyBy) : '—'}</dd>
      <dt>上門次數</dt><dd>${c.attempts || 0}${c.type === 'seepage' && (c.attempts || 0) >= 2 ? ' <span class="tag warn">兩至三次有紀錄後轉程序</span>' : ''}</dd>
      </dl>${c.notes ? `<p class="small" style="margin-top:8px;white-space:pre-wrap">${esc(c.notes)}</p>` : ''}</div>`;

    // 手段階梯
    html += `<div class="card"><div class="card-head"><h3>手段階梯</h3><span class="muted small">冇試過上一層，唔好跳去下一層</span></div><div class="ladder">${R.LADDER.map((l) => `<div class="rung ${l.level === c.escalation ? 'current' : ''}" data-lvl="${l.level}"><div class="lvl">${l.level}</div><div><strong>${l.name}</strong> <span class="muted small">${l.classic} · 代價${l.cost}</span><div class="small">${l.desc}</div></div></div>`).join('')}</div>
      <div class="btn-row no-print" style="margin-top:8px">${c.escalation < 3 ? `<button class="btn small" id="escUp">升一級 →</button>` : ''}${c.escalation > 0 ? `<button class="btn small ghost" id="escDown">← 降一級</button>` : ''}</div></div>`;

    // 滲水專區
    if (c.type === 'seepage') html += seepagePanel(c);

    html += `</div><div>`;
    // 法規
    if (routeInfo) html += `<div class="card"><div class="card-head"><h3>歸邊度</h3><a href="#/router" class="small">詳細</a></div><dl class="kv"><dt>條例</dt><dd>${esc(routeInfo.ordinance)}</dd><dt>部門</dt><dd>${esc(routeInfo.dept)}</dd><dt>你嘅角色</dt><dd>${esc(routeInfo.role)}</dd></dl><p class="small muted" style="margin-top:8px">要核實：${routeInfo.verify.map(esc).join('；')}</p></div>`;
    // 目標／底線
    html += `<div class="card"><div class="card-head"><h3>目標 / 底線 / 傾唔掂點算</h3><button class="btn small no-print" id="editPrep">編輯</button></div><dl class="kv">
      <dt>目標</dt><dd>${esc(c.prep.goal) || '<span class="muted">未定——要具體到邊個、做咩、幾時</span>'}</dd>
      <dt>底線</dt><dd>${esc(c.prep.bottom) || '<span class="muted">低過呢條就轉程序</span>'}</dd>
      <dt>我嘅 BATNA</dt><dd>${esc(c.prep.batna) || '<span class="muted">傾唔掂我下一步係咩？答唔到就唔應該開始傾</span>'}</dd>
      <dt>對方 BATNA</dt><dd>${esc(c.prep.theirBatna) || '<span class="muted">佢傾唔掂會點？</span>'}</dd>
      <dt>對方利益</dt><dd>${esc(c.prep.interest) || '<span class="muted">立場係佢話要咩；利益係佢點解要</span>'}</dd></dl></div>`;
    html += `</div></div>`;

    // 紀錄
    html += `<div class="card"><div class="card-head"><h3>接觸紀錄（${c.log.length}）</h3><button class="btn primary small no-print" id="addLog">記一筆</button></div>
      <p class="small muted">每次接觸都要記：日期時間、渠道、邊個、對方原話、結果、下一步。記事實，唔記情緒——「對方表示不滿並要求即時處理」，唔係「對方情緒激動」。</p>
      ${c.log.length ? `<ul class="timeline">${c.log.slice().reverse().map((l, i) => `<li><div class="when">${esc(l.at)} · ${esc(l.channel)} · ${esc(l.party)}</div><div class="what">${l.said ? '對方：' + esc(l.said) + '\n' : ''}${l.outcome ? '結果：' + esc(l.outcome) : ''}${l.next ? '\n下一步：' + esc(l.next) : ''}</div><button class="btn small ghost no-print" data-dellog="${c.log.length - 1 - i}">刪</button></li>`).join('')}</ul>` : '<div class="empty">未有紀錄</div>'}</div>`;

    // 信件
    const letters = S.letters.filter((l) => l.caseId === c.id);
    if (letters.length) html += `<div class="card"><h3>已出信件（${letters.length}）</h3><div class="list">${letters.slice().reverse().map((l) => `<div class="item" data-href="#/letters/${c.id}/${l.id}"><div class="body"><div class="title">${esc(R.LETTER_KINDS[l.kind].label)}</div><div class="meta"><span>${esc(l.createdAt)}</span></div></div></div>`).join('')}</div></div>`;

    $('#main').innerHTML = html;
    $('#editCase').onclick = () => caseForm(c);
    const cc = $('#closeCase'); if (cc) cc.onclick = () => closeCaseDialog(c);
    const rc = $('#reopenCase'); if (rc) rc.onclick = () => { c.status = 'open'; c.closedAt = ''; c.lastProgressAt = today(); save(); route(); };
    $('#delCase').onclick = () => confirmDialog(`刪除 ${c.ref}？呢個動作唔可以復原。`, () => { S.cases = S.cases.filter((x) => x.id !== c.id); S.letters = S.letters.filter((l) => l.caseId !== c.id); save(); location.hash = '#/cases'; });
    const up = $('#escUp'); if (up) up.onclick = () => escalateDialog(c);
    const dn = $('#escDown'); if (dn) dn.onclick = () => { c.escalation--; save(); route(); };
    $('#editPrep').onclick = () => prepForm(c);
    $('#addLog').onclick = () => logForm(c);
    $$('[data-dellog]').forEach((b) => b.onclick = () => confirmDialog('刪除呢筆紀錄？', () => { c.log.splice(Number(b.dataset.dellog), 1); save(); route(); }));
    bindItems();
    bindSeepage(c);
  };

  function findRoute(type, premises) { return R.ROUTES.find((r) => r.type === type && r.premises === premises) || R.ROUTES.find((r) => r.type === type && r.premises === null) || null; }

  function seepagePanel(c) {
    const sp = c.seepage || {}; const t = today();
    const isNew = c.premises === 'private' && c.openedAt >= R.SEEPAGE_NEW_PROCEDURE_DATE;
    let html = `<div class="card"><div class="card-head"><h3>滲水專區</h3><span class="tag ${isNew ? 'accent' : 'warn'}">${c.premises !== 'private' ? '非私人樓宇——唔行聯辦處' : isNew ? '2026/7/16 起新程序' : '舊程序（開立日期早過 2026/7/16）'}</span></div>`;
    if (c.premises === 'private') {
      html += `<div class="row"><div><label>濕度讀數（%）</label><input id="spMoist" value="${esc(sp.moisture)}" placeholder="35 以下聯辦處唔會調查"></div><div><label>聯辦處收到舉報日期</label><input type="date" id="spComplaint" value="${esc(sp.complaintAt)}"></div><div><label>建議維修通知發出日期</label><input type="date" id="spNotice" value="${esc(sp.noticeAt)}"></div></div>`;
      const rows = [];
      if (sp.moisture !== '' && Number(sp.moisture) < 35) rows.push(['濕度低於 35%', '聯辦處一般唔會調查或會暫停跟進——先靠本處協調']);
      if (sp.complaintAt) rows.push(['聯辦處聯絡舉報人（6 個工作天）', `約 ${fmtDate(addWorkingDays(sp.complaintAt, 6))} 前`]);
      if (sp.complaintAt && isNew) rows.push(['簡單個案發通知（約 14 個工作天）', `約 ${fmtDate(addWorkingDays(sp.complaintAt, 14))} 前`]);
      if (sp.noticeAt && isNew) { const dl = addDays(sp.noticeAt, 28); rows.push(['28 個曆日維修期屆滿', `${fmtDate(dl)}${dl < t ? ' <span class="tag danger">已過——滲水持續就入第二、三階段</span>' : `（尚餘 ${daysBetween(t, dl)} 日）`}`]); }
      if (rows.length) html += `<dl class="kv">${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`;
      html += `<p class="small muted" style="margin-top:8px">工作天計算只跳過星期六日，未扣公眾假期。所有時限用之前向 waterseepage.gov.hk 核實。${isNew ? '' : '<strong>舊個案唔好用新程序嘅時限去答住戶。</strong>'}</p>`;
    } else {
      html += `<p class="small">${esc(R.PREMISES[c.premises].seepage)}</p>`;
    }
    html += `</div>`;
    return html;
  }
  function bindSeepage(c) {
    const m = $('#spMoist'); if (!m) return;
    const upd = () => { c.seepage = { moisture: $('#spMoist').value.trim(), complaintAt: $('#spComplaint').value, noticeAt: $('#spNotice').value }; save(); route(); };
    ['#spMoist', '#spComplaint', '#spNotice'].forEach((s) => { $(s).onchange = upd; });
  }

  function logForm(c) {
    openModal(`<h2>記一筆接觸</h2><form id="logForm">
      <div class="row"><div><label>日期時間</label><input name="at" value="${nowStamp()}"></div><div><label>渠道</label><select name="channel">${CHANNELS.map((x) => `<option>${x}</option>`).join('')}</select></div><div><label>對方係邊個</label><input name="party" value="${esc(c.respondent || c.complainant)}"></div></div>
      <div class="row full"><div><label>對方原話（記事實，唔記情緒）</label><textarea name="said" placeholder="「唔關我事，你哋自己搞掂佢啦。」"></textarea></div></div>
      <div class="row full"><div><label>結果</label><input name="outcome" placeholder="有應門但冇入到；答應考慮星期四"></div></div>
      <div class="row"><div><label>下一步</label><input name="next" value="${esc(c.nextAction)}"></div><div><label>下一步期限</label><input type="date" name="nextDue" value="${esc(c.nextDue)}"></div><div><label>應承幾時覆投訴人</label><input type="date" name="promisedReplyBy" value="${esc(c.promisedReplyBy)}"></div></div>
      <div class="row"><label class="check"><input type="checkbox" name="attempt" ${c.type === 'seepage' ? 'checked' : ''}> 呢次係上門嘗試（計入次數）</label><label class="check"><input type="checkbox" name="progress" checked> 算係實質進展</label></div>
      <div class="help">傾到大家舒服但冇結論，等於冇傾過。收尾要定死：邊個、做咩、幾時、點覆。口頭傾成嘅嘢，即日出紀錄信。</div>
      <div class="btn-row" style="margin-top:10px"><button class="btn primary" type="submit">儲存</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`);
    $('#mCancel').onclick = closeModal;
    $('#logForm').onsubmit = (e) => {
      e.preventDefault(); const d = formData(e.target);
      c.log.push({ at: d.at, channel: d.channel, party: d.party, said: d.said, outcome: d.outcome, next: d.next });
      c.nextAction = d.next; c.nextDue = d.nextDue; c.promisedReplyBy = d.promisedReplyBy;
      if (d.attempt && d.channel === '上門') c.attempts = (c.attempts || 0) + 1;
      if (d.progress) c.lastProgressAt = today();
      save(); closeModal(); route(); toast('已記錄。記得即日出紀錄信。');
    };
  }
  function prepForm(c) {
    const p = c.prep;
    openModal(`<h2>目標 / 底線 / BATNA</h2><form id="prepForm">
      <div class="row full"><div><label>目標（具體到邊個、做咩、幾時）</label><input name="goal" value="${esc(p.goal)}"></div></div>
      <div class="row full"><div><label>底線（低過呢條就唔好傾落去，轉程序）</label><input name="bottom" value="${esc(p.bottom)}"></div></div>
      <div class="row full"><div><label>我傾唔掂會點（BATNA）</label><input name="batna" value="${esc(p.batna)}"><div class="help">你知道自己傾唔掂之後有咩做，你就唔會慌；你唔慌，對方就迫你唔到。</div></div></div>
      <div class="row full"><div><label>對方傾唔掂會點</label><input name="theirBatna" value="${esc(p.theirBatna)}"><div class="help">如果佢嘅最差情況根本唔差，佢就冇動力。</div></div></div>
      <div class="row full"><div><label>對方真正嘅利益（唔係佢講嗰樣）</label><input name="interest" value="${esc(p.interest)}"><div class="help">驚僭建被查？驚認咗要賠？屋企有老人？憎上次嗰個職員？唔知之前，任何方案都係亂估。</div></div></div>
      <div class="btn-row"><button class="btn primary" type="submit">儲存</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`);
    $('#mCancel').onclick = closeModal;
    $('#prepForm').onsubmit = (e) => { e.preventDefault(); Object.assign(c.prep, formData(e.target)); save(); closeModal(); route(); };
  }
  function escalateDialog(c) {
    const next = R.LADDER[c.escalation + 1];
    const losses = Object.values(c.seven || {}).filter((v) => v === 'them').length;
    openModal(`<h2>升級到「${next.name}」？</h2>
      <p class="small">${esc(next.desc)}</p>
      ${losses >= 3 ? `<div class="banner danger"><strong>七計對比你輸咗 ${losses} 項</strong>輸三條或以上，唔好行強硬路線。先去「形勢判斷」睇返。</div>` : ''}
      ${c.escalation === 0 && c.log.length < 2 ? `<div class="banner warn"><strong>紀錄上得 ${c.log.length} 次接觸</strong>紀錄上見到你跳步，對方可以話你冇畀機會佢改善。</div>` : ''}
      ${next.level >= 2 ? `<div class="card flat"><h4>嬲住唔好開戰——出信之前答三條</h4>${R.ANGER_CHECK.map((q, i) => `<label class="check"><input type="checkbox" class="angerQ" data-i="${i}"> ${esc(q)}</label>`).join('')}<div class="help">有一條答「係」，擺埋聽日。怒可以復喜，但你嬲住做落嘅決定唔會自己消失。</div></div>` : ''}
      <div class="row full"><div><label>點解升級（寫入紀錄）</label><input id="escWhy" placeholder="兩次上門有紀錄，對方明確拒絕；樓下滲水持續"></div></div>
      <div class="btn-row"><button class="btn primary" id="escOk">確定升級</button><button class="btn" id="mCancel">取消</button></div>`);
    $('#mCancel').onclick = closeModal;
    $('#escOk').onclick = () => {
      const why = $('#escWhy').value.trim();
      const apply = () => {
        c.escalation++; c.lastProgressAt = today(); if (c.status === 'open' && c.escalation >= 2) c.status = 'escalated';
        c.log.push({ at: nowStamp(), channel: '書面', party: '本處', said: '', outcome: `升級至「${next.name}」：${why}`, next: '' });
        save(); closeModal(); route();
      };
      const angry = $$('.angerQ').some((x) => x.checked);
      if (angry) confirmDialog('你剔咗「嬲住」嘅選項。真係要今日升級？建議隔一晚。', apply); else apply();
    };
  }
  function closeCaseDialog(c) {
    openModal(`<h2>結案 ${esc(c.ref)}</h2><p class="small">「結案」唔等於唔記錄。決定唔推，都要書面記低點解唔推、幾時再睇。否則三年後有人問起，你企唔住。</p>
      <form id="closeForm"><div class="row full"><div><label>結案原因</label><textarea name="closedReason" required placeholder="已修復；／投訴人確認冇再滲；／決定唔再推：對方唔郁而本處冇新籌碼，三個月後（日期）再睇"></textarea></div></div>
      <div class="btn-row"><button class="btn primary" type="submit">結案</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`);
    $('#mCancel').onclick = closeModal;
    $('#closeForm').onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); c.status = 'closed'; c.closedAt = today(); c.closedReason = d.closedReason; c.nextDue = ''; c.promisedReplyBy = ''; save(); closeModal(); route(); };
  }

  // ---------- 巡查 ----------
  VIEWS.inspections = function () {
    const list = S.inspections.slice().sort((a, b) => (a.at < b.at ? 1 : -1));
    $('#main').innerHTML = `<div class="card-head"><h1>巡查紀錄</h1><button class="btn primary" id="addInsp">記錄巡查</button></div>
      <p class="muted small">見到苗頭就先處理，唔好等住戶投訴先反應。有問題嘅發現可以一鍵開個案。</p>
      ${list.length ? `<div class="table-wrap"><table><thead><tr><th>日期</th><th>座</th><th>範圍</th><th>發現</th><th>安全</th><th>個案</th><th></th></tr></thead><tbody>${list.map((i) => `<tr><td>${fmtDate(i.at)}</td><td>${esc(i.block)}</td><td>${esc(i.area)}</td><td>${esc(i.findings)}</td><td>${i.safety ? '<span class="tag danger">安全</span>' : ''}</td><td>${i.caseId ? `<a href="#/case/${i.caseId}">${esc((caseById(i.caseId) || {}).ref || '')}</a>` : (i.findings && i.findings !== '無異常' ? `<button class="btn small" data-mkcase="${i.id}">開個案</button>` : '')}</td><td><button class="btn small ghost" data-delinsp="${i.id}">刪</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">未有巡查紀錄</div>'}`;
    $('#addInsp').onclick = () => {
      openModal(`<h2>記錄巡查</h2><form id="inspForm">
      <div class="row"><div><label>日期</label><input type="date" name="at" value="${today()}"></div><div><label>座</label><input name="block"></div><div><label>範圍</label><input name="area" placeholder="地下大堂、天台、樓梯"></div></div>
      <div class="row full"><div><label>發現</label><textarea name="findings" placeholder="無異常／或者具體寫：3樓樓梯有單車阻塞走火通道"></textarea></div></div>
      <div class="row"><label class="check"><input type="checkbox" name="safety"> 涉及安全（走火通道、消防、結構）</label></div>
      <div class="btn-row"><button class="btn primary" type="submit">儲存</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`);
      $('#mCancel').onclick = closeModal;
      $('#inspForm').onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); S.inspections.push({ id: uid(), at: d.at, block: d.block, area: d.area, findings: d.findings || '無異常', safety: d.safety, caseId: '' }); save(); closeModal(); route(); };
    };
    $$('[data-mkcase]').forEach((b) => b.onclick = () => { const i = S.inspections.find((x) => x.id === b.dataset.mkcase); const c = newCase({ title: `${i.block} ${i.area}：${i.findings}`.slice(0, 60), type: i.safety ? 'escape' : 'other', block: i.block, unit: i.area, safety: i.safety, complainant: '巡查', nextAction: i.safety ? '即時處理' : '', nextDue: i.safety ? today() : '', log: [{ at: i.at + ' 巡查', channel: '巡查', party: '—', said: '', outcome: i.findings, next: '' }] }); S.cases.push(c); i.caseId = c.id; save(); location.hash = '#/case/' + c.id; });
    $$('[data-delinsp]').forEach((b) => b.onclick = () => confirmDialog('刪除呢筆巡查紀錄？', () => { S.inspections = S.inspections.filter((x) => x.id !== b.dataset.delinsp); save(); route(); }));
  };

  // ---------- 承辦商 ----------
  VIEWS.contractors = function (id) {
    if (id) return contractorDetail(id);
    const t = today();
    $('#main').innerHTML = `<div class="card-head"><h1>承辦商</h1><button class="btn primary" id="addCon">新承辦商</button></div>
      <p class="muted small">合約 SLA 係客觀標準——「我哋一齊睇下份合約點寫」。超時次數係你出紀錄信、警告信嘅事實基礎。</p>
      ${S.contractors.length ? `<div class="list">${S.contractors.map((k) => { const open = k.orders.filter((o) => o.status !== 'done'); const late = open.filter((o) => o.dueAt && o.dueAt < t).length; const lateEver = k.orders.filter((o) => o.dueAt && ((o.doneAt && o.doneAt > o.dueAt) || (!o.doneAt && o.dueAt < t))).length; return `<div class="item ${late ? 'overdue' : ''}" data-href="#/contractors/${k.id}"><div class="body"><div class="title">${esc(k.name)}</div><div class="meta"><span>${esc(k.contract)}</span><span>SLA ${k.slaDays} 日</span><span>未完成 ${open.length}</span>${late ? `<span class="tag danger">超時 ${late}</span>` : ''}<span>累計超時 ${lateEver}／${k.orders.length}</span></div></div></div>`; }).join('')}</div>` : '<div class="empty">未有承辦商</div>'}`;
    $('#addCon').onclick = () => contractorForm();
    bindItems();
  };
  function contractorForm(existing) {
    const k = existing || { id: uid(), name: '', contact: '', phone: '', contract: '', slaDays: 3, notes: '', orders: [] };
    openModal(`<h2>${existing ? '編輯' : '新'}承辦商</h2><form id="conForm">
      <div class="row full"><div><label>公司名稱</label><input name="name" value="${esc(k.name)}" required></div></div>
      <div class="row"><div><label>聯絡人</label><input name="contact" value="${esc(k.contact)}"></div><div><label>電話</label><input name="phone" value="${esc(k.phone)}"></div></div>
      <div class="row"><div><label>合約</label><input name="contract" value="${esc(k.contract)}"></div><div><label>SLA 到場／完成日數</label><input type="number" name="slaDays" value="${k.slaDays}" min="0"></div></div>
      <div class="row full"><div><label>備註（條款、罰則）</label><textarea name="notes">${esc(k.notes)}</textarea></div></div>
      <div class="btn-row"><button class="btn primary" type="submit">儲存</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`);
    $('#mCancel').onclick = closeModal;
    $('#conForm').onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); d.slaDays = Number(d.slaDays) || 0; Object.assign(k, d); if (!existing) S.contractors.push(k); save(); closeModal(); location.hash = '#/contractors/' + k.id; route(); };
  }
  function contractorDetail(id) {
    const k = contractorById(id); if (!k) { $('#main').innerHTML = '<div class="empty">搵唔到</div>'; return; }
    const t = today();
    const orders = k.orders.slice().sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
    const late = k.orders.filter((o) => o.dueAt && ((o.doneAt && o.doneAt > o.dueAt) || (!o.doneAt && o.dueAt < t)));
    const cases = S.cases.filter((c) => c.contractorId === k.id);
    $('#main').innerHTML = `<div class="card-head"><div><div class="muted small">承辦商</div><h1>${esc(k.name)}</h1></div><div class="btn-row"><button class="btn" id="editCon">編輯</button><button class="btn" id="mkCase">開承辦商個案</button><button class="btn danger ghost" id="delCon">刪除</button></div></div>
      <div class="grid cols-2"><div class="card"><h3>資料</h3><dl class="kv"><dt>聯絡</dt><dd>${esc(k.contact)} ${esc(k.phone)}</dd><dt>合約</dt><dd>${esc(k.contract)}</dd><dt>SLA</dt><dd>${k.slaDays} 日</dd></dl>${k.notes ? `<p class="small" style="white-space:pre-wrap;margin-top:8px">${esc(k.notes)}</p>` : ''}</div>
      <div class="card"><h3>事實摘要（可以直接放入信）</h3><p class="small">${late.length ? `合約訂明 ${k.slaDays} 日內完成。以下 ${late.length} 宗工單超出限期：<br>${late.map((o) => `・${fmtDate(o.issuedAt)} 發出「${esc(o.desc)}」，限期 ${fmtDate(o.dueAt)}，${o.doneAt ? `於 ${fmtDate(o.doneAt)} 完成（遲 ${daysBetween(o.dueAt, o.doneAt)} 日）` : `至今未完成（已超 ${daysBetween(o.dueAt, t)} 日）`}`).join('<br>')}` : '暫時冇超時工單。'}</p><p class="tiny muted">呢段係事實，冇形容詞。「你哋成日走數」係推論；「三單入面兩單超時」係事實。</p></div></div>
      <div class="card"><div class="card-head"><h3>工單（${k.orders.length}）</h3><button class="btn primary small" id="addWo">新工單</button></div>
      ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>發出</th><th>內容</th><th>限期</th><th>完成</th><th>狀態</th><th></th></tr></thead><tbody>${orders.map((o) => { const isLate = o.dueAt && ((o.doneAt && o.doneAt > o.dueAt) || (!o.doneAt && o.dueAt < t)); return `<tr><td>${fmtDate(o.issuedAt)}</td><td>${esc(o.desc)}</td><td>${fmtDate(o.dueAt)}</td><td>${fmtDate(o.doneAt)}</td><td>${o.status === 'done' ? `<span class="tag ${isLate ? 'warn' : 'ok'}">${isLate ? '遲完成' : '完成'}</span>` : isLate ? '<span class="tag danger">超時</span>' : '<span class="tag accent">進行中</span>'}</td><td class="btn-row">${o.status !== 'done' ? `<button class="btn small" data-done="${o.id}">完成</button>` : ''}<button class="btn small ghost" data-delwo="${o.id}">刪</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">未有工單</div>'}</div>
      ${cases.length ? `<div class="card"><h3>相關個案</h3><div class="list">${cases.map(caseItem).join('')}</div></div>` : ''}`;
    $('#editCon').onclick = () => contractorForm(k);
    $('#delCon').onclick = () => confirmDialog('刪除呢個承辦商同全部工單？', () => { S.contractors = S.contractors.filter((x) => x.id !== k.id); save(); location.hash = '#/contractors'; });
    $('#mkCase').onclick = () => caseForm(null, { title: `${k.name}：工單超時`, type: 'contractor', respondent: k.name, respondentContact: k.phone, contractorId: k.id, complainant: '本處' });
    $('#addWo').onclick = () => {
      openModal(`<h2>新工單</h2><form id="woForm"><div class="row full"><div><label>內容</label><input name="desc" required></div></div><div class="row"><div><label>發出日期</label><input type="date" name="issuedAt" value="${today()}" id="woIssued"></div><div><label>限期</label><input type="date" name="dueAt" value="${addDays(today(), k.slaDays)}" id="woDue"></div></div><div class="btn-row"><button class="btn primary" type="submit">儲存</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`);
      $('#mCancel').onclick = closeModal;
      $('#woIssued').onchange = (e) => { $('#woDue').value = addDays(e.target.value, k.slaDays); };
      $('#woForm').onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); k.orders.push({ id: uid(), desc: d.desc, issuedAt: d.issuedAt, dueAt: d.dueAt, doneAt: '', status: 'open' }); save(); closeModal(); route(); };
    };
    $$('[data-done]').forEach((b) => b.onclick = () => { const o = k.orders.find((x) => x.id === b.dataset.done); o.status = 'done'; o.doneAt = today(); save(); route(); });
    $$('[data-delwo]').forEach((b) => b.onclick = () => { k.orders = k.orders.filter((x) => x.id !== b.dataset.delwo); save(); route(); });
    bindItems();
  }

  // ---------- 法規導航 ----------
  let routerSel = { type: 'seepage', premises: '' };
  VIEWS.router = function () {
    const r = routerSel.premises ? findRoute(routerSel.type, routerSel.premises) : null;
    $('#main').innerHTML = `<h1>法規導航</h1><p class="muted small">呢度係導航，唔係權威。條例、程序同時限會改。任何具體數字、時限、費用、表格，行動之前一定要向原始來源核實。唔係法律意見——涉及檢控、租約終止、索償、紀律程序，要問法律部門或上級。</p>
      <div class="card"><h3>第一個問題：呢個處所屬邊種？</h3><p class="small">呢條問題決定晒之後所有嘢，而且係最易搞錯嗰條。未答到之前，唔好講任何條例。同一條邨可以同時有幾種。</p>
      <div class="row"><div><label>處所類型</label><select id="rPrem"><option value="">— 未確定（先問清楚，唔好估）—</option>${opt(R.PREMISES, routerSel.premises)}</select></div><div><label>個案類型</label><select id="rType">${opt(R.CASE_TYPES, routerSel.type)}</select></div></div>
      ${routerSel.premises ? `<p class="small"><strong>${esc(R.PREMISES[routerSel.premises].label)}</strong>：${esc(R.PREMISES[routerSel.premises].regime)}</p>` : ''}</div>
      ${r ? `<div class="grid cols-2"><div class="card"><h3>歸邊條例／邊個部門</h3><dl class="kv"><dt>條例</dt><dd>${esc(r.ordinance)}</dd><dt>部門</dt><dd>${esc(r.dept)}</dd></dl><h4 style="margin-top:12px">你有咩權限、冇咩權限</h4><p class="small">${esc(r.role)}</p>${r.related.length ? `<h4>相關轉介</h4><ul class="small">${r.related.map((x) => `<li>${esc(x.when)} → ${esc(x.ordinance)}，${esc(x.dept)}</li>`).join('')}</ul>` : ''}</div>
      <div class="card"><h3>程序形狀同時限</h3><ol class="small">${r.procedure.map((p) => `<li>${esc(p)}</li>`).join('')}</ol><div class="banner warn" style="margin-top:8px"><strong>要核實</strong><ul class="warnlist small">${r.verify.map((v) => `<li>${esc(v)}</li>`).join('')}</ul></div></div></div>` : '<div class="empty">揀咗處所類型先有答案</div>'}
      <div class="grid cols-2"><div class="card"><h3>個案 → 歸邊度（總表）</h3><div class="table-wrap"><table><thead><tr><th>個案</th><th>主要條例</th><th>部門</th></tr></thead><tbody>${R.ROUTES.filter((x) => x.premises === null || x.premises === 'private').map((x) => `<tr><td>${esc(R.CASE_TYPES[x.type].label)}${x.premises ? '（私人）' : ''}</td><td class="small">${esc(x.ordinance)}</td><td class="small">${esc(x.dept)}</td></tr>`).join('')}</tbody></table></div></div>
      <div><div class="card"><h3>你自己嘅牌照責任（第626章）</h3><p class="small">${esc(R.LICENCE_NOTE)}</p>${S.settings.licenceNo ? `<p class="small">你嘅牌照號碼：<strong>${esc(S.settings.licenceNo)}</strong>（信件會自動加）</p>` : '<p class="small muted">未喺設定填牌照號碼。</p>'}</div>
      <div class="card"><h3>查證來源</h3><ul class="small">${R.SOURCES.map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.name)}</a> — ${esc(s.note)}</li>`).join('')}</ul><p class="tiny muted">房委會租住單位嘅事以房署內部通函、租約條款同屋邨管理指引為準。呢個系統唔覆蓋內部程序。</p></div></div></div>`;
    $('#rPrem').onchange = (e) => { routerSel.premises = e.target.value; VIEWS.router(); };
    $('#rType').onchange = (e) => { routerSel.type = e.target.value; VIEWS.router(); };
  };

  // ---------- 信件草擬 ----------
  VIEWS.letters = function (arg) {
    const caseId = arg || ''; const letterId = location.hash.split('/')[3] || '';
    const c = caseId ? caseById(caseId) : null;
    const existing = letterId ? S.letters.find((l) => l.id === letterId) : null;
    const st = S.settings;
    let kind = existing ? existing.kind : (c ? suggestLetterKind(c) : 'reply');
    let useExisting = !!existing;
    const render = () => {
      const K = R.LETTER_KINDS[kind];
      const gate = c && kind === 'warning' ? warningGate(c) : '';
      $('#main').innerHTML = `<div class="card-head no-print"><h1>信件草擬${c ? ` · ${esc(c.ref)}` : ''}</h1><div class="btn-row"><select id="lCase" style="width:auto"><option value="">— 唔連結個案 —</option>${S.cases.filter(isOpen).map((x) => `<option value="${x.id}" ${c && x.id === c.id ? 'selected' : ''}>${esc(x.ref)} ${esc(x.title)}</option>`).join('')}</select></div></div>
        <div class="tabs no-print">${Object.entries(R.LETTER_KINDS).map(([k, v]) => `<button class="${k === kind ? 'active' : ''}" data-kind="${k}">${v.label}</button>`).join('')}</div>
        <div class="grid cols-2 no-print"><div class="card flat"><h4>呢封信要攞咩</h4><p class="small">${esc(K.purpose)}</p><h4>次序（最常見嘅錯係由第三段開始寫）</h4><ol class="small">${K.order.map((o) => `<li>${esc(o)}</li>`).join('')}</ol></div>
        <div class="card flat"><h4>先諗清楚</h4><p class="small">要對方配合 → 軟、短，重點喺對方嘅好處同下一步，唔好列條款。<br>要紀錄／留底 → 硬、具體，日期時間齊，列條款。<br><strong>兩樣都要 → 分兩封。</strong>一封又想合作又想留底，通常兩樣都做唔到。</p>${!st.licenceNo && !st.officerName ? '<p class="small muted">去「設定」填姓名同牌照號碼，信尾會自動加。</p>' : ''}</div></div>
        ${gate}
        <div class="card"><div class="card-head no-print"><h3>草稿</h3><div class="btn-row"><button class="btn small" id="lGen">用範本重新生成</button><button class="btn small" id="lCopy">複製</button><button class="btn small" id="lPrint">列印</button><button class="btn primary small" id="lSave">儲存到個案</button></div></div>
        <textarea class="letter" id="lBody"></textarea><div class="print-letter" id="lPrintBody" style="display:none"></div>
        <div id="lWarn" style="margin-top:10px"></div></div>`;
      const gen = () => { const ctx = letterContext(c, kind); $('#lBody').value = useExisting && existing.kind === kind ? existing.body : R.LETTER_TEMPLATES[kind](ctx); scan(); };
      const scan = () => {
        const txt = $('#lBody').value; const hits = [];
        R.BANNED.forEach((b) => { const m = txt.match(b.re); if (m) hits.push({ words: Array.from(new Set(m)), why: b.why }); });
        const placeholders = (txt.match(/［[^］]*］/g) || []).length;
        const noDate = !/\d+月\d+日|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/.test(txt.replace(/\n[^\n]*$/, ''));
        let w = '';
        if (hits.length) w += `<div class="banner warn"><strong>書面唔應該出現嘅字眼</strong><ul class="warnlist small">${hits.map((h) => `<li><mark>${h.words.map(esc).join('、')}</mark> — ${esc(h.why)}</li>`).join('')}</ul></div>`;
        if (placeholders) w += `<div class="banner info small">仲有 ${placeholders} 個［方括號］未填。</div>`;
        if (noDate && kind !== 'notice') w += `<div class="banner info small">內文冇具體日期。「盡快」、「稍後」等於冇講——寫得出嘅日期先寫，寫咗就要做到。</div>`;
        if (st.licenceNo && !txt.includes(st.licenceNo)) w += `<div class="banner info small">信上冇你嘅牌照號碼（第626章牌照條件）。</div>`;
        if (!w) w = '<div class="banner ok small">掃描冇發現問題。出之前再讀一次：每一句係事實定推論？</div>';
        $('#lWarn').innerHTML = w;
      };
      $$('[data-kind]').forEach((b) => b.onclick = () => { kind = b.dataset.kind; render(); });
      $('#lCase').onchange = (e) => { location.hash = e.target.value ? '#/letters/' + e.target.value : '#/letters'; };
      $('#lBody').oninput = scan;
      $('#lGen').onclick = () => { useExisting = false; gen(); };
      $('#lCopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('#lBody').value).then(() => toast('已複製'), () => { $('#lBody').select(); document.execCommand('copy'); toast('已複製'); }); };
      $('#lPrint').onclick = () => { $('#lPrintBody').textContent = $('#lBody').value; $('#lPrintBody').style.display = 'block'; $('#lBody').style.display = 'none'; window.print(); $('#lPrintBody').style.display = 'none'; $('#lBody').style.display = ''; };
      $('#lSave').onclick = () => { if (!c) return toast('先連結一個個案'); const body = $('#lBody').value; if (existing) { existing.body = body; existing.kind = kind; } else S.letters.push({ id: uid(), caseId: c.id, kind, createdAt: nowStamp(), body }); c.lastProgressAt = today(); c.log.push({ at: nowStamp(), channel: '書面', party: c.respondent || c.complainant, said: '', outcome: `出咗${R.LETTER_KINDS[kind].label}`, next: c.nextAction }); save(); toast('已儲存到個案'); location.hash = '#/case/' + c.id; };
      gen();
    };
    render();
  };
  function suggestLetterKind(c) { if (c.type === 'contractor') return c.escalation >= 2 ? 'warning' : 'record'; if (c.type === 'fee') return 'refuse'; if (c.type === 'seepage' && (c.attempts || 0) > 0) return 'access'; return 'reply'; }
  function warningGate(c) {
    const hasRecord = S.letters.some((l) => l.caseId === c.id && l.kind === 'record') || c.log.some((l) => /紀錄信/.test(l.outcome || ''));
    const hasOral = c.log.some((l) => ['上門', '電話', '會議', '櫃檯'].includes(l.channel));
    const probs = [];
    if (!hasOral) probs.push('紀錄上未有口頭接觸');
    if (!hasRecord) probs.push('未出過紀錄信');
    if (c.escalation < 2) probs.push(`階梯仍然喺第 ${c.escalation} 級`);
    if (!probs.length) return '<div class="banner ok small no-print">口頭 → 紀錄信 → 死線 → 警告信：次序上企得穩。</div>';
    return `<div class="banner warn no-print"><strong>出警告信之前：我要改善，定係要紀錄？</strong>${probs.map(esc).join('；')}。跳步之後行合約行動嗰陣，紀錄會見到你由零直接跳去警告，對方可以話你冇畀機會佢改善。要改善就唔好即刻出信；要紀錄就出，而且唔好扮軟。</div>`;
  }
  function letterContext(c, kind) {
    const st = S.settings; const t = today();
    const base = { date: cnDate(t), officer: st.officerName, licence: st.licenceNo, phone: st.phone, estate: st.estate };
    if (!c) return base;
    const k = c.contractorId ? contractorById(c.contractorId) : null;
    const lastTalk = c.log.slice().reverse().find((l) => ['上門', '電話', '會議', '櫃檯'].includes(l.channel));
    const done = c.log.filter((l) => l.channel === '上門' || l.channel === '書面').map((l) => `於${cnDate(l.at.slice(0, 10))}${l.channel === '上門' ? '上門' : '以書面'}${l.outcome ? '（' + l.outcome + '）' : ''}`).join('、');
    const ctx = Object.assign({}, base, { unit: [c.block, c.unit].filter(Boolean).join(' '), nextDate: c.nextDue ? cnDate(c.nextDue) : '', replyDate: c.promisedReplyBy ? cnDate(c.promisedReplyBy) : '', done });
    if (kind === 'reply') { ctx.recipient = c.complainant; ctx.receivedDate = cnDate(c.openedAt); }
    else if (kind === 'access') { ctx.recipient = c.respondent; ctx.purpose = `${ctx.unit}的${R.CASE_TYPES[c.type].label}情況`; }
    else if (kind === 'record') { ctx.recipient = k ? k.name : c.respondent; ctx.talkDate = lastTalk ? cnDate(lastTalk.at.slice(0, 10)) : ''; ctx.channel = lastTalk ? lastTalk.channel : ''; ctx.agreed = lastTalk && lastTalk.outcome ? lastTalk.outcome + (c.nextDue ? `（限期：${cnDate(c.nextDue)}）` : '') : ''; }
    else if (kind === 'warning') { ctx.recipient = k ? k.name : c.respondent; if (k) { const late = k.orders.filter((o) => o.dueAt && ((o.doneAt && o.doneAt > o.dueAt) || (!o.doneAt && o.dueAt < t))); if (late.length) ctx.facts = `合約訂明工單須於 ${k.slaDays} 日內完成。以下 ${late.length} 宗工單超出限期：\n` + late.map((o) => `・${cnDate(o.issuedAt)}發出「${o.desc}」，限期${cnDate(o.dueAt)}，${o.doneAt ? `於${cnDate(o.doneAt)}完成` : '至今未完成'}`).join('\n'); ctx.clause = k.contract; } else if (done) ctx.facts = '本處' + done + '。'; ctx.deadline = ctx.nextDate; }
    else if (kind === 'refuse') { ctx.recipient = c.complainant; }
    return ctx;
  }

  // ---------- 對話準備 ----------
  VIEWS.prep = function (caseId) {
    const c = caseId ? caseById(caseId) : null;
    const keys = Object.keys(R.SCENARIOS);
    let sel = c ? (keys.find((k) => R.SCENARIOS[k].types.includes(c.type)) || keys[0]) : keys[0];
    let tab = 'playbook';
    const render = () => {
      const sc = R.SCENARIOS[sel];
      $('#main').innerHTML = `<div class="card-head"><h1>對話準備${c ? ` · ${esc(c.ref)}` : ''}</h1><select id="pCase" style="width:auto"><option value="">— 唔連結個案 —</option>${S.cases.filter(isOpen).map((x) => `<option value="${x.id}" ${c && x.id === c.id ? 'selected' : ''}>${esc(x.ref)} ${esc(x.title)}</option>`).join('')}</select></div>
        <p class="muted small">你幾乎冇強制力，但你要結果。真正嘅工作係：喺唔動用強制力嘅情況下，攞到對方自願配合。如果未決定要唔要傾，先去「形勢判斷」。</p>
        ${c ? `<div class="card"><div class="card-head"><h3>三條線</h3><button class="btn small" id="pEditPrep">編輯</button></div><dl class="kv"><dt>目標</dt><dd>${esc(c.prep.goal) || '<span class="muted">未定</span>'}</dd><dt>底線</dt><dd>${esc(c.prep.bottom) || '<span class="muted">未定</span>'}</dd><dt>我嘅 BATNA</dt><dd>${esc(c.prep.batna) || '<span class="muted">未定——答唔到就唔應該開始傾</span>'}</dd><dt>對方利益</dt><dd>${esc(c.prep.interest) || '<span class="muted">未知——唔知之前任何方案都係亂估</span>'}</dd></dl><p class="tiny muted" style="margin-top:6px">寫畀自己睇：對方唔係敵人，佢想要嘅係 ___。</p></div>` : ''}
        <div class="tabs"><button class="${tab === 'playbook' ? 'active' : ''}" data-tab="playbook">場景 playbook</button><button class="${tab === 'phrases' ? 'active' : ''}" data-tab="phrases">對白庫</button><button class="${tab === 'checklist' ? 'active' : ''}" data-tab="checklist">出門前檢查</button></div>
        ${tab === 'playbook' ? `<div class="row"><div><label>場景</label><select id="pScen">${keys.map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(R.SCENARIOS[k].label)}</option>`).join('')}</select></div></div>
          <div class="grid cols-2"><div><div class="card"><h3>佢真正想要／驚嘅係咩</h3><ul class="small">${sc.fear.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><p class="tiny muted">唔同嘅驚，要唔同嘅拆法。所以唔好未問就開始講條款。</p></div>
          <div class="card"><h3>次序（可以照讀）</h3>${sc.steps.map(([k, v]) => `<div class="step"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div></div>
          <div><div class="card"><h3>對方可能點回應 → 你點接</h3>${sc.pushback.map(([a, b]) => `<div class="step"><div class="k">如果佢話 ${esc(a)}</div><div class="v">→ ${esc(b)}</div></div>`).join('')}</div>
          <div class="card"><h3>幾時收手</h3><p class="small">${esc(sc.stop)}</p><h3>書面跟進</h3><p class="small">${esc(sc.record)}</p></div>
          <div class="card"><h3>收尾一定要齊四樣</h3><p class="small"><strong>邊個、做咩、幾時、點覆。</strong>聽到「係呀，就係咁」先算真 buy-in；「係係係，知啦」係想你走。</p></div></div></div>`
        : tab === 'phrases' ? `<div class="grid cols-2">${R.PHRASES.map((p) => `<div class="card"><h3>${esc(p.cat)}</h3>${p.items.map((i) => `<div class="quote">${esc(i)}</div>`).join('')}</div>`).join('')}</div>`
        : `<div class="card"><h3>出門前</h3>${['睇清楚檔案——唔好問你檔案入面已經有嘅嘢，改成確認：「我睇檔案見到你七月三號同八月十一號都報過——係咪即係中間嗰個月都冇停過？」', '目標、底線、BATNA 寫低咗', '對方嘅利益估咗至少三個可能', '開場第一句（accusation audit）寫好，講完唔加「但係」', '一條「內行嘅窄問題」建立可信度：「你個天花濕嗰笪，係咪朝早會明顯啲？」', '第三層問題（影響）唔好跳：「咁你間房而家瞓唔瞓到人？」', '金牌先出，唔郁先出狼狗；一次只出一隻；講唔出口嘅狼狗唔好放', '同類個案可以講，但講唔得出邊個單位', '渠道啱唔啱？書面止唔到一個覺得冇人聽佢講嘅住戶；口頭定唔死將來要追究嘅嘢', '對方啱啱爆發嗰十五分鐘唔好談判。聽、記低、約時間', '回嚟即日：紀錄 + 紀錄信'].map((i) => `<label class="check" style="margin-bottom:8px"><input type="checkbox"> ${esc(i)}</label>`).join('')}</div>`}`;
      $('#pCase').onchange = (e) => { location.hash = e.target.value ? '#/prep/' + e.target.value : '#/prep'; };
      $$('[data-tab]').forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
      const ps = $('#pScen'); if (ps) ps.onchange = (e) => { sel = e.target.value; render(); };
      const ep = $('#pEditPrep'); if (ep) ep.onclick = () => prepForm(c);
    };
    render();
  };

  // ---------- 形勢判斷 ----------
  VIEWS.review = function (caseId) {
    if (caseId) return reviewCase(caseId);
    const t = today();
    const open = S.cases.filter((c) => isOpen(c) && !isSafety(c));
    const groups = { wait: [], push: [], close: [], undecided: [] };
    open.forEach((c) => { if (c.triage && ['wait', 'push', 'close'].includes(c.triage)) groups[c.triage].push(c); else groups.undecided.push(c); });
    const stalled = open.filter((c) => stalledDays(c) >= 60);
    const block = (key, title, note, arr) => `<div class="card"><div class="card-head"><h3>${title}（${arr.length}）</h3><span class="muted small">${note}</span></div>${arr.length ? `<div class="list">${arr.map((c) => `<div class="item ${stalledDays(c) >= 60 ? 'overdue' : ''}"><div class="body" data-href="#/case/${c.id}"><div class="title">${esc(c.ref)} · ${esc(c.title)}</div><div class="meta"><span>${stalledDays(c)} 日冇進展</span><span>階梯 ${c.escalation}</span>${c.triageReason ? `<span>${esc(c.triageReason)}</span>` : ''}</div></div><div class="seg"><button data-tri="wait" data-id="${c.id}" class="${c.triage === 'wait' ? 'on-even' : ''}">等得</button><button data-tri="push" data-id="${c.id}" class="${c.triage === 'push' ? 'on-me' : ''}">要推</button><button data-tri="close" data-id="${c.id}" class="${c.triage === 'close' ? 'on-them' : ''}">應該結</button></div></div>`).join('')}</div>` : '<div class="empty">冇</div>'}</div>`;
    $('#main').innerHTML = `<h1>形勢判斷 · 個案盤點</h1>
      <p class="muted small">呢單嘢，究竟應唔應該爭落去？前線最大嘅隱性損耗係：十幾單個案各自慢慢爛，冇一單係決定過唔跟，亦冇一單真正推到尾。打仗最貴嘅唔係輸，係拖。每月掃一次：呢單今個月有冇實質進展？連續兩個月冇，就要決定升級定結案。</p>
      ${stalled.length ? `<div class="banner warn"><strong>${stalled.length} 宗連續兩個月冇實質進展</strong>判斷準則：再拖三個月會唔會變好？會（等緊報告、工程、第三方）→ 拖得，但定死檢查點。唔會（純粹對方唔郁，你冇新籌碼）→ 而家決定升級定結案。最差係唔升級又唔結案。</div>` : ''}
      <p class="small muted">安全個案唔喺呢度——冇得計數。弱勢住戶個案嘅判斷應該係轉介，唔係「值唔值得搞」。唔好見單都話要推——呢頁最大嘅價值係畀你批准自己放低啲唔值得嘅嘢。</p>
      ${block('undecided', '未分類', '逐單決定', groups.undecided)}${block('push', '要推', '定死下一步同期限，去個案頁升級', groups.push)}${block('wait', '等得', '等緊第三方——定死檢查點', groups.wait)}${block('close', '應該結', '書面記低點解唔推、幾時再睇，然後結案', groups.close)}
      <div class="card"><h3>你自己嘅五個弱點（對住鏡照）</h3><p class="small muted">呢五樣本身都係美德，正因為係美德，先至可以被利用。如果你發現每單都想贏到底、或者每單都想避，值得留意。</p><div class="grid cols-3">${R.WEAKNESS.map((w) => `<div class="card flat"><strong>${esc(w.name)}</strong><div class="small">${esc(w.desc)}</div></div>`).join('')}</div></div>`;
    $$('[data-tri]').forEach((b) => b.onclick = () => { const c = caseById(b.dataset.id); const tri = b.dataset.tri; openModal(`<h2>${esc(c.ref)} → ${{ wait: '等得', push: '要推', close: '應該結' }[tri]}</h2><form id="triForm"><div class="row full"><div><label>一句理由（寫入紀錄）</label><input name="reason" value="${esc(c.triageReason)}" required placeholder="${tri === 'wait' ? '等測漏報告，10月15日再睇' : tri === 'push' ? '對方唔郁，本處有紀錄，升級去正式程序' : '對方唔郁而本處冇新籌碼，三個月後再睇'}"></div></div><div class="btn-row"><button class="btn primary" type="submit">儲存</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`); $('#mCancel').onclick = closeModal; $('#triForm').onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); c.triage = tri; c.triageReason = d.reason; c.log.push({ at: nowStamp(), channel: '書面', party: '本處', said: '', outcome: `盤點：${{ wait: '等得', push: '要推', close: '應該結' }[tri]}——${d.reason}`, next: '' }); save(); closeModal(); route(); }; });
    bindItems();
  };
  function reviewCase(id) {
    const c = caseById(id); if (!c) { $('#main').innerHTML = '<div class="empty">搵唔到</div>'; return; }
    const sv = c.seven || {}; const fv = c.five || {};
    const losses = Object.values(sv).filter((v) => v === 'them').length; const wins = Object.values(sv).filter((v) => v === 'me').length;
    const days = stalledDays(c);
    $('#main').innerHTML = `<div class="card-head"><div><div class="muted small">形勢判斷</div><h1>${esc(c.ref)} · ${esc(c.title)}</h1></div><a class="btn" href="#/case/${c.id}">返回個案</a></div>
      ${isSafety(c) ? '<div class="banner danger"><strong>安全個案冇得計數</strong>即刻處理。呢頁只適用於有酌情空間嘅個案。</div>' : ''}
      ${c.vulnerable ? '<div class="banner warn"><strong>弱勢住戶唔適用成本計算</strong>判斷應該係轉介，唔係「呢單唔值得搞」。</div>' : ''}
      <div class="grid cols-2"><div class="card"><div class="card-head"><h3>七計對比</h3><span class="tag ${losses >= 3 ? 'danger' : 'ok'}">你贏 ${wins} · 輸 ${losses}</span></div><p class="small muted">出警告信之前行一次。輸三條或以上，就唔好行強硬路線。最常見嘅失敗唔係「道」唔夠，係「將」同「法」唔夠——你道理企得住晒，但手上有廿三單，冇時間推呢單到尾。</p>
        ${R.SEVEN.map((q, i) => `<div class="seven-row"><div class="small">${i + 1}. ${esc(q)}</div><div class="seg"><button data-sv="${i}" data-v="me" class="${sv[i] === 'me' ? 'on-me' : ''}">我方</button><button data-sv="${i}" data-v="even" class="${sv[i] === 'even' ? 'on-even' : ''}">平手</button><button data-sv="${i}" data-v="them" class="${sv[i] === 'them' ? 'on-them' : ''}">對方</button></div></div>`).join('')}
        ${losses >= 3 ? '<div class="banner danger small" style="margin-top:10px">唔好行強硬路線。考慮伐謀／伐交：改變佢嘅盤算，或者借第三方。</div>' : ''}</div>
      <div><div class="card"><h3>五事</h3><p class="small muted">紅嘅標出。</p>${R.FIVE.map((f) => `<div style="margin-bottom:10px"><label>${f.name}　<span class="muted" style="font-weight:400">${esc(f.q)}</span></label><div class="row" style="grid-template-columns:1fr auto;margin:0"><input data-five="${f.key}" value="${esc(fv[f.key] || '')}" placeholder="一句"><button class="btn small ${fv[f.key + '_red'] ? 'danger' : ''}" data-fivered="${f.key}">${fv[f.key + '_red'] ? '已標紅' : '標紅'}</button></div></div>`).join('')}</div>
      <div class="card"><h3>兩邊嘅底</h3><dl class="kv"><dt>我傾唔掂會點</dt><dd>${esc(c.prep.batna) || '<span class="muted">未答——答唔到就唔應該開始傾</span>'}</dd><dt>佢傾唔掂會點</dt><dd>${esc(c.prep.theirBatna) || '<span class="muted">未答——佢嘅最差情況唔差，佢就冇動力</span>'}</dd></dl><button class="btn small" id="rvPrep" style="margin-top:8px">編輯</button></div></div></div>
      <div class="grid cols-2"><div class="card"><h3>拖係最大嘅敵人</h3><p class="small">已經 <strong>${days}</strong> 日冇實質進展。再拖三個月會唔會變好？</p><div class="seg"><button data-tri="wait" class="${c.triage === 'wait' ? 'on-even' : ''}">會——等得，定檢查點</button><button data-tri="push" class="${c.triage === 'push' ? 'on-me' : ''}">唔會——要推</button><button data-tri="close" class="${c.triage === 'close' ? 'on-them' : ''}">唔會——應該結</button></div>${c.triageReason ? `<p class="small" style="margin-top:8px">${esc(c.triageReason)}</p>` : ''}</div>
      <div class="card"><h3>留返個缺口</h3><p class="small">一個冇晒退路嘅人唔會投降，只會死拚。唔好將「配合」同「認錯」綁埋——好多拒絕配合嘅人，佢拒絕嘅係認錯，唔係配合。</p><label>我而家開出嘅條件，對方接受咗之後仲有冇面？</label><input id="rvExit" value="${esc(c.prep.exit || '')}" placeholder="「而家要傾嘅唔係邊個錯，係點樣整同點分擔」"></div></div>
      <div class="card"><h3>建議層級</h3><div class="ladder">${R.LADDER.map((l) => `<div class="rung ${l.level === c.escalation ? 'current' : ''}"><div class="lvl">${l.level}</div><div><strong>${l.name}</strong> <span class="muted small">${l.classic}</span><div class="small">${l.desc}</div></div></div>`).join('')}</div><p class="small muted" style="margin-top:8px">而家喺第 ${c.escalation} 級。冇試過上一層，唔好跳去下一層——唔係因為要溫和，係因為紀錄上見到你跳步，對方可以話你冇畀機會佢改善。升級去個案頁做。</p></div>`;
    $$('[data-sv]').forEach((b) => b.onclick = () => { c.seven = c.seven || {}; c.seven[b.dataset.sv] = b.dataset.v; save(); reviewCase(id); });
    $$('[data-five]').forEach((i) => i.onchange = () => { c.five = c.five || {}; c.five[i.dataset.five] = i.value.trim(); save(); });
    $$('[data-fivered]').forEach((b) => b.onclick = () => { c.five = c.five || {}; c.five[b.dataset.fivered + '_red'] = !c.five[b.dataset.fivered + '_red']; save(); reviewCase(id); });
    $('#rvPrep').onclick = () => prepForm(c);
    $('#rvExit').onchange = (e) => { c.prep.exit = e.target.value.trim(); save(); };
    $$('[data-tri]').forEach((b) => b.onclick = () => { const tri = b.dataset.tri; openModal(`<h2>${{ wait: '等得', push: '要推', close: '應該結' }[tri]}</h2><form id="triForm"><div class="row full"><div><label>一句理由（寫入紀錄）</label><input name="reason" value="${esc(c.triageReason)}" required></div></div><div class="btn-row"><button class="btn primary" type="submit">儲存</button><button class="btn" type="button" id="mCancel">取消</button></div></form>`); $('#mCancel').onclick = closeModal; $('#triForm').onsubmit = (e) => { e.preventDefault(); const d = formData(e.target); c.triage = tri; c.triageReason = d.reason; c.log.push({ at: nowStamp(), channel: '書面', party: '本處', said: '', outcome: `盤點：${{ wait: '等得', push: '要推', close: '應該結' }[tri]}——${d.reason}`, next: '' }); save(); closeModal(); reviewCase(id); }; });
  }

  // ---------- 設定 ----------
  VIEWS.settings = function () {
    const st = S.settings;
    $('#main').innerHTML = `<h1>設定／備份</h1><div class="grid cols-2"><div class="card"><h3>你嘅資料（信件會自動用）</h3><form id="setForm">
      <div class="row"><div><label>姓名</label><input name="officerName" value="${esc(st.officerName)}"></div><div><label>物業管理人牌照號碼</label><input name="licenceNo" value="${esc(st.licenceNo)}" placeholder="第626章牌照條件"></div></div>
      <div class="row"><div><label>屋邨／物業名稱</label><input name="estate" value="${esc(st.estate)}"></div><div><label>辦事處</label><input name="office" value="${esc(st.office)}"></div></div>
      <div class="row"><div><label>電話</label><input name="phone" value="${esc(st.phone)}"></div><div><label>電郵</label><input name="email" value="${esc(st.email)}"></div></div>
      <div class="row"><div><label>外觀</label><select name="theme"><option value="auto" ${st.theme === 'auto' ? 'selected' : ''}>跟系統</option><option value="light" ${st.theme === 'light' ? 'selected' : ''}>淺色</option><option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>深色</option></select></div></div>
      <button class="btn primary" type="submit">儲存</button></form><p class="tiny muted" style="margin-top:8px">${esc(R.LICENCE_NOTE)}</p></div>
      <div><div class="card"><h3>備份</h3><p class="small">資料只儲存喺呢部機呢個瀏覽器嘅 localStorage。清除瀏覽紀錄、換機、換瀏覽器都會冇。<strong>每星期匯出一次。</strong></p><div class="btn-row"><button class="btn primary" id="exportBtn">匯出 JSON</button><label class="btn">匯入 JSON<input type="file" id="importFile" accept="application/json" hidden></label><button class="btn" id="importPaste">貼上 JSON 匯入</button><button class="btn" id="exportCsv">匯出個案 CSV</button></div><p class="tiny muted" style="margin-top:8px">匯出檔案包含住戶個人資料（第486章）。存喺公司指定位置，唔好放個人雲端或者傳出去。</p></div>
      <div class="card"><h3>統計</h3><dl class="kv"><dt>個案</dt><dd>${S.cases.length}（未結案 ${S.cases.filter(isOpen).length}）</dd><dt>承辦商</dt><dd>${S.contractors.length}</dd><dt>巡查紀錄</dt><dd>${S.inspections.length}</dd><dt>信件</dt><dd>${S.letters.length}</dd></dl></div>
      <div class="card"><h3>危險區</h3><div class="btn-row"><button class="btn" id="demoBtn">載入示範資料</button><button class="btn danger" id="wipeBtn">清除全部資料</button></div></div></div></div>`;
    $('#setForm').onsubmit = (e) => { e.preventDefault(); Object.assign(S.settings, formData(e.target)); save(); applyTheme(); toast('已儲存'); route(); };
    const importData = (txt) => { try { const d = JSON.parse(txt); if (!d || !Array.isArray(d.cases)) throw new Error('格式唔啱'); confirmDialog(`匯入會覆蓋現有資料（${S.cases.length} 宗個案）。繼續？`, () => { S = Object.assign(blank(), d); save(); applyTheme(); route(); toast('已匯入'); }); } catch (err) { toast('匯入失敗：' + err.message); } };
    $('#exportBtn').onclick = () => download(`pmo-backup-${today()}.json`, JSON.stringify(S, null, 2), 'application/json');
    $('#exportCsv').onclick = () => { const rows = [['編號', '標題', '類型', '處所', '座', '單位', '投訴人', '對方', '開立', '狀態', '階梯', '下一步', '期限', '應承覆', '冇進展日數']]; S.cases.forEach((c) => rows.push([c.ref, c.title, R.CASE_TYPES[c.type].label, R.PREMISES[c.premises].label, c.block, c.unit, c.complainant, c.respondent, c.openedAt, STATUS[c.status], c.escalation, c.nextAction, c.nextDue, c.promisedReplyBy, isOpen(c) ? stalledDays(c) : ''])); download(`pmo-cases-${today()}.csv`, '﻿' + rows.map((r) => r.map((v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv'); };
    $('#importFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => importData(rd.result); rd.readAsText(f); };
    $('#importPaste').onclick = () => { openModal(`<h2>貼上備份 JSON</h2><textarea id="impBody" style="min-height:220px" placeholder="{ &quot;cases&quot;: [...] }"></textarea><div class="btn-row" style="margin-top:10px"><button class="btn primary" id="impOk">匯入</button><button class="btn" id="mCancel">取消</button></div>`); $('#mCancel').onclick = closeModal; $('#impOk').onclick = () => { const t = $('#impBody').value; closeModal(); importData(t); }; };
    $('#demoBtn').onclick = () => { seedDemo(); route(); toast('已載入示範資料'); };
    $('#wipeBtn').onclick = () => confirmDialog('清除全部資料？先匯出備份。', () => { S = blank(); save(); route(); toast('已清除'); });
  };
  function download(name, content, type) {
    let embedded = false; try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
    if (embedded) {
      openModal(`<h2>${esc(name)}</h2><p class="small">呢個環境唔可以直接下載檔案。按「複製」，然後貼去一個文字檔儲存。</p><textarea id="dlBody" style="min-height:260px" readonly></textarea><div class="btn-row" style="margin-top:10px"><button class="btn primary" id="dlCopy">複製</button><button class="btn" id="mCancel">關閉</button></div>`);
      $('#dlBody').value = content; $('#mCancel').onclick = closeModal;
      $('#dlCopy').onclick = () => { $('#dlBody').select(); (navigator.clipboard ? navigator.clipboard.writeText(content) : Promise.reject()).then(() => toast('已複製'), () => { document.execCommand('copy'); toast('已複製'); }); };
      return;
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- 啟動 ----------
  load();
  if (window.PMO_AUTOSEED && !S.cases.length) { let fresh = true; try { fresh = !localStorage.getItem(STORE_KEY); } catch (e) { fresh = false; } if (fresh) seedDemo(); }
  window.addEventListener('hashchange', route);
  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  $('#quickAddBtn').onclick = () => caseForm();
  $('#modalBackdrop').onclick = (e) => { if (e.target === e.currentTarget) closeModal(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  route();
  window.PMO = { state: () => S, save, seedDemo, findRoute };
})();
