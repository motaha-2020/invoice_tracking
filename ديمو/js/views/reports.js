/* ============================================================
   views/reports.js — لوحة الإدارة (dash) + التقارير والتصدير (reports)
   + الاستقطاعات والضمانات (deductions) + سجل الإيميلات (emails)
   القاعدة: كل حاجة هنا بتبدأ من visibleInvoices() — كل مستخدم يشوف نطاقه بس
   (الشركة حاجتها، رئيس القطاع قطاعه، المدير العام إدارته العامة...)
   الحالة كلها في S.ui.rep — والدوال global بـ prefix rep_
   ============================================================ */

/* ───────────────────────── state + helpers ───────────────────────── */
function rep_ui() {
  S.ui.rep = S.ui.rep || {};
  const u = S.ui.rep;
  u.f = u.f || {};
  u.g = u.g || 'none';
  u.org = u.org || rep_defOrg();
  u.released = u.released || {};
  u.em = u.em || { q: '', rcpt: '', inv: '', from: '', until: '', lim: 60 };
  u.ded = u.ded || { co: '' };
  u.lim = u.lim || 200;
  return u;
}
/** المستوى الافتراضي في "حسب الجهة" = المستوى اللي تحت نطاق المستخدم */
function rep_defOrg() {
  const t = S.user && S.user.scope ? S.user.scope.type : 'all';
  return { all: 'sector', presidency: 'sector', sector: 'gdept', gdept: 'dept', dept: 'central', central: 'central' }[t] || 'sector';
}
const rep_r2 = v => Math.round((+v || 0) * 100) / 100;
const rep_avg = (arr, f) => arr.length ? sum(arr, f) / arr.length : null;
const REP_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const rep_monthLbl = m => REP_MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
const rep_subDate = inv => { const e = inv.log.find(x => x.action === 'submit'); return e ? new Date(e.date) : null; };
/** المحطة اللي ماسكة المستخلص دلوقتي (مفتاح) */
const rep_key = i => i.status === 'active' ? i.step : i.status === 'returned' ? i.returnTo : i.status === 'on_hold' ? 'hold' : i.status === 'paid' ? 'done' : 'draft';
const rep_keyLbl = k => k === 'hold' ? 'معلّق' : k === 'draft' ? 'مسودة' : k === 'company' ? 'الشركة (مرتجع)' : stepShort(k);
const REP_STEP_ORDER = () => ['company', ...Object.keys(DB.steps).filter(k => k !== 'company'), 'hold', 'done', 'draft'];
const rep_dayDiff = (a, b) => Math.round((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / DAY);

/* صف محسوب لكل مستخلص (cache بيتصفّر مع كل رسم عشان أي حركة Flow تبان فوراً) */
let rep_cache = new Map();
function rep_row(inv) {
  let r = rep_cache.get(inv);
  if (r) return r;
  const c = ctx(inv), t = invTotals(inv), s = slaState(inv), sub = rep_subDate(inv);
  r = {
    inv, id: inv.id, c, t, s, sub,
    cy: sub ? cycleDays(inv) : { total: null, company: 0 },
    key: rep_key(inv), cat: inv.cat || inv.suggestedCat || '',
    late: s.k === 'late', paid: inv.status === 'paid' ? ((inv.payment && inv.payment.amount) || 0) : 0,
    inflight: ['active', 'returned', 'on_hold'].includes(inv.status),
  };
  rep_cache.set(inv, r);
  return r;
}
const rep_rows = (list = visibleInvoices()) => list.map(rep_row);

/** زمن كل محطة — نفس stepDurations في core بس من غير صفوف "تحديد الفئة"
   (core بيحسبها كمحطة منفصلة بـ 0 يوم فبتبوّظ المتوسطات) */
function rep_stepDur(inv) {
  const out = [];
  inv.log.forEach((e, i) => {
    if (!['submit', 'approve', 'resubmit'].includes(e.action) || !e.to || e.to === 'done' || e.to === 'company') return;
    const next = inv.log.slice(i + 1).find(x => ['approve', 'return', 'pay'].includes(x.action) && x.step === e.to);
    const days = wdBetween(e.date, next ? next.date : (inv.status === 'paid' ? inv.since : TODAY));
    const sla = slaOf(inv, e.to);
    out.push({ step: e.to, days, sla, open: !next, late: sla != null && days > sla });
  });
  return out;
}

/* ───────────────────────── أبعاد الفلترة والتجميع ───────────────────────── */
const REP_ORG = ['presidency', 'sector', 'gdept', 'dept', 'central'];
const REP_DIMS = {
  company:    { l: 'الشركة',          o: r => r.c.company,    p: [] },
  contract:   { l: 'العقد',           o: r => r.c.contract,   p: ['company'], n: x => x.no },
  presidency: { l: 'رئاسة القطاعات',  o: r => r.c.presidency, p: [] },
  sector:     { l: 'القطاع',          o: r => r.c.sector,     p: ['presidency'] },
  gdept:      { l: 'الإدارة العامة',  o: r => r.c.gdept,      p: ['presidency', 'sector'] },
  dept:       { l: 'الإدارة المختصة', o: r => r.c.dept,       p: ['presidency', 'sector', 'gdept'] },
  central:    { l: 'السنترال',        o: r => r.c.central,    p: ['presidency', 'sector', 'gdept', 'dept'] },
  ptype:      { l: 'نوع المشروع',     o: r => r.c.type,       p: [] },
  project:    { l: 'المشروع',         o: r => r.c.project,    p: ['presidency', 'sector', 'gdept', 'dept', 'central', 'ptype'] },
  ao:         { l: 'أمر التكليف',     o: r => r.c.ao,         p: ['company', 'contract'], n: x => x.no },
};
const rep_dimName = (d, o) => (REP_DIMS[d].n || (x => x.name))(o);
const REP_FILTER_DIMS = ['company', 'contract', 'presidency', 'sector', 'gdept', 'dept', 'central', 'ptype', 'project'];
const REP_GROUPS = [['none', 'بدون تجميع'], ['company', 'الشركة'], ['contract', 'العقد'], ['ao', 'أمر التكليف'], ['presidency', 'رئاسة القطاعات'], ['sector', 'القطاع'], ['gdept', 'الإدارة العامة'], ['dept', 'الإدارة المختصة'], ['central', 'السنترال'], ['ptype', 'نوع المشروع'], ['project', 'المشروع'], ['step', 'المحطة الحالية'], ['cat', 'الفئة'], ['month', 'شهر التقديم']];
const rep_statusOpts = () => [['', 'كل الحالات'], ['active', 'تحت المراجعة'], ['late', 'متأخر'], ['returned', 'مرتجع'], ['on_hold', 'معلّق'], ['paid', 'تم الصرف'], ...(isCompany() ? [['draft', 'مسودة']] : [])];

/** اختيارات بُعد معيّن = اللي موجود في النطاق بعد فلاتر "الأب" بس (cascading) */
function rep_dimOpts(d, rows, f) {
  const def = REP_DIMS[d], m = new Map();
  rows.filter(r => def.p.every(pd => !f[pd] || REP_DIMS[pd].o(r).id === f[pd])).forEach(r => { const o = def.o(r); m.set(o.id, rep_dimName(d, o)); });
  return [...m.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'ar'));
}
/** لو اختيار "ابن" مابقاش موجود بعد تغيير الأب — يتشال */
function rep_fix(rows, f) {
  REP_FILTER_DIMS.forEach(d => { if (f[d] && !rep_dimOpts(d, rows, f).some(([id]) => id === f[d])) delete f[d]; });
  if (f.step && !rows.some(r => r.key === f.step)) delete f.step;
  if (f.status === 'draft' && !isCompany()) delete f.status;
}
function rep_apply(rows, f) {
  return rows.filter(r => {
    for (const d of REP_FILTER_DIMS) if (f[d] && REP_DIMS[d].o(r).id !== f[d]) return false;
    if (f.from || f.to) {
      if (!r.sub) return false;
      const d = iso(r.sub);
      if (f.from && d < f.from) return false;
      if (f.to && d > f.to) return false;
    }
    if (f.status && (f.status === 'late' ? !r.late : r.inv.status !== f.status)) return false;
    if (f.cat && r.cat !== f.cat) return false;
    if (f.step && r.key !== f.step) return false;
    return true;
  });
}
/** الصفوف بعد الفلاتر الحالية (بتستخدمها الشاشة والتصدير والاختبارات) */
function rep_filtered() {
  rep_cache = new Map();
  const u = rep_ui(), all = rep_rows();
  rep_fix(all, u.f);
  return rep_apply(all, u.f);
}
function rep_gk(r, g) {
  if (REP_DIMS[g]) { const o = REP_DIMS[g].o(r); return [o.id, rep_dimName(g, o)]; }
  if (g === 'step') return [r.key, rep_keyLbl(r.key)];
  if (g === 'cat') return [r.cat || '~', r.cat ? `${r.cat} — ${DB.categories[r.cat].name}` : 'من غير فئة'];
  if (g === 'month') { if (!r.sub) return ['~', 'لسه ما اتقدمش']; const m = iso(r.sub).slice(0, 7); return [m, rep_monthLbl(m)]; }
  return ['all', 'الإجمالي'];
}
function rep_agg(rows) {
  const cyc = rows.filter(r => r.inv.status === 'paid' && r.cy.total != null);
  return {
    n: rows.length, gross: sum(rows, r => r.t.gross), vat: sum(rows, r => r.t.vat), ded: sum(rows, r => r.t.dedTotal), net: sum(rows, r => r.t.net),
    paid: sum(rows, r => r.paid), paidN: rows.filter(r => r.inv.status === 'paid').length,
    late: rows.filter(r => r.late).length, live: rows.filter(r => r.inflight).length, cyc: rep_avg(cyc, r => r.cy.total), cycN: cyc.length,
  };
}
function rep_groups(rows, g) {
  const m = new Map();
  rows.forEach(r => { const [k, l] = rep_gk(r, g); if (!m.has(k)) m.set(k, { k, l, rows: [] }); m.get(k).rows.push(r); });
  const out = [...m.values()].map(x => ({ ...x, a: rep_agg(x.rows) }));
  if (g === 'month') out.sort((a, b) => String(b.k).localeCompare(String(a.k)));
  else if (g === 'step') { const o = REP_STEP_ORDER(); out.sort((a, b) => o.indexOf(a.k) - o.indexOf(b.k)); }
  else if (g === 'cat') out.sort((a, b) => String(a.k).localeCompare(String(b.k)));
  else out.sort((a, b) => b.a.gross - a.a.gross);
  return out;
}

