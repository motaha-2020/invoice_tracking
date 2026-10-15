/* ============================================================
   views/invoice.js — صندوق الوارد · كل المستخلصات · صفحة المستخلص
   (المسار، البنود، المهمات، المرفقات، الماليات، السجل، الإيميلات)
   + كل أكشنز المسار (اعتماد / إرجاع / إعادة إرسال / فئة / صرف / تعليق)
   الحالة في S.ui.inv — كل الدوال global بـ prefix inv_
   ============================================================ */

/* ───────────────────────── state + ثوابت ───────────────────────── */
function inv_st() {
  const d = {
    in: { q: '', co: '', k: '', cat: '', sla: '', kind: '', chip: 'all' },
    ls: { q: '', pr: '', se: '', gd: '', dp: '', ce: '', pj: '', pt: '', per: '', st: '', cat: '', co: '', sla: '', kind: '', sort: 'sla', dir: -1, page: 0 },
    tab: 'lines', tabFor: null, group: false, ded: null, focus: null,
  };
  if (!S.ui) S.ui = {};
  const s = S.ui.inv = S.ui.inv || {};
  Object.keys(d).forEach(k => { if (!(k in s)) s[k] = d[k]; else if (k === 'in' || k === 'ls') s[k] = Object.assign(d[k], s[k]); });
  return s;
}
const INV_STATUS = { draft: 'مسودة', active: 'جاري', returned: 'مرتجع', on_hold: 'معلّق', paid: 'تم الصرف' };
const INV_ACT = { submit: 'تقديم', approve: 'اعتماد وتسليم', return: 'إرجاع', resubmit: 'إعادة تقديم', category: 'تحديد الفئة', qty: 'تعديل كمية', hold: 'تعليق', release: 'رفع التعليق', pay: 'صرف', deductions: 'تعديل الاستقطاعات' };
const INV_SLA_OPTS = [['', 'كل حالات الـ SLA'], ['late', 'متأخر'], ['due', 'آخر يوم / قرب الميعاد'], ['ok', 'في الميعاد'], ['ret', 'مرتجع'], ['hold', 'معلّق'], ['nosla', 'بدون SLA'], ['paid', 'تم الصرف']];
const INV_KINDS = ['مدني', 'كهربي', 'مجمع', 'تخطيط'];
const INV_PAGE = 25;
const INV_ORG = [['pr', 'presidency', 'رئاسة القطاعات'], ['se', 'sector', 'القطاع'], ['gd', 'gdept', 'الإدارة العامة'], ['dp', 'dept', 'الإدارة المختصة'], ['ce', 'central', 'السنترال'], ['pj', 'project', 'المشروع']];

