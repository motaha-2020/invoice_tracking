/* ============================================================
   views/company.js — شاشات الشركة المنفذة
   co-home (الرئيسية) · co-returned (مطلوب الرد) · inv-new (مستخلص جديد — wizard)
   كل الدوال الـ global بـ prefix co_ والحالة في S.ui.co
   ============================================================ */

/* ───────────── state + helpers ───────────── */
function co_st() { return S.ui.co || (S.ui.co = { f: 'all', wiz: null, rs: null }); }
function co_w() { return co_st().wiz; }
const CO_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const CO_KINDS = ['مدني', 'كهربي', 'مجمع', 'تخطيط'];
const co_period = () => `${CO_MONTHS[TODAY.getMonth()]} ${TODAY.getFullYear()}`;
const co_normCode = v => String(v ?? '').trim().replace(/\./g, '-');
const co_round = v => v < 50 ? Math.round(v * 100) / 100 : Math.round(v);
const co_isRet = i => i.status === 'returned' && i.returnTo === 'company';
const co_lastReturn = inv => inv.log.slice().reverse().find(e => e.action === 'return');
const co_size = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const co_myContracts = () => DB.contracts.filter(k => k.companyId === S.user.scope.id);

/** شاشة مش متاحة لغير الشركات */
function co_guard() {
  if (isCompany()) return '';
  return pageHeader({ title: 'شاشة الشركات المنفذة' }) + `<div class="card">${emptyState('lock', 'الصفحة دي للشركات المنفذة بس', '<div>دورك يقدر يتابع المستخلصات من صندوق الوارد أو كل المستخلصات.</div>', `<button class="btn pr" onclick="go('home')">${icon('house')} الرئيسية</button>`)}</div>`;
}

/** أسباب آخر إرجاع + الملاحظة */
function co_reasonsHtml(inv) {
  const e = co_lastReturn(inv); if (!e) return '';
  const rs = (e.reasonIds || []).map(r => byId('returnReasons', r)).filter(Boolean);
  return `${rs.length ? `<div class="row">${rs.map(r => `<span class="bd r">${esc(r.name)}</span>`).join('')}</div>` : ''}${e.note ? `<div class="sm" style="white-space:pre-line;margin-top:6px">${esc(e.note)}</div>` : ''}`;
}

/** شريط المسار المصغّر: محطة لكل جزء */
function co_pathMini(inv) {
  const path = pathOf(inv);
  let cur = -1, curCls = '';
  if (inv.status === 'paid') cur = path.length;
  else if (inv.status === 'returned') { cur = path.findIndex(s => s.key === (inv.returnTo === 'company' ? inv.returnedFrom : inv.returnTo)); curCls = 'r'; }
  else if (inv.status === 'on_hold') { cur = path.findIndex(s => s.key === (inv.heldAt || inv.step)); curCls = 'a'; }
  else if (inv.status === 'active') cur = path.findIndex(s => s.key === inv.step);
  const segs = path.map((s, i) => {
    const cls = i < cur ? 'g' : i === cur ? curCls : '';
    const w = i <= cur ? 100 : 0;
    return `<span class="prog ${cls}" style="flex:1" title="${esc(s.short)}"><span style="width:${w}%"></span></span>`;
  }).join('');
  const label = inv.status === 'paid' ? 'خلص المسار' : inv.status === 'draft' ? 'لسه ما اتقدمش' : `محطة <span class="num">${Math.max(cur + 1, 1)}</span> من <span class="num">${path.length}</span>`;
  return `<div style="display:flex;gap:3px" role="img" aria-label="تقدم المستخلص في المسار">${segs}</div><div class="sm mut" style="margin-top:4px">${label}</div>`;
}

/** كارت مستخلص */
function co_card(inv) {
  const c = ctx(inv), t = invTotals(inv);
  const st = inv.status === 'returned' && inv.returnTo === 'company' ? 'st-r' : inv.status === 'on_hold' ? 'st-a' : inv.status === 'paid' ? 'st-g' : '';
  return `<div class="card click ${st}" role="button" tabindex="0" onclick="openInv('${inv.id}')" onkeydown="if(event.key==='Enter')openInv('${inv.id}')">
    <div class="cb stack" style="gap:10px">
      <div class="row sb"><div><span class="sm mut">مستخلص رقم</span> <b class="num">${esc(inv.no)}</b></div>${statusBadge(inv)}</div>
      <div><div class="b" style="line-height:1.4">${esc(inv.pathName || c.project.name)}</div>
        <div class="row sm mut" style="margin-top:4px"><span class="num">${esc(c.ao.no)}</span><span>·</span><span>${esc(inv.kind || '—')}</span><span>·</span>${catBadge(inv)}</div></div>
      <div>${co_pathMini(inv)}</div>
      <div class="row sb"><div class="sm"><span class="mut">عند:</span> <b>${esc(holderLabel(inv))}</b></div>${inv.status === 'draft' ? '' : slaChip(inv)}</div>
      <div class="row sb" style="border-top:1px solid var(--bd1);padding-top:8px"><span class="sm mut">الإجمالي</span><span><span class="money">${money(t.gross)}</span> <span class="sm mut">جنيه</span></span></div>
    </div></div>`;
}
const co_cardGrid = list => `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr))">${list.map(co_card).join('')}</div>`;

/* ───────────── co-home ───────────── */
const CO_GROUPS = [
  { k: 'ret', label: 'مطلوب الرد', ic: 'reply', f: co_isRet },
  { k: 'draft', label: 'مسودات', ic: 'file-pen-line', f: i => i.status === 'draft' },
  { k: 'rev', label: 'تحت المراجعة', ic: 'hourglass', f: i => ['active', 'on_hold'].includes(i.status) || (i.status === 'returned' && i.returnTo !== 'company') },
  { k: 'paid', label: 'اتصرف', ic: 'banknote', f: i => i.status === 'paid' },
];

