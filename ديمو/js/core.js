/* ============================================================
   core.js — المنطق المشترك (domain + صلاحيات + مسار + UI helpers + shell)
   الـ views بتستخدم الدوال دي بس، ومش بتعدّل DB مباشرة غير من خلال
   دوال المسار (Flow.*). المرجع الكامل للـ API في ديمو/README.md
   ============================================================ */

/* ───────────────────────── utils ───────────────────────── */
const DAY = 864e5;
let TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
const iso = d => { d = new Date(d); const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const fmtD = d => { if (!d) return '—'; d = new Date(d); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
const fmtDT = d => { d = new Date(d); return `${fmtD(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const money = v => v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString('en-US');
const money2 = v => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = v => v == null || isNaN(v) ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
const mShort = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : money(v);
const pct = (a, b) => b ? (a / b * 100) : 0;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (n, cls = '') => `<i data-lucide="${n}" class="${cls}"></i>`;
const N = v => `<span class="num">${v}</span>`;
const uid = (p = 'id') => p + '-' + Math.random().toString(36).slice(2, 9);
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});

/* ───────────────────────── working days ───────────────────────── */
const isWork = d => { const w = d.getDay(); return w !== 5 && w !== 6 && !DB.holidays.includes(iso(d)); };
function wdBetween(a, b) { // أيام العمل بعد a لحد b
  let n = 0, d = new Date(a); d.setHours(0, 0, 0, 0); const e = new Date(b); e.setHours(0, 0, 0, 0);
  while (d < e) { d = new Date(d.getTime() + DAY); if (isWork(d)) n++; }
  return n;
}
function addWd(a, n) { let d = new Date(a); d.setHours(0, 0, 0, 0); const s = n < 0 ? -1 : 1; let k = Math.abs(n); while (k > 0) { d = new Date(d.getTime() + s * DAY); if (isWork(d)) k--; } return d; }

/* ───────────────────────── lookups ───────────────────────── */
const byId = (table, id) => DB[table].find(x => x.id === id);
const userById = id => DB.users.find(u => u.id === id);
const material = code => DB.materials.find(m => m.code === code);
/** كل السياق المرتبط بأمر تكليف: العقد والشركة والمشروع والهيكل كله */
function aoCtx(aoId) {
  const ao = byId('aos', aoId); if (!ao) return null;
  const contract = byId('contracts', ao.contractId);
  const company = byId('companies', contract.companyId);
  const project = byId('projects', ao.projectId);
  const type = byId('projectTypes', project.typeId);
  const central = byId('centrals', project.centralId);
  const dept = byId('depts', central.deptId);
  const gdept = byId('gdepts', dept.gdeptId);
  const sector = byId('sectors', gdept.sectorId);
  const presidency = byId('presidencies', sector.presidencyId);
  return { ao, contract, company, project, type, central, dept, gdept, sector, presidency };
}
const invById = id => DB.invoices.find(i => i.id === id);
const ctx = inv => aoCtx(inv.aoId);
const aoValue = aoId => sum(DB.aoItems.filter(x => x.aoId === aoId), x => x.plannedQty * byId('contractItems', x.itemId).unitPrice);
const aoInvoices = aoId => DB.invoices.filter(i => i.aoId === aoId).sort((a, b) => a.seq - b.seq);

/* ───────────────────────── invoice domain ───────────────────────── */
const curRev = inv => inv.revisions[inv.revisions.length - 1];
/** الكميات المعتمدة في المستخلصات السابقة على نفس أمر التكليف */
function prevQtyMap(inv) {
  const m = {};
  aoInvoices(inv.aoId).filter(x => x.seq < inv.seq && x.status !== 'draft').forEach(p => {
    curRev(p).lines.forEach(l => { const k = l.itemId || l.newKey; m[k] = (m[k] || 0) + (l.approvedQty ?? l.qty); });
  });
  return m;
}
/** بنود المستخلص مع السعر من العقد والمقارنة بأمر التكليف */
function invLines(inv, rev = curRev(inv)) {
  const prev = prevQtyMap(inv);
  return rev.lines.map(l => {
    const it = l.itemId ? byId('contractItems', l.itemId) : null;
    const plan = l.itemId ? DB.aoItems.find(x => x.aoId === inv.aoId && x.itemId === l.itemId) : null;
    const price = it ? it.unitPrice : (l.agreedPrice ?? null);
    const approved = l.approvedQty ?? l.qty;
    const prevQty = prev[l.itemId || l.newKey] || 0;
    const cumQty = prevQty + approved;
    const plannedQty = plan ? plan.plannedQty : 0;
    return {
      ...l, itemNo: it ? it.itemNo : l.itemNo, description: it ? it.description : l.description, unit: it ? it.unit : l.unit,
      workType: it ? it.workType : 'بند مستجد', unitPrice: price, isNew: !it, notInAo: !!it && !plan,
      plannedQty, prevQty, approvedQty: approved, cumQty,
      overQty: Math.max(0, cumQty - plannedQty), overPct: plannedQty ? pct(cumQty - plannedQty, plannedQty) : (cumQty ? 100 : 0),
      submittedTotal: price == null ? null : l.qty * price, total: price == null ? null : approved * price,
      changed: l.approvedQty != null && l.approvedQty !== l.qty,
    };
  });
}
/** المهمات: مخطط / منصرف / منفذ / مفوتر */
function invMaterials(inv, rev = curRev(inv)) {
  const prevExec = {};
  aoInvoices(inv.aoId).filter(x => x.seq < inv.seq && x.status !== 'draft').forEach(p => curRev(p).materials.forEach(m => { prevExec[m.code] = (prevExec[m.code] || 0) + (m.billedQty ?? m.executedQty); }));
  return rev.materials.map(m => {
    const mat = material(m.code) || { description: m.description || '—', unit: m.unit || '—' };
    const planned = (DB.aoMaterials.find(x => x.aoId === inv.aoId && x.code === m.code) || {}).plannedQty || 0;
    const issued = sum(DB.materialIssues.filter(x => x.aoId === inv.aoId && x.code === m.code), x => x.qty);
    const billed = m.billedQty ?? m.executedQty;
    const prev = prevExec[m.code] || 0, cumExecuted = prev + m.executedQty;
    const flags = [];
    if (!planned) flags.push({ cls: 'r', t: 'غير موجود في أمر التكليف' });
    if (cumExecuted > issued) flags.push({ cls: 'r', t: 'المنفذ التراكمي أكبر من المنصرف' });
    else if (issued - cumExecuted > Math.max(5, issued * 0.15)) flags.push({ cls: 'a', t: 'رصيد منصرف لم يُستخدم' });
    if (planned && cumExecuted > planned) flags.push({ cls: 'a', t: 'المنفذ أكبر من المخطط' });
    return { ...m, description: mat.description, unit: mat.unit, planned, issued, prevExecuted: prev, executed: m.executedQty, cumExecuted, billed, balance: issued - cumExecuted, flags };
  });
}
/** اقتراح فئة التجاوز من البنود */
function suggestCategory(inv) {
  const lines = invLines(inv);
  const reasons = [];
  if (lines.some(l => l.isNew || l.unitPrice == null)) { reasons.push('فيه بند مستجد مالوش سعر في العقد'); return { cat: 'C5', reasons }; }
  const over = lines.filter(l => l.overQty > 0);
  if (!over.length) { reasons.push('كل الكميات التراكمية في حدود أمر التكليف'); return { cat: 'C1', reasons }; }
  over.forEach(l => reasons.push(`البند ${l.itemNo} تراكمي ${qty(l.cumQty)} من ${qty(l.plannedQty)} (+${l.overPct.toFixed(1)}%)`));
  const cumValue = sum(lines, l => l.cumQty * l.unitPrice);
  const aoVal = aoValue(inv.aoId);
  const totalOver = pct(cumValue - aoVal, aoVal);
  if (cumValue <= aoVal) { reasons.push('الإجمالي التراكمي لسه جوه قيمة أمر التكليف'); return { cat: 'C2', reasons, totalOver }; }
  reasons.push(`الإجمالي التراكمي تجاوز أمر التكليف بـ ${totalOver.toFixed(1)}%`);
  return { cat: totalOver <= 25 ? 'C3' : 'C4', reasons, totalOver };
}
/** الحسابات المالية: الإجمالي والضريبة والاستقطاعات والصافي */
function invTotals(inv) {
  const { contract } = ctx(inv);
  const lines = invLines(inv);
  const gross = sum(lines, l => l.total || 0);
  const submitted = sum(lines, l => l.submittedTotal || 0);
  const byWorkType = {};
  lines.forEach(l => { byWorkType[l.workType] = (byWorkType[l.workType] || 0) + (l.total || 0); });
  const vat = gross * contract.vatPct / 100;
  const deductions = (inv.deductions || defaultDeductions(inv)).map(d => ({ ...d, amount: d.pct != null ? gross * d.pct / 100 : (d.amount || 0) }));
  const dedTotal = sum(deductions, d => d.amount);
  const net = gross + vat - dedTotal;
  const cumGross = sum(aoInvoices(inv.aoId).filter(x => x.seq < inv.seq && x.status !== 'draft'), p => sum(invLines(p), l => l.total || 0)) + gross;
  return { gross, submitted, byWorkType, vatPct: contract.vatPct, vat, deductions, dedTotal, net, cumGross, aoValue: aoValue(inv.aoId), currency: contract.currency, words: numberToArabicWords(Math.round(net)) + ' جنيهاً مصرياً لا غير' };
}
function defaultDeductions(inv) {
  const k = ctx(inv).contract;
  return DB.deductionTypes.filter(t => t.basis && k[t.basis] > 0).map(t => ({ typeId: t.id, name: t.name, pct: k[t.basis], releasable: !!t.releasable }));
}
const missingDocs = inv => {
  const req = DB.requiredDocs[ctx(inv).type.id] || [];
  const have = new Set(curRev(inv).attachments.map(a => a.docTypeId));
  return req.filter(d => !have.has(d)).map(d => byId('docTypes', d));
};

/* ───────────────────────── تفقيط (رقم ← حروف) ───────────────────────── */
function numberToArabicWords(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'صفر';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const below1000 = x => {
    const h = Math.floor(x / 100), r = x % 100, parts = [];
    if (h) parts.push(hundreds[h]);
    if (r) { if (r < 20) parts.push(ones[r]); else { const o = r % 10, t = Math.floor(r / 10); parts.push(o ? `${ones[o]} و${tens[t]}` : tens[t]); } }
    return parts.join(' و');
  };
  const scales = [
    { v: 1e9, one: 'مليار', two: 'ملياران', few: 'مليارات' },
    { v: 1e6, one: 'مليون', two: 'مليونان', few: 'ملايين' },
    { v: 1e3, one: 'ألف', two: 'ألفان', few: 'آلاف' },
  ];
  const parts = [];
  for (const s of scales) {
    const c = Math.floor(n / s.v); if (!c) continue; n %= s.v;
    if (c === 1) parts.push(s.one); else if (c === 2) parts.push(s.two); else if (c <= 10) parts.push(`${below1000(c)} ${s.few}`); else parts.push(`${below1000(c)} ${s.one}اً`.replace('ألفاً', 'ألف').replace('مليوناً', 'مليون').replace('ملياراً', 'مليار'));
  }
  if (n) parts.push(below1000(n));
  return parts.join(' و');
}

/* ───────────────────────── المسار و الـ SLA ───────────────────────── */
const stepName = k => k === 'done' ? 'تم الصرف' : (DB.steps[k] || {}).name || k;
const stepShort = k => k === 'done' ? 'تم الصرف' : (DB.steps[k] || {}).short || k;
/** المسار الفعلي: الفئة المعتمدة، ولو لسه ما اتحددتش بنستخدم المقترحة (tentative) */
function pathOf(inv) {
  const cat = inv.cat || inv.suggestedCat || 'C1';
  return DB.categories[cat].path.map(([key, sla]) => ({ key, sla, ...DB.steps[key], tentative: !inv.cat }));
}
const slaOf = (inv, key) => (pathOf(inv).find(s => s.key === key) || {}).sla ?? null;
const totalSla = cat => sum(DB.categories[cat].path, p => p[1]);
/** حالة الـ SLA للمحطة الحالية */
function slaState(inv) {
  if (inv.status === 'paid') return { k: 'paid', cls: 'g', label: 'تم الصرف', el: null, sla: null };
  if (inv.status === 'draft') return { k: 'draft', cls: 'n', label: 'مسودة', el: null, sla: null };
  if (inv.status === 'on_hold') return { k: 'hold', cls: 'a', label: 'معلّق: ' + (inv.holdReason || 'بانتظار اعتماد أمر التكليف'), el: wdBetween(inv.since, TODAY), sla: null };
  const el = wdBetween(inv.since, TODAY);
  if (inv.status === 'returned') return { k: 'ret', cls: 'b', label: inv.returnTo === 'company' ? 'مرتجع للشركة' : 'مرتجع لـ ' + stepShort(inv.returnTo), el, sla: null };
  const sla = slaOf(inv, inv.step);
  if (sla == null) return { k: 'nosla', cls: 'n', label: 'بدون SLA', el, sla };
  if (el > sla) return { k: 'late', cls: 'r', label: 'متأخر', el, sla };
  if (sla - el <= DB.slaWarnAt) return { k: 'due', cls: 'a', label: el === sla ? 'آخر يوم' : 'قرب الميعاد', el, sla };
  return { k: 'ok', cls: 'g', label: 'في الميعاد', el, sla };
}
/** مين ماسك المستخلص دلوقتي (اسم الجهة) */
function holderLabel(inv) {
  if (inv.status === 'paid') return '—';
  if (inv.status === 'draft') return 'الشركة (مسودة)';
  if (inv.status === 'on_hold') return 'معلّق — ' + (inv.holdReason || 'بانتظار أمر التكليف');
  if (inv.status === 'returned') return inv.returnTo === 'company' ? ctx(inv).company.name : stepShort(inv.returnTo);
  return stepShort(inv.step);
}
/** إجمالي أيام العمل من التقديم لحد دلوقتي/الصرف، ومنها أيام عند الشركة */
function cycleDays(inv) {
  const sub = inv.log.find(e => e.action === 'submit'); if (!sub) return { total: null, company: 0 };
  const end = inv.status === 'paid' ? inv.since : TODAY;
  let company = 0;
  inv.log.forEach((e, i) => { if (e.action === 'return' && e.to === 'company') { const back = inv.log.slice(i + 1).find(x => x.action === 'resubmit'); company += wdBetween(e.date, back ? back.date : TODAY); } });
  return { total: wdBetween(sub.date, end), company };
}
/** وقت كل محطة (للتقارير): [{step, days, sla, late, chargedTo}] */
function stepDurations(inv) {
  const out = [];
  inv.log.forEach((e, i) => {
    if (!['submit', 'approve', 'resubmit', 'release'].includes(e.action) || !e.to || e.to === 'done') return;
    const next = inv.log.slice(i + 1).find(x => ['approve', 'return', 'pay'].includes(x.action) && x.step === e.to);
    const days = wdBetween(e.date, next ? next.date : (inv.status === 'paid' ? inv.since : TODAY));
    out.push({ step: e.to, days, sla: slaOf(inv, e.to), open: !next });
  });
  return out;
}

/* ───────────────────────── الصلاحيات والنطاق ───────────────────────── */
/** هل المستخلص جوه نطاق المستخدم؟ (نفس منطق scopeFilter في الـ backend) */
function inScope(user, inv) {
  const s = user.scope, c = ctx(inv);
  switch (s.type) {
    case 'all': return true;
    case 'company': return c.company.id === s.id;
    case 'presidency': return c.presidency.id === s.id;
    case 'sector': return c.sector.id === s.id;
    case 'gdept': return c.gdept.id === s.id;
    case 'dept': return c.dept.id === s.id;
    case 'central': return c.central.id === s.id;
  }
  return false;
}
const can = (perm, user = S.user) => (DB.permissions[perm] || []).includes(user.role);
const isCompany = (user = S.user) => user.role === 'company';
/** المستخلصات اللي المستخدم يشوفها: نطاقه، والشركات ما تشوفش المسودات بتاعة غيرها */
function visibleInvoices(user = S.user) {
  return DB.invoices.filter(i => inScope(user, i) && (i.status !== 'draft' || isCompany(user)));
}
/** هل المستخدم ده هو اللي عليه الدور دلوقتي؟ */
function canAct(inv, user = S.user) {
  if (!inScope(user, inv)) return false;
  if (inv.status === 'returned') return inv.returnTo === 'company' ? isCompany(user) : DB.steps[inv.returnTo].role === user.role;
  if (inv.status === 'draft') return isCompany(user);
  if (inv.status !== 'active') return false;
  return DB.steps[inv.step].role === user.role;
}
const canOverride = (inv, user = S.user) => can('invoice.override', user) && ['active', 'returned', 'on_hold'].includes(inv.status);
/** المستخدمين المسؤولين عن محطة لمستخلص معيّن (للإيميلات والإشعارات) */
function stepHolders(inv, key) {
  const role = key === 'company' ? 'company' : DB.steps[key].role;
  return DB.users.filter(u => u.role === role && inScope(u, inv));
}
const scopeLabel = s => {
  if (s.type === 'all') return 'كل الجهات';
  const t = { techUnit: 'techUnits', company: 'companies', presidency: 'presidencies', sector: 'sectors', gdept: 'gdepts', dept: 'depts', central: 'centrals' }[s.type];
  return (byId(t, s.id) || {}).name || '—';
};

/* ───────────────────────── Flow: كل حركات المستخلص ───────────────────────── */
/* كل دالة: بتعدّل المستخلص + تسجّل في log + audit + تبعت إشعار وإيميل للمسؤول الجديد */
const Flow = {
  _log(inv, e) { inv.log.push({ date: e.date || new Date(TODAY), by: e.by || S.user?.id, ...e }); DB.audit.unshift({ date: e.date || new Date(), userId: e.by || S.user?.id, action: e.action, entity: 'invoice:' + inv.no, details: e.note || '' }); },
  _notifyStep(inv, key, title, date) {
    const users = stepHolders(inv, key);
    users.forEach(u => {
      DB.notifications.unshift({ id: uid('n'), userId: u.id, title, invoiceId: inv.id, date: date || new Date(), read: false });
      DB.emails.unshift({ id: uid('e'), to: u.email, toName: u.name, subject: title, body: emailBody(inv, title, u), invoiceId: inv.id, date: date || new Date(), status: 'sent' });
    });
    return users;
  },
  /** الشركة بتقدّم مستخلص جديد */
  submit(inv, { by, date, note } = {}) {
    inv.suggestedCat = suggestCategory(inv).cat;
    inv.status = 'active'; inv.step = pathOf(inv)[0].key; inv.since = date || new Date(TODAY);
    this._log(inv, { action: 'submit', step: 'company', to: inv.step, by, date, note: note || 'تم تقديم المستخلص على البوابة' });
    this._notifyStep(inv, inv.step, `مستخلص جديد ${ctx(inv).company.name} رقم ${inv.no} وصل لصندوقك`, date);
  },
  /** مدير التنفيذ بيأكد الفئة (مطلوبة قبل الاعتماد من محطة exec) */
  setCategory(inv, cat, { by, date, note } = {}) {
    const old = inv.cat; inv.cat = cat;
    this._log(inv, { action: 'category', step: inv.step, to: inv.step, cat, by, date, note: note || (old ? `تغيير الفئة من ${old} إلى ${cat}` : `تحديد الفئة ${cat} — ${DB.categories[cat].name}`) });
  },
  /** اعتماد وتسليم للمحطة اللي بعدها */
  approve(inv, { by, date, note } = {}) {
    if (inv.step === 'exec' && !inv.cat) throw new Error('لازم تحدد الفئة قبل الاعتماد');
    const path = pathOf(inv), idx = path.findIndex(s => s.key === inv.step);
    const next = path[idx + 1];
    const from = inv.step;
    if (!next) return this.pay(inv, { by, date, note });
    inv.step = next.key; inv.since = date || new Date(TODAY);
    this._log(inv, { action: 'approve', step: from, to: next.key, by, date, note: note || '' });
    this._notifyStep(inv, next.key, `مستخلص ${ctx(inv).company.name} رقم ${inv.no} محتاج اعتمادك — ${next.name}`, date);
  },
  /** إرجاع لأي محطة سابقة أو للشركة، مع الأسباب */
  returnTo(inv, { target, reasonIds = [], note, by, date } = {}) {
    const from = inv.step;
    inv.status = 'returned'; inv.returnTo = target; inv.returnedFrom = from; inv.since = date || new Date(TODAY);
    this._log(inv, { action: 'return', step: from, to: target, reasonIds, note, by, date });
    const reasons = reasonIds.map(r => byId('returnReasons', r).name).join('، ');
    this._notifyStep(inv, target, `مستخلص ${ctx(inv).company.name} رقم ${inv.no} اترجع لك من ${stepShort(from)}: ${reasons}`, date);
  },
  /** الجهة اللي اترجع لها بتعيد الإرسال — يرجع للمحطة اللي رجّعته (مش من الأول) */
  resubmit(inv, { by, date, note, revision } = {}) {
    if (revision) inv.revisions.push(revision);
    const back = inv.returnedFrom;
    this._log(inv, { action: 'resubmit', step: inv.returnTo, to: back, by, date, note: note || 'تم استيفاء الملاحظات' });
    inv.status = 'active'; inv.step = back; inv.since = date || new Date(TODAY); inv.returnTo = null;
    if (revision) inv.suggestedCat = suggestCategory(inv).cat;
    this._notifyStep(inv, back, `مستخلص ${ctx(inv).company.name} رقم ${inv.no} رجع لك بعد استيفاء الملاحظات`, date);
  },
  /** تعديل الكمية المعتمدة لبند (بسبب) */
  updateApproved(inv, idx, newQty, { reason, by, date } = {}) {
    const l = curRev(inv).lines[idx]; const old = l.approvedQty ?? l.qty;
    l.approvedQty = newQty; l.approveNote = reason;
    this._log(inv, { action: 'qty', step: inv.step, to: inv.step, by, date, note: `البند ${invLines(inv)[idx].itemNo}: ${qty(old)} ← ${qty(newQty)} — ${reason}` });
  },
  /** تعليق المستخلص (مثلاً بانتظار اعتماد أمر التكليف أو ملحق الزيادة) — العداد بيقف */
  hold(inv, { reason, by, date } = {}) {
    inv.heldAt = inv.step; inv.status = 'on_hold'; inv.holdReason = reason; inv.since = date || new Date(TODAY);
    this._log(inv, { action: 'hold', step: inv.step, to: inv.step, by, date, note: reason });
  },
  release(inv, { by, date, note } = {}) {
    inv.status = 'active'; inv.step = inv.heldAt; inv.since = date || new Date(TODAY); inv.holdReason = null;
    this._log(inv, { action: 'release', step: inv.step, to: inv.step, by, date, note: note || 'تم رفع التعليق' });
    this._notifyStep(inv, inv.step, `مستخلص ${ctx(inv).company.name} رقم ${inv.no} رجع للعمل بعد رفع التعليق`, date);
  },
  /** المالية: الصرف + إشعار الشركة إن الشيك جاهز */
  pay(inv, { ref, method = 'شيك', by, date, note } = {}) {
    inv.status = 'paid'; inv.payment = { ref, method, date: date || new Date(TODAY), amount: invTotals(inv).net };
    this._log(inv, { action: 'pay', step: 'finance', to: 'done', by, date, note: note || `تم الصرف — ${method} رقم ${ref}` });
    inv.step = 'done'; inv.since = date || new Date(TODAY);
    this._notifyStep(inv, 'company', `${method} مستخلص رقم ${inv.no} جاهز للاستلام — صافي ${money(inv.payment.amount)} جنيه`, date);
  },
};
function emailBody(inv, title, u) {
  const c = ctx(inv), t = invTotals(inv);
  return `السيد/ ${u.name}\nتحية طيبة وبعد،\n\n${title}\n\nالشركة: ${c.company.fullName}\nالعقد: ${c.contract.no} — أمر التكليف: ${c.ao.no}\nالمشروع: ${c.project.name}\nالقيمة: ${money(t.gross)} جنيه\n\nرابط المستخلص: https://invoices.te.eg/i/${inv.id}\n\nمنظومة تتبع المستخلصات — المصرية للاتصالات`;
}

/* ───────────────────────── Excel ───────────────────────── */
const Excel = {
  /** يقرأ أول شيت ويرجع array of objects بأسماء الأعمدة */
  read(file) {
    return new Promise((res, rej) => {
      if (!window.XLSX) return rej(new Error('مكتبة Excel مش متحملة — محتاج إنترنت'));
      const fr = new FileReader();
      fr.onload = e => { try { const wb = XLSX.read(e.target.result, { type: 'array' }); res(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })); } catch (err) { rej(err); } };
      fr.onerror = rej; fr.readAsArrayBuffer(file);
    });
  },
  /** sheets: { 'اسم الشيت': [[header...], [row...]] } */
  download(filename, sheets) {
    if (!window.XLSX) { toast('مكتبة Excel مش متحملة — محتاج إنترنت', 'err'); return; }
    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, rows]) => { const ws = XLSX.utils.aoa_to_sheet(rows); ws['!cols'] = rows[0].map(() => ({ wch: 20 })); if (!wb.Workbook) wb.Workbook = { Views: [{ RTL: true }] }; XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); });
    XLSX.writeFile(wb, filename);
    toast('تم تنزيل ' + filename, 'ok');
  },
};