/* ───────────────────────── helpers ───────────────────────── */
const inv_val = id => { const e = document.getElementById(id); return e && e.value != null ? String(e.value) : ''; };
const inv_checked = name => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`) || []).map(x => x.value);
/** ترتيب "الأكتر تأخير الأول": الأيام المستهلكة − الـ SLA */
const inv_score = i => { const s = slaState(i); return s.el == null ? -999 : s.el - (s.sla ?? 3); };
const inv_hay = i => { const c = ctx(i); return [i.no, i.pathName, c.company.name, c.ao.no, c.contract.no, c.project.name, c.central.name, i.period].join(' '); };
const inv_rowCls = i => { const k = slaState(i).k; return k === 'late' ? 'flag' : k === 'due' ? 'warn' : ''; };
const inv_curKey = inv => inv.status === 'returned' ? inv.returnTo : inv.step;
const inv_isOvr = inv => !canAct(inv) && canOverride(inv);
const inv_canHold = inv => ['active', 'on_hold'].includes(inv.status) && inScope(S.user, inv) && (can('invoice.override') || S.user.role === 'tech_affairs');
const inv_canEditQty = inv => (canAct(inv) || canOverride(inv)) && ['active', 'returned'].includes(inv.status) && ['sup', 'exec', 'tech'].includes(inv_curKey(inv));
const inv_canDed = inv => can('deductions.edit') && !['paid', 'draft'].includes(inv.status);
const inv_holders = (inv, key) => { const us = stepHolders(inv, key); return us.length ? us.map(u => u.name).join('، ') : 'مفيش مستخدم متسجل'; };
const inv_next = inv => { const p = pathOf(inv), i = p.findIndex(s => s.key === inv.step); return i >= 0 ? p[i + 1] || null : null; };
const inv_submitDate = inv => (inv.log.find(e => e.action === 'submit') || {}).date || null;
const inv_size = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
/** ملاحظة الـ PMO لما بيحرّك بدل الجهة */
function inv_note(inv, note) {
  note = (note || '').trim();
  if (inv_isOvr(inv)) return `بالنيابة عن ${holderLabel(inv)} (PMO)` + (note ? ' — ' + note : '');
  return note || undefined;
}
/** ينفّذ حركة مسار: يقفل المودال ويعمل toast ويرسم */
function inv_run(fn, okMsg) {
  try { fn(); } catch (e) { toast(e.message || 'حصل خطأ', 'err'); return false; }
  closeModal(); toast(okMsg, 'ok'); return true;
}
function inv_f(scope, key, val) {
  const st = inv_st(); st[scope][key] = val;
  if (scope === 'ls') {
    st.ls.page = 0;
    const i = INV_ORG.findIndex(o => o[0] === key);
    if (i >= 0) INV_ORG.slice(i + 1).forEach(o => { st.ls[o[0]] = ''; });
  }
  render();
}
function inv_q(scope, val, id) { const st = inv_st(); st[scope].q = val; st.focus = id; if (scope === 'ls') st.ls.page = 0; render(); }
function inv_clear(scope) { const st = inv_st(), keep = scope === 'ls' ? { sort: st.ls.sort, dir: st.ls.dir } : {}; Object.keys(st[scope]).forEach(k => { st[scope][k] = ''; }); Object.assign(st[scope], keep); if (scope === 'in') st.in.chip = 'all'; if (scope === 'ls') st.ls.page = 0; render(); }
function inv_restoreFocus() {
  const st = inv_st(); if (!st.focus) return;
  const e = document.getElementById(st.focus); st.focus = null;
  if (e && e.focus) { e.focus(); try { const n = String(e.value || '').length; e.setSelectionRange(n, n); } catch (x) {} }
}
const inv_searchBox = (scope, id, val, ph) => `<input class="in" type="search" id="${id}" value="${esc(val)}" placeholder="${ph}" aria-label="${ph}" oninput="inv_q('${scope}',this.value,this.id)">`;
const inv_uniq = (arr, f) => { const m = new Map(); arr.forEach(x => { const [k, v] = f(x); if (k != null && !m.has(k)) m.set(k, v); }); return [...m].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'ar')); };

/* ═════════════════════════ 1) صندوق الوارد ═════════════════════════ */
function inv_inboxBase() {
  const all = visibleInvoices();
  return can('invoice.override') ? all.filter(i => ['active', 'returned', 'on_hold'].includes(i.status)) : all.filter(i => canAct(i));
}
function inv_applyIn(list, f) {
  return list.filter(i => {
    const c = ctx(i), s = slaState(i);
    if (f.q && !inv_hay(i).includes(f.q.trim())) return false;
    if (f.co && c.company.id !== f.co) return false;
    if (f.k && c.contract.id !== f.k) return false;
    if (f.cat && (f.cat === 'none' ? !!i.cat : i.cat !== f.cat)) return false;
    if (f.sla && s.k !== f.sla) return false;
    if (f.kind && i.kind !== f.kind) return false;
    if (f.chip === 'late' && s.k !== 'late') return false;
    if (f.chip === 'due' && s.k !== 'due') return false;
    if (f.chip === 'ret' && i.status !== 'returned') return false;
    if (f.chip === 'hold' && i.status !== 'on_hold') return false;
    if (f.chip === 'cat' && !(i.status === 'active' && i.step === 'exec' && !i.cat)) return false;
    return true;
  });
}
function inv_recent() {
  const uidv = S.user.id;
  return visibleInvoices().map(i => {
    const mine = i.log.filter(e => e.by === uidv && wdBetween(e.date, TODAY) <= 10);
    return mine.length ? { i, e: mine[mine.length - 1] } : null;
  }).filter(Boolean).sort((a, b) => new Date(b.e.date) - new Date(a.e.date));
}

View.register('inbox', {
  title: 'صندوق الوارد',
  render() {
    const st = inv_st(), f = st.in, ovr = can('invoice.override');
    const base = inv_inboxBase();
    const cnt = k => base.filter(i => slaState(i).k === k).length;
    const late = cnt('late'), due = cnt('due');
    const ret = base.filter(i => i.status === 'returned').length;
    const hold = ovr ? base.filter(i => i.status === 'on_hold').length
      : visibleInvoices().filter(i => i.status === 'on_hold' && DB.steps[i.step] && DB.steps[i.step].role === S.user.role).length;
    const needCat = base.filter(i => i.status === 'active' && i.step === 'exec' && !i.cat).length;
    const list = inv_applyIn(base, f).sort((a, b) => inv_score(b) - inv_score(a));

    const kpis = `<div class="grid g5 mb">
      ${kpi('inbox', 'عندك دلوقتي', base.length, ovr ? 'كل المفتوح في المنظومة' : 'مستنيين قرارك')}
      ${kpi('alarm-clock', 'متأخر', late, 'عدّى الـ SLA', late ? 'r' : '')}
      ${kpi('hourglass', 'آخر يوم', due, 'لازم يتحرك النهارده', due ? 'a' : '')}
      ${kpi('undo-2', 'مرتجع لك', ret, ovr ? 'مرتجعات في كل الجهات' : 'محتاجين ترد عليهم')}
      ${kpi('pause-circle', 'معلّق', hold, ovr ? 'العداد واقف' : 'واقفين عند محطتك')}
    </div>`;

    const chip = (k, label, n) => `<button class="chip ${f.chip === k ? 'on' : ''}" aria-pressed="${f.chip === k}" onclick="inv_f('in','chip','${k}')">${label}${n != null ? ` <span class="n num">${n}</span>` : ''}</button>`;
    const cos = inv_uniq(base, i => [ctx(i).company.id, ctx(i).company.name]);
    const ks = inv_uniq(base, i => [ctx(i).contract.id, ctx(i).contract.no]);
    const fbar = `<div class="fbar">
      ${inv_searchBox('in', 'inv-in-q', f.q, 'ابحث برقم، شركة، أمر تكليف…')}
      ${select('inv-in-co', [['', 'كل الشركات'], ...cos], f.co, `aria-label="الشركة" onchange="inv_f('in','co',this.value)"`)}
      ${select('inv-in-k', [['', 'كل العقود'], ...ks], f.k, `aria-label="العقد" onchange="inv_f('in','k',this.value)"`)}
      ${select('inv-in-cat', [['', 'كل الفئات'], ['none', 'لسه من غير فئة'], ...Object.keys(DB.categories).map(c => [c, c + ' — ' + DB.categories[c].name])], f.cat, `aria-label="الفئة" onchange="inv_f('in','cat',this.value)"`)}
      ${select('inv-in-sla', INV_SLA_OPTS.filter(o => o[0] !== 'paid'), f.sla, `aria-label="حالة الـ SLA" onchange="inv_f('in','sla',this.value)"`)}
      ${select('inv-in-kind', [['', 'كل الأنواع'], ...INV_KINDS], f.kind, `aria-label="نوع المستخلص" onchange="inv_f('in','kind',this.value)"`)}
    </div>
    <div class="chips">${chip('all', 'الكل', base.length)}${chip('late', 'متأخر', late)}${chip('due', 'آخر يوم', due)}${chip('ret', 'مرتجع', ret)}${ovr ? chip('hold', 'معلّق', hold) : ''}${(ovr || S.user.role === 'exec_mgr') && needCat ? chip('cat', 'محتاج تحديد فئة', needCat) : ''}
      ${Object.values(f).some(v => v && v !== 'all') ? `<button class="btn sm gh" onclick="inv_clear('in')">${icon('x')} مسح الفلاتر</button>` : ''}</div>`;

    const table = !base.length
      ? emptyState('inbox', 'صندوقك فاضي — مفيش مستخلصات مستنياك', '<div>أول ما مستخلص يوصل لمحطتك هيظهر هنا، وهيوصلك إشعار وإيميل.</div>', `<button class="btn" onclick="go('invoices')">${icon('files')} شوف كل المستخلصات</button>`)
      : !list.length
        ? emptyState('filter-x', 'مفيش نتائج بالفلتر ده', '<div>جرّب تشيل فلتر أو تغيّر كلمة البحث.</div>', `<button class="btn" onclick="inv_clear('in')">مسح الفلاتر</button>`)
        : `<div class="tw"><table><thead><tr><th>رقم</th><th>الشركة</th><th>المسار</th><th>الفئة</th><th>عند</th><th>الـ SLA</th><th class="n">القيمة</th><th class="c"><span class="sr">إجراء</span></th></tr></thead><tbody>
          ${list.map(i => `<tr class="click ${inv_rowCls(i)}" onclick="openInv('${i.id}')">${invRowCells(i)}<td class="c"><button class="btn sm" onclick="event.stopPropagation();openInv('${i.id}')" aria-label="فتح مستخلص رقم ${esc(i.no)}">فتح ${icon('arrow-left')}</button></td></tr>`).join('')}
        </tbody></table></div>`;

    const rec = inv_recent();
    const recent = `<details class="card mt" ${rec.length ? '' : 'open'}><summary class="ch" style="cursor:pointer;list-style:none">${icon('history')}<h3>عدّى عليّا مؤخراً</h3><span class="sub">آخر 10 أيام عمل · <span class="num">${rec.length}</span></span><span class="sp"></span>${icon('chevron-down')}</summary>
      ${rec.length ? `<div class="tw"><table><thead><tr><th>رقم</th><th>الشركة</th><th>عملت إيه</th><th>إمتى</th><th>هو فين دلوقتي</th><th>الحالة</th></tr></thead><tbody>
        ${rec.map(({ i, e }) => `<tr class="click" onclick="openInv('${i.id}')"><td><b class="num">${esc(i.no)}</b></td><td>${esc(ctx(i).company.name)}</td><td>${esc(INV_ACT[e.action] || e.action)}</td><td>${N(fmtD(e.date))}</td><td>${esc(holderLabel(i))}</td><td>${statusBadge(i)}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('history', 'مفيش حركات ليك في آخر 10 أيام')}
    </details>`;

    return pageHeader({
      title: 'صندوق الوارد',
      sub: ovr ? 'كل المستخلصات المفتوحة، الأكتر تأخير الأول' : `المستخلصات اللي مستنياك كـ ${esc(DB.roles[S.user.role].label)} — الأكتر تأخير الأول`,
      actions: `<button class="btn" onclick="go('invoices')">${icon('files')} كل المستخلصات</button>`,
    }) + (ovr ? `<div class="alert p mb">${icon('shield')}<div><b>صلاحية التحريك بدل الجهة (Override)</b><div class="sm">انت شايف كل المفتوح. تقدر تعتمد أو ترجّع أي مستخلص بالنيابة عن الجهة اللي عندها — وده بيتسجل في السجل باسمك.</div></div></div>` : '')
      + kpis + `<div class="card"><div class="ch"><h3>مستنياك</h3><span class="sub"><span class="num">${list.length}</span> من <span class="num">${base.length}</span></span></div>${base.length ? fbar : ''}${table}</div>` + recent;
  },
  after() { inv_restoreFocus(); },
});

/* ═════════════════════════ 2) كل المستخلصات ═════════════════════════ */
function inv_lsRows() {
  const f = inv_st().ls;
  return visibleInvoices().map(i => ({ i, c: ctx(i), s: slaState(i), t: invTotals(i) })).filter(({ i, c, s }) => {
    if (f.q && !inv_hay(i).includes(f.q.trim())) return false;
    for (const [k, prop] of INV_ORG) if (f[k] && c[prop].id !== f[k]) return false;
    if (f.pt && c.type.id !== f.pt) return false;
    if (f.per && i.period !== f.per) return false;
    if (f.st && i.status !== f.st) return false;
    if (f.cat && (f.cat === 'none' ? !!i.cat : i.cat !== f.cat)) return false;
    if (f.co && c.company.id !== f.co) return false;
    if (f.sla && s.k !== f.sla) return false;
    if (f.kind && i.kind !== f.kind) return false;
    return true;
  });
}
const INV_SORT = {
  no: r => +r.i.no || 0, co: r => r.c.company.name, path: r => r.i.pathName || '', cat: r => r.i.cat || r.i.suggestedCat || 'Z',
  holder: r => holderLabel(r.i), sla: r => inv_score(r.i), gross: r => r.t.gross, per: r => r.i.period || '',
};
function inv_sort(k) { const f = inv_st().ls; if (f.sort === k) f.dir = -f.dir; else { f.sort = k; f.dir = ['co', 'path', 'holder', 'per'].includes(k) ? 1 : -1; } f.page = 0; render(); }
function inv_page(d) { inv_st().ls.page += d; render(); window.scrollTo(0, 0); }
function inv_export() {
  if (!can('reports.export')) return toast('التصدير مش متاح لدورك', 'err');
  const rows = inv_lsSorted();
  const head = ['رقم المستخلص', 'الشركة', 'العقد', 'أمر التكليف', 'المشروع', 'نوع المشروع', 'السنترال', 'الإدارة المختصة', 'الإدارة العامة', 'القطاع', 'رئاسة القطاعات', 'الفترة', 'النوع', 'المسار', 'الفئة', 'الحالة', 'عند', 'أيام في المحطة', 'SLA المحطة', 'أيام الدورة', 'الإجمالي المعتمد', 'الصافي'];
  const data = rows.map(({ i, c, s, t }) => [i.no, c.company.name, c.contract.no, c.ao.no, c.project.name, c.type.name, c.central.name, c.dept.name, c.gdept.name, c.sector.name, c.presidency.name, i.period, i.kind, i.pathName, i.cat || (i.suggestedCat ? i.suggestedCat + ' (مقترحة)' : ''), INV_STATUS[i.status] || i.status, holderLabel(i), s.el ?? '', s.sla ?? '', cycleDays(i).total ?? '', Math.round(t.gross), Math.round(t.net)]);
  Excel.download(`المستخلصات_${iso(TODAY)}.xlsx`, { 'المستخلصات': [head, ...data] });
}
function inv_lsSorted() {
  const f = inv_st().ls, g = INV_SORT[f.sort] || INV_SORT.sla;
  return inv_lsRows().sort((a, b) => { const x = g(a), y = g(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * f.dir; });
}

View.register('invoices', {
  title: 'كل المستخلصات',
  render() {
    const st = inv_st(), f = st.ls, all = visibleInvoices(), showCo = !isCompany();
    const cs = all.map(i => ({ i, c: ctx(i) }));
    // فلاتر الهيكل متدرجة: كل مستوى بيتفلتر باللي فوقه
    let pool = cs;
    const org = INV_ORG.map(([k, prop, label]) => {
      const opts = inv_uniq(pool, x => [x.c[prop].id, x.c[prop].name]);
      const ctl = select('inv-ls-' + k, [['', label + ': الكل'], ...opts], f[k], `aria-label="${label}" onchange="inv_f('ls','${k}',this.value)"`);
      if (f[k]) pool = pool.filter(x => x.c[prop].id === f[k]);
      return ctl;
    }).join('');
    const types = inv_uniq(cs, x => [x.c.type.id, x.c.type.name]);
    const pers = inv_uniq(cs, x => [x.i.period, x.i.period]);
    const cos = inv_uniq(cs, x => [x.c.company.id, x.c.company.name]);
    const stOpts = Object.entries(INV_STATUS).filter(([k]) => k !== 'draft' || isCompany());
    const fbar = `<div class="fbar">
      ${inv_searchBox('ls', 'inv-ls-q', f.q, 'ابحث برقم، شركة، عقد، أمر تكليف…')}
      ${showCo ? select('inv-ls-co', [['', 'كل الشركات'], ...cos], f.co, `aria-label="الشركة" onchange="inv_f('ls','co',this.value)"`) : ''}
      ${org}
      ${select('inv-ls-pt', [['', 'نوع المشروع: الكل'], ...types], f.pt, `aria-label="نوع المشروع" onchange="inv_f('ls','pt',this.value)"`)}
      ${select('inv-ls-per', [['', 'كل الفترات'], ...pers], f.per, `aria-label="الفترة" onchange="inv_f('ls','per',this.value)"`)}
      ${select('inv-ls-st', [['', 'كل الحالات'], ...stOpts], f.st, `aria-label="الحالة" onchange="inv_f('ls','st',this.value)"`)}
      ${select('inv-ls-cat', [['', 'كل الفئات'], ['none', 'لسه من غير فئة'], ...Object.keys(DB.categories).map(c => [c, c + ' — ' + DB.categories[c].name])], f.cat, `aria-label="الفئة" onchange="inv_f('ls','cat',this.value)"`)}
      ${select('inv-ls-sla', INV_SLA_OPTS, f.sla, `aria-label="حالة الـ SLA" onchange="inv_f('ls','sla',this.value)"`)}
      ${select('inv-ls-kind', [['', 'كل الأنواع'], ...INV_KINDS], f.kind, `aria-label="نوع المستخلص" onchange="inv_f('ls','kind',this.value)"`)}
    </div>`;
    const active = ['q', 'co', 'pt', 'per', 'st', 'cat', 'sla', 'kind', ...INV_ORG.map(o => o[0])].filter(k => f[k]).length;

    const rows = inv_lsSorted();
    const pages = Math.max(1, Math.ceil(rows.length / INV_PAGE));
    if (f.page >= pages) f.page = pages - 1; if (f.page < 0) f.page = 0;
    const pageRows = rows.slice(f.page * INV_PAGE, (f.page + 1) * INV_PAGE);
    const gross = sum(rows, r => r.t.gross);
    const th = (k, label, cls = '') => { const on = f.sort === k; return `<th class="${cls}" aria-sort="${on ? (f.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button class="btn gh sm" style="padding:0 4px;height:auto;font-size:12px" onclick="inv_sort('${k}')">${label}${on ? icon(f.dir > 0 ? 'arrow-up' : 'arrow-down') : icon('chevrons-up-down')}</button></th>`; };
    const cols = showCo ? 8 : 7;
    const table = !all.length
      ? emptyState('files', 'مفيش مستخلصات في نطاقك لسه')
      : !rows.length
        ? emptyState('filter-x', 'مفيش نتائج بالفلتر ده', '<div>جرّب تشيل فلتر أو أكتر.</div>', `<button class="btn" onclick="inv_clear('ls')">مسح الفلاتر</button>`)
        : `<div class="tw"><table><thead><tr>${th('no', 'رقم')}${showCo ? th('co', 'الشركة') : ''}${th('path', 'المسار')}${th('cat', 'الفئة')}${th('holder', 'عند')}${th('sla', 'الـ SLA')}${th('gross', 'القيمة', 'n')}${th('per', 'الفترة')}</tr></thead>
          <tbody>${pageRows.map(({ i }) => `<tr class="click ${inv_rowCls(i)}" onclick="openInv('${i.id}')" tabindex="0" onkeydown="if(event.key==='Enter')openInv('${i.id}')">${invRowCells(i, { showCo })}<td class="sm">${esc(i.period || '—')}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="${cols - 2}">الإجمالي: <span class="num">${rows.length}</span> مستخلص</td><td class="n"><span class="money">${money(gross)}</span></td><td></td></tr></tfoot></table></div>
          <div class="cf row sb"><span>عرض <span class="num">${f.page * INV_PAGE + 1}–${Math.min(rows.length, (f.page + 1) * INV_PAGE)}</span> من <span class="num">${rows.length}</span></span>
          <span class="row"><button class="btn sm icon" ${f.page <= 0 ? 'disabled' : ''} onclick="inv_page(-1)" aria-label="الصفحة السابقة">${icon('chevron-right')}</button><span class="num">${f.page + 1} / ${pages}</span><button class="btn sm icon" ${f.page >= pages - 1 ? 'disabled' : ''} onclick="inv_page(1)" aria-label="الصفحة التالية">${icon('chevron-left')}</button></span></div>`;
    const exp = can('reports.export')
      ? `<button class="btn" onclick="inv_export()" ${rows.length ? '' : 'disabled'}>${icon('file-down')} تصدير Excel</button>`
      : `<span title="التصدير مش متاح لدورك"><button class="btn" disabled>${icon('file-down')} تصدير Excel</button></span>`;
    return pageHeader({ title: 'كل المستخلصات', sub: `كل المستخلصات في نطاقك: ${esc(scopeLabel(S.user.scope))}`, actions: exp })
      + `<div class="card"><div class="ch"><h3>المستخلصات</h3><span class="sub"><span class="num">${rows.length}</span> من <span class="num">${all.length}</span></span><span class="sp"></span>${active ? `<button class="btn sm gh" onclick="inv_clear('ls')">${icon('x')} مسح الفلاتر (<span class="num">${active}</span>)</button>` : ''}</div>${all.length ? fbar : ''}${table}</div>`;
  },
  after() { inv_restoreFocus(); },
});

/* ═════════════════════════ 3) صفحة المستخلص ═════════════════════════ */
function inv_tab(k) { inv_st().tab = k; render(); }
function inv_toggleGroup() { const st = inv_st(); st.group = !st.group; render(); }

/** شريط المسار: الشركة ← محطات الفئة ← الصرف */
function inv_stepper(inv) {
  const path = pathOf(inv), s = slaState(inv);
  const durs = {}; stepDurations(inv).forEach(d => { durs[d.step] = (durs[d.step] || 0) + d.days; });
  const steps = [{ key: 'company', short: 'تقديم الشركة', name: 'تقديم المستخلص من الشركة', sla: null }, ...path, { key: 'done', short: 'تم الصرف', name: 'تم الصرف', sla: null }];
  const idxOf = k => { const i = steps.findIndex(x => x.key === k); return i < 0 ? 1 : i; };
  let cur = -1, ret = -1, from = -1;
  if (inv.status === 'draft') cur = 0;
  else if (inv.status === 'paid') cur = steps.length;
  else if (inv.status === 'returned') { from = idxOf(inv.step); ret = inv.returnTo === 'company' ? 0 : idxOf(inv.returnTo); }
  else cur = idxOf(inv.step);
  const sub = inv_submitDate(inv);
  return `<div class="stepper" role="list" aria-label="مسار المستخلص">${steps.map((x, i) => {
    let cls = '', c = N(i), d = '';
    const isRet = i === ret, isFrom = i === from;
    const done = inv.status === 'paid' || (inv.status === 'returned' ? i < from && !isRet : i < cur);
    const isCur = !done && (i === cur || isFrom);
    if (isRet) { cls = 'ret'; c = icon('undo-2'); d = `مرتجع هنا · ${N(s.el ?? 0)} يوم`; }
    else if (done) { cls = 'done'; c = icon(x.key === 'done' ? 'banknote' : 'check'); d = x.key === 'company' ? (sub ? N(fmtD(sub)) : '') : durs[x.key] != null ? `${N(durs[x.key])} يوم${x.sla != null ? ` من ${N(x.sla)}` : ''}` : ''; }
    else if (isFrom) { cls = 'cur'; d = 'هيرجع هنا بعد التصليح'; }
    else if (isCur) {
      cls = 'cur ' + s.cls;
      d = inv.status === 'on_hold' ? `معلّق · ${N(s.el ?? 0)} يوم` : inv.status === 'draft' ? 'مسودة' : s.sla != null ? `${N(s.el + '/' + s.sla)} يوم` : `${N(s.el ?? 0)} يوم`;
    } else d = x.key === 'done' || x.key === 'company' ? '' : (x.sla != null ? `SLA ${N(x.sla)} يوم` : 'بدون SLA') + (x.tentative ? ' · مبدئي' : '');
    return `<div class="st ${cls}" role="listitem" title="${esc(x.name || x.short)}"${isCur || isRet ? ' aria-current="step"' : ''}><div class="c">${c}</div><div class="t">${esc(x.short)}</div><div class="d">${d}</div></div>`;
  }).join('')}</div>`;
}

function inv_lastReturn(inv) { for (let i = inv.log.length - 1; i >= 0; i--) if (inv.log[i].action === 'return') return inv.log[i]; return null; }

function inv_callouts(inv) {
  let h = '';
  if (!inv.cat && inv.status !== 'draft') h += `<div class="alert i mt">${icon('info')}<div>المسار مبدئي لحد ما مدير التنفيذ يأكد الفئة — المقترحة دلوقتي ${catBadge(inv)}</div></div>`;
  if (inv.status === 'draft') h += `<div class="alert i mt">${icon('info')}<div>المستخلص لسه مسودة عند الشركة ومتقدمش. المسار مبدئي لحد ما يتقدم ومدير التنفيذ يأكد الفئة.</div></div>`;
  if (inv.status === 'returned') {
    const e = inv_lastReturn(inv);
    const reasons = e && e.reasonIds ? e.reasonIds.map(r => (byId('returnReasons', r) || {}).name).filter(Boolean) : [];
    h += `<div class="alert i mt">${icon('undo-2')}<div><b>المستخلص دلوقتي عند ${esc(holderLabel(inv))}</b> — اترجع من ${esc(stepShort(inv.returnedFrom))}${e ? ` يوم ${N(fmtD(e.date))}` : ''}
      ${reasons.length ? `<div class="row" style="margin-top:6px">${reasons.map(r => `<span class="bd b">${esc(r)}</span>`).join('')}</div>` : ''}
      ${e && e.note ? `<div class="sm" style="white-space:pre-line;margin-top:6px">${esc(e.note)}</div>` : ''}
      <div class="sm" style="margin-top:4px">لما يتصلّح هيرجع على ${esc(stepShort(inv.returnedFrom))} مباشرة مش من الأول.</div></div></div>`;
  }
  if (inv.status !== 'paid' && inv.status !== 'draft') invAlerts(inv).forEach(a => { h += `<div class="alert ${a.cls === 'r' ? 'r' : ''} mt">${icon(a.cls === 'r' ? 'alert-octagon' : 'alert-triangle')}<div>${esc(a.t)}</div></div>`; });
  if (inv.status === 'on_hold') h += `<div class="alert mt">${icon('pause-circle')}<div><b>المستخلص معلّق</b> — ${esc(inv.holdReason || 'بانتظار أمر التكليف')}<div class="sm">عداد الـ SLA واقف لحد ما التعليق يترفع.</div></div></div>`;
  if (inv.status === 'paid' && inv.payment) h += `<div class="alert g mt">${icon('banknote')}<div><b>تم الصرف</b> — ${esc(inv.payment.method)} رقم ${N(esc(inv.payment.ref))} يوم ${N(fmtD(inv.payment.date))} · صافي <span class="money">${money(inv.payment.amount)}</span> جنيه</div></div>`;
  return h;
}

function inv_summary(inv) {
  const c = ctx(inv), cy = cycleDays(inv), sub = inv_submitDate(inv), t = invTotals(inv);
  const kv = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
  return `<div class="kv">
    ${kv('العقد', `${N(esc(c.contract.no))}<div class="sm mut">${esc(c.contract.title)}</div>`)}
    ${kv('أمر التكليف', N(esc(c.ao.no)))}
    ${kv('المشروع', `${esc(c.project.name)}<div class="sm mut">${esc(c.type.name)}</div>`)}
    ${kv('السنترال', esc(c.central.name))}
    ${kv('الإدارة المختصة', esc(c.dept.name))}
    ${kv('الإدارة العامة', esc(c.gdept.name))}
    ${kv('القطاع', esc(c.sector.name))}
    ${kv('رئاسة القطاعات', esc(c.presidency.name))}
    ${kv('الفترة', esc(inv.period || '—'))}
    ${kv('تاريخ التقديم', sub ? N(fmtD(sub)) : 'لسه متقدمش')}
    ${kv('أيام الدورة', cy.total == null ? '—' : `${N(cy.total)} يوم عمل${cy.company ? `<div class="sm mut">منهم ${N(cy.company)} يوم عند الشركة</div>` : ''}`)}
    ${kv('رقم النسخة', `${N(curRev(inv).n)}${inv.revisions.length > 1 ? ' <span class="bd n">معدّلة</span>' : ''}`)}
    ${kv('الإجمالي المعتمد', `<span class="money">${money(t.gross)}</span> جنيه`)}
    ${kv('الصافي', `<span class="money">${money(t.net)}</span> جنيه`)}
  </div>`;
}

/* ── تاب البنود ── */
function inv_tabLines(inv) {
  const lines = invLines(inv), edit = inv_canEditQty(inv), st = inv_st();
  if (!lines.length) return emptyState('list', 'مفيش بنود في المستخلص ده');
  const noPrice = lines.filter(l => l.unitPrice == null), over = lines.filter(l => l.overQty > 0), changed = lines.filter(l => l.changed);
  const cols = 11 + (edit ? 1 : 0);
  const row = l => `<tr>
    <td class="num">${esc(l.itemNo)}</td>
    <td style="min-width:220px">${esc(l.description)}${l.isNew ? ' <span class="bd r">بند مستجد</span>' : ''}${l.notInAo ? ' <span class="bd a">مش في أمر التكليف</span>' : ''}${l.changed && l.approveNote ? `<div class="sm mut">${icon('pencil')} ${esc(l.approveNote)}</div>` : ''}</td>
    <td>${esc(l.unit || '—')}</td>
    ${l.unitPrice == null ? `<td class="n err" title="البند مالوش سعر في العقد (C5)">${icon('alert-triangle')} بدون سعر</td>` : `<td class="n">${N(money(l.unitPrice))}</td>`}
    <td class="n">${N(qty(l.qty))}</td>
    <td class="n">${l.changed ? `<s class="mut">${N(qty(l.qty))}</s> ` : ''}<b>${N(qty(l.approvedQty))}</b></td>
    <td class="n">${N(qty(l.prevQty))}</td>
    <td class="n ${l.overQty > 0 ? 'diff-up' : ''}">${N(qty(l.cumQty))}</td>
    <td class="n">${N(qty(l.plannedQty))}</td>
    <td class="n ${l.overQty > 0 ? 'diff-up' : ''}">${l.overQty > 0 ? N('+' + l.overPct.toFixed(1) + '%') : '<span class="mut">—</span>'}</td>
    <td class="n">${l.total == null ? '<span class="mut">—</span>' : `<span class="money">${money(l.total)}</span>`}</td>
    ${edit ? `<td class="c"><button class="btn sm icon gh" title="تعديل الكمية المعتمدة" aria-label="تعديل الكمية المعتمدة للبند ${esc(l.itemNo)}" onclick="inv_qtyOpen('${inv.id}',${l._i})">${icon('pencil')}</button></td>` : ''}
  </tr>`;
  lines.forEach((l, i) => { l._i = i; });
  let body;
  if (st.group) {
    const g = groupBy(lines, l => l.workType);
    body = Object.entries(g).map(([wt, ls]) => `<tr><th colspan="${cols}" style="position:static">${esc(wt)} <span class="mut num">(${ls.length})</span></th></tr>${ls.map(row).join('')}<tr><td colspan="10" class="b">إجمالي ${esc(wt)}</td><td class="n"><span class="money">${money(sum(ls, l => l.total || 0))}</span></td>${edit ? '<td></td>' : ''}</tr>`).join('');
  } else body = lines.map(row).join('');
  const gross = sum(lines, l => l.total || 0), submitted = sum(lines, l => l.submittedTotal || 0);
  return `${noPrice.length ? `<div class="alert r mb">${icon('alert-triangle')}<div><b>فيه ${N(noPrice.length)} بند مالوش سعر في العقد (C5)</b><div class="sm">البند ده محتاج تسعير من التخطيط وموافقة اللجنة قبل ما يدخل في الإجمالي.</div></div></div>` : ''}
    ${over.length ? `<div class="alert mb">${icon('trending-up')}<div><b>${N(over.length)} بند التراكمي بتاعه أكبر من أمر التكليف</b><div class="sm">${over.slice(0, 4).map(l => `${esc(l.itemNo)} (+${l.overPct.toFixed(1)}%)`).join(' · ')}</div></div></div>` : ''}
    <div class="row sb mb"><div class="sm mut">${edit ? `${icon('pencil')} تقدر تعدّل الكمية المعتمدة لأي بند بسبب واضح — التعديل بيتسجل في السجل.` : 'الأسعار من العقد · السابق = المعتمد في المستخلصات اللي قبل كده على نفس أمر التكليف.'}${changed.length ? ` · <span class="num">${changed.length}</span> بند كميته اتعدلت` : ''}</div>
      <label class="switch sm"><input type="checkbox" ${st.group ? 'checked' : ''} onchange="inv_toggleGroup()" aria-label="تجميع حسب نوع العمل"> تجميع حسب نوع العمل</label></div>
    <div class="card"><div class="tw"><table><thead><tr><th>رقم البند</th><th>الوصف</th><th>الوحدة</th><th class="n">السعر</th><th class="n">المقدم</th><th class="n">المعتمد</th><th class="n">السابق</th><th class="n">التراكمي</th><th class="n">المخطط</th><th class="n">التجاوز%</th><th class="n">الإجمالي</th>${edit ? '<th class="c"><span class="sr">تعديل</span></th>' : ''}</tr></thead>
    <tbody>${body}</tbody>
    <tfoot><tr><td colspan="10">إجمالي المعتمد <span class="sm">(المقدم من الشركة: <span class="money">${money(submitted)}</span>)</span></td><td class="n"><span class="money">${money(gross)}</span></td>${edit ? '<td></td>' : ''}</tr></tfoot></table></div></div>`;
}

/* ── تاب المهمات ── */
function inv_tabMaterials(inv) {
  const ms = invMaterials(inv);
  if (!ms.length) return emptyState('package', 'مفيش مهمات في المستخلص ده', '<div>المستخلص ده مفيهوش بنود بتستهلك مهمات من توريد المصرية.</div>');
  const flagged = ms.filter(m => m.flags.some(f => f.cls === 'r')).length;
  return `<div class="sm mut mb">${icon('info')} المخطط من أمر التكليف · المنصرف من أذون صرف المخازن · التراكمي = السابق + الحالي · الرصيد = المنصرف − التراكمي (لو بالسالب يبقى المنفذ أكتر من المنصرف).</div>
    ${flagged ? `<div class="alert r mb">${icon('alert-triangle')}<div><b>${N(flagged)} صنف فيه مشكلة</b> — راجع مع المخازن قبل الاعتماد.</div></div>` : ''}
    <div class="card"><div class="tw"><table><thead><tr><th>الكود</th><th>الصنف</th><th>الوحدة</th><th class="n">المخطط</th><th class="n">المنصرف</th><th class="n">المنفذ السابق</th><th class="n">المنفذ الحالي</th><th class="n">التراكمي</th><th class="n">المفوتر</th><th class="n">الرصيد</th><th>ملاحظات</th></tr></thead><tbody>
    ${ms.map(m => `<tr><td class="num">${esc(m.code)}</td><td>${esc(m.description)}</td><td>${esc(m.unit)}</td><td class="n">${N(qty(m.planned))}</td><td class="n">${N(qty(m.issued))}</td><td class="n">${N(qty(m.prevExecuted))}</td><td class="n">${N(qty(m.executed))}</td>
      <td class="n ${m.cumExecuted > m.issued ? 'diff-up' : ''}">${N(qty(m.cumExecuted))}</td><td class="n">${N(qty(m.billed))}</td><td class="n ${m.balance < 0 ? 'diff-up' : ''}">${N(qty(m.balance))}</td>
      <td>${m.flags.length ? `<div class="row">${m.flags.map(f => `<span class="bd ${f.cls}">${esc(f.t)}</span>`).join('')}</div>` : '<span class="bd g">مطابق</span>'}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}

/* ── تاب المرفقات ── */
function inv_dl(name) { toast('تنزيل ' + name + ' (ديمو)', 'ok'); }
function inv_tabFiles(inv) {
  const c = ctx(inv), rev = curRev(inv), req = DB.requiredDocs[c.type.id] || [], have = new Set(rev.attachments.map(a => a.docTypeId)), miss = missingDocs(inv);
  const checklist = `<div class="card"><div class="ch"><h3>المستندات المطلوبة</h3><span class="sub">${esc(c.type.name)}</span><span class="sp"></span>${miss.length ? `<span class="bd r">ناقص <span class="num">${miss.length}</span></span>` : '<span class="bd g">كامل</span>'}</div><div class="cb stack" style="gap:8px">
    ${req.length ? req.map(d => { const ok = have.has(d); return `<div class="row"><span class="bd ${ok ? 'g' : 'r'}" aria-label="${ok ? 'مرفق' : 'ناقص'}">${icon(ok ? 'check' : 'x')}</span><span>${esc((byId('docTypes', d) || {}).name || d)}</span></div>`; }).join('') : '<div class="mut sm">مفيش مستندات إلزامية لنوع المشروع ده</div>'}
  </div></div>`;
  const files = `<div class="card"><div class="ch"><h3>الملفات المرفقة</h3><span class="sub">النسخة <span class="num">${rev.n}</span> · <span class="num">${rev.attachments.length}</span> ملف</span></div><div class="cb stack" style="gap:8px">
    ${rev.attachments.length ? rev.attachments.map(a => `<div class="file"><span class="fi">${icon(/\.(zip)$/i.test(a.name) ? 'file-archive' : /\.(dwg)$/i.test(a.name) ? 'drafting-compass' : 'file-text')}</span><div style="flex:1;min-width:0"><div class="b" style="overflow-wrap:anywhere">${esc(a.name)}</div><div class="sm mut">${a.docTypeId ? esc((byId('docTypes', a.docTypeId) || {}).name || '') + ' · ' : ''}${N(inv_size(a.size || 0))} · ${N(fmtD(a.date))}</div></div><button class="btn sm icon gh" aria-label="تنزيل ${esc(a.name)}" title="تنزيل" onclick="inv_dl(this.dataset.n)" data-n="${esc(a.name)}">${icon('download')}</button></div>`).join('') : emptyState('paperclip', 'مفيش ملفات مرفقة')}
  </div></div>`;
  const revs = `<div class="card mt"><div class="ch"><h3>نسخ المستخلص</h3><span class="sub">كل مرة الشركة تعيد الإرسال بتتعمل نسخة جديدة</span></div><div class="tw"><table><thead><tr><th>النسخة</th><th>التاريخ</th><th class="n">البنود</th><th class="n">المهمات</th><th class="n">المرفقات</th><th></th></tr></thead><tbody>
    ${inv.revisions.slice().reverse().map(r => `<tr><td><b class="num">${r.n}</b></td><td>${N(fmtD(r.date))}</td><td class="n">${N(r.lines.length)}</td><td class="n">${N(r.materials.length)}</td><td class="n">${N(r.attachments.length)}</td><td>${r === rev ? '<span class="bd p">الحالية</span>' : '<span class="bd n">سابقة</span>'}</td></tr>`).join('')}
  </tbody></table></div></div>`;
  return `<div class="grid g2">${checklist}${files}</div>${revs}`;
}

/* ── تاب الماليات ── */
function inv_tabMoney(inv) {
  const t = invTotals(inv), ed = inv_canDed(inv);
  const sr = (l, v, cls = '') => `<div class="sumrow ${cls}"><span>${l}</span><span class="money">${v}</span></div>`;
  const left = `<div class="card"><div class="ch"><h3>حساب الصافي</h3><span class="sp"></span>${ed ? `<button class="btn sm" onclick="inv_dedOpen('${inv.id}')">${icon('sliders-horizontal')} تعديل الاستقطاعات</button>` : ''}</div><div class="cb">
    ${sr('<b>إجمالي الأعمال المعتمدة</b>', money(t.gross))}
    ${Object.entries(t.byWorkType).map(([k, v]) => sr(`<span class="sm mut">${esc(k)}</span>`, money(v))).join('')}
    ${sr(`ضريبة القيمة المضافة (${N(t.vatPct + '%')})`, '+ ' + money(t.vat))}
    <hr class="sep">
    ${t.deductions.length ? t.deductions.map(d => sr(`${esc(d.name)}${d.pct != null ? ` (${N(d.pct + '%')})` : ''}`, '− ' + money(d.amount), 'neg')).join('') : '<div class="sm mut">مفيش استقطاعات</div>'}
    ${sr('<b>إجمالي الاستقطاعات</b>', '− ' + money(t.dedTotal), 'neg')}
    ${sr('الصافي المستحق', money(t.net) + ' ' + esc(t.currency === 'EGP' ? 'جنيه' : t.currency), 'tot')}
    <div class="words mt">${icon('pen-line')} فقط ${esc(t.words)}</div>
    ${!inv.deductions ? '<div class="sm mut mt">الاستقطاعات دي القيم الافتراضية من العقد — المالية بتأكدها وقت الصرف.</div>' : ''}
  </div></div>`;
  const used = t.aoValue ? Math.min(100, t.cumGross / t.aoValue * 100) : 0;
  const overAo = t.cumGross > t.aoValue;
  const right = `<div class="stack"><div class="card"><div class="ch"><h3>المقدم مقابل المعتمد</h3></div><div class="cb">
      ${sr('المقدم من الشركة', money(t.submitted))}
      ${sr('المعتمد', money(t.gross))}
      ${sr('الفرق', (t.gross - t.submitted < 0 ? '− ' : '') + money(Math.abs(t.gross - t.submitted)), t.gross < t.submitted ? 'neg' : '')}
    </div></div>
    <div class="card"><div class="ch"><h3>التراكمي على أمر التكليف</h3></div><div class="cb">
      <div class="row sb sm"><span>التراكمي <span class="money">${money(t.cumGross)}</span></span><span>قيمة أمر التكليف <span class="money">${money(t.aoValue)}</span></span></div>
      <div class="prog ${overAo ? 'r' : used > 90 ? 'a' : 'g'} mt" role="progressbar" aria-valuenow="${Math.round(pct(t.cumGross, t.aoValue))}" aria-valuemin="0" aria-valuemax="100" aria-label="نسبة التراكمي من أمر التكليف"><span style="width:${used}%"></span></div>
      <div class="sm ${overAo ? '' : 'mut'} mt">${overAo ? `<span class="bd r">متجاوز بـ ${N(pct(t.cumGross - t.aoValue, t.aoValue).toFixed(1) + '%')}</span>` : `مستخدم ${N(pct(t.cumGross, t.aoValue).toFixed(1) + '%')} من أمر التكليف`}</div>
    </div></div>
    ${inv.payment ? `<div class="card"><div class="ch"><h3>بيانات الصرف</h3></div><div class="cb kv">
      <div><span>الطريقة</span><b>${esc(inv.payment.method)}</b></div><div><span>الرقم المرجعي</span><b class="num">${esc(inv.payment.ref)}</b></div><div><span>التاريخ</span><b>${N(fmtD(inv.payment.date))}</b></div><div><span>المبلغ</span><b><span class="money">${money(inv.payment.amount)}</span></b></div>
    </div></div>` : ''}</div>`;
  return `<div class="grid g2">${left}${right}</div>`;
}

/* ── تاب السجل ── */
function inv_tabLog(inv) {
  if (!inv.log.length) return emptyState('history', 'مفيش حركات لسه', '<div>المستخلص لسه مسودة ومتقدمش.</div>');
  const items = inv.log.map((e, i) => ({ e, days: i > 0 ? wdBetween(inv.log[i - 1].date, e.date) : null })).reverse();
  const cls = a => a === 'return' ? 'ret' : ['approve', 'pay', 'submit', 'resubmit'].includes(a) ? 'ok' : 'info';
  return `<div class="card"><div class="cb"><div class="tl">${items.map(({ e, days }) => {
    const u = userById(e.by), reasons = (e.reasonIds || []).map(r => (byId('returnReasons', r) || {}).name).filter(Boolean);
    const move = e.to && e.step && e.to !== e.step ? `${esc(stepShort(e.step))} ${icon('arrow-left')} ${esc(e.to === 'company' ? ctx(inv).company.name : stepShort(e.to))}` : e.step ? esc(stepShort(e.step)) : '';
    return `<div class="tli ${cls(e.action)}"><div class="h"><b>${esc(INV_ACT[e.action] || e.action)}</b>${e.cat ? `<span class="cat">${esc(e.cat)}</span>` : ''}<span class="mut sm">${move}</span></div>
      <div class="m">${esc(u ? u.name : 'النظام')}${u ? ` · ${esc((DB.roles[u.role] || {}).label || '')}` : ''} · ${N(fmtD(e.date))}${days != null && e.action !== 'submit' ? ` · بعد ${N(days)} يوم عمل${e.step && e.step !== 'company' ? ` عند ${esc(stepShort(e.step))}` : ''}` : ''}</div>
      ${reasons.length ? `<div class="row" style="margin-top:6px">${reasons.map(r => `<span class="bd r">${esc(r)}</span>`).join('')}</div>` : ''}
      ${e.note ? `<div class="note">${esc(e.note)}</div>` : ''}</div>`;
  }).join('')}</div></div></div>`;
}

/* ── تاب الإيميلات ── */
function inv_tabEmails(inv) {
  const ms = DB.emails.filter(m => m.invoiceId === inv.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!ms.length) return emptyState('mail', 'مفيش إيميلات اتبعتت للمستخلص ده');
  return `<div class="sm mut mb">${icon('info')} في الديمو الإيميلات بتتسجل هنا بدل ما تتبعت فعلاً.</div><div class="stack" style="gap:8px">${ms.map(m => `<details class="card"><summary class="ch" style="cursor:pointer;list-style:none">${icon('mail')}<div style="flex:1;min-width:0"><div class="b" style="overflow-wrap:anywhere">${esc(m.subject)}</div><div class="sm mut">إلى: ${esc(m.toName || '')} <span class="num">&lt;${esc(m.to)}&gt;</span></div></div><span class="sm mut">${N(fmtDT(m.date))}</span><span class="bd g">${m.status === 'sent' ? 'اتبعت' : esc(m.status)}</span></summary><div class="cb sm" style="white-space:pre-wrap">${esc(m.body)}</div></details>`).join('')}</div>`;
}

/* ── شريط الأكشن الثابت ── */
function inv_actbar(inv) {
  const mine = canAct(inv), ovr = canOverride(inv), holdOk = inv_canHold(inv);
  if (!mine && !ovr && !holdOk) return '';
  const s = slaState(inv), id = inv.id, can2 = mine || ovr;
  const btns = [];
  if (inv.status === 'active' && can2) {
    const key = inv.step, needCat = key === 'exec' && !inv.cat, next = inv_next(inv);
    if (key === 'exec') btns.push(`<button class="btn ${needCat ? 'pr' : ''}" onclick="inv_catOpen('${id}')">${icon('tags')} ${needCat ? 'تحديد الفئة' : 'تغيير الفئة'}</button>`);
    if (key === 'finance' || !next) btns.push(`<button class="btn pr" onclick="inv_payOpen('${id}')">${icon('banknote')} صرف</button>`);
    else btns.push(`<span title="${needCat ? 'لازم تحدد الفئة الأول عشان المسار يتحدد' : ''}"><button class="btn ${needCat ? '' : 'pr'}" ${needCat ? 'disabled aria-disabled="true"' : ''} onclick="inv_approveOpen('${id}')">${icon('check-check')} اعتماد وتسليم لـ ${esc(next.short)}</button></span>`);
    btns.push(`<button class="btn dg" onclick="inv_returnOpen('${id}')">${icon('undo-2')} إرجاع</button>`);
  }
  if (inv.status === 'returned' && can2) btns.push(`<button class="btn pr" onclick="inv_resubmitOpen('${id}')">${icon('send')} إعادة الإرسال</button>`);
  if (holdOk && inv.status === 'active') btns.push(`<button class="btn wa" onclick="inv_holdOpen('${id}')">${icon('pause')} تعليق</button>`);
  if (holdOk && inv.status === 'on_hold') btns.push(`<button class="btn pr" onclick="inv_releaseOpen('${id}')">${icon('play')} رفع التعليق</button>`);
  if (!btns.length) return '';
  const time = s.sla != null ? `${N(s.el)} يوم من ${N(s.sla)}` : s.el != null ? `${N(s.el)} يوم` : '';
  const info = mine
    ? `${slaChip(inv)}<span>${inv.status === 'returned' ? 'اترجع لك من' : 'عندك من'} ${time}</span>`
    : ovr ? `<span class="bd p">${icon('shield')} تحريك بدل الجهة (PMO)</span><span>عند ${esc(holderLabel(inv))}${time ? ' من ' + time : ''}</span>`
      : `${slaChip(inv)}<span>عند ${esc(holderLabel(inv))}</span>`;
  return `<div class="actbar" role="region" aria-label="إجراءات المستخلص"><div class="info">${info}</div>${btns.join('')}</div>`;
}

View.register('invoice', {
  title: 'المستخلص',
  render(p) {
    const inv = invById(p.id);
    const back = `<button class="btn" onclick="go('invoices')">${icon('arrow-right')} كل المستخلصات</button>`;
    if (!inv) return emptyState('file-x', 'المستخلص ده مش موجود', '<div>ممكن يكون الرابط غلط.</div>', back);
    if (!inScope(S.user, inv) || (inv.status === 'draft' && !isCompany())) return emptyState('shield-off', 'مش من صلاحياتك', '<div>المستخلص ده برّه نطاقك. لو محتاج تشوفه كلّم إدارة المتابعة PMO.</div>', back);
    const st = inv_st(); if (st.tabFor !== inv.id) { st.tabFor = inv.id; st.tab = 'lines'; }
    const c = ctx(inv), cat = inv.cat || inv.suggestedCat || 'C1', path = pathOf(inv);
    const ms = invMaterials(inv), miss = missingDocs(inv), mails = DB.emails.filter(m => m.invoiceId === inv.id).length;
    const tabs = [
      ['lines', 'list', 'البنود', curRev(inv).lines.length],
      ['materials', 'package', 'المهمات', ms.length],
      ['files', 'paperclip', 'المرفقات', miss.length ? `${miss.length} ناقص` : curRev(inv).attachments.length],
      ['money', 'calculator', 'الماليات', null],
      ['log', 'history', 'السجل', inv.log.length],
      ['emails', 'mail', 'الإيميلات', mails],
    ];
    if (!tabs.some(t => t[0] === st.tab)) st.tab = 'lines';
    const body = { lines: inv_tabLines, materials: inv_tabMaterials, files: inv_tabFiles, money: inv_tabMoney, log: inv_tabLog, emails: inv_tabEmails }[st.tab](inv);
    const header = pageHeader({
      title: `مستخلص ${esc(c.company.name)} رقم ${N(esc(inv.no))}`,
      sub: `${esc(inv.pathName || c.project.name)}<span class="row" style="margin-top:8px">${statusBadge(inv)}${catBadge(inv)}${slaChip(inv)}${inv.kind ? `<span class="bd n">${esc(inv.kind)}</span>` : ''}<span class="sm mut">عند: ${esc(holderLabel(inv))}</span></span>`,
      crumbs: [['الرئيسية', 'home'], [isCompany() ? 'كل المستخلصات' : 'صندوق الوارد', isCompany() ? 'invoices' : 'inbox'], ['مستخلص رقم ' + inv.no]],
      actions: `<button class="btn" onclick="window.print()" aria-label="طباعة المستخلص">${icon('printer')} طباعة</button>`,
    });
    const stepCard = `<div class="card mb"><div class="ch"><h3>مسار المستخلص</h3><span class="sub">${inv.cat ? `فئة ${esc(cat)} — ${esc(DB.categories[cat].name)}` : `مبدئي على ${esc(cat)}`} · <span class="num">${path.length}</span> محطة · SLA إجمالي <span class="num">${totalSla(cat)}</span> يوم عمل</span></div><div class="cb">${inv_stepper(inv)}${inv_callouts(inv)}</div></div>`;
    const sumCard = `<div class="card mb"><div class="ch"><h3>بيانات المستخلص</h3></div><div class="cb">${inv_summary(inv)}</div></div>`;
    const tabBar = `<div class="tabs" role="tablist" aria-label="تفاصيل المستخلص">${tabs.map(([k, ic, l, n]) => `<button role="tab" aria-selected="${st.tab === k}" class="${st.tab === k ? 'on' : ''}" onclick="inv_tab('${k}')">${icon(ic)} ${l}${n != null && n !== 0 ? ` <span class="n num">${n}</span>` : ''}</button>`).join('')}</div>`;
    return header + stepCard + sumCard + tabBar + `<div role="tabpanel">${body}</div>` + inv_actbar(inv);
  },
});

/* ═════════════════════════ الأكشنز (مودالات) ═════════════════════════ */
const inv_cancelBtn = `<button class="btn" onclick="closeModal()">إلغاء</button>`;
const inv_ovrNote = inv => inv_isOvr(inv) ? `<div class="alert p">${icon('shield')}<div>انت بتحرّك المستخلص <b>بالنيابة عن ${esc(holderLabel(inv))}</b> — ده هيتسجل في السجل باسمك.</div></div>` : '';

/* ── اعتماد وتسليم ── */
function inv_approveOpen(id) {
  const inv = invById(id), next = inv_next(inv);
  if (inv.step === 'exec' && !inv.cat) return toast('لازم تحدد الفئة الأول', 'err');
  if (!next) return inv_payOpen(id);
  modal('اعتماد وتسليم', `${inv_ovrNote(inv)}
    <div class="alert i">${icon('arrow-left-circle')}<div>المستخلص هيتسلّم لـ <b>${esc(next.name)}</b>${next.sla != null ? ` (SLA <span class="num">${next.sla}</span> يوم عمل)` : ''}<div class="sm">هيوصل إشعار وإيميل لـ: ${esc(inv_holders(inv, next.key))}</div></div></div>
    ${field('ملاحظة (اختياري)', `<textarea id="inv-m-note" rows="3" placeholder="أي ملاحظة للمحطة اللي بعدك…"></textarea>`, { id: 'inv-m-note' })}`,
    `<button class="btn pr" onclick="inv_approveDo('${id}')">${icon('check-check')} اعتماد وتسليم</button>${inv_cancelBtn}`);
}
function inv_approveDo(id) {
  const inv = invById(id), next = inv_next(inv), note = inv_note(inv, inv_val('inv-m-note'));
  inv_run(() => Flow.approve(inv, { note }), `اتسلّم لـ ${next ? next.short : 'المحطة التالية'}`);
}

/* ── تحديد الفئة ── */
function inv_catOpen(id) {
  const inv = invById(id), sug = suggestCategory(inv), pre = inv.cat || inv.suggestedCat || sug.cat;
  modal(inv.cat ? 'تغيير الفئة' : 'تحديد فئة التجاوز', `${inv_ovrNote(inv)}
    <div class="alert p">${icon('sparkles')}<div><b>السيستم مقترح ${esc(sug.cat)}</b><ul style="margin:4px 0 0;padding-inline-start:18px" class="sm">${sug.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div></div>
    <div class="stack" style="gap:8px" role="radiogroup" aria-label="الفئة">${Object.entries(DB.categories).map(([k, v]) => `<label class="file" style="cursor:pointer"><input type="radio" class="chk" name="inv-cat" value="${k}" ${k === pre ? 'checked' : ''}><span class="cat">${k}</span><div style="flex:1;min-width:0"><div class="b">${esc(v.name)}</div><div class="sm mut"><span class="num">${v.path.length}</span> محطة · SLA إجمالي <span class="num">${totalSla(k)}</span> يوم عمل</div></div>${k === sug.cat ? '<span class="bd p">مقترحة</span>' : ''}</label>`).join('')}</div>
    ${field('ملاحظة (اختياري)', `<textarea id="inv-m-note" rows="2" placeholder="لو اخترت فئة غير المقترحة اكتب السبب"></textarea>`, { id: 'inv-m-note' })}
    <div class="sm mut">الفئة بتحدد المسار والـ SLA. بعد التحديد تقدر تعتمد وتسلّم.</div>`,
    `<button class="btn pr" onclick="inv_catDo('${id}')">${icon('check')} حفظ الفئة</button>${inv_cancelBtn}`, { size: 'lg' });
}
function inv_catDo(id) {
  const inv = invById(id), el = document.querySelector('input[name="inv-cat"]:checked'), cat = el && el.value;
  if (!cat || !DB.categories[cat]) return toast('اختار فئة الأول', 'err');
  const sug = suggestCategory(inv).cat, raw = inv_val('inv-m-note').trim();
  if (cat !== sug && !raw) return toast('اكتب سبب اختيار فئة غير المقترحة', 'err');
  let note = inv_note(inv, raw);
  if (note) note = `تحديد الفئة ${cat} — ${note}`;
  inv_run(() => Flow.setCategory(inv, cat, { note }), `اتحددت الفئة ${cat} — ${DB.categories[cat].name}`);
}

/* ── إرجاع ── */
function inv_returnTargets(inv) {
  const path = pathOf(inv), idx = path.findIndex(s => s.key === inv.step);
  return [['company', `${ctx(inv).company.name} (الشركة المنفذة)`], ...path.slice(0, Math.max(0, idx)).map(s => [s.key, `${s.name} — ${inv_holders(inv, s.key)}`])];
}
function inv_returnOpen(id) {
  const inv = invById(id);
  modal('إرجاع المستخلص', `${inv_ovrNote(inv)}
    ${field('ترجّعه لمين', select('inv-m-target', inv_returnTargets(inv), 'company'), { req: true, id: 'inv-m-target' })}
    <div class="fld"><label>السبب <span class="req">*</span></label><div class="grid g2" style="gap:6px">${DB.returnReasons.map(r => `<label class="row" style="gap:8px;flex-wrap:nowrap;cursor:pointer"><input type="checkbox" class="chk" name="inv-rr" value="${r.id}"><span class="sm">${esc(r.name)}</span></label>`).join('')}</div></div>
    ${field('المطلوب بالظبط', `<textarea id="inv-m-note" rows="4" placeholder="اكتب المطلوب تصليحه بالتفصيل — سطر لكل نقطة"></textarea>`, { req: true, id: 'inv-m-note' })}
    <div class="alert i">${icon('corner-down-left')}<div>لما يتصلّح هيرجع لك أنت مباشرة مش من الأول.</div></div>`,
    `<button class="btn dg" onclick="inv_returnDo('${id}')">${icon('undo-2')} إرجاع</button>${inv_cancelBtn}`, { size: 'lg' });
}
function inv_returnDo(id) {
  const inv = invById(id), target = inv_val('inv-m-target') || 'company', reasonIds = inv_checked('inv-rr'), raw = inv_val('inv-m-note').trim();
  if (!inv_returnTargets(inv).some(t => t[0] === target)) return toast('اختار الجهة اللي هترجعله', 'err');
  if (!reasonIds.length) return toast('اختار سبب واحد على الأقل', 'err');
  if (!raw) return toast('اكتب المطلوب بالظبط', 'err');
  const note = inv_note(inv, raw);
  inv_run(() => Flow.returnTo(inv, { target, reasonIds, note }), `اترجع لـ ${target === 'company' ? ctx(inv).company.name : stepShort(target)}`);
}

/* ── إعادة الإرسال ── */
function inv_rsFiles(files) {
  const ta = document.getElementById('inv-m-files'); if (!ta) return;
  const names = Array.from(files || []).map(f => f.name).filter(Boolean);
  ta.value = [ta.value.trim(), ...names].filter(Boolean).join('\n');
  toast(`اتضاف ${names.length} ملف`, 'ok');
}
function inv_newRev(inv, names, docIds) {
  const c = curRev(inv), d = new Date(TODAY);
  const atts = c.attachments.map(a => ({ ...a }));
  docIds.forEach(dt => { const t = byId('docTypes', dt); if (t && !atts.some(a => a.docTypeId === dt)) atts.push({ id: uid('a'), docTypeId: dt, name: t.name + '.pdf', size: 320 * 1024, date: d }); });
  names.forEach(n => atts.push({ id: uid('a'), docTypeId: null, name: n, size: 280 * 1024, date: d }));
  return { n: c.n + 1, date: d, lines: c.lines.map(l => ({ ...l })), materials: c.materials.map(m => ({ ...m })), attachments: atts };
}
function inv_resubmitOpen(id) {
  const inv = invById(id), co = inv.returnTo === 'company', e = inv_lastReturn(inv), miss = co ? missingDocs(inv) : [];
  modal('إعادة الإرسال', `${inv_ovrNote(inv)}
    <div class="alert i">${icon('corner-down-left')}<div>المستخلص هيرجع على <b>${esc(stepName(inv.returnedFrom))}</b> مباشرة (${esc(inv_holders(inv, inv.returnedFrom))}).${e && e.note ? `<div class="sm" style="white-space:pre-line;margin-top:4px">المطلوب: ${esc(e.note)}</div>` : ''}</div></div>
    ${co ? `${miss.length ? `<div class="fld"><label>المستندات الناقصة اللي أرفقتها</label>${miss.map(d => `<label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" class="chk" name="inv-md" value="${d.id}"><span class="sm">${esc(d.name)}</span></label>`).join('')}</div>` : ''}
      ${dropZone('inv-dz', 'اسحب الملفات المحدّثة هنا', 'أو دوس عشان تختار — هتتحفظ في نسخة جديدة من المستخلص', 'inv_rsFiles')}
      ${field('أسماء الملفات المحدّثة', `<textarea id="inv-m-files" rows="3" placeholder="ملف في كل سطر — مثلاً: محضر الحصر المعدّل.pdf"></textarea>`, { id: 'inv-m-files', hint: `هتتعمل نسخة رقم ${curRev(inv).n + 1}` })}` : ''}
    ${field('إيه اللي اتعمل', `<textarea id="inv-m-note" rows="3" placeholder="مثلاً: تم إرفاق شهادة الاستلام وتعديل الحصر"></textarea>`, { req: true, id: 'inv-m-note' })}`,
    `<button class="btn pr" onclick="inv_resubmitDo('${id}')">${icon('send')} إعادة الإرسال</button>${inv_cancelBtn}`, { size: co ? 'lg' : '' });
}
function inv_resubmitDo(id) {
  const inv = invById(id), raw = inv_val('inv-m-note').trim();
  if (!raw) return toast('اكتب إيه اللي اتعمل', 'err');
  const back = inv.returnedFrom, note = inv_note(inv, raw);
  let revision;
  if (inv.returnTo === 'company') {
    const names = inv_val('inv-m-files').split(/\n|،|,/).map(s => s.trim()).filter(Boolean);
    revision = inv_newRev(inv, names, inv_checked('inv-md'));
  }
  inv_run(() => Flow.resubmit(inv, { note, revision }), `رجع لـ ${stepShort(back)}${revision ? ` — نسخة رقم ${revision.n}` : ''}`);
}

/* ── تعديل الكمية المعتمدة ── */
function inv_qtyOpen(id, idx) {
  const inv = invById(id), l = invLines(inv)[idx];
  if (!l) return;
  modal('تعديل الكمية المعتمدة', `${inv_ovrNote(inv)}
    <div class="kv"><div><span>البند</span><b class="num">${esc(l.itemNo)}</b></div><div><span>الوحدة</span><b>${esc(l.unit || '—')}</b></div><div><span>المقدم من الشركة</span><b class="num">${qty(l.qty)}</b></div><div><span>المعتمد حالياً</span><b class="num">${qty(l.approvedQty)}</b></div><div><span>المخطط</span><b class="num">${qty(l.plannedQty)}</b></div><div><span>السابق</span><b class="num">${qty(l.prevQty)}</b></div></div>
    <div class="sm mut">${esc(l.description)}</div>
    ${field('الكمية المعتمدة الجديدة', `<input class="in" id="inv-m-qty" type="number" min="0" step="any" inputmode="decimal" value="${l.approvedQty}">`, { req: true, id: 'inv-m-qty' })}
    ${field('السبب', `<textarea id="inv-m-reason" rows="3" placeholder="مثلاً: الحصر المشترك أقل من المقدم"></textarea>`, { req: true, id: 'inv-m-reason' })}`,
    `<button class="btn pr" onclick="inv_qtyDo('${id}',${idx})">${icon('check')} حفظ التعديل</button>${inv_cancelBtn}`);
}
function inv_qtyDo(id, idx) {
  const inv = invById(id), raw = inv_val('inv-m-qty').trim(), q = Number(raw), reason = inv_val('inv-m-reason').trim();
  if (raw === '' || isNaN(q) || q < 0) return toast('اكتب كمية صحيحة (صفر أو أكتر)', 'err');
  if (!reason) return toast('لازم تكتب سبب التعديل', 'err');
  const r = inv_isOvr(inv) ? `${reason} (بالنيابة عن ${holderLabel(inv)})` : reason;
  inv_run(() => Flow.updateApproved(inv, idx, q, { reason: r }), 'اتعدلت الكمية المعتمدة');
}

/* ── الصرف ── */
function inv_payOpen(id) {
  const inv = invById(id), t = invTotals(inv);
  modal('صرف المستخلص', `${inv_ovrNote(inv)}
    <div class="card flat"><div class="cb"><div class="sumrow tot"><span>الصافي المستحق</span><span class="money">${money(t.net)}</span></div><div class="words">فقط ${esc(t.words)}</div></div></div>
    <div class="grid g2">${field('طريقة الصرف', select('inv-m-method', ['شيك', 'تحويل بنكي'], 'شيك'), { req: true, id: 'inv-m-method' })}
    ${field('رقم الشيك / التحويل', `<input class="in" id="inv-m-ref" inputmode="numeric" placeholder="مثلاً 458213">`, { req: true, id: 'inv-m-ref' })}</div>
    <div class="sm mut">${icon('mail')} الشركة هيوصلها إشعار وإيميل إن الشيك أو التحويل جاهز.</div>`,
    `<button class="btn pr" onclick="inv_payDo('${id}')">${icon('banknote')} تأكيد الصرف</button>${inv_cancelBtn}`);
}
function inv_payDo(id) {
  const inv = invById(id), method = inv_val('inv-m-method') || 'شيك', ref = inv_val('inv-m-ref').trim();
  if (!ref) return toast('اكتب رقم الشيك أو التحويل', 'err');
  const note = inv_isOvr(inv) ? inv_note(inv, `تم الصرف — ${method} رقم ${ref}`) : undefined;
  inv_run(() => Flow.pay(inv, { ref, method, note }), `تم الصرف — ${method} رقم ${ref}`);
}

/* ── التعليق ── */
const INV_HOLD_REASONS = ['بانتظار اعتماد ملحق زيادة أمر التكليف', 'بانتظار اعتماد أمر التكليف', 'بانتظار تسعير بند مستجد', 'بانتظار مستندات من جهة خارجية', 'أخرى'];
function inv_holdOpen(id) {
  const inv = invById(id);
  modal('تعليق المستخلص', `<div class="alert">${icon('pause-circle')}<div>التعليق بيوقف عداد الـ SLA. المستخلص هيفضل عند ${esc(holderLabel(inv))} لحد ما التعليق يترفع.</div></div>
    ${field('السبب', select('inv-m-hreason', INV_HOLD_REASONS, INV_HOLD_REASONS[0]), { req: true, id: 'inv-m-hreason' })}
    ${field('تفاصيل', `<textarea id="inv-m-note" rows="2" placeholder="مطلوبة لو اخترت أخرى"></textarea>`, { id: 'inv-m-note' })}`,
    `<button class="btn wa" onclick="inv_holdDo('${id}')">${icon('pause')} تعليق</button>${inv_cancelBtn}`);
}
function inv_holdDo(id) {
  const inv = invById(id), pre = inv_val('inv-m-hreason') || INV_HOLD_REASONS[0], txt = inv_val('inv-m-note').trim();
  if (pre === 'أخرى' && !txt) return toast('اكتب سبب التعليق', 'err');
  const reason = pre === 'أخرى' ? txt : pre + (txt ? ' — ' + txt : '');
  inv_run(() => Flow.hold(inv, { reason }), 'اتعلّق المستخلص — العداد واقف');
}
function inv_releaseOpen(id) { confirmBox('رفع التعليق', `المستخلص هيرجع لـ ${esc(stepShort(invById(id).step))} والعداد هيبدأ من جديد. متأكد؟`, 'رفع التعليق', () => inv_releaseDo(id)); }
function inv_releaseDo(id) {
  const inv = invById(id);
  try { Flow.release(inv); } catch (e) { return toast(e.message, 'err'); }
  closeModal(); toast('اترفع التعليق ورجع لـ ' + stepShort(inv.step), 'ok');
}

/* ── تعديل الاستقطاعات (المالية) ── */
function inv_dedOpen(id, keep) {
  const inv = invById(id), st = inv_st(), t = invTotals(inv);
  if (!keep || !st.ded) st.ded = t.deductions.map(d => ({ typeId: d.typeId, name: d.name, mode: d.pct != null ? 'pct' : 'amt', v: d.pct != null ? d.pct : Math.round(d.amount || 0), releasable: !!d.releasable }));
  const amt = d => d.mode === 'pct' ? t.gross * (+d.v || 0) / 100 : (+d.v || 0);
  const rows = st.ded.map((d, i) => `<tr><td>${esc(d.name)}${d.releasable ? ' <span class="bd n">بيترد</span>' : ''}</td>
    <td>${select('inv-d-m' + i, [['pct', 'نسبة %'], ['amt', 'مبلغ']], d.mode, `aria-label="نوع القيمة لـ ${esc(d.name)}" onchange="inv_dedSet(${i},'mode',this.value);inv_dedOpen('${id}',true)"`)}</td>
    <td><input class="cellin" id="inv-d-v${i}" type="number" min="0" step="any" value="${esc(d.v)}" aria-label="قيمة ${esc(d.name)}" oninput="inv_dedSet(${i},'v',this.value)"></td>
    <td class="n"><span class="money">${money(amt(d))}</span></td>
    <td class="c"><button class="btn sm icon gh" aria-label="حذف ${esc(d.name)}" onclick="inv_dedDel('${id}',${i})">${icon('trash-2')}</button></td></tr>`).join('');
  modal('تعديل الاستقطاعات', `<div class="sm mut">إجمالي الأعمال المعتمدة <span class="money">${money(t.gross)}</span> — النسبة بتتحسب منه.${inv.step !== 'finance' ? ' <span class="bd a">المستخلص لسه مش في محطة المالية</span>' : ''}</div>
    <div class="tw"><table><thead><tr><th>البند</th><th>النوع</th><th>القيمة</th><th class="n">المبلغ</th><th class="c"><span class="sr">حذف</span></th></tr></thead><tbody>${rows || `<tr><td colspan="5" class="mut">مفيش استقطاعات</td></tr>`}</tbody></table></div>
    <div><button class="btn sm" onclick="inv_dedAdd('${id}')">${icon('plus')} إضافة غرامة</button></div>
    ${field('ملاحظة / سبب التعديل', `<textarea id="inv-m-note" rows="2" placeholder="مثلاً: غرامة تأخير 12 يوم عن الجدول الزمني"></textarea>`, { id: 'inv-m-note' })}
    <div class="sm mut">المبالغ بتتحدث بعد الحفظ.</div>`,
    `<button class="btn pr" onclick="inv_dedDo('${id}')">${icon('check')} حفظ الاستقطاعات</button><button class="btn" onclick="inv_st().ded=null;closeModal()">إلغاء</button>`, { size: 'lg' });
}
function inv_dedSet(i, k, v) { const d = (inv_st().ded || [])[i]; if (d) d[k] = v; }
function inv_dedAdd(id) { const st = inv_st(); (st.ded = st.ded || []).push({ typeId: 'penalty', name: (byId('deductionTypes', 'penalty') || {}).name || 'غرامة تأخير', mode: 'amt', v: 0, releasable: false }); inv_dedOpen(id, true); }
function inv_dedDel(id, i) { const st = inv_st(); (st.ded || []).splice(i, 1); inv_dedOpen(id, true); }
function inv_dedDo(id) {
  const inv = invById(id), st = inv_st(), draft = st.ded || [];
  for (const d of draft) {
    const v = Number(d.v);
    if (d.v === '' || isNaN(v) || v < 0) return toast(`قيمة ${d.name} مش صحيحة`, 'err');
    if (d.mode === 'pct' && v > 100) return toast(`نسبة ${d.name} أكبر من 100%`, 'err');
  }
  inv.deductions = draft.map(d => d.mode === 'pct' ? { typeId: d.typeId, name: d.name, pct: Number(d.v), releasable: d.releasable } : { typeId: d.typeId, name: d.name, amount: Number(d.v), releasable: d.releasable });
  const summary = draft.map(d => `${d.name} ${d.mode === 'pct' ? d.v + '%' : money(Number(d.v))}`).join(' · ');
  const raw = inv_val('inv-m-note').trim();
  Flow._log(inv, { action: 'deductions', step: inv.step, to: inv.step, note: (raw ? raw + '\n' : '') + summary });
  st.ded = null;
  closeModal(); toast('اتحفظت الاستقطاعات — الصافي ' + money(invTotals(inv).net), 'ok');
}