/* ───────────────────────── رسومات صغيرة (CSS variables بس) ───────────────────────── */
function rep_donut(segs, label, size = 104) {
  const tot = sum(segs, s => s.v), R = 15.9155;
  let off = 0;
  const arcs = tot ? segs.filter(s => s.v).map(s => {
    const p = s.v / tot * 100;
    const a = `<circle cx="18" cy="18" r="${R}" fill="none" stroke-width="4.2" style="stroke:${s.c}" stroke-dasharray="${p.toFixed(3)} ${(100 - p).toFixed(3)}" stroke-dashoffset="${(25 - off).toFixed(3)}"><title>${esc(s.l)}: ${s.v}</title></circle>`;
    off += p; return a;
  }).join('') : '';
  return `<svg viewBox="0 0 36 36" width="${size}" height="${size}" role="img" aria-label="${esc(label)}"><circle cx="18" cy="18" r="${R}" fill="none" stroke-width="4.2" style="stroke:var(--sunken)"></circle>${arcs}<text x="18" y="19.5" text-anchor="middle" style="font-size:8px;font-weight:700;fill:var(--tx)">${tot}</text><text x="18" y="25" text-anchor="middle" style="font-size:3.4px;fill:var(--tx3)">شغال</text></svg>`;
}
function rep_spark(vals, label) {
  const w = 96, h = 22, max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => `${(i / Math.max(1, vals.length - 1) * w).toFixed(1)},${(h - 2 - v / max * (h - 4)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" style="vertical-align:middle;margin-inline-start:6px"><polyline points="${pts}" fill="none" style="stroke:var(--brand);stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round"></polyline></svg>`;
}
const REP_SEG = [
  { k: 'ok', l: 'في الميعاد', c: 'var(--ok6)' },
  { k: 'due', l: 'قرب الميعاد', c: 'var(--wa6)' },
  { k: 'late', l: 'متأخر', c: 'var(--cr6)' },
  { k: 'other', l: 'مرتجع / بدون SLA', c: 'var(--in6)' },
];
const rep_seg = r => ['ok', 'due', 'late'].includes(r.s.k) ? r.s.k : 'other';
const rep_legend = segs => `<div class="legend" aria-hidden="true">${segs.map(s => `<span><i style="background:${s.c}"></i>${s.l}</span>`).join('')}</div>`;
/** آخر 8 أسابيع: [{start, end, label}] */
function rep_weeks(n = 8) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const end = new Date(TODAY.getTime() - i * 7 * DAY + DAY), start = new Date(end.getTime() - 7 * DAY);
    out.push({ start, end, label: `${start.getDate()}/${start.getMonth() + 1}` });
  }
  return out;
}
const rep_in = (d, w) => d && new Date(d) >= w.start && new Date(d) < w.end;

/* ============================================================
   1) لوحة المتابعة للإدارة
   ============================================================ */
const REP_DASH_ROLES = ['pmo', 'admin', 'presidency_head', 'sector_head', 'gm', 'committee', 'planning', 'finance'];