View.register('co-home', {
  title: 'الرئيسية',
  render() {
    const g = co_guard(); if (g) return g;
    const st = co_st(), co = byId('companies', S.user.scope.id);
    const invs = visibleInvoices().slice().sort((a, b) => new Date(b.since) - new Date(a.since));
    const ret = invs.filter(co_isRet), drafts = invs.filter(i => i.status === 'draft'), held = invs.filter(i => i.status === 'on_hold');
    const review = invs.filter(CO_GROUPS[2].f);
    const yr = TODAY.getFullYear();
    const paidYr = invs.filter(i => i.status === 'paid' && i.payment && new Date(i.payment.date).getFullYear() === yr);
    const paidSum = sum(paidYr, i => i.payment.amount ?? invTotals(i).net);
    const submitted = invs.filter(i => i.status !== 'draft'), paid = submitted.filter(i => i.status === 'paid');
    const base = paid.length ? paid : submitted;
    const avg = base.length ? sum(base, i => cycleDays(i).total || 0) / base.length : null;
    const avgCo = base.length ? sum(base, i => cycleDays(i).company) / base.length : 0;

    const kpis = `<div class="grid g4 mb">
      ${kpi('hourglass', 'تحت المراجعة', review.length, `بقيمة ${mShort(sum(review, i => invTotals(i).gross))} جنيه`)}
      ${kpi('reply', 'مطلوب الرد منك', ret.length, ret.length ? 'الأيام دي محسوبة على الشركة' : 'مفيش حاجة مستنياك', ret.length ? 'r' : 'g')}
      ${kpi('banknote', `اتصرف سنة ${yr}`, `${mShort(paidSum)} <small>جنيه</small>`, `صافي <span class="num">${paidYr.length}</span> مستخلص`)}
      ${kpi('timer', 'متوسط أيام الدورة', avg == null ? '—' : `${Math.round(avg)} <small>يوم عمل</small>`, avg == null ? 'لسه مفيش مستخلصات متقدمة' : `منها <span class="num">${Math.round(avgCo)}</span> يوم عند الشركة · ${paid.length ? 'للمستخلصات اللي اتصرفت' : 'للمستخلصات المتقدمة'}`)}
    </div>`;

    // مطلوب منك دلوقتي
    const todo = [
      ...ret.map(i => `<div class="alert r"><span>${icon('reply')}</span><div style="flex:1;min-width:0">
          <div class="row sb"><b>مستخلص <span class="num">${esc(i.no)}</span> اترجع لك من ${esc(stepShort(i.returnedFrom))}</b><span class="sm">من <span class="num">${wdBetween(i.since, TODAY)}</span> يوم عمل</span></div>
          <div class="sm" style="margin:2px 0 6px">${esc(i.pathName)}</div>${co_reasonsHtml(i)}
          <div class="row" style="margin-top:8px"><button class="btn sm pr" onclick="co_rsOpen('${i.id}')">${icon('send')} رد وأعد التقديم</button><button class="btn sm" onclick="openInv('${i.id}')">افتح المستخلص</button></div></div></div>`),
      ...drafts.map(i => { const md = missingDocs(i).length, n = curRev(i).lines.length; return `<div class="alert p"><span>${icon('file-pen-line')}</span><div style="flex:1;min-width:0">
          <div class="row sb"><b>مسودة مستخلص <span class="num">${esc(i.no)}</span> لسه ما اتقدمتش</b></div>
          <div class="sm">${esc(i.pathName)} · <span class="num">${n}</span> بند${md ? ` · ناقص <span class="num">${md}</span> مستند` : ''}</div>
          <div class="row" style="margin-top:8px"><button class="btn sm pr" onclick="go('inv-new',{draft:'${i.id}'})">${icon('pencil')} كمّل المسودة</button></div></div></div>`; }),
      ...held.map(i => `<div class="alert"><span>${icon('pause-circle')}</span><div style="flex:1;min-width:0">
          <div class="row sb"><b>مستخلص <span class="num">${esc(i.no)}</span> معلّق</b><span class="sm">من <span class="num">${wdBetween(i.since, TODAY)}</span> يوم</span></div>
          <div class="sm">${esc(i.holdReason || 'بانتظار اعتماد أمر التكليف')} — العداد واقف لحد ما يترفع التعليق، مش مطلوب منك حاجة دلوقتي.</div>
          <div class="row" style="margin-top:8px"><button class="btn sm" onclick="openInv('${i.id}')">افتح المستخلص</button></div></div></div>`),
    ];
    const todoCard = `<div class="card mb"><div class="ch"><h3>مطلوب منك دلوقتي</h3>${todo.length ? `<span class="bd n num">${todo.length}</span>` : ''}</div>
      <div class="cb">${todo.length ? `<div class="stack">${todo.join('')}</div>` : emptyState('check-circle-2', 'كله تمام', '<div>مفيش مستخلصات مستنية رد منك.</div>')}</div></div>`;

    // كروت المستخلصات
    const chips = [['all', 'الكل', invs.length], ...CO_GROUPS.map(gr => [gr.k, gr.label, invs.filter(gr.f).length])];
    const groups = st.f === 'all' ? CO_GROUPS : CO_GROUPS.filter(gr => gr.k === st.f);
    const body = groups.map(gr => { const l = invs.filter(gr.f); if (!l.length) return st.f === 'all' ? '' : emptyState(gr.ic, `مفيش مستخلصات ${gr.label}`); return `${st.f === 'all' ? `<div class="row" style="margin:6px 0 10px"><span class="mut">${icon(gr.ic)}</span><b>${gr.label}</b><span class="bd n num">${l.length}</span></div>` : ''}${co_cardGrid(l)}`; }).join('<div style="height:18px"></div>');
    const listCard = `<div class="card"><div class="ch"><h3>مستخلصاتك</h3><span class="sub">دوس على أي مستخلص عشان تشوف تفاصيله ومساره</span></div>
      <div class="chips" role="tablist" aria-label="فلتر الحالة">${chips.map(([k, l, n]) => `<button class="chip ${st.f === k ? 'on' : ''}" role="tab" aria-selected="${st.f === k}" onclick="co_st().f='${k}';render()">${l} <span class="n num">${n}</span></button>`).join('')}</div>
      <div class="cb">${invs.length ? (body || emptyState('inbox', 'مفيش مستخلصات')) : emptyState('file-plus-2', 'لسه ما قدمتش أي مستخلص', '<div>ابدأ أول مستخلص وارفع البنود من Excel.</div>', `<button class="btn pr" onclick="go('inv-new')">${icon('plus')} مستخلص جديد</button>`)}</div></div>`;

    return pageHeader({ title: `أهلاً، ${esc(co ? co.name : '')}`, sub: `${esc(co ? co.fullName : '')} · متابعة مستخلصاتك من التقديم لحد الصرف`, actions: `<button class="btn pr" onclick="go('inv-new')">${icon('file-plus-2')} مستخلص جديد</button>` }) + kpis + todoCard + listCard;
  },
});

/* ───────────── co-returned ───────────── */
View.register('co-returned', {
  title: 'مطلوب الرد',
  render() {
    const g = co_guard(); if (g) return g;
    const list = visibleInvoices().filter(co_isRet).sort((a, b) => new Date(a.since) - new Date(b.since));
    const head = pageHeader({ title: 'مطلوب الرد', sub: 'مستخلصات اترجعت لك — كل يوم عمل هنا محسوب على الشركة في وقت الدورة', crumbs: [['الرئيسية', 'home'], ['مطلوب الرد']] });
    if (!list.length) return head + `<div class="card">${emptyState('check-circle-2', 'مفيش مستخلصات مرتجعة', '<div>أي مستخلص يترجع لك هيظهر هنا بالأسباب.</div>', `<button class="btn" onclick="go('home')">رجوع للرئيسية</button>`)}</div>`;
    const totalDays = sum(list, i => wdBetween(i.since, TODAY));
    return head + `<div class="alert r mb">${icon('clock')}<div>عندك <b class="num">${list.length}</b> مستخلص مستني ردك · إجمالي <b class="num">${totalDays}</b> يوم عمل محسوبة على الشركة لحد النهارده.</div></div>
    <div class="stack">${list.map(i => {
      const c = ctx(i), d = wdBetween(i.since, TODAY), e = co_lastReturn(i), by = e && userById(e.by);
      return `<div class="card st-r"><div class="ch"><h3>مستخلص <span class="num">${esc(i.no)}</span></h3><span class="sub">${esc(i.pathName)}</span><span class="sp"></span>${catBadge(i)}<span class="sla r">من <span class="num">${d}</span> يوم عمل · على الشركة</span></div>
        <div class="cb stack">
          <div class="kv"><div><span>رجّعه</span><b>${esc(stepShort(i.returnedFrom))}</b>${by ? `<div class="sm mut">${esc(by.name)}</div>` : ''}</div><div><span>تاريخ الإرجاع</span><b class="num">${fmtD(i.since)}</b></div><div><span>أمر التكليف</span><b class="num">${esc(c.ao.no)}</b></div><div><span>الإجمالي</span><b><span class="money">${money(invTotals(i).gross)}</span> جنيه</b></div></div>
          <div><div class="sm mut" style="margin-bottom:4px">أسباب الإرجاع</div>${co_reasonsHtml(i) || '<span class="mut sm">مفيش أسباب مسجلة</span>'}</div>
          <div class="row"><button class="btn pr" onclick="co_rsOpen('${i.id}')">${icon('send')} رد سريع وإعادة تقديم</button><button class="btn" onclick="openInv('${i.id}')">${icon('reply')} الرد وإعادة التقديم</button></div>
        </div></div>`;
    }).join('')}</div>`;
  },
});