/* ───────────────────────── state + router ───────────────────────── */
let S = { user: null, route: 'home', params: {}, notifOpen: false, whoOpen: false, modal: '', cmdk: null, ui: {} };
const VIEWS = {}; // key → { title, icon, render(params), roles?:[], perm?:'' }
const View = { register(key, def) { VIEWS[key] = def; } };
/* القائمة الجانبية — الـ views بتسجّل نفسها بالـ keys دي */
const NAV = [
  { sec: 'العمل اليومي', items: [
    { key: 'home', label: 'الرئيسية', icon: 'layout-dashboard' },
    { key: 'inbox', label: 'صندوق الوارد', icon: 'inbox', roles: ['supervisor', 'exec_mgr', 'gm', 'tech_affairs', 'tech_office', 'planning', 'sector_head', 'presidency_head', 'committee', 'stores', 'finance', 'pmo', 'admin'], count: () => visibleInvoices().filter(i => canAct(i)).length },
    { key: 'co-returned', label: 'مطلوب الرد', icon: 'reply', roles: ['company'], count: () => visibleInvoices().filter(i => i.status === 'returned' && i.returnTo === 'company').length },
    { key: 'inv-new', label: 'مستخلص جديد', icon: 'file-plus-2', roles: ['company'] },
    { key: 'invoices', label: 'كل المستخلصات', icon: 'files' },
  ] },
  { sec: 'المتابعة والتقارير', items: [
    { key: 'reports', label: 'التقارير والتصدير', icon: 'file-bar-chart', perm: 'reports.view' },
    { key: 'deductions', label: 'الاستقطاعات والضمانات', icon: 'lock', roles: ['company', 'finance', 'pmo', 'admin', 'stores'] },
    { key: 'emails', label: 'سجل الإيميلات', icon: 'mail', roles: ['pmo', 'admin'] },
  ] },
  { sec: 'البيانات الأساسية', items: [
    { key: 'contracts', label: 'العقود وأوامر التكليف', icon: 'file-signature', roles: ['tech_affairs', 'tech_office', 'pmo', 'admin', 'planning', 'company'] },
    { key: 'issues', label: 'المهمات المنصرفة', icon: 'package', roles: ['stores', 'pmo', 'admin', 'tech_affairs'] },
    { key: 'org', label: 'الهيكل والمشاريع', icon: 'network', roles: ['admin', 'pmo'] },
  ] },
  { sec: 'الإعدادات', items: [
    { key: 'users', label: 'المستخدمين والصلاحيات', icon: 'users', perm: 'users.manage' },
    { key: 'workflow', label: 'المسار والـ SLA', icon: 'git-branch', perm: 'workflow.config' },
  ] },
];
const navAllowed = (it, user = S.user) => (!it.roles || it.roles.includes(user.role)) && (!it.perm || can(it.perm, user));
function go(route, params = {}) { S.route = route; S.params = params; S.notifOpen = false; S.whoOpen = false; document.body.classList.remove('navopen'); try { location.hash = route + (params.id ? '/' + params.id : ''); } catch (e) {} render(); window.scrollTo(0, 0); }
const openInv = id => go('invoice', { id });