View.register('dash', {
  title: 'لوحة المتابعة',
  render() {
    if (!REP_DASH_ROLES.includes(S.user.role)) return emptyState('lock', 'اللوحة دي للإدارة', '<div>تقدر تتابع مستخلصاتك من "كل المستخلصات"</div>', `<button class="btn pr" onclick="go('invoices')">كل المستخلصات</button>`);
    rep_cache = new Map();
    const u = rep_ui();
    const rows = rep_rows().filter(r => r.inv.status !== 'draft');
    const head = pageHeader({
      title: 'لوحة المتابعة',
      sub: `${esc(scopeLabel(S.user.scope))} · موقف النهارده <span class="num">${fmtD(TODAY)}</span>`,
      actions: can('reports.view') ? `<button class="btn" onclick="go('reports')">${icon('file-bar-chart')}التقارير والتصدير</button>` : '',
    });
    if (!rows.length) return head + `<div class="card">${emptyState('inbox', 'مفيش مستخلصات في نطاقك لسه', '<div>أول ما شركة تقدّم مستخلص هيظهر هنا</div>')}</div>`;

    const live = rows.filter(r => r.inflight), act = rows.filter(r => r.inv.status === 'active');
    const late = live.filter(r => r.late), due = live.filter(r => r.s.k === 'due');
    const ret = live.filter(r => r.inv.status === 'returned' && r.inv.returnTo === 'company');
    const hold = live.filter(r => r.inv.status === 'on_hold');
    const paid = rows.filter(r => r.inv.status === 'paid');
    const mStart = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    const paidM = paid.filter(r => new Date(r.inv.payment.date) >= mStart);
    const cyc = paid.filter(r => r.cy.total != null);
    const avgC = rep_avg(cyc, r => r.cy.total), avgSla = rep_avg(cyc, r => totalSla(r.cat || 'C1')), avgCo = rep_avg(cyc, r => r.cy.company);
    const weeks = rep_weeks();

    /* ── الجملة الرئيسية: استنتاج مش رقم ── */
    let headline, hcls = 'g';
    if (late.length) {
      const ranked = Object.entries(groupBy(late, r => r.key)).sort((a, b) => b[1].length - a[1].length), top = ranked[0];
      const share = top[1].length / late.length, tie = ranked[1] && ranked[1][1].length === top[1].length;
      headline = late.length === 1 ? `مستخلص واحد متأخر — عند ${rep_keyLbl(top[0])}`
        : tie ? `${late.length} مستخلصات متأخرة — موزّعين على ${ranked.length} محطات: ${ranked.slice(0, 3).map(x => rep_keyLbl(x[0])).join('، ')}`
        : `${late.length} مستخلصات متأخرة — ${share === 1 ? 'كلها' : share > 0.5 ? 'أغلبها' : 'أكترها'} عند ${rep_keyLbl(top[0])}`;
      hcls = 'r';
    } else if (due.length) { headline = `مفيش متأخر — بس ${due.length} قربوا يعدّوا الميعاد`; hcls = 'a'; }
    else headline = live.length ? 'كل المستخلصات الشغالة ماشية في الميعاد' : 'مفيش مستخلصات شغالة دلوقتي — كله اتصرف';
    const segCounts = [...REP_SEG.slice(0, 3).map(s => ({ ...s, v: live.filter(r => r.inv.status !== 'on_hold' && rep_seg(r) === s.k).length })),
      { l: 'مرتجع', c: 'var(--in6)', v: live.filter(r => r.inv.status === 'returned' || r.s.k === 'nosla').length }, { l: 'معلّق', c: 'var(--bd3)', v: hold.length }];
    const headCard = `<div class="card mb ${hcls === 'r' ? 'st-r' : hcls === 'a' ? 'st-a' : 'st-g'}"><div class="cb row" style="gap:20px;flex-wrap:nowrap">
      <div style="flex:1;min-width:0"><div class="sm mut b">الخلاصة</div><h2 style="margin:2px 0 6px;font-size:22px;line-height:1.35">${esc(headline)}</h2>
      <div class="mut">${N(late.length)} متأخر من ${N(live.length)} شغال · ${N(ret.length)} مرتجع عند الشركات · ${N(hold.length)} معلّق · ${N(paidM.length)} اتصرفوا الشهر ده</div>
      <div class="mt">${rep_legend(segCounts)}</div></div>
      <div style="flex:none">${rep_donut(segCounts, `توزيع ${live.length} مستخلص شغال حسب الحالة`)}</div></div></div>`;

    /* ── KPIs ── */
    const actVal = sum(act, r => r.t.gross);
    const paidSpark = weeks.map(w => sum(paid.filter(r => rep_in(r.inv.payment.date, w)), r => r.paid));
    const kpis = `<div class="grid mb" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
      ${kpi('file-clock', 'تحت المراجعة', act.length, `من ${live.length} شغال · <span class="money">${mShort(actVal)}</span> جنيه`)}
      ${kpi('alarm-clock', 'متأخر', late.length, `${pct(late.length, live.length).toFixed(0)}% من ${live.length} شغال`, late.length ? 'r' : 'g')}
      ${kpi('banknote', 'اتصرف الشهر ده', mShort(sum(paidM, r => r.paid)), `${paidM.length} مستخلص في ${REP_MONTHS[TODAY.getMonth()]}${rep_spark(paidSpark, 'المصروف في آخر 8 أسابيع')}`)}
      ${kpi('timer', 'متوسط الدورة (يوم عمل)', avgC == null ? '—' : avgC.toFixed(1), avgC == null ? 'لسه مفيش مستخلصات اتصرفت' : `الـ SLA ${avgSla.toFixed(1)} يوم · منها ${avgCo.toFixed(1)} عند الشركة · ${cyc.length} مصروف`, avgC == null ? '' : avgC > avgSla ? 'a' : 'g')}
      ${kpi('reply', 'مرتجع عند الشركات', ret.length, `من ${live.length} شغال`)}
      ${kpi('pause-circle', 'معلّق', hold.length, hold.length ? esc(hold[0].inv.holdReason || 'بانتظار أمر التكليف') : 'مفيش حاجة معلّقة')}
    </div>`;

    /* ── المتأخر فين وعند مين ── */
    const order = REP_STEP_ORDER();
    const byKey = groupBy(live.filter(r => r.inv.status !== 'on_hold'), r => r.key);
    const keys = Object.keys(byKey).sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const maxN = Math.max(1, ...keys.map(k => byKey[k].length));
    const stepBars = keys.length ? keys.map(k => {
      const list = byKey[k], cnt = s => list.filter(r => rep_seg(r) === s).length, lt = cnt('late');
      return `<div class="hbar" role="button" tabindex="0" style="cursor:pointer" onclick="rep_toInv('${esc(k)}')" onkeydown="if(event.key==='Enter')rep_toInv('${esc(k)}')" aria-label="${esc(rep_keyLbl(k))}: ${list.length} مستخلص، منهم ${lt} متأخر — افتح القائمة">
        <div class="nm">${esc(rep_keyLbl(k))}<small>${lt ? `${lt} متأخر من ${list.length}` : `${list.length} مستخلص`}</small></div>
        <div class="bar">${REP_SEG.map(s => { const v = cnt(s.k); return v ? `<span style="width:${(v / maxN * 100).toFixed(1)}%;background:${s.c}" title="${s.l}: ${v}"></span>` : ''; }).join('')}</div>
        <div class="vv">${N(list.length)}</div></div>`;
    }).join('') : emptyState('check-circle-2', 'مفيش حاجة شغالة في أي محطة');
    const stepCard = `<div class="card"><div class="ch"><h3>المتأخر فين وعند مين</h3><span class="sub">دوس على المحطة تفتح مستخلصاتها</span><span class="sp"></span>${rep_legend(REP_SEG)}</div><div class="cb">${stepBars}</div></div>`;

    /* ── محتاج انتباه ── */
    const att = act.filter(r => r.s.sla != null && r.s.el >= r.s.sla).sort((a, b) => (b.s.el - b.s.sla) - (a.s.el - a.s.sla)).slice(0, 8);
    const attCard = `<div class="card"><div class="ch"><h3>محتاج انتباه</h3><span class="sub">الأكتر تأخير — ${att.length} من ${late.length + due.length}</span></div>
      ${att.length ? `<div class="tw"><table><thead><tr><th>المستخلص</th><th>عند مين</th><th class="n">التأخير</th></tr></thead><tbody>${att.map(r => {
        const over = r.s.el - r.s.sla, who = stepHolders(r.inv, r.inv.step).map(x => x.name);
        return `<tr class="click ${over > 0 ? 'flag' : 'warn'}" onclick="openInv('${esc(r.id)}')"><td><b class="num">${esc(r.inv.no)}</b> <span class="sm">${esc(r.c.company.name)}</span><div class="sm mut">${esc(r.c.ao.no)} · ${esc(r.c.central.name)}</div></td>
        <td>${esc(holderLabel(r.inv))}<div class="sm mut">${esc(who.slice(0, 2).join('، ') || '—')}</div></td>
        <td class="n">${over > 0 ? `<span class="bd r">+${over} يوم</span>` : `<span class="bd a">آخر يوم</span>`}<div class="sm mut"><span class="num">${r.s.el}/${r.s.sla}</span></div></td></tr>`;
      }).join('')}</tbody></table></div>` : emptyState('party-popper', 'مفيش حاجة متأخرة', '<div>كل المحطات جوه الـ SLA</div>')}</div>`;

    /* ── حسب الشركة ── */
    const coG = Object.values(groupBy(rows, r => r.c.company.id)).map(rs => {
      const lv = rs.filter(r => r.inflight), sb = rs.filter(r => r.sub);
      return { co: rs[0].c.company, n: rs.length, live: lv.length, late: lv.filter(r => r.late).length, val: sum(lv, r => r.t.gross), coDays: rep_avg(sb, r => r.cy.company), ret: rs.filter(r => r.inv.log.some(e => e.action === 'return' && e.to === 'company')).length };
    }).sort((a, b) => b.val - a.val);
    const coCard = `<div class="card"><div class="ch"><h3>حسب الشركة</h3><span class="sub">${coG.length} شركة في نطاقك</span></div><div class="tw"><table><thead><tr><th>الشركة</th><th class="n">شغال</th><th class="n">متأخر</th><th class="n">تحت المراجعة (جنيه)</th><th class="n" title="متوسط أيام العمل اللي المستخلص قعدها عند الشركة بسبب الإرجاع">أيام عند الشركة</th></tr></thead><tbody>
      ${coG.map(x => `<tr><td><b>${esc(x.co.name)}</b><div class="sm mut">${x.ret} اترجعلها من ${x.n}</div></td><td class="n">${N(x.live)}</td><td class="n">${x.late ? `<span class="bd r">${x.late} من ${x.live}</span>` : N(0)}</td><td class="n"><span class="money">${money(x.val)}</span></td><td class="n">${x.coDays == null ? '—' : N(x.coDays.toFixed(1))}</td></tr>`).join('')}
      </tbody></table></div></div>`;

    /* ── حسب الفئة ── */
    const catRows = Object.keys(DB.categories).map(cat => {
      const rs = rows.filter(r => r.cat === cat), pd = rs.filter(r => r.inv.status === 'paid' && r.cy.total != null), sla = totalSla(cat);
      const onTime = rs.filter(r => r.inv.status === 'paid' ? (r.cy.total != null && r.cy.total - r.cy.company <= sla) : !r.late).length;
      return { cat, n: rs.length, avg: rep_avg(pd, r => r.cy.total), pdN: pd.length, sla, onTime };
    });
    const catCard = `<div class="card"><div class="ch"><h3>حسب الفئة</h3><span class="sub">الدورة الفعلية للمصروف مقابل SLA المسار كله</span></div><div class="tw"><table><thead><tr><th>الفئة</th><th class="n">عدد</th><th>الدورة مقابل الـ SLA</th><th class="n">في الميعاد</th></tr></thead><tbody>
      ${catRows.map(x => `<tr><td><span class="cat">${x.cat}</span><div class="sm mut">${esc(DB.categories[x.cat].name)}</div></td><td class="n">${N(x.n)}</td>
      <td style="min-width:150px">${x.avg == null ? `<span class="sm mut">لسه مفيش مصروف · SLA ${x.sla} يوم</span>` : `<div class="sm"><span class="num">${x.avg.toFixed(1)}</span> من <span class="num">${x.sla}</span> يوم <span class="mut">(${x.pdN} مصروف)</span></div><div class="prog ${x.avg > x.sla ? 'r' : 'g'}" role="progressbar" aria-valuenow="${x.avg.toFixed(1)}" aria-valuemax="${x.sla}" aria-label="متوسط الدورة ${x.cat}"><span style="width:${Math.min(100, x.avg / x.sla * 100).toFixed(0)}%"></span></div>`}</td>
      <td class="n">${x.n ? `${N(pct(x.onTime, x.n).toFixed(0) + '%')}<div class="sm mut">${x.onTime} من ${x.n}</div>` : '—'}</td></tr>`).join('')}
      </tbody></table></div><div class="cf">في الميعاد = المصروف اللي وقته عند المصرية (من غير أيام الشركة) جوه الـ SLA، والشغال اللي مش متأخر في محطته</div></div>`;

    /* ── حسب الجهة ── */
    const lvl = u.org, lvLbl = { presidency: 'رئاسة', sector: 'قطاع', gdept: 'إدارة عامة', dept: 'إدارة مختصة', central: 'سنترال' };
    const orgG = rep_groups(rows, lvl);
    const orgCard = `<div class="card"><div class="ch"><h3>حسب الجهة</h3><span class="sp"></span><div class="row" role="group" aria-label="مستوى الهيكل">${REP_ORG.map(k => `<button class="chip ${k === lvl ? 'on' : ''}" aria-pressed="${k === lvl}" onclick="rep_ui().org='${k}';render()">${lvLbl[k]}</button>`).join('')}</div></div>
      <div class="tw"><table><thead><tr><th>${esc(REP_DIMS[lvl].l)}</th><th class="n">مستخلصات</th><th class="n">شغال</th><th class="n">متأخر</th><th class="n">القيمة (جنيه)</th><th class="n">المصروف (جنيه)</th></tr></thead><tbody>
      ${orgG.map(g => `<tr><td>${esc(g.l)}</td><td class="n">${N(g.a.n)}</td><td class="n">${N(g.a.live)}</td><td class="n">${g.a.late ? `<span class="bd r">${g.a.late} من ${g.a.live}</span>` : N(0)}</td><td class="n"><span class="money">${money(g.a.gross)}</span></td><td class="n"><span class="money">${money(g.a.paid)}</span></td></tr>`).join('')}
      </tbody></table></div></div>`;

    /* ── الاتجاه: آخر 8 أسابيع ── */
    const tr = weeks.map(w => ({ ...w, s: rows.filter(r => rep_in(r.sub, w)).length, p: paid.filter(r => rep_in(r.inv.payment.date, w)).length }));
    const tMax = Math.max(1, ...tr.map(x => Math.max(x.s, x.p)));
    const bar = (v, c, t) => `<span title="${t}: ${v}" style="width:42%;max-width:18px;height:${Math.max(v ? 4 : 0, v / tMax * 100).toFixed(0)}%;background:${c};border-radius:2px 2px 0 0"></span>`;
    const trendCard = `<div class="card"><div class="ch"><h3>آخر 8 أسابيع</h3><span class="sub">${sum(tr, x => x.s)} اتقدم · ${sum(tr, x => x.p)} اتصرف</span><span class="sp"></span>${rep_legend([{ l: 'اتقدم', c: 'var(--brand)' }, { l: 'اتصرف', c: 'var(--ok6)' }])}</div>
      <div class="cb"><div role="img" aria-label="عدد المستخلصات المقدمة والمصروفة أسبوعياً لآخر 8 أسابيع" style="display:flex;gap:6px;align-items:stretch;height:170px">
      ${tr.map(x => `<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><div class="sm num" style="text-align:center;color:var(--tx3)">${x.s}·${x.p}</div><div style="flex:1;display:flex;gap:3px;align-items:flex-end;justify-content:center;border-bottom:1px solid var(--bd2)">${bar(x.s, 'var(--brand)', 'اتقدم')}${bar(x.p, 'var(--ok6)', 'اتصرف')}</div><div class="sm mut num" style="text-align:center">${x.label}</div></div>`).join('')}
      </div></div><div class="cf">كل عمود = أسبوع يبدأ من التاريخ المكتوب تحته</div></div>`;

    return head + headCard + kpis
      + `<div class="grid g21 mb">${stepCard}${attCard}</div>`
      + `<div class="grid g2 mb">${coCard}${catCard}</div>`
      + `<div class="grid g21">${orgCard}${trendCard}</div>`;
  },
});
/** من اللوحة لقائمة المستخلصات بفلتر المحطة (شاشة invoices بتاعة agent تاني — بنسيب له التلميح) */
function rep_toInv(key) { S.ui.inv = { ...(S.ui.inv || {}), f: { step: key } }; go('invoices'); }