/* ── مودال الرد السريع ── */
function co_rsOpen(id) {
  const inv = invById(id); if (!inv) return;
  const st = co_st();
  if (!st.rs || st.rs.id !== id) st.rs = { id, note: '', files: [], dt: (missingDocs(inv)[0] || {}).id || 'dt1', lines: null, linesName: '', linesMsg: '', err: '' };
  const rs = st.rs;
  const body = `<div class="alert r">${icon('reply')}<div><b>اترجع من ${esc(stepShort(inv.returnedFrom))}</b>${co_reasonsHtml(inv)}</div></div>
    ${field('ردك على الملاحظات', `<textarea id="co_rs_note" rows="3" placeholder="مثلاً: تم إرفاق الشهادة وتعديل كمية بند الحفر حسب الحصر" oninput="co_st().rs.note=this.value">${esc(rs.note)}</textarea>${rs.err ? `<div class="e">${esc(rs.err)}</div>` : ''}`, { req: true, id: 'co_rs_note', hint: 'الرد بيتسجل في سجل المستخلص وبيوصل للي رجّعه' })}
    <div class="fld"><label for="co_rs_dt">مرفقات جديدة (اختياري)</label>
      <div class="row">${select('co_rs_dt', DB.docTypes.map(d => [d.id, d.name]), rs.dt, `style="flex:1;min-width:180px" onchange="co_st().rs.dt=this.value"`)}
        <label class="btn">${icon('paperclip')} اختار ملف<input type="file" hidden multiple onchange="co_rsFiles(this.files)"></label>
        <button class="btn gh" onclick="co_rsSample()">${icon('flask-conical')} ملف تجريبي</button></div>
      ${rs.files.length ? `<div class="stack" style="gap:6px;margin-top:6px">${rs.files.map(f => `<div class="file"><span class="fi">${icon('file')}</span><div style="flex:1;min-width:0"><div class="b sm">${esc(f.name)}</div><div class="sm mut">${esc((byId('docTypes', f.docTypeId) || {}).name || '')} · ${co_size(f.size)}</div></div><button class="btn sm icon gh" aria-label="شيل الملف" onclick="co_rsDel('${f.id}')">${icon('x')}</button></div>`).join('')}</div>` : ''}</div>
    <div class="fld"><label>تعديل البنود (اختياري)</label>
      <div class="row"><label class="btn">${icon('file-spreadsheet')} ارفع ملف بنود معدّل<input type="file" hidden accept=".xlsx,.xls" onchange="co_rsLines(this.files)"></label><a class="btn gh" href="templates/09_بنود_المستخلص.xlsx" download>${icon('download')} القالب</a></div>
      ${rs.linesMsg ? `<div class="${rs.lines ? 'h' : 'e'}">${esc(rs.linesMsg)}</div>` : '<div class="h">لو رفعت ملف، البنود الجديدة هتحل محل بنود المراجعة الحالية</div>'}</div>`;
  modal(`الرد على مستخلص <span class="num">${esc(inv.no)}</span>`, body, `<button class="btn pr" onclick="co_rsConfirm()">${icon('send')} إعادة التقديم لـ ${esc(stepShort(inv.returnedFrom))}</button><button class="btn" onclick="co_st().rs=null;closeModal()">إلغاء</button>`, { size: 'lg' });
}
function co_rsFiles(files) { const rs = co_st().rs; [...files].forEach(f => rs.files.push({ id: uid('a'), docTypeId: rs.dt, name: f.name, size: f.size, date: new Date(TODAY) })); co_rsOpen(rs.id); }
function co_rsSample() { const rs = co_st().rs; const d = byId('docTypes', rs.dt); rs.files.push({ id: uid('a'), docTypeId: rs.dt, name: `${d.name} — معدّل.pdf`, size: (300 + Math.floor(Math.random() * 3000)) * 1024, date: new Date(TODAY) }); co_rsOpen(rs.id); }
function co_rsDel(fid) { const rs = co_st().rs; rs.files = rs.files.filter(f => f.id !== fid); co_rsOpen(rs.id); }
function co_rsLines(files) {
  const rs = co_st().rs, f = files && files[0]; if (!f) return;
  const inv = invById(rs.id);
  co_readSheet(f, 'بنود المستخلص').then(raw => {
    const rows = co_mapLineRows(raw);
    const chk = co_lineCheck({ aoId: inv.aoId, rows, siteCode: '' });
    if (!rows.length) { rs.lines = null; rs.linesMsg = 'الملف مفيهوش بنود — اتأكد إنك بتستخدم القالب'; }
    else if (chk.err) { rs.lines = null; rs.linesMsg = `${chk.err} صف فيهم أخطاء (كود غلط أو كمية مش مظبوطة) — صلّح الملف وارفعه تاني`; }
    else { rs.lines = chk.lines; rs.linesName = f.name; rs.linesMsg = `${f.name}: ${chk.lines.length} بند${chk.warn ? ` · ${chk.warn} تحذير` : ''} — هيتقدموا كمراجعة جديدة`; }
    co_rsOpen(rs.id);
  }).catch(err => { toast(err.message, 'err'); });
}
function co_rsConfirm() {
  const rs = co_st().rs, inv = invById(rs.id);
  const note = (document.getElementById('co_rs_note') || {}).value ?? rs.note;
  rs.note = note;
  if (!String(note).trim()) { rs.err = 'اكتب ردك على الملاحظات قبل إعادة التقديم'; return co_rsOpen(rs.id); }
  const cur = curRev(inv);
  const revision = JSON.parse(JSON.stringify(cur));
  revision.n = cur.n + 1; revision.date = new Date(TODAY);
  revision.attachments = revision.attachments.concat(rs.files);
  if (rs.lines) revision.lines = rs.lines;
  const to = stepShort(inv.returnedFrom);
  Flow.resubmit(inv, { by: S.user.id, note: String(note).trim(), revision });
  co_st().rs = null; S.modal = '';
  toast(`المستخلص ${inv.no} رجع لـ ${to}`, 'ok');
  render();
}

/* ───────────── Excel ───────────── */
/** يقرا شيت بالاسم (أو أول شيت) ويعتمد على الصف التاني كأسماء أعمدة تقنية */
function co_readSheet(file, sheet) {
  return new Promise((res, rej) => {
    if (!window.XLSX) return rej(new Error('مكتبة Excel مش متحملة — محتاج إنترنت، أو جرّب بالملف التجريبي'));
    const fr = new FileReader();
    fr.onload = e => { try { const wb = XLSX.read(e.target.result, { type: 'array' }); const ws = wb.Sheets[sheet] || wb.Sheets[wb.SheetNames[0]]; res(XLSX.utils.sheet_to_json(ws, { range: 1, defval: '' })); } catch (err) { rej(new Error('الملف مش مقروء — اتأكد إنه Excel بنفس شكل القالب')); } };
    fr.onerror = () => rej(new Error('مش قادر أقرا الملف'));
    fr.readAsArrayBuffer(file);
  });
}
const co_num = v => v === '' || v == null ? NaN : Number(String(v).replace(/,/g, ''));
function co_mapLineRows(raw) {
  return raw.filter(r => { const c = String(r.item_code ?? '').trim(); return c && !c.startsWith('مثال'); })
    .map(r => ({ code: co_normCode(r.item_code), qty: co_num(r.qty), site: String(r.site_code ?? '').trim(), note: String(r.notes ?? '').trim() }));
}
function co_mapMatRows(raw) {
  return raw.filter(r => { const c = String(r.material_code ?? '').trim(); return c && !c.startsWith('مثال'); })
    .map(r => ({ code: String(r.material_code).trim(), qty: co_num(r.executed_qty) }));
}

/* ───────────── تحقق البنود والمهمات ───────────── */
/** w: {aoId, rows:[{code, qty, site, manual}], siteCode} ← rows بالحالة + lines مدموجة */
function co_lineCheck(w) {
  const out = { rows: [], lines: [], err: 0, warn: 0 };
  if (!w.aoId) return out;
  const k = byId('aos', w.aoId).contractId;
  const sites = new Set(DB.aoSites.filter(s => s.aoId === w.aoId).map(s => s.code));
  const first = {};
  (w.rows || []).forEach((r, i) => {
    const code = co_normCode(r.code), q = Number(r.qty);
    const it = DB.contractItems.find(x => x.contractId === k && x.itemNo === code);
    const res = { i, code, qty: q, site: r.site || '', manual: !!r.manual, msgs: [], level: 'ok', it };
    if (r.manual && !(q > 0)) { res.level = 'skip'; out.rows.push(res); return; }
    if (!it) res.msgs.push({ cls: 'r', t: 'الكود ده مش موجود في العقد' });
    else if (it.isGroup) res.msgs.push({ cls: 'r', t: 'ده عنوان مجموعة مش بند' });
    if (!(q > 0)) res.msgs.push({ cls: 'r', t: 'الكمية لازم تكون رقم أكبر من صفر' });
    if (res.msgs.length) { res.level = 'err'; out.err++; out.rows.push(res); return; }
    if (it.unitPrice == null) res.msgs.push({ cls: 'a', t: 'مالوش سعر في العقد ← هيمشي C5' });
    if (!DB.aoItems.some(x => x.aoId === w.aoId && x.itemId === it.id)) res.msgs.push({ cls: 'a', t: 'مش موجود في أمر التكليف' });
    if (res.site && sites.size && !sites.has(res.site)) res.msgs.push({ cls: 'a', t: 'الموقع مش من مواقع أمر التكليف' });
    if (first[it.id] != null) { res.msgs.push({ cls: 'a', t: 'متكرر — اتجمع مع أول صف' }); res.dup = true; out.lines[first[it.id]].qty += q; }
    else { first[it.id] = out.lines.length; res.lineIdx = out.lines.length; const l = { itemId: it.id, qty: q }; const sc = res.site || w.siteCode; if (sc) l.siteCode = sc; out.lines.push(l); }
    if (res.msgs.length) { res.level = 'warn'; out.warn++; }
    out.rows.push(res);
  });
  return out;
}
function co_matCheck(w) {
  const out = { rows: [], mats: [], err: 0, warn: 0 }, first = {};
  (w.mats || []).forEach((r, i) => {
    const code = String(r.code ?? '').trim(), q = Number(r.qty), m = material(code);
    const res = { i, code, qty: q, mat: m, msgs: [], level: 'ok' };
    if (!m) res.msgs.push({ cls: 'r', t: 'كود المهمات مش في الكتالوج' });
    if (!(q > 0)) res.msgs.push({ cls: 'r', t: 'الكمية لازم تكون أكبر من صفر' });
    if (res.msgs.length) { res.level = 'err'; out.err++; out.rows.push(res); return; }
    if (first[code] != null) { res.msgs.push({ cls: 'a', t: 'متكرر — اتجمع مع أول صف' }); res.dup = true; out.mats[first[code]].executedQty += q; res.level = 'warn'; out.warn++; }
    else { first[code] = out.mats.length; res.matIdx = out.mats.length; out.mats.push({ code, executedQty: q }); }
    out.rows.push(res);
  });
  return out;
}