/* ───────────────────────── UI helpers (بترجع HTML) ───────────────────────── */
function pageHeader({ title, sub = '', crumbs = [], actions = '' }) {
  const cr = crumbs.length ? `<div class="crumbs">${crumbs.map(([l, r, p]) => r ? `<a onclick='go(${JSON.stringify(r)},${JSON.stringify(p || {})})'>${esc(l)}</a>` : `<span>${esc(l)}</span>`).join(icon('chevron-left'))}</div>` : '';
  return `${cr}<div class="ph"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="sp"></div><div class="acts">${actions}</div></div>`;
}
const kpi = (ic, label, value, sub = '', cls = '') => `<div class="card kpi ${cls}"><div class="l"><span class="ic">${icon(ic)}</span>${label}</div><div class="v num">${value}</div><div class="s">${sub}</div></div>`;
function slaChip(inv) {
  const s = slaState(inv);
  if (s.sla != null) { const w = Math.min(100, s.el / s.sla * 100); return `<span class="sla ${s.cls}" title="${s.label}"><span class="num">${s.el}/${s.sla}</span> يوم<span class="bar"><i style="width:${w}%"></i></span></span>`; }
  if (s.el != null) return `<span class="sla ${s.cls}">${s.label} · <span class="num">${s.el}</span> يوم</span>`;
  return `<span class="sla ${s.cls}">${s.label}</span>`;
}
function statusBadge(inv) {
  const s = slaState(inv);
  return `<span class="bd dot ${s.cls}">${s.label}</span>`;
}
const catBadge = inv => inv.cat ? `<span class="cat" title="${esc(DB.categories[inv.cat].name)}">${inv.cat}</span>` : inv.suggestedCat ? `<span class="cat sug" title="مقترحة: ${esc(DB.categories[inv.suggestedCat].name)}">${inv.suggestedCat}؟</span>` : `<span class="cat x">—</span>`;
function select(id, options, value = '', attrs = '') {
  return `<select class="sel" id="${id}" ${attrs}>${options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
}
const field = (label, control, { req = false, hint = '', id = '' } = {}) => `<div class="fld">${label ? `<label ${id ? `for="${id}"` : ''}>${label}${req ? ' <span class="req">*</span>' : ''}</label>` : ''}${control}${hint ? `<div class="h">${hint}</div>` : ''}</div>`;
const emptyState = (ic, title, sub = '', action = '') => `<div class="empty"><div class="ic">${icon(ic)}</div><b>${title}</b>${sub}${action ? `<div style="margin-top:12px">${action}</div>` : ''}</div>`;
/** منطقة رفع ملفات — onFiles اسم دالة global بتاخد FileList */
const dropZone = (id, title, sub, onFiles, accept = '') => `<label class="drop" id="${id}" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="event.preventDefault();this.classList.remove('over');${onFiles}(event.dataTransfer.files)"><div class="ic">${icon('upload-cloud')}</div><b>${title}</b><div class="sm mut">${sub}</div><input type="file" hidden ${accept ? `accept="${accept}"` : ''} multiple onchange="${onFiles}(this.files)"></label>`;
/** صف المستخلص في جدول — مشترك بين صندوق الوارد والقوائم */
function invRowCells(i, { showCo = true } = {}) {
  const c = ctx(i), t = invTotals(i);
  return `<td><b class="num">${esc(i.no)}</b><div class="sm mut">${esc(c.ao.no)}</div></td>${showCo ? `<td>${esc(c.company.name)}</td>` : ''}<td><div>${esc(i.pathName || c.project.name)}</div><div class="sm mut">${esc(c.central.name)} · ${esc(i.kind || '')}</div></td><td>${catBadge(i)}</td><td>${esc(holderLabel(i))}</td><td>${slaChip(i)}</td><td class="n"><span class="money">${money(t.gross)}</span></td>`;
}

/* ───────────────────────── modal / toast / confirm ───────────────────────── */
function modal(title, body, foot, { size = '' } = {}) { S.modal = `<div class="scrim" onclick="if(event.target===this)closeModal()"><div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="mh"><h3>${title}</h3><button class="btn sm icon gh" onclick="closeModal()" aria-label="إغلاق">${icon('x')}</button></div><div class="mb2">${body}</div>${foot ? `<div class="mf">${foot}</div>` : ''}</div></div>`; render(); }
function closeModal() { S.modal = ''; render(); }
function confirmBox(title, msg, yesLabel, onYes, cls = 'pr') { window.__confirm = onYes; modal(title, `<p style="margin:0">${msg}</p>`, `<button class="btn ${cls}" onclick="closeModal();window.__confirm()">${yesLabel}</button><button class="btn" onclick="closeModal()">إلغاء</button>`); }
function toast(msg, kind = '') { const t = document.createElement('div'); t.className = 'toast ' + kind; t.innerHTML = icon(kind === 'err' ? 'alert-circle' : 'check-circle-2') + esc(msg); document.body.appendChild(t); icons(); setTimeout(() => t.remove(), 2800); }

/* ───────────────────────── shell ───────────────────────── */
function icons() { if (window.lucide) lucide.createIcons(); }
function render() {
  const app = document.getElementById('app');
  if (!S.user) { app.innerHTML = vLogin(); return icons(); }
  const v = VIEWS[S.route];
  let body;
  try { body = v ? v.render(S.params || {}) : emptyState('construction', 'الصفحة دي لسه بتتبني', `<div>${esc(S.route)}</div>`); }
  catch (err) { console.error(err); body = `<div class="alert r">${icon('alert-octagon')}<div><b>حصل خطأ في الصفحة</b><div class="sm">${esc(err.message)}</div></div></div>`; }
  app.innerHTML = `${vHeader()}<div class="subbar">${icon('flask-conical')} ديمو — بيانات تجريبية · تاريخ النهارده: <span class="num">${fmtD(TODAY)}</span> · الإيميلات بتتسجل في "سجل الإيميلات" بدل ما تتبعت</div><div class="wrap">${vSide()}<main class="main" id="main">${body}</main></div>${S.modal || ''}${S.cmdk ? vCmdk() : ''}`;
  icons();
  if (v && v.after) v.after(S.params || {});
  if (S.cmdk) document.getElementById('cmdq')?.focus();
}
function vHeader() {
  const u = S.user, myN = DB.notifications.filter(n => n.userId === u.id), unread = myN.filter(n => !n.read).length;
  return `<header class="hdr">
    <button class="ib" onclick="toggleSide()" aria-label="القائمة">${icon('panel-right')}</button>
    <img class="logo" src="assets/we-mark.png" alt="WE">
    <div class="ttl">منظومة تتبع المستخلصات<small>المصرية للاتصالات · إدارة المتابعة PMO</small></div>
    <div class="sp"></div>
    <button class="search" onclick="openCmdk()">${icon('search')}<span>ابحث عن مستخلص، عقد، أمر تكليف…</span><kbd>Ctrl K</kbd></button>
    <button class="ib" onclick="toggleTheme()" aria-label="الوضع الداكن">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
    <button class="ib" onclick="S.notifOpen=!S.notifOpen;S.whoOpen=false;render()" aria-label="الإشعارات">${icon('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button>
    <button class="who" onclick="S.whoOpen=!S.whoOpen;S.notifOpen=false;render()"><span class="av">${esc(u.name.replace(/^(م\.|أ\.)\s*/, '').slice(0, 1))}</span><span>${esc(u.name)}</span>${icon('chevron-down')}</button>
    ${S.notifOpen ? vNotif(myN) : ''}${S.whoOpen ? vWho() : ''}
  </header>`;
}
function vNotif(list) {
  return `<div class="pop"><div class="ph2">${icon('bell')} الإشعارات<span class="sp1"></span><button class="btn sm gh" onclick="DB.notifications.forEach(n=>{if(n.userId===S.user.id)n.read=true});render()">تعليم الكل كمقروء</button></div>
  ${list.length ? list.slice(0, 30).map(n => `<div class="it ${n.read ? '' : 'unread'}" onclick="DB.notifications.find(x=>x.id==='${n.id}').read=true;openInv('${n.invoiceId}')"><span class="ic">${icon('file-text')}</span><div>${esc(n.title)}<small>${fmtD(n.date)}</small></div></div>`).join('') : emptyState('bell-off', 'مفيش إشعارات')}</div>`;
}
function vWho() {
  const u = S.user;
  return `<div class="pop who-pop"><div class="cb" style="padding:14px"><b>${esc(u.name)}</b><div class="sm mut">${esc(u.email)}</div><div class="row" style="margin-top:8px"><span class="bd p">${esc(DB.roles[u.role].label)}</span><span class="bd n">${esc(scopeLabel(u.scope))}</span></div></div>
  <div class="it" onclick="S.user=null;S.whoOpen=false;render()"><span class="ic">${icon('repeat')}</span><div>تبديل المستخدم (ديمو)<small>جرّب المنظومة بدور تاني</small></div></div>
  <div class="it" onclick="S.user=null;S.whoOpen=false;render()"><span class="ic">${icon('log-out')}</span><div>تسجيل الخروج</div></div></div>`;
}
function vSide() {
  return `<nav class="side" aria-label="القائمة الرئيسية">${NAV.map(sec => { const its = sec.items.filter(it => navAllowed(it)); if (!its.length) return ''; return `<div class="sec">${sec.sec}</div>${its.map(it => { const c = it.count ? it.count() : 0; return `<a class="${S.route === it.key || (it.key === 'invoices' && S.route === 'invoice') ? 'on' : ''}" onclick="go('${it.key}')" title="${it.label}">${icon(it.icon)}<span class="lbl">${it.label}</span>${c ? `<span class="cnt">${c}</span>` : ''}</a>`; }).join('')}`; }).join('')}</nav>`;
}
function toggleSide() { if (innerWidth <= 860) document.body.classList.toggle('navopen'); else { document.body.classList.toggle('collapsed'); try { localStorage.setItem('collapsed', document.body.classList.contains('collapsed') ? '1' : ''); } catch (e) {} } }
function toggleTheme() { const r = document.documentElement; const dark = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches); r.dataset.theme = dark ? 'light' : 'dark'; try { localStorage.setItem('theme', r.dataset.theme); } catch (e) {} render(); }

/* ── login (اختيار مستخدم تجريبي) ── */
function vLogin() {
  const groups = groupBy(DB.users, u => u.role);
  return `<div class="login"><div class="brandside"><img src="assets/we-mark-white.png" alt="WE"><div><h1>المستخلص من التقديم لحد الصرف، في مكان واحد</h1><p>الشركة تقدّم وتتابع، وكل إدارة تعتمد أو ترجّع بسبب واضح، والسيستم يعدّ أيام العمل ويبعت الإيميلات.</p>
  <ul><li>${icon('file-spreadsheet')} بنود ومهمات من Excel والأسعار من العقد</li><li>${icon('git-branch')} مسار حسب فئة التجاوز C1–C5</li><li>${icon('shield-check')} كل مستخدم يشوف نطاقه بس</li><li>${icon('file-down')} تقارير وتصدير بأي فلتر</li></ul></div><div class="sm" style="opacity:.6">إدارة المتابعة PMO · المصرية للاتصالات</div></div>
  <div class="form"><div class="box"><h2>تسجيل الدخول</h2><p class="mut" style="margin:0 0 14px">في الديمو: اختار مستخدم عشان تشوف المنظومة بعينه وصلاحياته.</p>
  <div class="row mb"><input class="in" placeholder="البريد الإلكتروني" disabled><input class="in" type="password" placeholder="كلمة السر" disabled></div>
  <div class="acc">${Object.entries(groups).map(([r, us]) => `<div class="sm mut b" style="margin-top:6px">${esc(DB.roles[r].label)}</div>${us.map(u => { const n = visibleInvoices(u).filter(i => canAct(i, u)).length; return `<button onclick="login('${u.id}')"><span class="av">${esc(u.name.replace(/^(م\.|أ\.)\s*/, '').slice(0, 1))}</span><span class="sp1">${esc(u.name)}<small>${esc(scopeLabel(u.scope))}</small></span>${n ? `<span class="bd p" title="مستخلصات مستنياه">${N(n)} مستنياه</span>` : ''}</button>`; }).join('')}`).join('')}</div></div></div></div>`;
}
function login(id) { S.user = userById(id); S.ui = {}; go('home'); }

/* ── command palette (Ctrl+K) ── */
function openCmdk() { S.cmdk = { q: '', i: 0 }; render(); }
function cmdkResults(q) {
  q = q.trim();
  const inv = visibleInvoices().filter(i => { const c = ctx(i); return !q || [i.no, i.pathName, c.company.name, c.ao.no, c.contract.no, c.project.name, c.central.name].join(' ').includes(q); }).slice(0, 8)
    .map(i => ({ ic: 'file-text', t: `مستخلص ${ctx(i).company.name} رقم ${i.no}`, s: ctx(i).ao.no, run: () => openInv(i.id) }));
  const pages = NAV.flatMap(s => s.items).filter(it => navAllowed(it) && (!q || it.label.includes(q))).map(it => ({ ic: it.icon, t: it.label, s: 'صفحة', run: () => go(it.key) }));
  return [...(inv.length ? [{ grp: 'المستخلصات' }, ...inv] : []), ...(pages.length ? [{ grp: 'الصفحات' }, ...pages] : [])];
}
function vCmdk() {
  const res = cmdkResults(S.cmdk.q), items = res.filter(r => !r.grp); S.cmdk.items = items;
  let k = -1;
  return `<div class="scrim cmdk" onclick="if(event.target===this){S.cmdk=null;render()}"><div class="box"><div class="q">${icon('search')}<input id="cmdq" value="${esc(S.cmdk.q)}" placeholder="اكتب رقم مستخلص، اسم شركة، أمر تكليف أو صفحة…" oninput="S.cmdk.q=this.value;S.cmdk.i=0;render();const e=document.getElementById('cmdq');e.setSelectionRange(e.value.length,e.value.length)" onkeydown="cmdkKey(event)"></div>
  <div class="res">${res.length ? res.map(r => r.grp ? `<div class="grp">${r.grp}</div>` : (k++, `<div class="r ${k === S.cmdk.i ? 'on' : ''}" onclick="S.cmdk.items[${k}].run();S.cmdk=null;render()">${icon(r.ic)}<span>${esc(r.t)}</span><small>${esc(r.s)}</small></div>`)).join('') : emptyState('search-x', 'مفيش نتائج')}</div>
  <div class="foot"><span><kbd>↑</kbd> <kbd>↓</kbd> تنقل</span><span><kbd>Enter</kbd> فتح</span><span><kbd>Esc</kbd> إغلاق</span></div></div></div>`;
}
function cmdkKey(e) {
  const n = (S.cmdk.items || []).length;
  if (e.key === 'ArrowDown') { S.cmdk.i = (S.cmdk.i + 1) % Math.max(n, 1); render(); }
  else if (e.key === 'ArrowUp') { S.cmdk.i = (S.cmdk.i - 1 + n) % Math.max(n, 1); render(); }
  else if (e.key === 'Enter' && n) { const it = S.cmdk.items[S.cmdk.i]; S.cmdk = null; it.run(); }
  else if (e.key === 'Escape') { S.cmdk = null; render(); }
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && S.user) { e.preventDefault(); openCmdk(); }
  else if (e.key === 'Escape' && S.modal) closeModal();
});

/* ───────────────────────── boot ───────────────────────── */
function boot() {
  try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; if (localStorage.getItem('collapsed')) document.body.classList.add('collapsed'); } catch (e) {}
  seedInvoices();
  render();
}