/* ============================================================
   2) التقارير والتصدير
   ============================================================ */
const REP_PRESETS = {
  late:     { t: 'تقرير المتأخرات اليومي', ic: 'alarm-clock', d: 'كل اللي عدّى الـ SLA النهارده، مجمّع حسب المحطة', f: () => ({ status: 'late' }), g: () => 'step' },
  weekly:   { t: 'تقرير أسبوعي للإدارة العليا', ic: 'presentation', d: 'الموقف كله حسب الجهة + اللي اتقدم واتصرف الأسبوع ده', f: () => ({}), g: () => (S.user.scope.type === 'all' ? 'presidency' : rep_defOrg()), mode: 'weekly' },
  tracker:  { t: 'موقف مستخلصات شركة', ic: 'table-2', d: 'نفس أعمدة شيت الموقف: أمر التكليف، المسار، المبالغ، موقف الفاتورة', f: rows => ({ company: (rows[0] && rows[0].c.company.id) || '' }), g: () => 'none', mode: 'tracker' },
  paidByK:  { t: 'المنصرف حسب العقد', ic: 'banknote', d: 'المستخلصات المصروفة بالإجمالي والاستقطاعات والصافي لكل عقد', f: () => ({ status: 'paid' }), g: () => 'contract' },
  steps:    { t: 'أداء المحطات', ic: 'gauge', d: 'متوسط أيام كل محطة مقابل الـ SLA ونسبة التأخير', f: () => ({}), g: () => 'none', mode: 'steps' },
};
function rep_preset(k) {
  const u = rep_ui();
  if (u.preset === k) { u.preset = null; render(); return; }
  rep_cache = new Map();
  const p = REP_PRESETS[k], rows = rep_rows();
  u.preset = k; u.f = p.f(rows); u.g = p.g(); u.lim = 200;
  render();
}
function rep_presetGo(k) { rep_ui().preset = null; go('reports'); rep_preset(k); }
function rep_setF(k, v) { const u = rep_ui(); if (v) u.f[k] = v; else delete u.f[k]; u.lim = 200; render(); }
function rep_range(k) {
  const u = rep_ui(), y = TODAY.getFullYear(), m = TODAY.getMonth();
  const from = k === 'month' ? new Date(y, m, 1) : k === 'q' ? new Date(y, m - 2, 1) : k === 'year' ? new Date(y, 0, 1) : null;
  if (from) { u.f.from = iso(from); u.f.to = iso(TODAY); u.range = k; } else { delete u.f.from; delete u.f.to; u.range = ''; }
  render();
}
function rep_clear() { const u = rep_ui(); u.f = {}; u.g = 'none'; u.preset = null; u.range = ''; u.lim = 200; render(); }

/** موقف الفاتورة بالنص (زي عمود "موقف الفاتورة" في شيت المتابعة) */
function rep_position(r) {
  const i = r.inv, s = r.s;
  if (i.status === 'paid') return `تم الصرف ${fmtD(i.payment.date)} — ${i.payment.method || ''} ${i.payment.ref || ''}`.trim();
  if (i.status === 'draft') return 'مسودة عند الشركة';
  if (i.status === 'on_hold') return `معلّق — ${i.holdReason || 'بانتظار أمر التكليف'}`;
  if (i.status === 'returned') return `${i.returnTo === 'company' ? 'مرتجع للشركة' : 'مرتجع لـ ' + stepShort(i.returnTo)} من ${stepShort(i.returnedFrom)} — ${s.el} يوم`;
  return `عند ${stepShort(i.step)} — ${s.el}${s.sla != null ? '/' + s.sla : ''} يوم${s.k === 'late' ? ' (متأخر)' : ''}`;
}
/* أعمدة الجدول التفصيلي: h عنوان، x قيمة الـ Excel، c (اختياري) HTML، n رقمي، tot يتجمع */
const REP_COLS = [
  { h: 'رقم المستخلص', x: r => r.inv.no, c: r => `<b class="num">${esc(r.inv.no)}</b>` },
  { h: 'الشركة', x: r => r.c.company.name },
  { h: 'العقد', x: r => r.c.contract.no, c: r => `<span class="num">${esc(r.c.contract.no)}</span>` },
  { h: 'أمر التكليف', x: r => r.c.ao.no, c: r => `<span class="num">${esc(r.c.ao.no)}</span>` },
  { h: 'اسم المسار', x: r => r.inv.pathName || '', c: r => `<span style="display:inline-block;min-width:200px">${esc(r.inv.pathName || '')}</span>` },
  { h: 'النوع', x: r => r.inv.kind || '' },
  { h: 'المشروع', x: r => r.c.project.name },
  { h: 'السنترال', x: r => r.c.central.name },
  { h: 'الإدارة المختصة', x: r => r.c.dept.name },
  { h: 'الإدارة العامة', x: r => r.c.gdept.name },
  { h: 'القطاع', x: r => r.c.sector.name },
  { h: 'رئاسة القطاعات', x: r => r.c.presidency.name },
  { h: 'الفئة', x: r => r.cat ? r.cat + (r.inv.cat ? '' : ' (مقترحة)') : '', c: r => catBadge(r.inv) },
  { h: 'الحالة', x: r => r.s.label, c: r => statusBadge(r.inv) },
  { h: 'عند مين', x: r => holderLabel(r.inv) },
  { h: 'أيام في المحطة', x: r => r.inflight ? r.s.el : '', n: 1 },
  { h: 'الـ SLA', x: r => r.inflight && r.s.sla != null ? r.s.sla : '', n: 1 },
  { h: 'تاريخ التقديم', x: r => r.sub ? iso(r.sub) : '', c: r => r.sub ? `<span class="num">${fmtD(r.sub)}</span>` : '—' },
  { h: 'الإجمالي', x: r => rep_r2(r.t.gross), m: 1, n: 1, tot: 1 },
  { h: 'الصافي', x: r => rep_r2(r.t.net), m: 1, n: 1, tot: 1 },
  { h: 'تاريخ الصرف', x: r => r.inv.payment ? iso(r.inv.payment.date) : '', c: r => r.inv.payment ? `<span class="num">${fmtD(r.inv.payment.date)}</span>` : '—' },
  { h: 'مرجع الصرف', x: r => r.inv.payment ? `${r.inv.payment.method || ''} ${r.inv.payment.ref || ''}`.trim() : '' },
];
const REP_TRACKER_COLS = [
  { h: 'م', x: (r, i) => i + 1, n: 1 },
  { h: 'أمر التكليف', x: r => r.c.ao.no, c: r => `<span class="num">${esc(r.c.ao.no)}</span>` },
  { h: 'رقم المستخلص', x: r => r.inv.no, c: r => `<b class="num">${esc(r.inv.no)}</b>` },
  { h: 'اسم المسار', x: r => r.inv.pathName || '' },
  { h: 'القطاع', x: r => r.c.sector.name },
  { h: 'نطاق', x: r => r.c.central.name, c: r => `${esc(r.c.central.name)}<div class="sm mut">${esc(r.c.dept.name)}</div>` },
  { h: 'المبلغ غير شامل', x: r => rep_r2(r.t.gross), m: 1, n: 1, tot: 1 },
  { h: 'المبلغ شامل', x: r => rep_r2(r.t.gross + r.t.vat), m: 1, n: 1, tot: 1 },
  { h: 'موقف الفاتورة', x: r => rep_position(r), c: r => `${statusBadge(r.inv)}<div class="sm mut">${esc(rep_position(r))}</div>` },
];
const rep_cols = () => rep_ui().preset === 'tracker' ? REP_TRACKER_COLS : REP_COLS;
const rep_cell = (col, r, i) => col.c ? col.c(r, i) : col.m ? `<span class="money">${money(col.x(r, i))}</span>` : col.n ? (col.x(r, i) === '' ? '—' : N(esc(col.x(r, i)))) : esc(col.x(r, i));

/** أداء المحطات: متوسط الأيام مقابل الـ SLA لكل محطة */
function rep_stepPerf(rows) {
  const m = {};
  rows.forEach(r => rep_stepDur(r.inv).forEach(d => {
    const x = m[d.step] = m[d.step] || { n: 0, days: 0, late: 0, open: 0, slaSum: 0, slaN: 0, inv: new Set() };
    x.n++; x.days += d.days; x.inv.add(r.id);
    if (d.late) x.late++;
    if (d.open) x.open++;
    if (d.sla != null) { x.slaSum += d.sla; x.slaN++; }
  }));
  return Object.keys(DB.steps).filter(k => m[k]).map(k => ({ k, ...m[k], avg: m[k].days / m[k].n, sla: m[k].slaN ? m[k].slaSum / m[k].slaN : null }));
}
function rep_filterDesc(f) {
  const parts = [];
  if (f.from || f.to) parts.push(`الفترة: ${f.from || '…'} ← ${f.to || '…'}`);
  REP_FILTER_DIMS.forEach(d => { if (f[d]) { const o = (DB[{ company: 'companies', contract: 'contracts', presidency: 'presidencies', sector: 'sectors', gdept: 'gdepts', dept: 'depts', central: 'centrals', ptype: 'projectTypes', project: 'projects' }[d]] || []).find(x => x.id === f[d]); parts.push(`${REP_DIMS[d].l}: ${o ? rep_dimName(d, o) : f[d]}`); } });
  if (f.status) parts.push('الحالة: ' + (rep_statusOpts().find(o => o[0] === f.status) || ['', f.status])[1]);
  if (f.cat) parts.push('الفئة: ' + f.cat);
  if (f.step) parts.push('المحطة: ' + rep_keyLbl(f.step));
  return parts;
}