/* ───────────── wizard: الحالة والحسابات ───────────── */
function co_newWiz() {
  const ks = co_myContracts();
  return { step: 1, draftId: null, contractId: ks.length === 1 ? ks[0].id : '', aoId: '', no: '', pathName: '', kind: 'مدني', period: co_period(), siteCode: '',
    rows: [], src: '', fileName: '', mats: [], matSrc: '', matFile: '', atts: [], xdt: 'dt3', tried: {}, savedAt: null, done: null };
}
function co_loadDraft(id) {
  const inv = invById(id);
  if (!inv || inv.status !== 'draft' || !inScope(S.user, inv)) return false;
  const c = ctx(inv), rev = curRev(inv);
  const w = co_newWiz();
  Object.assign(w, { draftId: inv.id, contractId: c.contract.id, aoId: inv.aoId, no: inv.no, pathName: inv.pathName || '', kind: inv.kind || 'مدني', period: inv.period || co_period(),
    siteCode: (rev.lines.find(l => l.siteCode) || {}).siteCode || '',
    rows: rev.lines.map(l => ({ code: (byId('contractItems', l.itemId) || {}).itemNo || '', qty: l.qty, site: l.siteCode || '' })), src: 'draft', fileName: 'من المسودة',
    mats: rev.materials.map(m => ({ code: m.code, qty: m.executedQty })), matSrc: rev.materials.length ? 'draft' : '',
    atts: rev.attachments.map(a => ({ ...a })), savedAt: inv.since });
  co_st().wiz = w; return true;
}
function co_seqFor(w) {
  const d = w.draftId && invById(w.draftId);
  if (d && d.aoId === w.aoId) return d.seq;
  const others = aoInvoices(w.aoId).filter(i => i.id !== w.draftId);
  return (others.length ? Math.max(...others.map(i => i.seq)) : 0) + 1;
}
function co_temp(w, lines, mats, atts) {
  return { id: w.draftId || 'co-tmp', no: w.no || '', seq: co_seqFor(w), aoId: w.aoId, period: w.period, kind: w.kind, pathName: w.pathName, status: 'draft', step: null, since: new Date(TODAY), cat: null, suggestedCat: null, returnTo: null, returnedFrom: null,
    revisions: [{ n: 1, date: new Date(TODAY), lines, materials: mats, attachments: atts }], deductions: null, log: [], payment: null };
}
/** كل الحسابات المشتقة من حالة الـ wizard */
function co_calc(w) {
  const lc = co_lineCheck(w), mc = co_matCheck(w);
  if (!w.aoId) return { lc, mc, temp: null };
  const temp = co_temp(w, lc.lines, mc.mats, w.atts);
  const sug = suggestCategory(temp);
  const pathInv = { ...temp, suggestedCat: sug.cat };
  return { lc, mc, temp, sug, lines: invLines(temp), mats: invMaterials(temp), tot: invTotals(temp), path: pathOf(pathInv), sla: totalSla(sug.cat), pathInv };
}
function co_v1(w) {
  const e = {};
  if (!w.contractId) e.contract = 'اختار العقد';
  if (!w.aoId) e.ao = 'اختار أمر التكليف';
  const no = String(w.no || '').trim();
  if (!no) e.no = 'اكتب رقم المستخلص';
  else if (w.contractId && DB.invoices.some(i => i.id !== w.draftId && byId('aos', i.aoId).contractId === w.contractId && String(i.no).trim() === no)) e.no = 'الرقم ده متسجل قبل كده على نفس العقد';
  if (!String(w.pathName || '').trim()) e.pathName = 'اكتب اسم المسار';
  return e;
}
function co_reqDocs(w) { if (!w.aoId) return []; return (DB.requiredDocs[aoCtx(w.aoId).type.id] || []).map(d => byId('docTypes', d)); }
function co_blockers(w, k) {
  const b = [];
  const e1 = co_v1(w); Object.values(e1).forEach(m => b.push({ step: 1, t: m }));
  if (!k.lc.lines.length) b.push({ step: 2, t: 'مفيش بنود أعمال في المستخلص' });
  if (k.lc.err) b.push({ step: 2, t: `${k.lc.err} صف بنود فيهم أخطاء` });
  if (k.mc.err) b.push({ step: 3, t: `${k.mc.err} صف مهمات فيهم أخطاء` });
  co_reqDocs(w).filter(d => !w.atts.some(a => a.docTypeId === d.id)).forEach(d => b.push({ step: 4, t: `مستند ناقص: ${d.name}` }));
  return b;
}

/** حفظ/تحديث المسودة في DB.invoices بنفس شكل README */
function co_upsertDraft(w) {
  const k = co_calc(w);
  let inv = w.draftId && invById(w.draftId);
  if (inv && inv.status !== 'draft') inv = null;
  const seq = co_seqFor(w);
  const rev = { n: 1, date: new Date(TODAY), lines: k.lc.lines.map(l => ({ ...l })), materials: k.mc.mats.map(m => ({ code: m.code, executedQty: co_round(m.executedQty) })), attachments: w.atts.map(a => ({ ...a })) };
  const fields = { no: String(w.no).trim(), seq, aoId: w.aoId, period: w.period || co_period(), kind: w.kind, pathName: String(w.pathName || '').trim() || aoCtx(w.aoId).project.name };
  if (inv) { Object.assign(inv, fields); inv.revisions[inv.revisions.length - 1] = { ...rev, n: curRev(inv).n }; inv.since = new Date(TODAY); }
  else {
    inv = { id: uid('inv'), ...fields, status: 'draft', step: null, since: new Date(TODAY), cat: null, suggestedCat: null, returnTo: null, returnedFrom: null, revisions: [rev], deductions: null, log: [], payment: null };
    DB.invoices.push(inv); w.draftId = inv.id;
  }
  w.savedAt = new Date();
  return inv;
}

/* ───────────── wizard: الأحداث ───────────── */
/** إعادة رسم مع الحفاظ على الفوكس (للخانات اللي بتتعدل في الجداول) */
function co_rerender() { setTimeout(() => { const a = document.activeElement, id = a && a.id; render(); if (id) { const e = document.getElementById(id); if (e) e.focus(); } }, 0); }
function co_set(key, v, re) { co_w()[key] = v; if (re) render(); }
function co_setK(v) { const w = co_w(); if (w.contractId !== v) { w.contractId = v; w.aoId = ''; w.siteCode = ''; } render(); }
function co_setAo(v) { const w = co_w(); if (w.aoId !== v) { w.aoId = v; w.siteCode = ''; if (v && !w.pathName) w.pathName = aoCtx(v).project.name.split('—')[0].trim(); } render(); }
function co_goStep(n) { const w = co_w(); if (n < w.step) { w.step = n; render(); window.scrollTo(0, 0); } }
function co_validStep(w, n) {
  if (n === 1) return !Object.keys(co_v1(w)).length;
  const k = co_calc(w);
  if (n === 2) return k.lc.lines.length > 0 && !k.lc.err;
  if (n === 3) return !k.mc.err;
  return true;
}
function co_next() {
  const w = co_w();
  if (!co_validStep(w, w.step)) { w.tried[w.step] = true; render(); toast(w.step === 1 ? 'كمّل البيانات المطلوبة الأول' : 'صلّح الأخطاء اللي في الجدول الأول', 'err'); return; }
  co_upsertDraft(w); // autosave
  w.step = Math.min(4, w.step + 1); render(); window.scrollTo(0, 0);
}
function co_back() { const w = co_w(); w.step = Math.max(1, w.step - 1); render(); window.scrollTo(0, 0); }
function co_saveDraft() {
  const w = co_w(), e = co_v1(w);
  if (e.contract || e.ao || e.no) { w.tried[1] = true; w.step = 1; render(); toast('لازم العقد وأمر التكليف ورقم مستخلص صحيح عشان تحفظ', 'err'); return; }
  co_upsertDraft(w); toast('اتحفظت المسودة', 'ok'); render();
}
function co_reset() { co_st().wiz = co_newWiz(); render(); }
function co_submit() {
  const w = co_w(), k = co_calc(w), b = co_blockers(w, k);
  if (b.length) { w.tried[4] = true; render(); toast('فيه حاجات ناقصة قبل التقديم', 'err'); return null; }
  const inv = co_upsertDraft(w);
  Flow.submit(inv, { by: S.user.id });
  w.done = inv.id; w.doneParams = S.params; render(); window.scrollTo(0, 0);
  toast(`المستخلص ${inv.no} اتقدّم`, 'ok');
  return inv;
}

/* بنود */
function co_linesFiles(files) {
  const f = files && files[0]; if (!f) return;
  co_readSheet(f, 'بنود المستخلص').then(raw => {
    const rows = co_mapLineRows(raw);
    if (!rows.length) { toast('الملف مفيهوش بنود — اتأكد إنك بتستخدم القالب', 'err'); return; }
    const w = co_w(); w.rows = rows; w.src = 'excel'; w.fileName = f.name; w.tried[2] = false; render();
    toast(`اتقرا ${rows.length} صف من ${f.name}`, 'ok');
  }).catch(err => toast(err.message, 'err'));
}
function co_manual() {
  const w = co_w();
  const have = {}; w.rows.forEach(r => { const c = co_normCode(r.code); have[c] = (have[c] || 0) + (Number(r.qty) || 0); });
  w.rows = DB.aoItems.filter(x => x.aoId === w.aoId).map(x => { const it = byId('contractItems', x.itemId); return { code: it.itemNo, qty: have[it.itemNo] || '', site: '', manual: true }; });
  w.src = 'manual'; w.fileName = ''; render();
}
function co_sample() {
  const w = co_w(), sites = DB.aoSites.filter(s => s.aoId === w.aoId);
  const prev = prevQtyMap(co_temp(w, [], [], [])), items = DB.aoItems.filter(x => x.aoId === w.aoId);
  const site = () => w.siteCode || (sites.length ? sites[Math.floor(Math.random() * sites.length)].code : '');
  // 30–60% من المتبقي في أمر التكليف (ولو أمر التكليف اتفوتر كله: من المخطط)
  let rows = items.map(x => ({ x, rem: x.plannedQty - (prev[x.itemId] || 0) })).filter(o => o.rem >= 2)
    .map(o => ({ code: byId('contractItems', o.x.itemId).itemNo, qty: Math.max(1, Math.round(o.rem * (0.3 + Math.random() * 0.3))), site: site() }));
  if (!rows.length) rows = items.map(x => ({ code: byId('contractItems', x.itemId).itemNo, qty: Math.max(1, Math.round(x.plannedQty * (0.3 + Math.random() * 0.3))), site: site() }));
  w.rows = rows; w.src = 'sample'; w.fileName = 'ملف تجريبي — بنود المستخلص.xlsx'; render();
  toast('اتملت كميات تجريبية (30–60% من المتبقي في أمر التكليف)', 'ok');
}
function co_setQty(i, v) { const r = co_w().rows[i]; if (r) r.qty = v === '' ? '' : co_num(v); co_rerender(); }
function co_delRow(i) { co_w().rows.splice(i, 1); render(); }
function co_dropErrRows() { const w = co_w(), bad = new Set(co_lineCheck(w).rows.filter(r => r.level === 'err').map(r => r.i)); w.rows = w.rows.filter((r, i) => !bad.has(i)); render(); }
function co_clearRows() { const w = co_w(); w.rows = []; w.src = ''; w.fileName = ''; render(); }

/* مهمات */
function co_matsFiles(files) {
  const f = files && files[0]; if (!f) return;
  co_readSheet(f, 'مهمات المستخلص').then(raw => {
    const rows = co_mapMatRows(raw);
    if (!rows.length) { toast('الملف مفيهوش مهمات — اتأكد إنك بتستخدم القالب', 'err'); return; }
    const w = co_w(); w.mats = rows; w.matSrc = 'excel'; w.matFile = f.name; render();
    toast(`اتقرا ${rows.length} صنف من ${f.name}`, 'ok');
  }).catch(err => toast(err.message, 'err'));
}
/** يشتق المهمات المنفذة من البنود: بند العقد ← الكتالوج (material × matFactor) */
function co_deriveMats() {
  const w = co_w(), lines = co_lineCheck(w).lines, acc = {};
  lines.forEach(l => {
    const it = byId('contractItems', l.itemId), c = it && DB.itemCatalog.find(x => x.itemNo === it.itemNo);
    if (c && c.material) acc[c.material] = (acc[c.material] || 0) + l.qty * c.matFactor;
  });
  w.mats = Object.entries(acc).map(([code, q]) => ({ code, qty: co_round(q) }));
  w.matSrc = 'derived'; w.matFile = ''; render();
  toast(w.mats.length ? `اتحسب ${w.mats.length} صنف من البنود` : 'البنود دي مفيهاش مهمات من توريد المصرية', w.mats.length ? 'ok' : '');
}
function co_setMatQty(i, v) { const r = co_w().mats[i]; if (r) r.qty = v === '' ? '' : co_num(v); co_rerender(); }
function co_delMat(i) { co_w().mats.splice(i, 1); render(); }

/* مرفقات */
function co_attach(dt, files) { const w = co_w(); [...(files || [])].forEach(f => w.atts.push({ id: uid('a'), docTypeId: dt, name: f.name, size: f.size, date: new Date(TODAY) })); render(); }
function co_attachSample(dt) { const w = co_w(), d = byId('docTypes', dt), ext = { dt3: 'zip', dt7: 'dwg' }[dt] || 'pdf'; w.atts.push({ id: uid('a'), docTypeId: dt, name: `${d.name}.${ext}`, size: (200 + Math.floor(Math.random() * 6000)) * 1024, date: new Date(TODAY) }); render(); }
function co_attachAllSamples() { const w = co_w(); co_reqDocs(w).filter(d => !w.atts.some(a => a.docTypeId === d.id)).forEach(d => w.atts.push({ id: uid('a'), docTypeId: d.id, name: `${d.name}.pdf`, size: (200 + Math.floor(Math.random() * 6000)) * 1024, date: new Date(TODAY) })); render(); }
function co_attachDel(id) { const w = co_w(); w.atts = w.atts.filter(a => a.id !== id); render(); }

/* ───────────── wizard: الرسم ───────────── */
const CO_STEPS = ['بيانات المستخلص', 'بنود الأعمال', 'المهمات', 'المرفقات والمراجعة'];
function co_msgs(msgs) { return msgs.map(m => `<span class="bd ${m.cls}">${esc(m.t)}</span>`).join(' '); }
function co_catBox(k) {
  if (!k.temp) return '';
  const c = k.sug.cat;
  return `<div class="card"><div class="ch"><h3>الفئة المقترحة</h3><span class="sp"></span>${catBadge({ suggestedCat: c })}</div><div class="cb stack" style="gap:10px">
    <div class="b">${esc(DB.categories[c].name)}</div>
    <ul class="sm" style="margin:0;padding-inline-start:18px">${k.sug.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    <div><div class="sm mut" style="margin-bottom:6px">المسار المتوقع · <span class="num">${k.path.length}</span> محطة · SLA <span class="num">${k.sla}</span> يوم عمل</div>
    <div class="row" style="gap:4px">${k.path.map((s, i) => `${i ? `<span class="mut">${icon('chevron-left')}</span>` : ''}<span class="bd n">${esc(s.short)}${s.sla != null ? ` <span class="num">${s.sla}</span>ي` : ''}</span>`).join('')}</div></div>
    <div class="sm mut">${icon('info')} الفئة النهائية بيأكدها مدير التنفيذ — دي مقترحة من الكميات.</div></div></div>`;
}