View.register('reports', {
  title: 'التقارير والتصدير',
  render() {
    if (!can('reports.view')) return emptyState('lock', 'مالكش صلاحية على التقارير', '<div>كلّم فريق المتابعة PMO لو محتاجها</div>');
    const u = rep_ui();
    rep_cache = new Map();
    const all = rep_rows();
    rep_fix(all, u.f);
    const rows = rep_apply(all, u.f), f = u.f;
    const canX = can('reports.export'), preset = u.preset ? REP_PRESETS[u.preset] : null, mode = preset ? preset.mode : null;
    const nF = Object.keys(f).filter(k => f[k]).length;

    const head = pageHeader({
      title: 'التقارير والتصدير',
      sub: `كل الأرقام من نطاقك بس: ${esc(scopeLabel(S.user.scope))}`,
      actions: `<button class="btn pr" onclick="rep_export()" ${canX ? '' : 'disabled title="التصدير مش ضمن صلاحياتك"'} aria-label="تصدير Excel">${icon('file-spreadsheet')}تصدير Excel</button><button class="btn" onclick="window.print()" aria-label="طباعة أو حفظ PDF">${icon('printer')}طباعة / PDF</button>`,
    });

    /* ── التقارير الجاهزة ── */
    const cards = `<div class="grid mb" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">${Object.entries(REP_PRESETS).map(([k, p]) => `<div class="card click" role="button" tabindex="0" aria-pressed="${u.preset === k}" onclick="rep_preset('${k}')" onkeydown="if(event.key==='Enter')rep_preset('${k}')" style="${u.preset === k ? 'border-color:var(--brand);box-shadow:var(--sh-focus)' : ''}"><div class="cb"><div class="row" style="flex-wrap:nowrap"><span class="kpi" style="padding:0"><span class="l"><span class="ic">${icon(p.ic)}</span></span></span><b style="line-height:1.3">${p.t}</b></div><div class="sm mut" style="margin-top:6px">${p.d}</div></div></div>`).join('')}</div>`;

    /* ── الفلاتر ── */
    const dimSel = d => { const id = 'rep-f-' + d, o = rep_dimOpts(d, all, f); return field(REP_DIMS[d].l, select(id, [['', o.length ? `الكل (${o.length})` : 'مفيش'], ...o], f[d] || '', `onchange="rep_setF('${d}',this.value)" ${o.length ? '' : 'disabled'}`), { id }); };
    const catO = Object.keys(DB.categories).filter(c => all.some(r => r.cat === c));
    const stepO = REP_STEP_ORDER().filter(k => all.some(r => r.key === k));
    const ranges = [['month', 'الشهر ده'], ['q', 'آخر 3 شهور'], ['year', 'السنة'], ['', 'كل الفترات']];
    const filt = `<div class="card mb"><div class="ch"><h3>${icon('filter')} الفلاتر</h3><span class="sub">${nF ? `${nF} فلتر شغال` : 'من غير فلاتر'}</span><span class="sp"></span>${nF || u.preset ? `<button class="btn sm gh" onclick="rep_clear()">${icon('x')}امسح الكل</button>` : ''}</div>
      <div class="chips" role="group" aria-label="فترات جاهزة"><span class="sm mut" style="align-self:center">فترة التقديم:</span>${ranges.map(([k, l]) => `<button class="chip ${(u.range || '') === k && (k || (!f.from && !f.to)) ? 'on' : ''}" onclick="rep_range('${k}')">${l}</button>`).join('')}</div>
      <div class="fbar">
        ${field('من تاريخ', `<input type="date" class="in" id="rep-from" value="${esc(f.from || '')}" onchange="rep_ui().range='';rep_setF('from',this.value)">`, { id: 'rep-from' })}
        ${field('إلى تاريخ', `<input type="date" class="in" id="rep-to" value="${esc(f.to || '')}" onchange="rep_ui().range='';rep_setF('to',this.value)">`, { id: 'rep-to' })}
        ${REP_FILTER_DIMS.map(dimSel).join('')}
        ${field('الحالة', select('rep-f-status', rep_statusOpts(), f.status || '', `onchange="rep_setF('status',this.value)"`), { id: 'rep-f-status' })}
        ${field('الفئة', select('rep-f-cat', [['', 'كل الفئات'], ...catO.map(c => [c, `${c} — ${DB.categories[c].name}`])], f.cat || '', `onchange="rep_setF('cat',this.value)"`), { id: 'rep-f-cat' })}
        ${field('المحطة الحالية', select('rep-f-step', [['', 'كل المحطات'], ...stepO.map(k => [k, rep_keyLbl(k)])], f.step || '', `onchange="rep_setF('step',this.value)"`), { id: 'rep-f-step' })}
      </div></div>`;

    /* ── ملخص الأرقام ── */
    const A = rep_agg(rows), allLive = all.filter(r => r.inflight).length;
    const kp = `<div class="grid mb" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
      ${kpi('files', 'مستخلصات', A.n, `من ${all.length} في نطاقك`)}
      ${kpi('sigma', 'الإجمالي (جنيه)', mShort(A.gross), `صافي <span class="money">${money(A.net)}</span>`)}
      ${kpi('banknote', 'المصروف (جنيه)', mShort(A.paid), `${A.paidN} من ${A.n} اتصرف`, 'g')}
      ${kpi('alarm-clock', 'متأخر', A.late, `من ${A.live} شغال${allLive !== A.live ? ` (النطاق كله ${allLive})` : ''}`, A.late ? 'r' : '')}
      ${kpi('timer', 'متوسط الدورة', A.cyc == null ? '—' : A.cyc.toFixed(1), A.cyc == null ? 'مفيش مصروف في النتيجة' : `يوم عمل · من ${A.cycN} مصروف`)}
    </div>`;

    if (!rows.length) return head + cards + filt + `<div class="card">${emptyState('search-x', 'مفيش مستخلصات بالفلاتر دي', '<div>جرّب توسّع الفترة أو تشيل فلتر</div>', `<button class="btn" onclick="rep_clear()">امسح الفلاتر</button>`)}</div>`;

    /* ── التقرير الأسبوعي: سطر الأسبوع ── */
    let weekly = '';
    if (mode === 'weekly') {
      const w = { start: new Date(TODAY.getTime() - 6 * DAY), end: new Date(TODAY.getTime() + DAY) };
      const sb = rows.filter(r => rep_in(r.sub, w)), pd = rows.filter(r => r.inv.payment && rep_in(r.inv.payment.date, w));
      const rt = rows.filter(r => r.inv.log.some(e => e.action === 'return' && rep_in(e.date, w)));
      weekly = `<div class="alert p mb">${icon('presentation')}<div><b>الأسبوع ده (من <span class="num">${fmtD(w.start)}</span>):</b> اتقدم ${N(sb.length)} مستخلص بـ <span class="money">${mShort(sum(sb, r => r.t.gross))}</span> · اتصرف ${N(pd.length)} بصافي <span class="money">${mShort(sum(pd, r => r.paid))}</span> · اترجع ${N(rt.length)} · متأخر دلوقتي ${N(A.late)} من ${N(A.live)} شغال</div></div>`;
    }

    /* ── أداء المحطات ── */
    let perf = '';
    if (mode === 'steps') {
      const P = rep_stepPerf(rows);
      perf = `<div class="card mb"><div class="ch"><h3>أداء المحطات</h3><span class="sub">من ${rows.length} مستخلص — كل مرور على محطة بيتحسب (حتى بعد الإرجاع)</span></div>
        ${P.length ? `<div class="tw"><table><thead><tr><th>المحطة</th><th class="n">مرات</th><th style="min-width:200px">متوسط الأيام مقابل الـ SLA</th><th class="n">اتأخرت</th><th class="n">مفتوحة دلوقتي</th></tr></thead><tbody>
        ${P.map(x => `<tr><td><b>${esc(stepShort(x.k))}</b><div class="sm mut">${esc(stepName(x.k))}</div></td><td class="n">${N(x.n)}</td>
        <td>${x.sla == null ? `<div class="sm"><span class="num">${x.avg.toFixed(1)}</span> يوم <span class="mut">· بدون SLA</span></div>` : `<div class="sm"><span class="num">${x.avg.toFixed(1)}</span> من <span class="num">${x.sla.toFixed(x.sla % 1 ? 1 : 0)}</span> يوم</div><div class="prog ${x.avg > x.sla ? 'r' : x.avg > x.sla * 0.8 ? 'a' : 'g'}" role="progressbar" aria-label="متوسط ${esc(stepShort(x.k))}" aria-valuenow="${x.avg.toFixed(1)}" aria-valuemax="${x.sla}"><span style="width:${Math.min(100, x.avg / Math.max(x.sla, 0.1) * 100).toFixed(0)}%"></span></div>`}</td>
        <td class="n">${x.late ? `<span class="bd r">${x.late} من ${x.n}</span>` : N(0)}<div class="sm mut">${pct(x.late, x.n).toFixed(0)}%</div></td><td class="n">${N(x.open)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('gauge', 'مفيش حركة على المحطات في النتيجة')}</div>`;
    }

    /* ── الملخص المجمّع ── */
    const gSel = select('rep-g', REP_GROUPS, u.g, `onchange="rep_ui().g=this.value;render()" aria-label="تجميع حسب" style="width:auto;min-width:160px"`);
    let summary = '';
    if (u.g !== 'none') {
      const G = rep_groups(rows, u.g);
      summary = `<div class="card mb"><div class="ch"><h3>الملخص حسب ${esc((REP_GROUPS.find(x => x[0] === u.g) || [, ''])[1])}</h3><span class="sub">${G.length} مجموعة</span><span class="sp"></span><label class="sm mut" for="rep-g">تجميع حسب</label>${gSel}</div>
        <div class="tw"><table><thead><tr><th>المجموعة</th><th class="n">عدد</th><th class="n">الإجمالي</th><th class="n">الضريبة</th><th class="n">الاستقطاعات</th><th class="n">الصافي</th><th class="n">المصروف</th><th class="n">متأخر</th><th class="n">متوسط الدورة</th></tr></thead><tbody>
        ${G.map(g => `<tr><td style="min-width:180px">${esc(g.l)}<div class="prog" style="margin-top:4px;height:4px" aria-hidden="true"><span style="width:${pct(g.a.gross, A.gross).toFixed(1)}%"></span></div></td><td class="n">${N(g.a.n)}</td><td class="n"><span class="money">${money(g.a.gross)}</span></td><td class="n"><span class="money">${money(g.a.vat)}</span></td><td class="n"><span class="money">${money(g.a.ded)}</span></td><td class="n"><span class="money">${money(g.a.net)}</span></td><td class="n"><span class="money">${money(g.a.paid)}</span><div class="sm mut">${g.a.paidN} من ${g.a.n}</div></td><td class="n">${g.a.late ? `<span class="bd r">${g.a.late} من ${g.a.live}</span>` : N(0)}</td><td class="n">${g.a.cyc == null ? '—' : N(g.a.cyc.toFixed(1))}</td></tr>`).join('')}
        </tbody><tfoot><tr><td>الإجمالي</td><td class="n">${N(A.n)}</td><td class="n"><span class="money">${money(A.gross)}</span></td><td class="n"><span class="money">${money(A.vat)}</span></td><td class="n"><span class="money">${money(A.ded)}</span></td><td class="n"><span class="money">${money(A.net)}</span></td><td class="n"><span class="money">${money(A.paid)}</span></td><td class="n">${N(A.late)}</td><td class="n">${A.cyc == null ? '—' : N(A.cyc.toFixed(1))}</td></tr></tfoot></table></div></div>`;
    }

    /* ── التفصيلي ── */
    const cols = rep_cols(), shown = rows.slice(0, u.lim);
    const detail = `<div class="card"><div class="ch"><h3>${mode === 'tracker' ? `موقف مستخلصات ${esc(f.company ? (byId('companies', f.company) || {}).name || '' : 'الشركات')}` : 'التفصيلي'}</h3><span class="sub">${shown.length} من ${rows.length} مستخلص</span><span class="sp"></span>${u.g === 'none' ? `<label class="sm mut" for="rep-g">تجميع حسب</label>${gSel}` : ''}</div>
      <div class="tw"><table aria-label="الجدول التفصيلي"><thead><tr>${cols.map(c => `<th class="${c.n ? 'n' : ''}">${c.h}</th>`).join('')}</tr></thead><tbody>
      ${shown.map((r, i) => `<tr class="click ${r.late ? 'flag' : r.s.k === 'due' ? 'warn' : ''}" data-inv="${esc(r.id)}" onclick="openInv('${esc(r.id)}')">${cols.map(c => `<td class="${c.n ? 'n' : ''}">${rep_cell(c, r, i)}</td>`).join('')}</tr>`).join('')}
      </tbody><tfoot><tr>${cols.map((c, j) => `<td class="${c.n ? 'n' : ''}">${j === 0 ? `الإجمالي (${rows.length})` : c.tot ? `<span class="money">${money(sum(rows, r => c.x(r)))}</span>` : ''}</td>`).join('')}</tr></tfoot></table></div>
      ${rows.length > shown.length ? `<div class="cf row sb"><span>معروض ${shown.length} من ${rows.length} — الإجماليات على الكل، والتصدير بيطلع الكل</span><button class="btn sm" onclick="rep_ui().lim=1e9;render()">اعرض الكل</button></div>` : `<div class="cf">${rep_filterDesc(f).map(esc).join(' · ') || 'من غير فلاتر'}${u.preset ? ` · تقرير: ${esc(REP_PRESETS[u.preset].t)}` : ''}</div>`}</div>`;

    return head + cards + filt + kp + weekly + perf + summary + detail;
  },
});

function rep_export() {
  if (!can('reports.export')) { toast('التصدير مش ضمن صلاحياتك', 'err'); return; }
  const u = rep_ui(), rows = rep_filtered(), A = rep_agg(rows), cols = rep_cols();
  const hdr = ['المجموعة', 'عدد', 'الإجمالي', 'الضريبة', 'الاستقطاعات', 'الصافي', 'المصروف', 'متأخر', 'متوسط الدورة (يوم عمل)'];
  const line = (l, a) => [l, a.n, rep_r2(a.gross), rep_r2(a.vat), rep_r2(a.ded), rep_r2(a.net), rep_r2(a.paid), a.late, a.cyc == null ? '' : rep_r2(a.cyc)];
  const summary = [hdr, ...(u.g === 'none' ? [] : rep_groups(rows, u.g).map(g => line(g.l, g.a))), line('الإجمالي', A), [], ['النطاق', scopeLabel(S.user.scope)], ['الفلاتر', rep_filterDesc(u.f).join(' · ') || 'من غير فلاتر'], ['تاريخ التقرير', iso(TODAY)], ['بواسطة', S.user.name]];
  if (u.preset) summary.push(['التقرير', REP_PRESETS[u.preset].t]);
  const detail = [cols.map(c => c.h), ...rows.map((r, i) => cols.map(c => c.x(r, i)))];
  const durs = [['رقم المستخلص', 'الشركة', 'أمر التكليف', 'الفئة', 'المحطة', 'أيام العمل', 'الـ SLA', 'متأخر؟', 'لسه مفتوحة؟']];
  rows.forEach(r => rep_stepDur(r.inv).forEach(d => durs.push([r.inv.no, r.c.company.name, r.c.ao.no, r.cat, stepName(d.step), d.days, d.sla == null ? '' : d.sla, d.late ? 'متأخر' : 'لا', d.open ? 'نعم' : 'لا'])));
  const sheets = { 'ملخص': summary, 'تفصيلي': detail, 'زمن المحطات': durs };
  if (u.preset === 'steps') sheets['أداء المحطات'] = [['المحطة', 'مرات', 'متوسط الأيام', 'متوسط الـ SLA', 'اتأخرت', 'مفتوحة'], ...rep_stepPerf(rows).map(x => [stepName(x.k), x.n, rep_r2(x.avg), x.sla == null ? '' : rep_r2(x.sla), x.late, x.open])];
  Excel.download(`تقرير_المستخلصات_${u.preset ? REP_PRESETS[u.preset].t.replace(/\s+/g, '_') + '_' : ''}${iso(TODAY)}.xlsx`, sheets);
}

/* ============================================================
   3) الاستقطاعات والضمانات
   ============================================================ */
const REP_DED_ROLES = ['company', 'finance', 'pmo', 'admin', 'stores'];
const rep_addMonths = (d, n) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setMonth(x.getMonth() + n); return x; };
/** مواعيد الإفراج عن تأمين ضمان الأعمال لكل أمر تكليف
   افتراض الديمو: الإفراج بعد 12 شهر من صرف آخر مستخلص على أمر التكليف */
function rep_retention(rows) {
  const u = rep_ui();
  return Object.values(groupBy(rows, r => r.c.ao.id)).map(rs => {
    const pd = rs.filter(r => r.inv.status === 'paid' && r.inv.payment);
    const ret = r => (r.t.deductions.find(d => d.typeId === 'retention') || {}).amount || 0;
    const held = sum(pd, ret);
    if (!pd.length || !held) return null;
    const last = new Date(Math.max(...pd.map(r => new Date(r.inv.payment.date).getTime())));
    const rel = rep_addMonths(last, 12), days = rep_dayDiff(TODAY, rel), c = rs[0].c;
    const released = u.released[c.ao.id] || null;
    const st = released ? { k: 'done', l: 'تم الإفراج', cls: 'g' } : days <= 30 ? { k: 'req', l: 'مطلوب الإفراج', cls: 'a' } : { k: 'held', l: 'محجوز', cls: 'n' };
    return { c, held, pending: sum(rs.filter(r => r.inflight), ret), live: rs.filter(r => r.inflight).length, paidN: pd.length, last, rel, days, released, st };
  }).filter(Boolean).sort((a, b) => a.rel - b.rel);
}
function rep_dedRows() {
  const u = rep_ui();
  let rows = rep_rows().filter(r => r.inv.status !== 'draft');
  if (u.ded.co && !rows.some(r => r.c.company.id === u.ded.co)) u.ded.co = '';
  if (u.ded.co) rows = rows.filter(r => r.c.company.id === u.ded.co);
  return rows;
}
function rep_dedAgg(rows) {
  const m = {};
  rows.forEach(r => r.t.deductions.forEach(d => {
    const k = r.c.contract.id + '|' + d.typeId, t = DB.deductionTypes.find(x => x.id === d.typeId) || {};
    const x = m[k] = m[k] || { contract: r.c.contract, company: r.c.company, typeId: d.typeId, name: d.name || t.name, releasable: !!(d.releasable || t.releasable), paid: 0, live: 0, n: 0 };
    if (r.inv.status === 'paid') x.paid += d.amount || 0; else x.live += d.amount || 0;
    x.n++;
  }));
  const order = DB.deductionTypes.map(t => t.id);
  return Object.values(m).sort((a, b) => a.contract.no.localeCompare(b.contract.no) || order.indexOf(a.typeId) - order.indexOf(b.typeId));
}
function rep_release(aoId) {
  if (!can('deductions.edit')) { toast('تسجيل الإفراج للمالية بس', 'err'); return; }
  const ao = byId('aos', aoId);
  confirmBox('تسجيل الإفراج عن الضمان', `هيتسجّل إن تأمين ضمان أعمال أمر التكليف <b class="num">${esc(ao.no)}</b> اتفرج عنه النهارده. متأكد؟`, 'تم الإفراج', () => { rep_ui().released[aoId] = iso(TODAY); render(); toast('اتسجّل الإفراج عن ضمان ' + ao.no, 'ok'); }, 'ok');
}
function rep_unrelease(aoId) { delete rep_ui().released[aoId]; render(); }
function rep_dedExport() {
  const rows = rep_dedRows(), D = rep_dedAgg(rows), R = rep_retention(rows);
  Excel.download(`الاستقطاعات_والضمانات_${iso(TODAY)}.xlsx`, {
    'الاستقطاعات': [['العقد', 'الشركة', 'نوع الاستقطاع', 'قابل للإفراج', 'من المصروف', 'متوقع من الجاري', 'الإجمالي', 'عدد المستخلصات'], ...D.map(x => [x.contract.no, x.company.name, x.name, x.releasable ? 'نعم' : 'لا', rep_r2(x.paid), rep_r2(x.live), rep_r2(x.paid + x.live), x.n])],
    'مواعيد الإفراج': [['العقد', 'الشركة', 'أمر التكليف', 'المشروع', 'الضمان المحجوز', 'متوقع من الجاري', 'آخر صرف', 'ميعاد الإفراج', 'أيام متبقية', 'الحالة', 'تاريخ الإفراج'], ...R.map(x => [x.c.contract.no, x.c.company.name, x.c.ao.no, x.c.project.name, rep_r2(x.held), rep_r2(x.pending), iso(x.last), iso(x.rel), x.days, x.st.l, x.released || ''])],
    'ملاحظة': [['الافتراض'], ['ميعاد الإفراج عن تأمين ضمان الأعمال = 12 شهر بعد صرف آخر مستخلص على أمر التكليف (افتراض الديمو — بيتعدّل حسب شروط العقد)']],
  });
}

View.register('deductions', {
  title: 'الاستقطاعات والضمانات',
  render() {
    if (!REP_DED_ROLES.includes(S.user.role)) return emptyState('lock', 'الصفحة دي للمالية والشركات', '<div>مش ضمن صلاحيات دورك</div>');
    const u = rep_ui();
    rep_cache = new Map();
    const scopeRows = rep_rows().filter(r => r.inv.status !== 'draft');
    const rows = rep_dedRows(), D = rep_dedAgg(rows), R = rep_retention(rows);
    const canX = can('reports.export') || can('deductions.edit'), canEd = can('deductions.edit');
    const cos = [...new Map(scopeRows.map(r => [r.c.company.id, r.c.company.name])).entries()];
    const head = pageHeader({
      title: 'الاستقطاعات والضمانات',
      sub: `${isCompany() ? 'استقطاعات عقودك' : 'كل الاستقطاعات في نطاقك'} — محسوبة من المستخلصات المصروفة والجاري`,
      actions: `${cos.length > 1 ? select('rep-ded-co', [['', `كل الشركات (${cos.length})`], ...cos], u.ded.co, `onchange="rep_ui().ded.co=this.value;render()" aria-label="الشركة" style="width:auto;min-width:160px"`) : ''}<button class="btn pr" onclick="rep_dedExport()" ${canX ? '' : 'disabled title="التصدير مش ضمن صلاحياتك"'}>${icon('file-spreadsheet')}تصدير Excel</button><button class="btn" onclick="window.print()" aria-label="طباعة">${icon('printer')}طباعة</button>`,
    });
    if (!D.length) return head + `<div class="card">${emptyState('lock', 'مفيش استقطاعات لسه', '<div>الاستقطاعات بتتحسب أول ما يتقدم مستخلص</div>')}</div>`;

    const retHeld = sum(R.filter(x => !x.released), x => x.held), req = R.filter(x => x.st.k === 'req'), done = R.filter(x => x.released);
    const soon = R.filter(x => !x.released && x.days <= 7);
    const others = sum(D.filter(x => !x.releasable), x => x.paid);
    const kp = `<div class="grid mb" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
      ${kpi('lock', 'ضمان محجوز (جنيه)', mShort(retHeld), `على ${R.length - done.length} أمر تكليف · + <span class="money">${mShort(sum(R, x => x.pending))}</span> متوقع من الجاري`)}
      ${kpi('calendar-clock', 'مطلوب الإفراج', req.length, `خلال 30 يوم · من ${R.length} أمر تكليف`, req.length ? 'a' : '')}
      ${kpi('unlock', 'تم الإفراج', done.length, done.length ? `<span class="money">${mShort(sum(done, x => x.held))}</span> جنيه` : 'لسه مفيش', done.length ? 'g' : '')}
      ${kpi('receipt', 'استقطاعات نهائية (جنيه)', mShort(others), 'ضرايب ودمغة ودفعة مقدمة من المصروف')}
    </div>`;
    const next = R.find(x => !x.released);
    const alert = soon.length
      ? `<div class="alert r mb">${icon('alarm-clock')}<div><b>${soon.length} إفراج ميعاده خلال 7 أيام أو فات:</b> ${soon.map(x => `<span class="num">${esc(x.c.ao.no)}</span> (${x.days < 0 ? `فات بـ ${-x.days} يوم` : x.days === 0 ? 'النهارده' : `باقي ${x.days} يوم`})`).join('، ')}</div></div>`
      : `<div class="alert i mb">${icon('info')}<div>مفيش إفراج مستحق خلال 7 أيام${next ? ` · أقرب ميعاد <span class="num">${fmtD(next.rel)}</span> لأمر التكليف <span class="num">${esc(next.c.ao.no)}</span> (باقي ${next.days} يوم)` : ''}.</div></div>`;

    const dedCard = `<div class="card mb"><div class="ch"><h3>الاستقطاعات المتراكمة حسب العقد والنوع</h3><span class="sub">${D.length} بند على ${new Set(D.map(x => x.contract.id)).size} عقد</span></div><div class="tw"><table><thead><tr><th>العقد</th><th>نوع الاستقطاع</th><th class="n">من المصروف</th><th class="n">متوقع من الجاري</th><th class="n">الإجمالي</th><th class="n">مستخلصات</th></tr></thead><tbody>
      ${D.map((x, i) => `<tr>${i === 0 || D[i - 1].contract.id !== x.contract.id ? `<td rowspan="${D.filter(y => y.contract.id === x.contract.id).length}" style="vertical-align:top"><b class="num">${esc(x.contract.no)}</b><div class="sm mut">${esc(x.company.name)} · ${esc(x.contract.title)}</div></td>` : ''}<td>${esc(x.name)} ${x.releasable ? '<span class="bd b">بيتفرج عنه</span>' : ''}</td><td class="n"><span class="money">${money(x.paid)}</span></td><td class="n"><span class="money">${money(x.live)}</span></td><td class="n"><span class="money">${money(x.paid + x.live)}</span></td><td class="n">${N(x.n)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="2">الإجمالي</td><td class="n"><span class="money">${money(sum(D, x => x.paid))}</span></td><td class="n"><span class="money">${money(sum(D, x => x.live))}</span></td><td class="n"><span class="money">${money(sum(D, x => x.paid + x.live))}</span></td><td></td></tr></tfoot></table></div></div>`;

    const relCard = `<div class="card"><div class="ch"><h3>تأمين ضمان الأعمال — ميعاد الإفراج</h3><span class="sub">${R.length} أمر تكليف عليه ضمان محجوز</span></div>
      <div class="cb" style="padding-bottom:0"><div class="alert i">${icon('info')}<div><b>افتراض الديمو:</b> الإفراج بعد 12 شهر من صرف آخر مستخلص على أمر التكليف. لو لسه فيه مستخلصات شغالة على نفس الأمر، الميعاد هيتأجل مع صرفها. "مطلوب الإفراج" = الميعاد جاي خلال 30 يوم أو فات.</div></div></div>
      ${R.length ? `<div class="tw"><table><thead><tr><th>أمر التكليف</th><th>العقد</th><th class="n">الضمان المحجوز</th><th class="n">آخر صرف</th><th class="n">ميعاد الإفراج</th><th>الحالة</th>${canEd ? '<th></th>' : ''}</tr></thead><tbody>
      ${R.map(x => `<tr class="${x.st.k === 'req' ? 'warn' : ''}"><td><b class="num">${esc(x.c.ao.no)}</b><div class="sm mut">${esc(x.c.project.name)}</div></td><td><span class="num">${esc(x.c.contract.no)}</span><div class="sm mut">${esc(x.c.company.name)}</div></td>
        <td class="n"><span class="money">${money(x.held)}</span><div class="sm mut">${x.paidN} مستخلص مصروف${x.live ? ` · ${x.live} شغال` : ''}</div></td><td class="n"><span class="num">${fmtD(x.last)}</span></td>
        <td class="n"><span class="num">${fmtD(x.rel)}</span><div class="sm mut">${x.released ? `اتفرج <span class="num">${fmtD(x.released)}</span>` : x.days < 0 ? `فات بـ ${-x.days} يوم` : `باقي ${x.days} يوم`}</div></td>
        <td><span class="bd dot ${x.st.cls}">${x.st.l}</span></td>
        ${canEd ? `<td>${x.released ? `<button class="btn sm gh" onclick="rep_unrelease('${esc(x.c.ao.id)}')">تراجع</button>` : `<button class="btn sm ${x.st.k === 'req' ? 'ok' : ''}" onclick="rep_release('${esc(x.c.ao.id)}')" ${x.st.k === 'req' ? '' : 'disabled title="لسه بدري — الميعاد بعد أكتر من 30 يوم"'}>${icon('unlock')}سجّل الإفراج</button>`}</td>` : ''}</tr>`).join('')}
      </tbody></table></div>` : emptyState('lock', 'مفيش ضمان محجوز لسه', '<div>الضمان بيتحجز من المستخلصات المصروفة</div>')}</div>`;

    return head + kp + alert + dedCard + relCard;
  },
});

/* ============================================================
   4) سجل الإيميلات
   ============================================================ */
const REP_MAIL_ROLES = ['pmo', 'admin'];
function rep_em(k, v, focusId) { const u = rep_ui(); u.em[k] = v; u.em.lim = 60; u.focus = focusId || ''; render(); }
function rep_emList() {
  const e = rep_ui().em, q = (e.q || '').trim();
  return DB.emails.filter(m => {
    if (q && ![m.subject, m.to, m.toName, m.body].join(' ').includes(q)) return false;
    if (e.rcpt && m.to !== e.rcpt) return false;
    if (e.inv && (e.inv === '~digest' ? m.kind !== 'digest' : m.invoiceId !== e.inv)) return false;
    const d = iso(m.date);
    if (e.from && d < e.from) return false;
    if (e.until && d > e.until) return false;
    return true;
  });
}
function rep_openMail(id) {
  const m = DB.emails.find(x => x.id === id); if (!m) return;
  const inv = m.invoiceId ? invById(m.invoiceId) : null;
  modal(esc(m.subject), `<div class="kv"><div><span>إلى</span><b>${esc(m.toName || '')}</b><div class="sm mut num">${esc(m.to)}</div></div><div><span>التاريخ</span><b class="num">${fmtDT(m.date)}</b></div><div><span>المستخلص</span><b>${inv ? `<span class="num">${esc(inv.no)}</span> — ${esc(ctx(inv).company.name)}` : m.kind === 'digest' ? 'ملخص يومي' : '—'}</b></div><div><span>الحالة</span><b><span class="bd g">اتبعت</span></b></div></div>
    <div class="words" style="white-space:pre-wrap;line-height:1.8">${esc(m.body)}</div>`,
    `${inv ? `<button class="btn pr" onclick="closeModal();openInv('${esc(inv.id)}')">${icon('file-text')}افتح المستخلص</button>` : ''}<button class="btn" onclick="closeModal()">إغلاق</button>`, { size: 'lg' });
}
/** الملخص اليومي: المتأخر مجمّع حسب المحطة ← لمسؤولي المحطات دي + فريق PMO */
function rep_sendDigest() {
  const late = visibleInvoices().filter(i => i.status === 'active' && slaState(i).k === 'late');
  const byStep = groupBy(late, i => i.step), now = new Date(), title = `الملخص اليومي للمتأخرات — ${fmtD(TODAY)}`;
  const lineOf = i => { const s = slaState(i), c = ctx(i); return `  - ${c.company.name} رقم ${i.no} — ${c.ao.no} — ${c.central.name} — ${s.el}/${s.sla} يوم (متأخر ${s.el - s.sla})\n    https://invoices.te.eg/i/${i.id}`; };
  const block = list => Object.entries(groupBy(list, i => i.step)).map(([k, l]) => `■ ${stepName(k)} (${l.length})\n${l.map(lineOf).join('\n')}`).join('\n\n');
  const rc = new Map();
  Object.entries(byStep).forEach(([k, list]) => list.forEach(i => stepHolders(i, k).forEach(u => { if (!rc.has(u.id)) rc.set(u.id, { u, list: [] }); rc.get(u.id).list.push(i); })));
  DB.users.filter(u => u.role === 'pmo').forEach(u => rc.set(u.id, { u, list: late, pmo: true }));
  rc.forEach(({ u, list, pmo }) => {
    const body = `السيد/ ${u.name}\nتحية طيبة وبعد،\n\n${list.length ? `${pmo ? `فيه ${list.length} مستخلص متأخر في المنظومة كلها` : `فيه ${list.length} مستخلص متأخر عندك`} لحد النهارده ${fmtD(TODAY)}:\n\n${block(list)}` : 'مفيش مستخلصات متأخرة النهارده — كل المحطات جوه الـ SLA.'}\n\nالملخص ده بيتبعت تلقائياً كل يوم الساعة ${DB.settings.dailyDigestAt}.\n\nمنظومة تتبع المستخلصات — المصرية للاتصالات`;
    DB.emails.unshift({ id: uid('e'), to: u.email, toName: u.name, subject: `${title} (${list.length})`, body, invoiceId: null, kind: 'digest', date: now, status: 'sent' });
  });
  DB.audit.unshift({ date: now, userId: S.user.id, action: 'digest', entity: 'emails', details: `ملخص يومي يدوي — ${late.length} متأخر — ${rc.size} مستلم` });
  toast(`اتبعت الملخص لـ ${rc.size} مستلم — ${late.length} متأخر`, 'ok');
  render();
}

View.register('emails', {
  title: 'سجل الإيميلات',
  render() {
    if (!REP_MAIL_ROLES.includes(S.user.role)) return emptyState('lock', 'السجل ده لفريق المتابعة ومدير النظام', '');
    const u = rep_ui(), e = u.em;
    const list = rep_emList(), shown = list.slice(0, e.lim);
    const weekAgo = iso(new Date(TODAY.getTime() - 6 * DAY)), today = iso(TODAY);
    const nToday = DB.emails.filter(m => iso(m.date) === today).length, nWeek = DB.emails.filter(m => iso(m.date) >= weekAgo).length;
    const rcpts = [...new Map(DB.emails.map(m => [m.to, m.toName ? `${m.toName} — ${m.to}` : m.to])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'ar'));
    const invIds = [...new Set(DB.emails.map(m => m.invoiceId).filter(Boolean))].map(invById).filter(Boolean).sort((a, b) => String(a.no).localeCompare(String(b.no), 'en', { numeric: true }));
    const lastDigest = DB.emails.find(m => m.kind === 'digest');
    const lateN = visibleInvoices().filter(i => i.status === 'active' && slaState(i).k === 'late').length;
    const head = pageHeader({ title: 'سجل الإيميلات', sub: 'كل إيميل المنظومة بعتته — في الديمو بيتسجل هنا بدل ما يتبعت فعلاً' });

    const kp = `<div class="grid mb" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
      ${kpi('mail', 'اتبعت النهارده', nToday, `من ${DB.emails.length} إيميل في السجل`)}
      ${kpi('calendar-days', 'آخر 7 أيام', nWeek, `من ${DB.emails.length}`)}
      ${kpi('users', 'مستلمين', rcpts.length, 'عنوان مختلف')}
      ${kpi('alarm-clock', 'متأخر دلوقتي', lateN, 'هيدخل في الملخص الجاي', lateN ? 'r' : '')}
    </div>`;

    const sched = `<div class="card mb"><div class="ch"><h3>${icon('calendar-clock')} الإشعارات المجدولة</h3></div><div class="cb stack">
      <div class="row sb"><div><b>الملخص اليومي للمتأخرات</b><div class="sm mut">كل يوم الساعة <span class="num">${esc(DB.settings.dailyDigestAt)}</span>: المتأخر مجمّع حسب المحطة، بيروح لمسؤولي المحطات دي في نطاقهم + فريق PMO</div><div class="sm mut">${lastDigest ? `آخر ملخص: <span class="num">${fmtDT(lastDigest.date)}</span>` : 'لسه ما اتبعتش ملخص النهارده'}</div></div><button class="btn pr" onclick="rep_sendDigest()">${icon('send')}ابعت الملخص اليومي دلوقتي</button></div>
      <hr class="sep" style="margin:0">
      <div class="row sb"><div><b>التقرير الأسبوعي للإدارة العليا</b><div class="sm mut">كل يوم ${esc(DB.settings.weeklyReportDay)}: موقف المستخلصات حسب الجهة + اللي اتقدم واتصرف خلال الأسبوع، لرؤساء القطاعات ورئاسة القطاعات</div></div><button class="btn" onclick="rep_presetGo('weekly')">${icon('presentation')}افتح التقرير الأسبوعي</button></div>
      <div class="sm mut">${icon('server')} الإرسال الفعلي عن طريق <span class="num">${esc(DB.settings.smtpHost)}:${esc(DB.settings.smtpPort)}</span> من <span class="num">${esc(DB.settings.smtpFrom)}</span></div>
    </div></div>`;

    const nF = ['q', 'rcpt', 'inv', 'from', 'until'].filter(k => e[k]).length;
    const filt = `<div class="fbar">
      ${field('بحث', `<input class="in" id="rep-emq" type="search" placeholder="موضوع، مستلم، نص…" value="${esc(e.q)}" oninput="rep_em('q',this.value,'rep-emq')">`, { id: 'rep-emq' })}
      ${field('المستلم', select('rep-em-to', [['', `الكل (${rcpts.length})`], ...rcpts], e.rcpt, `onchange="rep_em('rcpt',this.value)"`), { id: 'rep-em-to' })}
      ${field('المستخلص', select('rep-em-inv', [['', 'الكل'], ['~digest', 'الملخصات اليومية'], ...invIds.map(i => [i.id, `${i.no} — ${ctx(i).company.name}`])], e.inv, `onchange="rep_em('inv',this.value)"`), { id: 'rep-em-inv' })}
      ${field('من', `<input type="date" class="in" id="rep-em-from" value="${esc(e.from)}" onchange="rep_em('from',this.value)">`, { id: 'rep-em-from' })}
      ${field('إلى', `<input type="date" class="in" id="rep-em-until" value="${esc(e.until)}" onchange="rep_em('until',this.value)">`, { id: 'rep-em-until' })}
    </div>`;
    const table = shown.length ? `<div class="tw"><table><thead><tr><th>التاريخ</th><th>إلى</th><th>الموضوع</th><th>المستخلص</th><th>الحالة</th></tr></thead><tbody>
      ${shown.map(m => { const inv = m.invoiceId ? invById(m.invoiceId) : null; return `<tr class="click" tabindex="0" onclick="rep_openMail('${esc(m.id)}')" onkeydown="if(event.key==='Enter')rep_openMail('${esc(m.id)}')"><td><span class="num sm">${fmtDT(m.date)}</span></td><td>${esc(m.toName || '')}<div class="sm mut num">${esc(m.to)}</div></td><td style="min-width:240px">${esc(m.subject)}</td><td>${inv ? `<span class="num">${esc(inv.no)}</span> <span class="sm mut">${esc(ctx(inv).company.name)}</span>` : m.kind === 'digest' ? '<span class="bd p">ملخص يومي</span>' : '—'}</td><td><span class="bd dot g">اتبعت</span></td></tr>`; }).join('')}
      </tbody></table></div>${list.length > shown.length ? `<div class="cf row sb"><span>معروض ${shown.length} من ${list.length}</span><button class="btn sm" onclick="rep_ui().em.lim+=100;render()">اعرض 100 كمان</button></div>` : ''}`
      : emptyState('mail-x', 'مفيش إيميلات بالفلاتر دي', '', nF ? `<button class="btn" onclick="rep_ui().em={q:'',rcpt:'',inv:'',from:'',until:'',lim:60};render()">امسح الفلاتر</button>` : '');
    const card = `<div class="card"><div class="ch"><h3>الإيميلات</h3><span class="sub">${list.length} من ${DB.emails.length}</span><span class="sp"></span>${nF ? `<button class="btn sm gh" onclick="rep_ui().em={q:'',rcpt:'',inv:'',from:'',until:'',lim:60};render()">${icon('x')}امسح الفلاتر</button>` : ''}</div>${filt}${table}</div>`;
    return head + kp + sched + card;
  },
  after() {
    const u = S.ui.rep;
    if (u && u.focus) { const el = document.getElementById(u.focus); if (el && el.focus) { el.focus(); const n = (el.value || '').length; try { el.setSelectionRange(n, n); } catch (err) {} } u.focus = ''; }
  },
});