function co_step1(w, k) {
  const e = w.tried[1] ? co_v1(w) : {};
  const err = m => m ? `<div class="e">${esc(m)}</div>` : '';
  const ks = co_myContracts();
  const aos = DB.aos.filter(a => a.contractId === w.contractId);
  const c = w.aoId ? aoCtx(w.aoId) : null;
  const sites = w.aoId ? DB.aoSites.filter(s => s.aoId === w.aoId) : [];
  let billedHtml = '';
  if (c) {
    const prev = aoInvoices(w.aoId).filter(i => i.status !== 'draft' && i.id !== w.draftId);
    const billed = sum(prev, i => invTotals(i).gross), val = aoValue(w.aoId), p = pct(billed, val);
    billedHtml = `<div class="card mt"><div class="cb"><div class="row sb"><b>قيمة أمر التكليف</b><span><span class="money">${money(val)}</span> جنيه</span></div>
      <div class="prog ${p > 100 ? 'r' : p > 85 ? 'a' : ''}" style="margin:10px 0 6px"><span style="width:${Math.min(100, p)}%"></span></div>
      <div class="row sb sm mut"><span>اتفوتر قبل كده: <span class="money">${money(billed)}</span> جنيه في <span class="num">${prev.length}</span> مستخلص</span><span class="num">${p.toFixed(1)}%</span></div></div></div>`;
  }
  const kv = (l, v) => `<div><span>${l}</span><b>${c ? esc(v) : '—'}</b></div>`;
  return `<div class="grid g2">
    <div class="card"><div class="ch"><h3>العقد وأمر التكليف</h3></div><div class="cb stack">
      ${field('العقد', select('co_k', [['', ks.length ? 'اختار العقد' : 'مفيش عقود متسجلة لشركتك'], ...ks.map(x => [x.id, `${x.no} — ${x.title}`])], w.contractId, `onchange="co_setK(this.value)" aria-required="true"`) + err(e.contract), { req: true, id: 'co_k' })}
      ${field('أمر التكليف', select('co_ao', [['', w.contractId ? (aos.length ? 'اختار أمر التكليف' : 'مفيش أوامر تكليف على العقد ده') : 'اختار العقد الأول'], ...aos.map(a => [a.id, `${a.no} — ${byId('projects', a.projectId).name}`])], w.aoId, `onchange="co_setAo(this.value)" aria-required="true" ${w.contractId ? '' : 'disabled'}`) + err(e.ao), { req: true, id: 'co_ao' })}
      ${sites.length ? field('الموقع / الكابينة', select('co_site', [['', 'غير محدد (أو من ملف البنود)'], ...sites.map(s => [s.code, `${s.code} — ${s.name}`])], w.siteCode, `onchange="co_set('siteCode',this.value)"`), { id: 'co_site', hint: 'اختياري — بيتطبق على البنود اللي مالهاش كود موقع' }) : ''}
    </div></div>
    <div class="card"><div class="ch"><h3>بيانات المستخلص</h3></div><div class="cb stack">
      <div class="grid g2" style="gap:12px">
        ${field('رقم المستخلص', `<input class="in num" id="co_no" style="direction:ltr;text-align:start;display:block" value="${esc(w.no)}" placeholder="مثلاً 206" oninput="co_set('no',this.value)" aria-required="true">` + err(e.no), { req: true, id: 'co_no' })}
        ${field('نوع المستخلص', select('co_kind', CO_KINDS, w.kind, `onchange="co_set('kind',this.value)"`), { id: 'co_kind' })}
      </div>
      ${field('اسم المسار', `<input class="in" id="co_pn" value="${esc(w.pathName)}" placeholder="مثلاً: أعمال مدنية FTTH طلخا — كابينة 75" oninput="co_set('pathName',this.value)" aria-required="true">` + err(e.pathName), { req: true, id: 'co_pn' })}
      ${field('الفترة', `<input class="in" id="co_per" value="${esc(w.period)}" oninput="co_set('period',this.value)">`, { id: 'co_per', hint: 'الشهر أو المدة اللي الأعمال اتنفذت فيها' })}
    </div></div></div>
    <div class="card mt"><div class="ch"><h3>بيانات أمر التكليف</h3><span class="sub">${icon('lock')} بتتملى أوتوماتيك من أمر التكليف</span></div><div class="cb">
      <div class="kv">${kv('رئاسة القطاعات', c && c.presidency.name)}${kv('القطاع', c && c.sector.name)}${kv('الإدارة العامة', c && c.gdept.name)}${kv('الإدارة المختصة', c && c.dept.name)}${kv('السنترال', c && c.central.name)}${kv('نوع المشروع', c && c.type.name)}${kv('المشروع', c && c.project.name)}</div>
    </div></div>${billedHtml}`;
}

function co_step2(w, k) {
  const lc = k.lc, hasRows = w.rows.length > 0;
  const srcLbl = { excel: `${icon('file-spreadsheet')} ${esc(w.fileName)}`, sample: `${icon('flask-conical')} ${esc(w.fileName)}`, manual: `${icon('pencil')} إدخال يدوي`, draft: `${icon('file-pen-line')} من المسودة` }[w.src] || '';
  const upload = `<div class="card mb"><div class="ch"><h3>بنود الأعمال</h3><span class="sub">ارفع ملف Excel بالكود والكمية — أو أدخل يدوي</span><span class="sp"></span><a class="btn sm" href="templates/09_بنود_المستخلص.xlsx" download>${icon('download')} نزّل القالب</a></div>
    <div class="cb stack">
      ${dropZone('co_dz_lines', 'اسحب ملف البنود هنا أو دوس للاختيار', 'Excel بنفس شكل القالب — شيت "بنود المستخلص"', 'co_linesFiles', '.xlsx,.xls')}
      <div class="row"><button class="btn" onclick="co_manual()">${icon('keyboard')} أدخل يدوي</button><button class="btn gh" onclick="co_sample()">${icon('flask-conical')} جرّب بملف تجريبي</button><span class="sp1"></span>${hasRows ? `<button class="btn sm gh dg" onclick="co_clearRows()">${icon('trash-2')} امسح الكل</button>` : ''}</div>
      <div class="alert i">${icon('info')}<div>الوصف والوحدة وسعر الوحدة بييجوا من العقد مش من الملف — الملف محتاج بس كود البند والكمية.</div></div>
    </div></div>`;
  if (!hasRows) return upload + `<div class="card">${emptyState('table', 'لسه مفيش بنود', '<div>ارفع الملف أو استخدم الإدخال اليدوي عشان تشوف المعاينة.</div>')}</div>`;
  const ok = lc.rows.filter(r => r.level === 'ok').length;
  const sumBar = `<div class="row"><span class="bd g">${N(ok)} سليم</span>${lc.warn ? `<span class="bd a">${N(lc.warn)} تحذير</span>` : ''}${lc.err ? `<span class="bd r">${N(lc.err)} خطأ</span>` : ''}<span class="bd n">${N(lc.lines.length)} بند في المستخلص</span>${lc.err ? `<button class="btn sm dg" onclick="co_dropErrRows()">${icon('eraser')} شيل الصفوف اللي فيها أخطاء</button>` : ''}</div>`;
  const rows = lc.rows.map(r => {
    const L = r.lineIdx != null ? k.lines[r.lineIdx] : null;
    const it = r.it && !r.it.isGroup ? r.it : null;
    const qtyCell = r.manual ? `<input class="cellin" id="co_q_${r.i}" inputmode="decimal" aria-label="كمية البند ${esc(r.code)}" value="${r.qty > 0 ? esc(r.qty) : ''}" placeholder="0" onchange="co_setQty(${r.i},this.value)">` : `<span class="num">${isNaN(r.qty) ? '—' : qty(r.qty)}</span>`;
    const statusCell = r.level === 'skip' ? '<span class="sm mut">—</span>' : r.level === 'ok' ? '<span class="bd g">تمام</span>' : co_msgs(r.msgs);
    const del = r.manual ? '' : `<button class="btn sm icon gh" aria-label="شيل الصف" onclick="co_delRow(${r.i})">${icon('x')}</button>`;
    if (r.level === 'err') return `<tr class="flag"><td class="err"><b class="num">${esc(r.code)}</b></td><td class="err">${it ? esc(it.description) : r.it ? esc(r.it.description) : '—'}</td><td class="err">—</td><td class="err n">—</td><td class="err n">${qtyCell}</td><td class="err n">—</td><td class="err n">—</td><td class="err n">—</td><td class="err n">—</td><td class="err n">—</td><td class="err">${statusCell}</td><td class="err">${del}</td></tr>`;
    const dash = r.dup || r.level === 'skip';
    const pl = DB.aoItems.find(x => x.aoId === w.aoId && x.itemId === (it && it.id));
    return `<tr class="${r.level === 'warn' ? 'warn' : ''}"><td><b class="num">${esc(r.code)}</b>${r.site ? `<div class="sm mut num">${esc(r.site)}</div>` : ''}</td><td style="min-width:220px">${esc(it ? it.description : '')}</td><td>${esc(it ? it.unit : '')}</td>
      <td class="n"><span class="money">${it && it.unitPrice != null ? money(it.unitPrice) : '—'}</span></td><td class="n">${qtyCell}</td>
      <td class="n">${dash ? '—' : N(qty(L.prevQty))}</td><td class="n ${!dash && L.overQty > 0 ? 'diff-up' : ''}">${dash ? '—' : N(qty(L.cumQty))}</td><td class="n">${dash ? (pl ? N(qty(pl.plannedQty)) : '—') : (L.plannedQty ? N(qty(L.plannedQty)) : '—')}</td>
      <td class="n">${dash || !L.plannedQty ? '—' : N(pct(L.cumQty, L.plannedQty).toFixed(0) + '%')}</td><td class="n"><span class="money">${dash || L.total == null ? '—' : money(L.total)}</span></td><td>${statusCell}</td><td>${del}</td></tr>`;
  }).join('');
  const table = `<div class="card mb"><div class="ch"><h3>معاينة البنود</h3><span class="sub">${srcLbl}</span><span class="sp"></span>${sumBar}</div>
    <div class="tw"><table><thead><tr><th>رقم البند</th><th>الوصف</th><th>الوحدة</th><th class="n">سعر الوحدة (من العقد)</th><th class="n">الكمية الحالية</th><th class="n">السابق</th><th class="n">التراكمي</th><th class="n">المخطط في أمر التكليف</th><th class="n">%</th><th class="n">الإجمالي</th><th>حالة</th><th><span class="sr">حذف</span></th></tr></thead>
    <tbody>${rows}</tbody><tfoot><tr><td colspan="9">إجمالي المستخلص (قبل الضريبة)</td><td class="n"><span class="money">${money(k.tot.gross)}</span></td><td colspan="2">جنيه</td></tr></tfoot></table></div>
    ${lc.err && w.tried[2] ? `<div class="cb"><div class="fld"><div class="e">${icon('alert-circle')} صلّح الصفوف الحمرا أو شيلها عشان تكمّل</div></div></div>` : ''}${!lc.lines.length && w.tried[2] ? `<div class="cb"><div class="fld"><div class="e">لازم بند واحد على الأقل بكمية أكبر من صفر</div></div></div>` : ''}</div>`;
  return upload + table + co_catBox(k);
}

function co_step3(w, k) {
  const mc = k.mc;
  const srcLbl = { excel: `${icon('file-spreadsheet')} ${esc(w.matFile)}`, derived: `${icon('calculator')} محسوبة من البنود`, draft: `${icon('file-pen-line')} من المسودة` }[w.matSrc] || '';
  const upload = `<div class="card mb"><div class="ch"><h3>المهمات المنفذة</h3><span class="sub">المهمات من توريد المصرية اللي اتركبت في الأعمال دي</span><span class="sp"></span><a class="btn sm" href="templates/10_مهمات_المستخلص.xlsx" download>${icon('download')} نزّل القالب</a></div>
    <div class="cb stack">
      ${dropZone('co_dz_mats', 'اسحب ملف المهمات هنا أو دوس للاختيار', 'Excel بنفس شكل القالب — شيت "مهمات المستخلص"', 'co_matsFiles', '.xlsx,.xls')}
      <div class="row"><button class="btn" onclick="co_deriveMats()">${icon('calculator')} احسب من البنود</button><span class="sm mut">بيحسب الكميات من بنود الخطوة اللي فاتت حسب معاملات الكتالوج — وتقدر تعدّلها</span></div>
      <div class="alert i">${icon('scale')}<div>كل صنف بيتقارن بـ 4 أرقام: المخطط في أمر التكليف · المنصرف من المخازن · المنفذ التراكمي · المفوتر — والفرق بيظهر للمراجعين.</div></div>
    </div></div>`;
  if (!w.mats.length) return upload + `<div class="card">${emptyState('package', 'مفيش مهمات', '<div>لو الأعمال دي مفيهاش مهمات من المصرية تقدر تكمّل على طول.</div>')}</div>`;
  const rows = mc.rows.map(r => {
    const M = r.matIdx != null ? k.mats[r.matIdx] : null;
    const qin = `<input class="cellin" id="co_m_${r.i}" inputmode="decimal" aria-label="الكمية المنفذة ${esc(r.code)}" value="${isNaN(r.qty) ? '' : esc(r.qty)}" onchange="co_setMatQty(${r.i},this.value)">`;
    const del = `<button class="btn sm icon gh" aria-label="شيل الصنف" onclick="co_delMat(${r.i})">${icon('x')}</button>`;
    if (r.level === 'err') return `<tr class="flag"><td class="err"><b class="num">${esc(r.code)}</b></td><td class="err">${r.mat ? esc(r.mat.description) : '—'}</td><td class="err">—</td><td class="err n">—</td><td class="err n">—</td><td class="err n">—</td><td class="err n">${qin}</td><td class="err n">—</td><td class="err n">—</td><td class="err">${co_msgs(r.msgs)}</td><td class="err">${del}</td></tr>`;
    if (r.dup) return `<tr class="warn"><td><b class="num">${esc(r.code)}</b></td><td>${esc(r.mat.description)}</td><td>${esc(r.mat.unit)}</td><td class="n" colspan="3">—</td><td class="n">${qin}</td><td class="n" colspan="2">—</td><td>${co_msgs(r.msgs)}</td><td>${del}</td></tr>`;
    const flags = M.flags.length ? M.flags.map(f => `<span class="bd ${f.cls}">${esc(f.t)}</span>`).join(' ') : '<span class="bd g">مطابق</span>';
    return `<tr class="${M.flags.some(f => f.cls === 'r') ? 'flag' : M.flags.length ? 'warn' : ''}"><td><b class="num">${esc(r.code)}</b></td><td>${esc(M.description)}</td><td>${esc(M.unit)}</td>
      <td class="n">${N(qty(M.planned))}</td><td class="n">${N(qty(M.issued))}</td><td class="n">${N(qty(M.prevExecuted))}</td><td class="n">${qin}</td>
      <td class="n ${M.cumExecuted > M.issued ? 'diff-up' : ''}">${N(qty(M.cumExecuted))}</td><td class="n">${N(qty(M.billed))}</td><td>${flags}</td><td>${del}</td></tr>`;
  }).join('');
  return upload + `<div class="card"><div class="ch"><h3>مقارنة المهمات</h3><span class="sub">${srcLbl}</span><span class="sp"></span>${mc.err ? `<span class="bd r">${N(mc.err)} خطأ</span>` : ''}${mc.warn ? `<span class="bd a">${N(mc.warn)} تحذير</span>` : ''}</div>
    <div class="tw"><table><thead><tr><th>رقم الشطب</th><th>الصنف</th><th>الوحدة</th><th class="n">المخطط في أمر التكليف</th><th class="n">المنصرف من المخازن</th><th class="n">المنفذ السابق</th><th class="n">المنفذ الحالي</th><th class="n">المنفذ التراكمي</th><th class="n">المفوتر</th><th>ملاحظات</th><th><span class="sr">حذف</span></th></tr></thead><tbody>${rows}</tbody></table></div>
    ${mc.err && w.tried[3] ? `<div class="cb"><div class="fld"><div class="e">${icon('alert-circle')} صلّح الصفوف الحمرا أو شيلها عشان تكمّل</div></div></div>` : ''}</div>`;
}

function co_fileRow(a) {
  return `<div class="file"><span class="fi">${icon('file-check-2')}</span><div style="flex:1;min-width:0"><div class="b sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.name)}</div><div class="sm mut">${co_size(a.size || 0)}</div></div><button class="btn sm icon gh" aria-label="شيل ${esc(a.name)}" onclick="co_attachDel('${a.id}')">${icon('x')}</button></div>`;
}
function co_step4(w, k) {
  const req = co_reqDocs(w), reqIds = new Set(req.map(d => d.id));
  const missing = req.filter(d => !w.atts.some(a => a.docTypeId === d.id));
  const reqCard = `<div class="card"><div class="ch"><h3>المستندات المطلوبة</h3><span class="sub">حسب نوع المشروع</span><span class="sp"></span>${missing.length ? `<button class="btn sm gh" onclick="co_attachAllSamples()">${icon('flask-conical')} أرفق ملفات تجريبية للناقص</button>` : '<span class="bd g">كاملة</span>'}</div>
    <div class="cb stack">${req.map(d => { const fs = w.atts.filter(a => a.docTypeId === d.id); return `<div><div class="row sb" style="margin-bottom:6px"><b class="sm">${esc(d.name)} <span class="req" style="color:var(--cr6)">*</span></b>${fs.length ? '<span class="bd g">مرفق</span>' : '<span class="bd r">مطلوب</span>'}</div>
      ${fs.map(co_fileRow).join('')}
      <div class="row" style="margin-top:6px"><label class="btn sm">${icon('paperclip')} ${fs.length ? 'ملف تاني' : 'اختار ملف'}<input type="file" hidden multiple onchange="co_attach('${d.id}',this.files)"></label><button class="btn sm gh" onclick="co_attachSample('${d.id}')">${icon('flask-conical')} أرفق ملف تجريبي</button></div></div>`; }).join('<hr class="sep">') || emptyState('file-check-2', 'مفيش مستندات إلزامية')}</div></div>`;
  const extra = w.atts.filter(a => !reqIds.has(a.docTypeId));
  const extraCard = `<div class="card"><div class="ch"><h3>مرفقات إضافية</h3><span class="sub">اختياري</span></div><div class="cb stack">
    ${field('نوع المستند', select('co_xdt', DB.docTypes.map(d => [d.id, d.name]), w.xdt, `onchange="co_set('xdt',this.value)"`), { id: 'co_xdt' })}
    <div class="row"><label class="btn">${icon('paperclip')} اختار ملف<input type="file" hidden multiple onchange="co_attach(co_w().xdt,this.files)"></label><button class="btn gh" onclick="co_attachSample(co_w().xdt)">${icon('flask-conical')} ملف تجريبي</button></div>
    ${extra.length ? extra.map(a => `<div><div class="sm mut">${esc((byId('docTypes', a.docTypeId) || {}).name || '')}</div>${co_fileRow(a)}</div>`).join('') : '<div class="sm mut">مفيش مرفقات إضافية</div>'}</div></div>`;

  const c = aoCtx(w.aoId), t = k.tot, b = co_blockers(w, k);
  const review = `<div class="card mt"><div class="ch"><h3>مراجعة قبل التقديم</h3></div><div class="cb stack">
    <div class="kv"><div><span>رقم المستخلص</span><b class="num">${esc(w.no)}</b></div><div><span>اسم المسار</span><b>${esc(w.pathName)}</b></div><div><span>النوع</span><b>${esc(w.kind)}</b></div><div><span>الفترة</span><b>${esc(w.period || '—')}</b></div>
      <div><span>العقد</span><b class="num">${esc(c.contract.no)}</b></div><div><span>أمر التكليف</span><b class="num">${esc(c.ao.no)}</b></div><div><span>المشروع</span><b>${esc(c.project.name)}</b></div><div><span>السنترال</span><b>${esc(c.central.name)}</b></div>
      <div><span>البنود</span><b>${N(k.lc.lines.length)} بند</b></div><div><span>المهمات</span><b>${N(k.mc.mats.length)} صنف</b></div><div><span>المرفقات</span><b>${N(w.atts.length)} ملف</b></div></div>
    <div class="grid g2">
      <div><div class="sumrow"><span>إجمالي الأعمال</span><span><span class="money">${money2(t.gross)}</span></span></div>
        <div class="sumrow"><span>ضريبة القيمة المضافة <span class="num">${t.vatPct}%</span></span><span><span class="money">${money2(t.vat)}</span></span></div>
        ${t.deductions.map(d => `<div class="sumrow neg"><span>${esc(d.name)}${d.pct != null ? ` <span class="num">${d.pct}%</span>` : ''}</span><span><span class="money">- ${money2(d.amount)}</span></span></div>`).join('')}
        <div class="sumrow tot"><span>الصافي المتوقع</span><span><span class="money">${money2(t.net)}</span> جنيه</span></div>
        <div class="words mt">${esc(t.words)}</div>
        <div class="sm mut" style="margin-top:6px">الاستقطاعات قيم مبدئية من العقد — المالية بتأكدها وقت الصرف.</div></div>
      ${co_catBox(k)}</div>
    ${b.length ? `<div class="alert r">${icon('alert-octagon')}<div><b>مش هينفع تقدّم قبل ما تكمّل دول:</b><ul style="margin:4px 0 0;padding-inline-start:18px">${b.map(x => `<li><a style="cursor:pointer" onclick="co_goStep(${x.step})">${esc(x.t)}</a>${x.step < 4 ? ` <span class="sm">(خطوة ${x.step})</span>` : ''}</li>`).join('')}</ul></div></div>`
      : `<div class="alert g">${icon('check-circle-2')}<div>كله جاهز. أول ما تقدّم، المستخلص هيروح لـ <b>${esc(k.path[0].name)}</b> وهيوصلهم إيميل.</div></div>`}
  </div></div>`;
  return `<div class="grid g2">${reqCard}${extraCard}</div>${review}`;
}

function co_success(inv) {
  const c = ctx(inv), hs = stepHolders(inv, inv.step), t = invTotals(inv);
  return pageHeader({ title: 'المستخلص اتقدّم', crumbs: [['الرئيسية', 'home'], ['مستخلص جديد']] }) + `<div class="card st-g"><div class="cb" style="text-align:center;padding:32px 18px">
    <div class="empty" style="padding:0 0 8px"><div class="ic" style="background:var(--ok1);color:var(--ok7)">${icon('check-circle-2')}</div></div>
    <h2 style="margin:0 0 4px">مستخلص رقم <span class="num">${esc(inv.no)}</span> وصل لـ ${esc(stepName(inv.step))}</h2>
    <p class="mut" style="margin:0 0 14px">${esc(inv.pathName)} · ${esc(c.ao.no)} · الإجمالي <span class="money">${money(t.gross)}</span> جنيه</p>
    <div class="row" style="justify-content:center;margin-bottom:16px">${catBadge(inv)}<span class="bd n">${esc(DB.categories[inv.suggestedCat].name)}</span></div>
    ${hs.length ? `<div class="sm mut" style="margin-bottom:6px">اتبعت إشعار وإيميل لـ</div><div class="row" style="justify-content:center;margin-bottom:18px">${hs.map(u => `<span class="bd p">${icon('user')} ${esc(u.name)}</span>`).join('')}</div>` : ''}
    <div style="max-width:720px;margin:0 auto 18px">${co_pathMini(inv)}</div>
    <div class="row" style="justify-content:center"><button class="btn pr" onclick="openInv('${inv.id}')">${icon('eye')} تابع المستخلص</button><button class="btn" onclick="co_reset()">${icon('file-plus-2')} مستخلص جديد</button><button class="btn gh" onclick="go('home')">الرئيسية</button></div>
  </div></div>`;
}

View.register('inv-new', {
  title: 'مستخلص جديد',
  render(p) {
    const g = co_guard(); if (g) return g;
    const st = co_st();
    // شاشة النجاح تفضل ظاهرة لحد ما المستخدم يتنقل (go بيعمل params جديدة)
    if (st.wiz && st.wiz.done && st.wiz.doneParams !== p) st.wiz = null;
    if (p && p.draft && (!st.wiz || st.wiz.draftId !== p.draft)) co_loadDraft(p.draft);
    if (!st.wiz) st.wiz = co_newWiz();
    const w = st.wiz;
    if (w.done) { const inv = invById(w.done); if (inv) return co_success(inv); }
    if (!co_myContracts().length) return pageHeader({ title: 'مستخلص جديد' }) + `<div class="card">${emptyState('file-x', 'مفيش عقود متسجلة لشركتك', '<div>كلّم الشئون الفنية عشان يرفعوا العقد وأوامر التكليف.</div>')}</div>`;
    const k = co_calc(w);
    const steps = `<div class="wsteps" role="list" aria-label="خطوات المستخلص">${CO_STEPS.map((l, i) => { const n = i + 1, cls = n < w.step ? 'done' : n === w.step ? 'cur' : ''; return `<div class="ws ${cls}" role="listitem" ${n < w.step ? `style="cursor:pointer" tabindex="0" onclick="co_goStep(${n})" onkeydown="if(event.key==='Enter')co_goStep(${n})"` : ''} ${n === w.step ? 'aria-current="step"' : ''}><span class="n">${n < w.step ? icon('check') : n}</span><span class="lbl">${l}</span></div>`; }).join('')}</div>`;
    const body = w.step === 1 ? co_step1(w, k) : w.step === 2 ? co_step2(w, k) : w.step === 3 ? co_step3(w, k) : co_step4(w, k);
    const saved = w.savedAt ? `${icon('cloud')} اتحفظت مسودة الساعة <span class="num">${String(new Date(w.savedAt).getHours()).padStart(2, '0')}:${String(new Date(w.savedAt).getMinutes()).padStart(2, '0')}</span>` : `${icon('cloud')} المسودة بتتحفظ تلقائي`;
    const info = `<span class="sm mut">${saved}</span>${k.temp && k.lc.lines.length ? `<span>الإجمالي <span class="money">${money(k.tot.gross)}</span> جنيه</span>${catBadge({ suggestedCat: k.sug.cat })}` : ''}`;
    const actbar = `<div class="actbar"><div class="info">${info}</div>
      ${w.step > 1 ? `<button class="btn" onclick="co_back()">${icon('arrow-right')} رجوع</button>` : ''}
      <button class="btn gh" onclick="co_saveDraft()">${icon('save')} حفظ كمسودة</button>
      ${w.step < 4 ? `<button class="btn pr" onclick="co_next()">التالي ${icon('arrow-left')}</button>` : `<button class="btn pr" onclick="co_submit()" ${co_blockers(w, k).length ? 'aria-disabled="true"' : ''}>${icon('send')} تقديم المستخلص</button>`}</div>`;
    const sub = w.draftId ? `بتكمّل مسودة مستخلص رقم <span class="num">${esc(w.no)}</span>` : 'قدّم مستخلصك في 4 خطوات — الأسعار من العقد والمسار بيتحدد أوتوماتيك';
    return pageHeader({ title: 'مستخلص جديد', sub, crumbs: [['الرئيسية', 'home'], ['مستخلص جديد']], actions: `<button class="btn gh sm" onclick="co_reset()">${icon('rotate-ccw')} ابدأ من جديد</button>` }) + steps + body + actbar;
  },
});
