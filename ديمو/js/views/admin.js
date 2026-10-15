/* ============================================================
   views/admin.js — البيانات الأساسية والإعدادات
   الشاشات: org (الهيكل والمشاريع) · contracts (العقود وأوامر التكليف)
            issues (المهمات المنصرفة) · users (المستخدمين والصلاحيات)
            workflow (المسار والـ SLA)
   + مكوّن رفع Excel موحّد adm_uploader: قالب ← معاينة بحالة كل صف ← تأكيد الحفظ
   كل الدوال global بـ prefix adm_ — والحالة في S.ui.adm
   ============================================================ */

/* ───────────────────────── helpers ───────────────────────── */
const adm_q = v => esc(JSON.stringify(v));          // آمن جوه onclick="..."
const ADM_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADM_UPLOG = [];                               // سجل الرفع (بيفضل موجود لو غيّرت المستخدم)
const ADM_DAYS = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
DB.holidayNames = DB.holidayNames || { '2026-01-07': 'عيد الميلاد المجيد', '2026-01-25': 'عيد الشرطة وثورة يناير', '2026-04-12': 'عيد القيامة', '2026-04-13': 'شم النسيم', '2026-04-25': 'عيد تحرير سيناء', '2026-05-01': 'عيد العمال', '2026-05-26': 'وقفة عرفات', '2026-05-27': 'عيد الأضحى', '2026-05-28': 'عيد الأضحى', '2026-06-16': 'رأس السنة الهجرية', '2026-06-30': 'ثورة 30 يونيو', '2026-07-23': 'ثورة 23 يوليو', '2026-08-25': 'المولد النبوي', '2026-10-06': 'عيد القوات المسلحة' };

function adm_st() {
  if (!S.ui.adm) S.ui.adm = {
    orgTab: 'tree', open: Object.fromEntries(DB.presidencies.map(p => ['presidencies:' + p.id, 1])), sel: null, q: '', pq: '', ptype: '',
    contract: null, ctab: 'boq', cq: '', cco: '', bq: '',
    itab: 'sum', fk: '', fao: '', fmat: '',
    utab: 'list', uq: '', urole: '', preview: '', uform: null,
    wtab: 'path', wf: null,
    uploads: ADM_UPLOG, up: {}, cur: null,
  };
  return S.ui.adm;
}
function adm_set(k, v) { adm_st()[k] = v; render(); }
/** بحث بيحدّث الشاشة من غير ما يضيع الـ focus */
function adm_type(k, el) {
  const id = el.id, pos = el.selectionStart; adm_st()[k] = el.value; render();
  const e = document.getElementById(id); if (e) { e.focus(); try { e.setSelectionRange(pos, pos); } catch (x) {} }
}
const adm_code = v => String(v ?? '').trim();
const adm_itemNo = v => adm_code(v).replace(/\s+/g, '').replace(/\./g, '-');
function adm_num(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[,\s]/g, '');
  if (!s) return null;
  const n = Number(s); return isNaN(n) ? NaN : n;
}
/** تاريخ من Excel (serial أو نص) ← 'yyyy-mm-dd'، فاضي ← null، غلط ← false */
function adm_date(v) {
  if (v === '' || v == null) return null;
  const p2 = x => String(x).padStart(2, '0');
  if (v instanceof Date) return isNaN(v) ? false : iso(v);
  if (typeof v === 'number') { if (v < 20000 || v > 80000) return false; const d = new Date(Math.round((v - 25569) * DAY)); return d.toISOString().slice(0, 10); }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/))) { if (+m[2] > 12 || +m[1] > 31) return false; return `${m[3]}-${p2(m[2])}-${p2(m[1])}`; }
  return false;
}
/** ترتيب أرقام البنود بالتدرج 1 < 1-1 < 1-1-1-1 < 1-4-2 < 2 */
function adm_cmpNo(a, b) {
  const x = String(a).split('-'), y = String(b).split('-');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] == null) return -1; if (y[i] == null) return 1;
    const d = (parseFloat(x[i]) || 0) - (parseFloat(y[i]) || 0); if (d) return d;
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}
function adm_audit(action, entity, details) { DB.audit.unshift({ date: new Date(), userId: S.user && S.user.id, action, entity, details }); }
const adm_denied = (title, sub = '') => pageHeader({ title }) + `<div class="card">${emptyState('lock', 'الصفحة دي مش ضمن صلاحياتك', `<div>${sub || 'لو محتاجها كلّم مدير النظام يضيفلك الصلاحية.'}</div>`)}</div>`;
const adm_nav = key => { const it = NAV.flatMap(s => s.items).find(i => i.key === key); return !!it && navAllowed(it); };
const adm_aoIn = (aoId, u = S.user) => { try { return inScope(u, { aoId }); } catch (e) { return false; } };
const adm_tabs = (cur, list, fn) => `<div class="tabs" role="tablist">${list.map(([k, l, n, ic]) => `<button role="tab" aria-selected="${cur === k}" class="${cur === k ? 'on' : ''}" onclick="${fn}(${adm_q(k)})">${ic ? icon(ic) : ''}${l}${n != null ? ` <span class="n num">${n}</span>` : ''}</button>`).join('')}</div>`;
const adm_prog = (p, label = true) => `<div class="row" style="flex-wrap:nowrap;gap:8px"><div class="prog ${p > 100 ? 'r' : p >= 90 ? 'a' : ''}" style="flex:1;min-width:56px" role="progressbar" aria-valuenow="${Math.round(p)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.min(100, Math.max(0, p))}%"></span></div>${label ? `<span class="sm num">${p.toFixed(0)}%</span>` : ''}</div>`;
const adm_btnEdit = (fn, label = 'تعديل') => `<button class="btn sm icon gh" onclick="event.stopPropagation();${fn}" aria-label="${label}" title="${label}">${icon('pencil')}</button>`;
const adm_btnDel = (fn, label = 'مسح') => `<button class="btn sm icon gh" onclick="event.stopPropagation();${fn}" aria-label="${label}" title="${label}">${icon('trash-2')}</button>`;
const adm_val = id => { const e = document.getElementById(id); return e ? e.value : ''; };
const adm_chk = id => { const e = document.getElementById(id); return !!(e && e.checked); };

/* ───────────────────────── الهيكل: المستويات ───────────────────────── */
const ADM_LV = {
  presidencies: { one: 'رئاسة قطاعات', many: 'رئاسات القطاعات', icon: 'landmark', parent: null, fk: null, sheet: 'رئاسات القطاعات', pcol: null, kids: ['sectors'] },
  sectors: { one: 'قطاع', many: 'القطاعات', icon: 'building-2', parent: 'presidencies', fk: 'presidencyId', sheet: 'القطاعات', pcol: 'presidency_code', kids: ['techUnits', 'gdepts'] },
  techUnits: { one: 'شئون فنية', many: 'الشئون الفنية', icon: 'wrench', parent: 'sectors', fk: 'sectorId', sheet: 'الشئون الفنية', pcol: 'sector_code', kids: [] },
  gdepts: { one: 'إدارة عامة', many: 'الإدارات العامة', icon: 'building', parent: 'sectors', fk: 'sectorId', sheet: 'الإدارات العامة', pcol: 'sector_code', kids: ['depts'] },
  depts: { one: 'إدارة مختصة', many: 'الإدارات المختصة', icon: 'briefcase', parent: 'gdepts', fk: 'gdeptId', sheet: 'الإدارات المختصة', pcol: 'gdept_code', kids: ['centrals'] },
  centrals: { one: 'سنترال', many: 'السنترالات', icon: 'radio-tower', parent: 'depts', fk: 'deptId', sheet: 'السنترالات', pcol: 'dept_code', kids: ['projects'] },
  projects: { one: 'مشروع', many: 'المشروعات', icon: 'folder-kanban', parent: 'centrals', fk: 'centralId', kids: [] },
};
const ADM_ORDER = ['presidencies', 'sectors', 'gdepts', 'techUnits', 'depts', 'centrals']; // ترتيب شيتات قالب 01
const ADM_SCOPE_OF = { presidencies: 'presidency', sectors: 'sector', gdepts: 'gdept', depts: 'dept', centrals: 'central', techUnits: 'techUnit', companies: 'company' };
const ADM_SCOPE_T = { all: 'كل الجهات', company: 'شركة', presidency: 'رئاسة قطاعات', sector: 'قطاع', gdept: 'إدارة عامة', dept: 'إدارة مختصة', central: 'سنترال' };
const ADM_SCOPE_TBL = { company: 'companies', presidency: 'presidencies', sector: 'sectors', gdept: 'gdepts', dept: 'depts', central: 'centrals' };
const ADM_SCOPE_AR = {
  all: 'بيشوف كل المستخلصات في كل الجهات.',
  company: 'بيشوف مستخلصات شركته بس — ومسوداتها كمان.',
  presidency: 'كل القطاعات والإدارات والسنترالات اللي تحت رئاسة القطاعات بتاعته.',
  sector: 'كل الإدارات العامة والمختصة والسنترالات اللي في قطاعه.',
  gdept: 'الإدارات المختصة والسنترالات اللي تحت إدارته العامة.',
  dept: 'السنترالات والمشروعات اللي في إدارته المختصة بس.',
  central: 'مشروعات سنترال واحد بس.',
};

const adm_kids = (t, id) => ((ADM_LV[t] || {}).kids || []).flatMap(k => DB[k].filter(x => x[ADM_LV[k].fk] === id).map(n => ({ t: k, n })));
function adm_path(t, id) {
  const out = []; let n = byId(t, id);
  while (n) { out.unshift({ t, n }); const L = ADM_LV[t]; if (!L || !L.parent) break; const pid = n[L.fk]; t = L.parent; n = byId(t, pid); }
  return out;
}
const adm_pathTxt = (t, id) => adm_path(t, id).map(x => esc(x.n.name)).join(` ${icon('chevron-left')} `);
/** عدد المستخلصات (غير المسودات) على كل عقدة — key = "table:id" */
function adm_invCount() {
  const m = {};
  DB.invoices.forEach(i => {
    if (i.status === 'draft') return;
    let c; try { c = ctx(i); } catch (e) { return; } if (!c) return;
    [['presidencies', c.presidency], ['sectors', c.sector], ['gdepts', c.gdept], ['depts', c.dept], ['centrals', c.central], ['projects', c.project], ['projectTypes', c.type], ['companies', c.company], ['contracts', c.contract], ['aos', c.ao]]
      .forEach(([t, x]) => { if (x) { const k = t + ':' + x.id; m[k] = (m[k] || 0) + 1; } });
  });
  return m;
}
const adm_scopeUsers = (t, id) => DB.users.filter(u => u.scope.type === ADM_SCOPE_OF[t] && u.scope.id === id);
const adm_orgEdit = () => ['admin', 'pmo'].includes(S.user.role);

/* ── تعريف كل كيان للفورم العام (إضافة/تعديل) ── */
const adm_parentOpts = t => DB[t].map(x => { const L = ADM_LV[t], p = L && L.parent ? byId(L.parent, x[L.fk]) : null; return [x.id, x.name + (p ? ' — ' + p.name : '')]; });
const ADM_ENT = {
  presidencies: { one: 'رئاسة قطاعات', fields: [] },
  sectors: { one: 'قطاع', fields: [{ k: 'presidencyId', l: 'رئاسة القطاعات', type: 'sel', req: 1, opts: () => adm_parentOpts('presidencies') }] },
  techUnits: { one: 'شئون فنية', fields: [{ k: 'sectorId', l: 'القطاع', type: 'sel', req: 1, opts: () => adm_parentOpts('sectors') }] },
  gdepts: { one: 'إدارة عامة', fields: [{ k: 'sectorId', l: 'القطاع', type: 'sel', req: 1, opts: () => adm_parentOpts('sectors') }, { k: 'gmEmail', l: 'إيميل المدير العام', type: 'email', hint: 'اختياري — بيتربط بالمستخدم' }] },
  depts: { one: 'إدارة مختصة', fields: [{ k: 'gdeptId', l: 'الإدارة العامة', type: 'sel', req: 1, opts: () => adm_parentOpts('gdepts') }] },
  centrals: { one: 'سنترال', fields: [{ k: 'deptId', l: 'الإدارة المختصة', type: 'sel', req: 1, opts: () => adm_parentOpts('depts') }] },
  projects: { one: 'مشروع', fields: [{ k: 'typeId', l: 'نوع المشروع', type: 'sel', req: 1, opts: () => DB.projectTypes.map(t => [t.id, t.name]) }, { k: 'centralId', l: 'السنترال', type: 'sel', req: 1, opts: () => adm_parentOpts('centrals'), hint: 'من السنترال المستخلص بيعرف إدارته وقطاعه ورئاسته' }, { k: 'start', l: 'تاريخ البدء', type: 'date' }, { k: 'notes', l: 'ملاحظات' }] },
  projectTypes: { one: 'نوع مشروع', fields: [] },
  companies: { one: 'شركة', fields: [{ k: 'fullName', l: 'الاسم الكامل', req: 1 }, { k: 'email', l: 'إيميل المستخلصات', type: 'email', req: 1, hint: 'ده اللي بيوصله إشعار الصرف وجاهزية الشيك' }, { k: 'phone', l: 'التليفون' }, { k: 'commercialReg', l: 'السجل التجاري' }, { k: 'taxNo', l: 'البطاقة الضريبية' }, { k: 'address', l: 'العنوان' }] },
};
/** فورم إضافة/تعديل لأي كيان: الكود بيظهر ومش بيتغير بعد الحفظ */
function adm_form(t, id = null, preset = {}) {
  const E = ADM_ENT[t], x = id ? byId(t, id) : null, v = k => x ? (x[k] ?? '') : (preset[k] ?? '');
  const ctl = f => {
    const fid = 'adm-f-' + f.k;
    if (f.type === 'sel') return select(fid, [['', '— اختار —'], ...f.opts()], v(f.k), `aria-label="${esc(f.l)}"`);
    return `<input class="in" id="${fid}" type="${f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : 'text'}" value="${esc(v(f.k))}" ${f.type === 'email' ? 'dir="ltr"' : ''}>`;
  };
  const body = `<div class="grid g2">
    ${field('الكود', `<input class="in" id="adm-f-code" dir="ltr" value="${esc(x ? x.id : (preset.code || ''))}" ${x ? 'readonly' : ''} placeholder="مثلاً C-RABAA">`, { req: true, id: 'adm-f-code', hint: x ? 'الكود ثابت ومش بيتغير — الاسم بس اللي بيتعدل' : 'كود قصير فريد — هو اللي القوالب بتشاور عليه' })}
    ${field(t === 'companies' ? 'الاسم المختصر' : 'الاسم', `<input class="in" id="adm-f-name" value="${esc(x ? x.name : '')}">`, { req: true, id: 'adm-f-name' })}
  </div>${E.fields.length ? `<div class="grid g2">${E.fields.map(f => field(f.l, ctl(f), { req: !!f.req, hint: f.hint || '', id: 'adm-f-' + f.k })).join('')}</div>` : ''}`;
  modal(`${x ? 'تعديل' : 'إضافة'} ${E.one}`, body, `<button class="btn pr" onclick="adm_formSave(${adm_q(t)},${adm_q(id)})">${icon('save')} حفظ</button><button class="btn" onclick="closeModal()">إلغاء</button>`);
}
function adm_formSave(t, id) {
  const E = ADM_ENT[t], code = adm_code(adm_val('adm-f-code')), name = adm_code(adm_val('adm-f-name'));
  if (!code || !name) return toast('الكود والاسم إلزاميين', 'err');
  if (!id && byId(t, code)) return toast(`الكود ${code} موجود قبل كده`, 'err');
  const vals = {};
  for (const f of E.fields) {
    const val = adm_code(adm_val('adm-f-' + f.k));
    if (f.req && !val) return toast(`${f.l} إلزامي`, 'err');
    if (f.type === 'email' && val && !ADM_EMAIL.test(val)) return toast('الإيميل شكله غلط', 'err');
    vals[f.k] = val;
  }
  let x = id ? byId(t, id) : null;
  if (!x) { x = { id: code }; DB[t].push(x); if (t === 'projectTypes') DB.requiredDocs[code] = DB.requiredDocs[code] || ['dt1', 'dt2']; }
  Object.assign(x, { name }, vals);
  adm_audit(id ? 'update' : 'create', t + ':' + x.id, name);
  closeModal(); toast(id ? 'اتحفظ التعديل' : `اتضاف ${E.one}: ${name}`, 'ok');
}
/** اللي متعلّق بالكيان — لو فيه حاجة مينفعش يتمسح */
function adm_deps(t, id) {
  const out = [], add = (n, l) => { if (n) out.push(`${n} ${l}`); };
  if (ADM_LV[t]) ADM_LV[t].kids.forEach(k => add(DB[k].filter(x => x[ADM_LV[k].fk] === id).length, ADM_LV[k].many));
  if (t === 'projects') add(DB.aos.filter(a => a.projectId === id).length, 'أوامر تكليف');
  if (t === 'projectTypes') add(DB.projects.filter(p => p.typeId === id).length, 'مشروعات');
  if (t === 'companies') add(DB.contracts.filter(k => k.companyId === id).length, 'عقود');
  if (ADM_SCOPE_OF[t]) add(adm_scopeUsers(t, id).length, 'مستخدمين نطاقهم عليه');
  add(adm_invCount()[t + ':' + id] || 0, 'مستخلصات');
  return out;
}
function adm_del(t, id) {
  const x = byId(t, id); if (!x) return;
  const deps = adm_deps(t, id), one = (ADM_ENT[t] || {}).one || '';
  if (deps.length) return modal('مينفعش تمسح لو تحتها بيانات', `<div class="alert r">${icon('alert-octagon')}<div><b>${esc(x.name)}</b> مربوط بيه:<ul style="margin:6px 0 0;padding-inline-start:18px">${deps.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div></div><p class="mut sm" style="margin:0">انقل أو امسح اللي تحته الأول، أو عدّل الاسم بدل المسح.</p>`, `<button class="btn" onclick="closeModal()">تمام</button>`);
  confirmBox(`مسح ${one}`, `متأكد إنك عايز تمسح <b>${esc(x.name)}</b>؟ مفيش حاجة مربوطة بيه.`, 'امسح', () => {
    DB[t].splice(DB[t].indexOf(x), 1);
    if (t === 'projectTypes') delete DB.requiredDocs[id];
    const st = adm_st(); if (st.sel && st.sel.id === id) st.sel = null;
    adm_audit('delete', t + ':' + id, x.name); toast('اتمسح', 'ok'); render();
  }, 'dg');
}

/* ───────────────────────── مكوّن الرفع الموحّد ───────────────────────── */
const ADM_UP = {};
/** adm_uploader({id, title, templateFile, sheet, columns, validateRow, onCommit, sample, perm})
    أو متعدد الشيتات: sheets: [{sheet, columns:[[key,label,'d'?]], validateRow, kv?, fields?}] بالترتيب أب ← ابن.
    validateRow(row, env) ← adm_r() فيه st ('new'|'upd') + errs[] + warns[] */
function adm_uploader(cfg) {
  const sheets = (cfg.sheets || [{ sheet: cfg.sheet, columns: cfg.columns, validateRow: cfg.validateRow }]).map(s => ({ ...s, columns: s.columns || [] }));
  ADM_UP[cfg.id] = { ...cfg, sheets };
  return cfg.id;
}
function adm_r() { return { st: 'new', errs: [], warns: [], data: {}, err(m) { this.errs.push(m); return this; }, warn(m) { this.warns.push(m); return this; } }; }
const adm_rs = x => x.res.errs.length ? 'err' : x.res.st;
const adm_rows = arr => arr.map((r, i) => ({ ...r, __row: i + 3 }));
function adm_upSt(id) { const st = adm_st(); return st.up[id] = st.up[id] || {}; }
const adm_upAllowed = id => { const c = ADM_UP[id]; return !!c && (!c.perm || c.perm()); };
const adm_upBtn = (id, label, preset = {}, cls = '') => adm_upAllowed(id) ? `<button class="btn ${cls}" onclick="adm_openUp(${adm_q(id)},${adm_q(preset)})">${icon('upload')} ${label}</button>` : '';
/** فتح نافذة الرفع من جديد */
function adm_openUp(id, preset = {}) {
  if (!adm_upAllowed(id)) return toast('الرفع ده مش ضمن صلاحياتك', 'err');
  adm_st().up[id] = { preset }; adm_st().cur = id; adm_upShow(id);
}
/** تحويل الـ workbook لصفوف لكل شيت (بالاسم، ولو مش موجود أول شيت) */
function adm_parseWorkbook(wb, cfg) {
  const out = {}, notes = [];
  const meta = wb.Sheets._meta, mid = meta && meta.B1 ? String(meta.B1.v) : '';
  if (mid && mid !== cfg.templateFile) notes.push({ cls: 'r', t: `الملف ده قالب "${mid}" مش "${cfg.templateFile}" — اتأكد إنك رافع القالب الصح` });
  cfg.sheets.forEach((sd, i) => {
    let ws = wb.Sheets[sd.sheet];
    if (!ws && i === 0) { const first = wb.SheetNames.find(n => !['تعليمات', '_meta'].includes(n)); if (first && !cfg.sheets.some(s => s.sheet === first)) { ws = wb.Sheets[first]; notes.push({ cls: 'a', t: `مفيش شيت باسم "${sd.sheet}" — قريت أول شيت "${first}"` }); } }
    if (!ws) { out[sd.sheet] = []; notes.push({ cls: 'a', t: `شيت "${sd.sheet}" مش موجود في الملف` }); return; }
    if (sd.kv) { // البيان | القيمة | (المفتاح) — من الصف التاني
      const obj = { __row: 2 };
      XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }).slice(1).forEach(r => { const k = adm_code(r[2]); if (k) obj[k] = r[1]; });
      out[sd.sheet] = [obj]; return;
    }
    const raw = XLSX.utils.sheet_to_json(ws, { range: 1, defval: '' });
    const rows = raw.map(r => { const o = { __row: (r.__rowNum__ ?? 0) + 1 }; Object.keys(r).forEach(k => { o[adm_code(k)] = r[k]; }); return o; });
    const first = sd.columns[0] && sd.columns[0][0];
    if (rows.length && first && !(first in rows[0])) notes.push({ cls: 'r', t: `شيت "${sd.sheet}": الصف التاني مفيهوش أسماء الأعمدة التقنية (${first}…) — نزّل القالب الجديد` });
    out[sd.sheet] = rows.filter(r => { const v = adm_code(first ? r[first] : Object.values(r)[1]); return v && !v.startsWith('مثال'); });
  });
  return { parsed: out, notes };
}
/** بيشغّل الـ validation على كل الشيتات بالترتيب (env مشترك عشان الأكواد الجديدة في نفس الملف) */
function adm_upValidate(id) {
  const cfg = ADM_UP[id], st = adm_upSt(id), env = { seen: {}, ok: {}, preset: st.preset || {} };
  st.results = {};
  cfg.sheets.forEach(sd => {
    env.seen[sd.sheet] = {};
    st.results[sd.sheet] = (st.parsed[sd.sheet] || []).map(row => {
      let res; try { res = sd.validateRow(row, env); } catch (e) { res = adm_r().err('خطأ غير متوقع: ' + e.message); }
      return { row, res };
    });
  });
  if (cfg.finalize) cfg.finalize(env, st.results);
  st.env = env;
  if (!st.tab || !cfg.sheets.some(s => s.sheet === st.tab)) st.tab = (cfg.sheets.find(s => (st.results[s.sheet] || []).some(x => adm_rs(x) === 'err')) || cfg.sheets.find(s => (st.results[s.sheet] || []).length) || cfg.sheets[0]).sheet;
}
/** ingest: workbook جاهز (من FileReader أو من الاختبار) */
function adm_upIngest(id, wb, fileName) {
  const st = adm_upSt(id), r = adm_parseWorkbook(wb, ADM_UP[id]);
  st.parsed = r.parsed; st.notes = r.notes; st.fileName = fileName; st.tab = null;
  adm_upValidate(id);
}
function adm_upFiles(files) {
  const id = adm_st().cur, f = files && files[0]; if (!id || !f) return;
  if (!window.XLSX) return toast('مكتبة Excel مش متحملة — محتاج إنترنت', 'err');
  const fr = new FileReader();
  fr.onload = e => { try { adm_upIngest(id, XLSX.read(e.target.result, { type: 'array' }), f.name); adm_upShow(id); } catch (err) { toast('الملف ده مش Excel سليم: ' + err.message, 'err'); } };
  fr.onerror = () => toast('مقدرتش أقرا الملف', 'err');
  fr.readAsArrayBuffer(f);
}
function adm_upSample(id) {
  const cfg = ADM_UP[id], st = adm_upSt(id);
  st.parsed = cfg.sample(st.preset || {}); st.notes = [{ cls: 'i', t: 'دي بيانات تجريبية فيها صفوف سليمة وصفوف فيها أخطاء عشان تشوف المعاينة — مفيش حاجة بتتحفظ قبل ما توافق' }];
  st.fileName = 'بيانات تجريبية'; st.tab = null; adm_upValidate(id); adm_upShow(id);
}
function adm_upReset(id) { const st = adm_upSt(id); adm_st().up[id] = { preset: st.preset }; adm_upShow(id); }
function adm_upTab(sheet) { const id = adm_st().cur; adm_upSt(id).tab = sheet; adm_upShow(id); }
function adm_upCounts(id) {
  const cfg = ADM_UP[id], st = adm_upSt(id), c = { new: 0, upd: 0, warn: 0, err: 0, blocked: false };
  if (!st.results) return c;
  cfg.sheets.forEach(sd => (st.results[sd.sheet] || []).forEach(x => { const k = adm_rs(x); c[k]++; if (k !== 'err' && x.res.warns.length) c.warn++; if (k === 'err' && sd.kv) c.blocked = true; }));
  return c;
}
const adm_stBadge = x => { const k = adm_rs(x); if (k === 'err') return `<span class="b">✗ خطأ</span>`; const w = x.res.warns.length; return `<span class="bd ${w ? 'a' : k === 'upd' ? 'b' : 'g'}">${w ? '⚠' : '✓'} ${k === 'upd' ? 'تحديث' : 'جديد'}</span>`; };
const adm_cell = (v, kind) => { if (kind === 'd') { const d = adm_date(v); return d ? fmtD(d) : esc(v); } return typeof v === 'number' ? `<span class="num">${qty(v)}</span>` : esc(v); };
function adm_upShow(id) {
  const cfg = ADM_UP[id], st = adm_upSt(id), c = adm_upCounts(id), tplHref = `templates/${cfg.templateFile}.xlsx`;
  let body = `<div class="row sb" style="align-items:flex-start"><div class="sm mut" style="flex:1;min-width:220px">${cfg.hint || 'نزّل القالب، املاه من غير ما تغيّر أسماء الشيتات ولا الصف التاني، وارفعه هنا.'}<div class="row" style="margin-top:6px;gap:4px">${cfg.sheets.map(s => `<span class="bd n">${icon('sheet')} ${esc(s.sheet)}</span>`).join('')}</div></div>
    <div class="row"><a class="btn sm" href="${esc(tplHref)}" download aria-label="تنزيل قالب ${esc(cfg.templateFile)}">${icon('download')} تنزيل القالب</a><button class="btn sm" onclick="adm_upSample(${adm_q(id)})">${icon('flask-conical')} جرّب ببيانات تجريبية</button></div></div>`;
  if (!st.results) {
    body += dropZone('adm-dz', 'اسحب ملف Excel هنا أو دوس واختار', `${esc(cfg.templateFile)}.xlsx — الصفوف الرمادي أمثلة، امسحها قبل الرفع`, 'adm_upFiles', '.xlsx,.xls');
  } else {
    body += `<div class="file"><span class="fi">${icon('file-spreadsheet')}</span><div style="flex:1;min-width:0"><b>${esc(st.fileName)}</b><div class="sm mut">${N(sum(cfg.sheets, s => (st.results[s.sheet] || []).length))} صف اتقرا</div></div><button class="btn sm gh" onclick="adm_upReset(${adm_q(id)})">${icon('refresh-cw')} ملف تاني</button></div>`;
    (st.notes || []).forEach(n => { body += `<div class="alert ${n.cls === 'a' ? '' : n.cls}">${icon(n.cls === 'r' ? 'alert-octagon' : 'info')}<div>${esc(n.t)}</div></div>`; });
    body += `<div class="grid g4">${[['جديد', c.new, 'g', 'plus-circle'], ['تحديث', c.upd, '', 'refresh-cw'], ['تحذيرات', c.warn, 'a', 'alert-triangle'], ['أخطاء', c.err, 'r', 'x-circle']].map(([l, v, cl, ic]) => `<div class="card flat kpi ${v ? cl : ''}" style="padding:10px 14px"><div class="l">${icon(ic)} ${l}</div><div class="v num" style="font-size:22px;margin-top:2px">${v}</div></div>`).join('')}</div>`;
    if (c.blocked) body += `<div class="alert r">${icon('alert-octagon')}<div><b>بيانات الرأس فيها أخطاء</b> — صلّحها في الملف الأول، مفيش حاجة هتتحفظ.</div></div>`;
    if (cfg.sheets.length > 1) body += `<div class="tabs" role="tablist" style="margin-bottom:0">${cfg.sheets.map(s => { const rs = st.results[s.sheet] || [], e = rs.filter(x => adm_rs(x) === 'err').length; return `<button role="tab" aria-selected="${st.tab === s.sheet}" class="${st.tab === s.sheet ? 'on' : ''}" onclick="adm_upTab(${adm_q(s.sheet)})">${esc(s.sheet)} <span class="n num">${rs.length}</span>${e ? `<span class="bd r num">${e}</span>` : ''}</button>`; }).join('')}</div>`;
    const sd = cfg.sheets.find(s => s.sheet === st.tab) || cfg.sheets[0], rs = st.results[sd.sheet] || [];
    if (!rs.length) body += emptyState('sheet', 'الشيت ده فاضي', '<div>مفيش صفوف فيها بيانات (الصفوف اللي أولها فاضي أو "مثال" بتتجاهل).</div>');
    else if (sd.kv) {
      const x = rs[0], k = adm_rs(x);
      body += `<div class="alert ${k === 'err' ? 'r' : x.res.warns.length ? '' : 'g'}">${icon(k === 'err' ? 'x-circle' : x.res.warns.length ? 'alert-triangle' : 'check-circle-2')}<div><b>${k === 'err' ? 'فيه أخطاء' : k === 'upd' ? 'تحديث بيانات موجودة' : 'بيانات جديدة'}</b>${[...x.res.errs, ...x.res.warns].map(m => `<div>• ${esc(m)}</div>`).join('')}</div></div>
        <div class="tw"><table><thead><tr><th>البيان</th><th>القيمة</th></tr></thead><tbody>${(sd.fields || []).map(([fk, fl, kind]) => `<tr><td class="mut">${esc(fl)}</td><td>${x.row[fk] === '' || x.row[fk] == null ? '<span class="mut">—</span>' : adm_cell(x.row[fk], kind)}</td></tr>`).join('')}</tbody></table></div>`;
    } else {
      body += `<div class="tw" style="max-height:46vh"><table><thead><tr><th class="n">صف</th><th>الحالة</th>${sd.columns.map(([, l]) => `<th>${esc(l)}</th>`).join('')}<th>الملاحظات</th></tr></thead><tbody>${rs.slice(0, 300).map(x => { const bad = adm_rs(x) === 'err', c = cls => { const s = [cls, bad ? 'err' : ''].filter(Boolean).join(' '); return s ? ` class="${s}"` : ''; }; return `<tr class="${!bad && x.res.warns.length ? 'warn' : ''}"><td${c('n')}><span class="num">${x.row.__row}</span></td><td${c('')}>${adm_stBadge(x)}</td>${sd.columns.map(([ck, , kind]) => `<td${c('')}>${adm_cell(x.row[ck], kind)}</td>`).join('')}<td${c('sm')}>${[...x.res.errs, ...x.res.warns].map(esc).join('<br>') || '<span class="mut">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>${rs.length > 300 ? `<div class="sm mut">بيظهر أول 300 صف من ${N(rs.length)}</div>` : ''}`;
    }
  }
  const mine = ADM_UPLOG.filter(u => u.tpl === cfg.templateFile).slice(0, 3);
  if (mine.length) body += `<div class="sm mut">${icon('history')} آخر رفع: ${mine.map(u => `${esc(u.byName)} · ${fmtDT(u.date)} · ${N(u.n)} جديد / ${N(u.u)} تحديث`).join(' — ')}</div>`;
  const valid = c.new + c.upd;
  const foot = st.results ? `<button class="btn pr" onclick="adm_upCommit(${adm_q(id)})" ${!valid || c.blocked ? 'disabled' : ''}>${icon('check')} تأكيد الحفظ (${N(valid)} صف)</button>${c.err ? `<span class="sm mut">الصفوف اللي فيها أخطاء (${N(c.err)}) مش هتتحفظ</span>` : ''}<span class="sp1"></span><button class="btn" onclick="closeModal()">إلغاء</button>` : `<span class="sp1"></span><button class="btn" onclick="closeModal()">إغلاق</button>`;
  modal(esc(cfg.title), body, foot, { size: 'lg' });
}
/** الحفظ: الصفوف السليمة بس ← DB (upsert بالكود) + audit + سجل الرفع */
function adm_upCommit(id) {
  const cfg = ADM_UP[id], st = adm_upSt(id); if (!st.results) return null;
  const c = adm_upCounts(id);
  if (c.blocked) { toast('بيانات الرأس فيها أخطاء — مفيش حاجة اتحفظت', 'err'); return null; }
  if (!c.new && !c.upd) { toast('مفيش صفوف سليمة تتحفظ', 'err'); return null; }
  const valid = {}; cfg.sheets.forEach(sd => { valid[sd.sheet] = (st.results[sd.sheet] || []).filter(x => adm_rs(x) !== 'err'); });
  let extra = '';
  try { extra = cfg.onCommit(valid, st.env) || ''; } catch (e) { console.error(e); toast('حصل خطأ أثناء الحفظ: ' + e.message, 'err'); return null; }
  const u = S.user;
  adm_audit('import', 'template:' + cfg.templateFile, `${st.fileName}: ${c.new} جديد، ${c.upd} تحديث، ${c.err} مرفوض${extra ? ' — ' + extra : ''}`);
  ADM_UPLOG.unshift({ id: uid('up'), tpl: cfg.templateFile, title: cfg.title, by: u.id, byName: u.name, date: new Date(), file: st.fileName, n: c.new, u: c.upd, e: c.err, extra });
  adm_st().up[id] = { preset: st.preset };
  closeModal();
  toast(`اتحفظ ${c.new} جديد و${c.upd} تحديث${c.err ? ` — واتجاهل ${c.err} صف فيه أخطاء` : ''}${extra ? ' · ' + extra : ''}`, 'ok');
  return { n: c.new, u: c.upd, e: c.err, extra };
}
/** كارت "سجل الرفع" لقوالب الشاشة */
function adm_upLog(tpls) {
  const list = ADM_UPLOG.filter(u => tpls.includes(u.tpl));
  return `<div class="card mt"><div class="ch"><h3>${icon('history')} سجل الرفع</h3><span class="sub">مين رفع إيه وإمتى</span></div>${list.length ? `<div class="tw"><table><thead><tr><th>القالب</th><th>الملف</th><th>رفعه</th><th>إمتى</th><th class="n">جديد</th><th class="n">تحديث</th><th class="n">مرفوض</th></tr></thead><tbody>${list.slice(0, 12).map(u => `<tr><td>${esc(u.title)}</td><td class="sm">${esc(u.file)}</td><td>${esc(u.byName)}</td><td class="sm num">${fmtDT(u.date)}</td><td class="n">${N(u.n)}</td><td class="n">${N(u.u)}</td><td class="n">${u.e ? `<span class="bd r num">${u.e}</span>` : N(0)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('inbox', 'لسه مفيش رفع', '<div>أي ملف هيترفع من هنا هيتسجل باسم اللي رفعه.</div>')}</div>`;
}

/* ───────────── قوالب الرفع ───────────── */
/* 01 الهيكل التنظيمي: 6 شيتات بالترتيب، كل مستوى بيشاور على كود اللي فوقه */
adm_uploader({
  id: 'org01', title: 'رفع الهيكل التنظيمي', templateFile: '01_الهيكل_التنظيمي', perm: adm_orgEdit,
  hint: 'الشيتات بتتقري بالترتيب من الرئاسات للسنترالات — كل مستوى ممكن يشاور على كود لسه متضاف في نفس الملف. الكود الموجود قبل كده بيتحدّث اسمه بس.',
  sheets: ADM_ORDER.map(t => {
    const L = ADM_LV[t];
    return {
      sheet: L.sheet, t,
      columns: [['code', 'الكود'], ...(L.pcol ? [[L.pcol, 'كود ' + ADM_LV[L.parent].one]] : []), ['name', 'الاسم'], ...(t === 'gdepts' ? [['gm_email', 'إيميل المدير العام']] : [])],
      validateRow(r, env) {
        const R = adm_r(), code = adm_code(r.code), name = adm_code(r.name), seen = env.seen[L.sheet];
        if (!code) R.err('الكود فاضي'); if (!name) R.err('الاسم فاضي');
        if (code && seen[code]) R.err(`الكود متكرر في الملف (صف ${seen[code]})`);
        const ex = code ? byId(t, code) : null;
        if (ex) { R.st = 'upd'; if (name && ex.name !== name) R.warn(`الاسم هيتغير من "${ex.name}"`); }
        if (L.pcol) {
          const pc = adm_code(r[L.pcol]), P = ADM_LV[L.parent];
          if (!pc) R.err(`كود ${P.one} فاضي`);
          else if (!byId(L.parent, pc) && !(env.ok[L.parent] || {})[pc]) R.err(`${P.one} بالكود ${pc} مش موجود — لا في المنظومة ولا في الملف`);
          else if (ex && ex[L.fk] !== pc) R.warn(`هيتنقل تحت ${(byId(L.parent, pc) || {}).name || (env.ok[L.parent] || {})[pc]}`);
        }
        if (t === 'gdepts' && adm_code(r.gm_email)) { const e = adm_code(r.gm_email).toLowerCase(); if (!ADM_EMAIL.test(e)) R.warn('إيميل المدير العام شكله غلط'); else if (!DB.users.some(u => u.email.toLowerCase() === e)) R.warn('إيميل المدير العام مش متسجل كمستخدم لسه'); }
        if (code) seen[code] = r.__row;
        if (!R.errs.length && code) (env.ok[t] = env.ok[t] || {})[code] = name;
        return R;
      },
    };
  }),
  onCommit(v) {
    ADM_ORDER.forEach(t => (v[ADM_LV[t].sheet] || []).forEach(({ row: r }) => {
      const L = ADM_LV[t], code = adm_code(r.code); let x = byId(t, code);
      if (!x) { x = { id: code }; DB[t].push(x); }
      x.name = adm_code(r.name); if (L.fk) x[L.fk] = adm_code(r[L.pcol]);
      if (t === 'gdepts' && adm_code(r.gm_email)) x.gmEmail = adm_code(r.gm_email);
    }));
  },
  sample() {
    return {
      'رئاسات القطاعات': adm_rows([{ code: 'PR-UPPER', name: 'رئاسة قطاعات الصعيد' }, { code: 'pr1', name: DB.presidencies[0].name }]),
      'القطاعات': adm_rows([{ code: 'S-ASSIUT', presidency_code: 'PR-UPPER', name: 'قطاع أسيوط والوادي الجديد' }]),
      'الإدارات العامة': adm_rows([{ code: 'G-ASSIUT', sector_code: 'S-ASSIUT', name: 'الإدارة العامة لتنفيذ مشروعات أسيوط', gm_email: 'gm.assiut@te.eg' }]),
      'الشئون الفنية': adm_rows([{ code: 'TA-ASSIUT', sector_code: 'S-ASSIUT', name: 'الشئون الفنية — قطاع أسيوط' }]),
      'الإدارات المختصة': adm_rows([{ code: 'D-ASSIUT', gdept_code: 'G-ASSIUT', name: 'إدارة تنفيذ أسيوط الجديدة' }, { code: 'D-SOHAG', gdept_code: 'G-SOHAG', name: 'إدارة تنفيذ سوهاج' }]),
      'السنترالات': adm_rows([{ code: 'C-ASSIUT1', dept_code: 'D-ASSIUT', name: 'سنترال أسيوط الجديدة' }, { code: 'C-ASSIUT2', dept_code: 'D-ASSIUT', name: 'سنترال منفلوط' }, { code: 'C-X', dept_code: '', name: 'سنترال من غير إدارة' }]),
    };
  },
});
/* 02 المشروعات: أنواع المشروعات + المشروعات */
adm_uploader({
  id: 'org02', title: 'رفع المشروعات', templateFile: '02_المشروعات', perm: adm_orgEdit,
  hint: 'كل مشروع مربوط بسنترال واحد — ومنه المستخلص بيعرف إدارته المختصة والعامة وقطاعه ورئاسته. النوع بيحدد المستندات الإلزامية.',
  sheets: [
    { sheet: 'أنواع المشروعات', columns: [['code', 'الكود'], ['name', 'نوع المشروع']], validateRow(r, env) {
      const R = adm_r(), code = adm_code(r.code), name = adm_code(r.name), seen = env.seen['أنواع المشروعات'];
      if (!code) R.err('الكود فاضي'); if (!name) R.err('الاسم فاضي'); if (code && seen[code]) R.err(`متكرر (صف ${seen[code]})`);
      const ex = code && byId('projectTypes', code); if (ex) { R.st = 'upd'; if (ex.name !== name) R.warn(`الاسم هيتغير من "${ex.name}"`); } else if (code) R.warn('نوع جديد — حدد مستنداته الإلزامية من شاشة المسار');
      if (code) seen[code] = r.__row; if (!R.errs.length) (env.ok.types = env.ok.types || {})[code] = name; return R;
    } },
    { sheet: 'المشروعات', columns: [['code', 'الكود'], ['name', 'المشروع'], ['type_code', 'النوع'], ['central_code', 'السنترال'], ['start_date', 'تاريخ البدء', 'd'], ['notes', 'ملاحظات']], validateRow(r, env) {
      const R = adm_r(), code = adm_code(r.code), name = adm_code(r.name), tc = adm_code(r.type_code), cc = adm_code(r.central_code), seen = env.seen['المشروعات'];
      if (!code) R.err('الكود فاضي'); if (!name) R.err('الاسم فاضي'); if (code && seen[code]) R.err(`متكرر (صف ${seen[code]})`);
      if (!tc) R.err('نوع المشروع فاضي'); else if (!byId('projectTypes', tc) && !(env.ok.types || {})[tc]) R.err(`نوع المشروع ${tc} مش موجود`);
      const c = cc && byId('centrals', cc); if (!cc) R.err('كود السنترال فاضي'); else if (!c) R.err(`السنترال ${cc} مش موجود — ارفع الهيكل الأول`);
      if (adm_date(r.start_date) === false) R.err('تاريخ البدء مش مفهوم (يوم/شهر/سنة)');
      const ex = code && byId('projects', code);
      if (ex) { R.st = 'upd'; if (c && ex.centralId !== cc) { const n = DB.aos.filter(a => a.projectId === code).length; R.warn(`السنترال هيتغير من ${(byId('centrals', ex.centralId) || {}).name || '—'}${n ? ` — وده هينقل ${n} أمر تكليف ومستخلصاتهم لمكان تاني في الهيكل` : ''}`); } }
      if (code) seen[code] = r.__row; return R;
    } },
  ],
  onCommit(v) {
    v['أنواع المشروعات'].forEach(({ row: r }) => { const code = adm_code(r.code); let x = byId('projectTypes', code); if (!x) { x = { id: code }; DB.projectTypes.push(x); DB.requiredDocs[code] = DB.requiredDocs[code] || ['dt1', 'dt2']; } x.name = adm_code(r.name); });
    v['المشروعات'].forEach(({ row: r }) => { const code = adm_code(r.code); let x = byId('projects', code); if (!x) { x = { id: code }; DB.projects.push(x); } Object.assign(x, { name: adm_code(r.name), typeId: adm_code(r.type_code), centralId: adm_code(r.central_code), start: adm_date(r.start_date) || x.start || '', notes: adm_code(r.notes) }); });
  },
  sample() {
    return {
      'أنواع المشروعات': adm_rows([{ code: 'FWA', name: 'FWA — إنترنت لاسلكي ثابت' }, { code: 't1', name: DB.projectTypes[0].name }]),
      'المشروعات': adm_rows([{ code: 'PJ-UNIV', name: 'FTTH المنصورة — حي الجامعة', type_code: 't1', central_code: 'c1', start_date: '01/11/2026', notes: '' }, { code: 'PJ-FWA1', name: 'FWA قرى طلخا', type_code: 'FWA', central_code: 'c3', start_date: '', notes: 'مرحلة أولى' }, { code: 'pj2', name: DB.projects[1].name, type_code: 't2', central_code: 'c2', start_date: '', notes: '' }, { code: 'PJ-BAD', name: 'مشروع على سنترال مش متسجل', type_code: 't1', central_code: 'C-XXX', start_date: '', notes: '' }]),
    };
  },
});
/* 03 الشركات */
adm_uploader({
  id: 'org03', title: 'رفع الشركات المنفذة', templateFile: '03_الشركات', sheet: 'الشركات', perm: adm_orgEdit,
  columns: [['code', 'الكود'], ['name', 'الاسم المختصر'], ['full_name', 'الاسم الكامل'], ['email', 'إيميل المستخلصات'], ['phone', 'التليفون'], ['tax_no', 'البطاقة الضريبية']],
  validateRow(r, env) {
    const R = adm_r(), code = adm_code(r.code), seen = env.seen['الشركات'], email = adm_code(r.email);
    if (!code) R.err('الكود فاضي'); if (!adm_code(r.name)) R.err('الاسم المختصر فاضي'); if (!adm_code(r.full_name)) R.err('الاسم الكامل فاضي');
    if (!email) R.err('إيميل المستخلصات إلزامي'); else if (!ADM_EMAIL.test(email)) R.err('الإيميل شكله غلط');
    if (code && seen[code]) R.err(`متكرر (صف ${seen[code]})`);
    const ex = code && byId('companies', code); if (ex) { R.st = 'upd'; if (email && ex.email !== email) R.warn(`إيميل الإشعارات هيتغير من ${ex.email}`); }
    if (code) seen[code] = r.__row; return R;
  },
  onCommit(v) {
    v['الشركات'].forEach(({ row: r }) => { const code = adm_code(r.code); let x = byId('companies', code); if (!x) { x = { id: code }; DB.companies.push(x); } Object.assign(x, { name: adm_code(r.name), fullName: adm_code(r.full_name), email: adm_code(r.email), phone: adm_code(r.phone), commercialReg: adm_code(r.commercial_reg), taxNo: adm_code(r.tax_no), address: adm_code(r.address) }); });
  },
  sample: () => ({ 'الشركات': adm_rows([{ code: 'CO-NILE', name: 'النيل', full_name: 'شركة النيل للاتصالات والمقاولات', commercial_reg: '12345', tax_no: '200-300-400', email: 'invoices@nile-tel.com', phone: '01000000009', address: 'المنصورة' }, { code: 'co2', name: 'بريدج', full_name: DB.companies[1].fullName, email: DB.companies[1].email, phone: '01000000002' }, { code: 'CO-BAD', name: 'شركة', full_name: 'شركة من غير إيميل', email: '' }]) }),
});
/* 04 المستخدمين */
adm_uploader({
  id: 'users04', title: 'رفع المستخدمين', templateFile: '04_المستخدمين', sheet: 'المستخدمين', perm: () => can('users.manage'),
  hint: 'كل مستخدم جديد بيوصله إيميل دعوة. نفس الإيميل ممكن يتكرر لو الشخص ليه أكتر من نطاق.',
  columns: [['name', 'الاسم'], ['email', 'الإيميل'], ['role', 'الدور'], ['scope_type', 'نوع النطاق'], ['scope_code', 'كود النطاق'], ['delegate_email', 'البديل']],
  validateRow(r, env) {
    const R = adm_r(), email = adm_code(r.email).toLowerCase(), role = adm_code(r.role), stype = adm_code(r.scope_type), sc = adm_code(r.scope_code), seen = env.seen['المستخدمين'];
    if (!adm_code(r.name)) R.err('الاسم فاضي');
    if (!email) R.err('الإيميل فاضي'); else if (!ADM_EMAIL.test(email)) R.err('الإيميل شكله غلط');
    if (!DB.roles[role]) R.err(`الدور "${role}" مش معروف`);
    if (!ADM_SCOPE_T[stype]) R.err(`نوع النطاق "${stype}" مش معروف`);
    else if (stype !== 'all') { if (!sc) R.err('كود النطاق فاضي'); else if (!byId(ADM_SCOPE_TBL[stype], sc)) R.err(`مفيش ${ADM_SCOPE_T[stype]} بالكود ${sc}`); }
    if (DB.roles[role] && ADM_SCOPE_T[stype] && DB.roles[role].scope !== stype) R.warn(`الدور ده نطاقه المعتاد "${ADM_SCOPE_T[DB.roles[role].scope]}"`);
    const key = `${email}|${stype}|${stype === 'all' ? '' : sc}`;
    if (seen[key]) R.err(`نفس الإيميل والنطاق متكررين (صف ${seen[key]})`);
    const ex = DB.users.find(u => u.email.toLowerCase() === email && u.scope.type === stype && (stype === 'all' || u.scope.id === sc));
    if (ex) R.st = 'upd'; else if (DB.users.some(u => u.email.toLowerCase() === email)) R.warn('الإيميل متسجل بنطاق تاني — هيتضاف نطاق إضافي');
    const de = adm_code(r.delegate_email).toLowerCase();
    if (de && !DB.users.some(u => u.email.toLowerCase() === de) && !(env.ok.emails || {})[de]) R.warn('إيميل البديل مش متسجل — هيتجاهل');
    seen[key] = r.__row; if (!R.errs.length) (env.ok.emails = env.ok.emails || {})[email] = 1;
    return R;
  },
  onCommit(v) {
    const fresh = [], pend = [];
    v['المستخدمين'].forEach(({ row: r }) => {
      const email = adm_code(r.email).toLowerCase(), stype = adm_code(r.scope_type), scope = stype === 'all' ? { type: 'all' } : { type: stype, id: adm_code(r.scope_code) };
      let u = DB.users.find(x => x.email.toLowerCase() === email && x.scope.type === scope.type && x.scope.id === scope.id);
      if (!u) { u = { id: uid('u'), email }; DB.users.push(u); fresh.push(u); }
      Object.assign(u, { name: adm_code(r.name), phone: adm_code(r.phone), role: adm_code(r.role), scope });
      pend.push([u, adm_code(r.delegate_email).toLowerCase()]);
    });
    pend.forEach(([u, de]) => { const d = de && DB.users.find(x => x.email.toLowerCase() === de && x.id !== u.id); if (d) u.delegateId = d.id; });
    fresh.forEach(u => adm_invite(u, true));
    return fresh.length ? `اتبعت ${fresh.length} دعوة` : '';
  },
  sample: () => ({ 'المستخدمين': adm_rows([
    { name: 'م. سارة الشريف', email: 'exec.maadi2@te.eg', phone: '', role: 'exec_mgr', scope_type: 'dept', scope_code: 'd5', delegate_email: '' },
    { name: 'م. كريم حسن', email: 'gm.dakahlia2@te.eg', phone: '', role: 'gm', scope_type: 'gdept', scope_code: 'g1', delegate_email: 'exec.mansoura@te.eg' },
    { name: 'م. محمود فتحي', email: 'exec.mansoura@te.eg', phone: '01011112222', role: 'exec_mgr', scope_type: 'dept', scope_code: 'd1', delegate_email: '' },
    { name: 'مستخدم غلط', email: 'x@te.eg', phone: '', role: 'boss', scope_type: 'dept', scope_code: 'D-NONE', delegate_email: '' },
  ]) }),
});

/* 05 العقد والمقايسة */
const ADM_K_FIELDS = [['contract_no', 'رقم العقد / الإحالة'], ['company_code', 'كود الشركة'], ['title', 'موضوع العقد'], ['award_date', 'تاريخ برقية القبول', 'd'], ['start_date', 'تاريخ البدء', 'd'], ['end_date', 'تاريخ الانتهاء', 'd'], ['currency', 'العملة'], ['vat_pct', 'ضريبة القيمة المضافة %'], ...[['pay_monthly_pct', 'نسبة الصرف مع المستخلص الشهري %'], ['pay_asbuilt_pct', 'محجوز لحد As-Built %'], ['pay_handover_pct', 'محجوز لحد التسليم الابتدائي %'], ['final_guarantee_pct', 'خطاب الضمان النهائي %'], ['delay_fine_pct_week', 'غرامة التأخير % أسبوعياً'], ['delay_fine_cap_pct', 'الحد الأقصى للغرامة %'], ['warranty_months', 'مدة الضمان (شهور)'], ['tax_pct', 'خصم ضريبي %']], ['contract_value', 'قيمة العقد']];
/* شروط العقد (من برقية القبول) — مفتاح القالب ← الحقل في DB */
const ADM_K_TERMS = [['pay_monthly_pct', 'payMonthlyPct'], ['pay_asbuilt_pct', 'asbuiltPct'], ['pay_handover_pct', 'handoverPct'], ['final_guarantee_pct', 'finalGuaranteePct'], ['delay_fine_pct_week', 'delayFinePctWeek'], ['delay_fine_cap_pct', 'delayFineCapPct'], ['tax_pct', 'taxPct']];
const adm_termsOf = k => Object.fromEntries([...ADM_K_TERMS, ['warranty_months', 'warrantyMonths']].map(([key, f]) => [key, k[f] ?? '']));
const ADM_WORK_TYPES = ['أعمال مدنية', 'تركيبات', 'كهربية', 'توريد', 'توريد وتركيب', 'تخطيط ورسومات', 'خدمات', 'صيانة', 'صواعد داخل المباني', 'رفع كفاءة'];
const adm_contractByNo = v => { v = adm_code(v); return DB.contracts.find(k => k.no === v || k.id === v); };
adm_uploader({
  id: 'contract05', title: 'رفع عقد ومقايسة', templateFile: '05_العقد_والمقايسة', perm: () => can('master.import'),
  hint: 'الأسعار دي اللي السيستم بيحسب بيها كل المستخلصات. الصف اللي من غير وحدة = عنوان مجموعة. البند من غير سعر بيتعلّم "مالوش سعر" وأي فوترة عليه تبقى C5.',
  sheets: [
    { sheet: 'بيانات العقد', kv: true, fields: ADM_K_FIELDS, validateRow(o, env) {
      const R = adm_r(), no = adm_code(o.contract_no), co = byId('companies', adm_code(o.company_code)), cur = adm_code(o.currency || 'EGP').toUpperCase();
      if (!no) R.err('رقم العقد إلزامي');
      if (!adm_code(o.company_code)) R.err('كود الشركة إلزامي'); else if (!co) R.err(`الشركة ${adm_code(o.company_code)} مش متسجلة — ارفع قالب الشركات الأول`);
      if (!adm_code(o.title)) R.err('موضوع العقد إلزامي');
      if (!['EGP', 'USD', 'EUR'].includes(cur)) R.err('العملة لازم EGP أو USD أو EUR');
      const h = { no, companyId: co && co.id, title: adm_code(o.title), currency: cur };
      const wm = adm_num(o.warranty_months); h.warrantyMonths = wm == null || isNaN(wm) ? 12 : wm;
      [['vat_pct', 'vatPct', 1], ...ADM_K_TERMS].forEach(([k, f, req]) => { const n = adm_num(o[k]); if (n == null) { if (req) R.err('ضريبة القيمة المضافة إلزامية'); h[f] = 0; } else if (isNaN(n) || n < 0 || n > 100) R.err(`${k} لازم نسبة من 0 لـ 100`); else h[f] = n; });
      if ((h.payMonthlyPct || 0) + (h.asbuiltPct || 0) + (h.handoverPct || 0) !== 100 && h.payMonthlyPct) R.err('نسب الصرف (الشهري + As-Built + التسليم) لازم مجموعها 100%');
      [['award_date', 'awardDate'], ['start_date', 'start'], ['end_date', 'end']].forEach(([k, f]) => { const d = adm_date(o[k]); if (d === false) R.err(`التاريخ ${k} مش مفهوم`); else h[f] = d || ''; });
      const val = adm_num(o.contract_value); if (val != null && (isNaN(val) || val < 0)) R.err('قيمة العقد لازم رقم'); h.value = val;
      const ex = no ? DB.contracts.find(k => k.no === no) : null;
      if (ex) { R.st = 'upd'; if (co && ex.companyId !== co.id) R.err(`العقد ده متسجل باسم ${(byId('companies', ex.companyId) || {}).name || '—'}`); else R.warn('العقد موجود — البيانات والأسعار هتتحدث، والبنود اللي مش في الملف هتفضل زي ما هي'); }
      env.h = h; env.cid = ex ? ex.id : no; env.exists = !!ex; env.boq = {};
      env.hasInv = !!ex && DB.invoices.some(i => i.status !== 'draft' && (byId('aos', i.aoId) || {}).contractId === ex.id);
      return R;
    } },
    { sheet: 'المقايسة', columns: [['item_code', 'رقم البند'], ['description', 'الوصف'], ['unit', 'الوحدة'], ['contract_qty', 'كمية العقد'], ['unit_price', 'سعر الوحدة'], ['work_type', 'نوع العمل']], validateRow(r, env) {
      const R = adm_r(), no = adm_itemNo(r.item_code), unit = adm_code(r.unit), price = adm_num(r.unit_price), q = adm_num(r.contract_qty), wt = adm_code(r.work_type), seen = env.seen['المقايسة'];
      if (!no) R.err('رقم البند فاضي'); else if (!/^[0-9A-Za-z]+(-[0-9A-Za-z]+)*$/.test(no)) R.err('رقم البند لازم بالتدرج زي 1-1-1-1');
      if (!adm_code(r.description)) R.err('الوصف فاضي');
      if (no && seen[no]) R.err(`البند متكرر (صف ${seen[no]})`);
      const group = !unit; R.data.group = group;
      if (group) { if (price) R.warn('صف عنوان (من غير وحدة) — السعر هيتجاهل'); }
      else {
        if (price == null || price === 0) R.warn('مالوش سعر في العقد — أي فوترة عليه هتبقى C5');
        else if (isNaN(price) || price < 0) R.err('سعر الوحدة لازم رقم موجب');
        if (q != null && (isNaN(q) || q < 0)) R.err('كمية العقد لازم رقم موجب');
        if (wt && !ADM_WORK_TYPES.includes(wt)) R.warn(`نوع العمل "${wt}" مش من القائمة`);
      }
      const parts = no.split('-');
      if (no && parts.length > 1 && !parts.slice(0, -1).some((_, i) => { const p = parts.slice(0, i + 1).join('-'); return env.boq[p] || (env.exists && DB.contractItems.some(it => it.contractId === env.cid && it.itemNo === p)); })) R.warn(`مفيش عنوان أب للبند (${parts[0]}) في المقايسة`);
      const ex = env.exists && no ? DB.contractItems.find(it => it.contractId === env.cid && it.itemNo === no) : null;
      if (ex) { R.st = 'upd'; const np = group || !price ? null : price; if (ex.unitPrice !== np && !group) R.warn(`السعر هيتغير من ${money(ex.unitPrice)} لـ ${money(np)}${env.hasInv ? ' — وده هيأثر على حسابات المستخلصات المفتوحة' : ''}`); }
      if (no) { seen[no] = r.__row; env.boq[no] = 1; }
      return R;
    } },
  ],
  finalize(env, res) { const h = res['بيانات العقد'][0]; if (h && !res['المقايسة'].length && !env.exists) h.res.err('مفيش ولا بند في شيت المقايسة'); },
  onCommit(v, env) {
    const h = env.h; let k = DB.contracts.find(x => x.no === h.no);
    if (!k) { k = { id: env.cid, no: h.no, priceFactor: 1 }; DB.contracts.push(k); }
    Object.assign(k, { companyId: h.companyId, title: h.title, currency: h.currency, vatPct: h.vatPct, ...Object.fromEntries([...ADM_K_TERMS.map(t => t[1]), 'warrantyMonths'].map(f => [f, h[f]])), start: h.start || k.start || '', end: h.end || k.end || '', awardDate: h.awardDate || k.awardDate || '' });
    if (h.value != null) k.value = h.value;
    let n = 0;
    v['المقايسة'].forEach(({ row: r, res }) => {
      const no = adm_itemNo(r.item_code), group = res.data.group, price = adm_num(r.unit_price);
      let it = DB.contractItems.find(x => x.contractId === k.id && x.itemNo === no);
      if (!it) { it = { id: `${k.id}-${no}`, contractId: k.id, itemNo: no }; DB.contractItems.push(it); }
      Object.assign(it, { parentNo: no.split('-').slice(0, -1).join('-'), isGroup: group, description: adm_code(r.description), unit: group ? '' : adm_code(r.unit), unitPrice: group || !price ? null : price, workType: group ? '' : (adm_code(r.work_type) || it.workType || ''), contractQty: group ? null : adm_num(r.contract_qty) });
      n++;
    });
    adm_st().contract = k.id;
    return `العقد ${k.no}: ${n} بند في المقايسة`;
  },
  sample(p) {
    const k = p.contractId && byId('contracts', p.contractId);
    if (k) { // تحديث مقايسة عقد موجود: تعديل سعر + بند جديد
      const it = DB.contractItems.find(i => i.contractId === k.id && !i.isGroup && i.unitPrice != null);
      return {
        'بيانات العقد': [{ __row: 2, contract_no: k.no, company_code: k.companyId, title: k.title, currency: k.currency, vat_pct: k.vatPct, ...adm_termsOf(k) }],
        'المقايسة': adm_rows([{ item_code: it.itemNo, description: it.description, unit: it.unit, contract_qty: 200, unit_price: Math.round(it.unitPrice * 1.05), work_type: it.workType }, { item_code: '2.9.1', description: 'تركيب مانع تسرب للمواسير (بند إضافي)', unit: 'عدد', contract_qty: 500, unit_price: 85, work_type: 'تركيبات' }, { item_code: '2-9-2', description: 'بند من غير سعر لسه', unit: 'م.ط', contract_qty: '', unit_price: '', work_type: 'تركيبات' }]),
      };
    }
    return {
      'بيانات العقد': [{ __row: 2, contract_no: '88/2026/1/7', company_code: 'co3', title: 'تنفيذ شبكات FTTH المعادي الجديدة', award_date: '15/09/2026', start_date: '01/10/2026', end_date: '30/09/2027', currency: 'EGP', vat_pct: 14, pay_monthly_pct: 90, pay_asbuilt_pct: 0, pay_handover_pct: 10, final_guarantee_pct: 5, delay_fine_pct_week: 2, delay_fine_cap_pct: 10, warranty_months: 12, tax_pct: 1, contract_value: '' }],
      'المقايسة': adm_rows([
        { item_code: '1', description: 'الأعمال المدنية', unit: '', contract_qty: '', unit_price: '', work_type: '' },
        { item_code: '1.1', description: 'غرف التفتيش', unit: '', contract_qty: '', unit_price: '', work_type: '' },
        { item_code: '1-1-1-1', description: 'غرفة تفتيش طراز (DH) 70×70×70 سم', unit: 'عدد', contract_qty: 150, unit_price: 22500, work_type: 'أعمال مدنية' },
        { item_code: '1-9-1', description: 'حفر ضيق Micro trenching عرض 10–13 سم', unit: 'م.ط', contract_qty: 40000, unit_price: 160, work_type: 'أعمال مدنية' },
        { item_code: '2', description: 'التركيبات', unit: '', contract_qty: '', unit_price: '', work_type: '' },
        { item_code: '2-6-1', description: 'Installation of Fiber Optic Micro Cables 2–12 fiber', unit: 'م.ط', contract_qty: 90000, unit_price: 12, work_type: 'تركيبات' },
        { item_code: '2-3-1', description: 'كابلات نحاسية من سعة 10 إلى 400 جوز', unit: 'م.ط', contract_qty: 2000, unit_price: '', work_type: 'تركيبات' },
        { item_code: '2-7-2', description: '', unit: 'عدد', contract_qty: 20, unit_price: 4200, work_type: 'تركيبات' },
        { item_code: '1-9-1', description: 'بند متكرر', unit: 'م.ط', contract_qty: 1, unit_price: 1, work_type: 'أعمال مدنية' },
      ]),
    };
  },
});
/* 06 أمر التكليف (أصلي أو ملحق زيادة) */
const ADM_AO_FIELDS = [['contract_no', 'رقم العقد'], ['ao_no', 'رقم أمر التكليف'], ['revision', 'رقم الملحق / الزيادة'], ['ao_date', 'تاريخ أمر التكليف', 'd'], ['project_code', 'كود المشروع'], ['name', 'اسم أمر التكليف / المنطقة'], ['ao_value', 'قيمة أمر التكليف']];
const adm_lastRev = ao => Math.max(0, ...((ao && ao.revisions) || []).map(r => r.n));
adm_uploader({
  id: 'ao06', title: 'رفع أمر تكليف / ملحق زيادة', templateFile: '06_أمر_التكليف', perm: () => can('master.import'),
  hint: 'رقم الملحق 0 = أمر التكليف الأصلي (الكميات بتتستبدل). 1 وأكتر = ملحق زيادة (الكميات بتتزوّد على المخطط ويتسجل الملحق). البنود لازم تكون في مقايسة العقد.',
  sheets: [
    { sheet: 'بيانات أمر التكليف', kv: true, fields: ADM_AO_FIELDS, validateRow(o, env) {
      const R = adm_r(), k = adm_contractByNo(o.contract_no), aoNo = adm_code(o.ao_no), rev = adm_num(o.revision) ?? 0, pc = adm_code(o.project_code), prj = pc && byId('projects', pc), d = adm_date(o.ao_date);
      if (!adm_code(o.contract_no)) R.err('رقم العقد إلزامي'); else if (!k) R.err(`العقد ${adm_code(o.contract_no)} مش متسجل — ارفع العقد والمقايسة الأول`);
      if (!aoNo) R.err('رقم أمر التكليف إلزامي');
      if (isNaN(rev) || rev < 0 || rev % 1) R.err('رقم الملحق لازم رقم صحيح (0 = الأصلي)');
      const ex = k && aoNo ? DB.aos.find(a => a.contractId === k.id && a.no === aoNo) : null;
      if (rev > 0) {
        if (!ex) R.err('ملحق الزيادة لازم يكون على أمر تكليف موجود');
        else { R.st = 'upd'; if (rev <= adm_lastRev(ex)) R.err(`الملحق رقم ${rev} اترفع قبل كده — آخر ملحق ${adm_lastRev(ex)}`); else if (rev > adm_lastRev(ex) + 1) R.warn(`آخر ملحق مسجل ${adm_lastRev(ex)} — كده هتنط رقم`); }
      } else if (ex) { R.st = 'upd'; R.warn('أمر التكليف موجود — الكميات المخططة في الملف هتستبدل الموجودة'); }
      if (!pc) { if (!ex) R.err('كود المشروع إلزامي'); } else if (!prj) R.err(`المشروع ${pc} مش موجود — ارفع قالب المشروعات الأول`); else if (ex && ex.projectId !== pc) R.warn(`المشروع مختلف عن المسجل (${(byId('projects', ex.projectId) || {}).name || '—'}) — هيتغير`);
      if (d === false) R.err('تاريخ أمر التكليف مش مفهوم'); else if (!d && !ex) R.err('تاريخ أمر التكليف إلزامي');
      if (!ex && !adm_code(o.name)) R.warn('مفيش اسم لأمر التكليف — هيتسمى باسم المشروع');
      if (ex && !adm_aoIn(ex.id) && S.user.scope.type !== 'all') R.err('أمر التكليف ده خارج نطاقك');
      if (!ex && prj && S.user.scope.type !== 'all' && !adm_scopeNodes(S.user.scope).centrals.some(c => c.id === prj.centralId)) R.err('المشروع ده خارج نطاقك');
      const v = adm_num(o.ao_value); if (v != null && isNaN(v)) R.err('قيمة أمر التكليف لازم رقم');
      Object.assign(env, { k, ex, rev: isNaN(rev) ? 0 : rev, h: { aoNo, projectId: prj ? prj.id : ex && ex.projectId, date: d || '', name: adm_code(o.name), value: v }, value: 0, items: {} });
      return R;
    } },
    { sheet: 'بنود أمر التكليف', columns: [['item_code', 'رقم البند'], ['description', 'الوصف'], ['site_code', 'الموقع'], ['planned_qty', 'الكمية المخططة']], validateRow(r, env) {
      const R = adm_r(), no = adm_itemNo(r.item_code), q = adm_num(r.planned_qty), site = adm_code(r.site_code), seen = env.seen['بنود أمر التكليف'];
      if (!env.k) return R.err('العقد مش متعرف — صلّح بيانات أمر التكليف');
      if (!no) return R.err('رقم البند فاضي');
      const it = DB.contractItems.find(i => i.contractId === env.k.id && i.itemNo === no);
      if (!it) R.err(`البند ${no} مش موجود في مقايسة العقد ${env.k.no}`);
      else if (it.isGroup) R.err('ده عنوان مجموعة مش بند يتفوتر');
      else { R.data.itemId = it.id; if (it.unitPrice == null) R.warn('البند مالوش سعر في العقد — مش هيدخل في قيمة أمر التكليف'); }
      if (q == null || isNaN(q) || q <= 0) R.err('الكمية المخططة لازم رقم أكبر من صفر');
      const key = no + '|' + site; if (seen[key]) R.err(`البند متكرر لنفس الموقع (صف ${seen[key]})`); seen[key] = r.__row;
      if (it && !it.isGroup) {
        const cur = env.ex && DB.aoItems.find(x => x.aoId === env.ex.id && x.itemId === it.id);
        if (cur) { R.st = 'upd'; if (env.rev > 0 && q > 0) R.warn(`زيادة +${qty(q)} على المخطط ${qty(cur.plannedQty)}`); }
        else if (env.rev > 0) R.warn('بند جديد على أمر التكليف في الملحق');
        if (site && env.ex && !DB.aoSites.some(s => s.aoId === env.ex.id && s.code === site)) R.warn(`موقع جديد ${site} هيتضاف`);
        if (!R.errs.length) env.value += q * (it.unitPrice || 0);
      }
      return R;
    } },
    { sheet: 'مهمات أمر التكليف', columns: [['material_code', 'رقم الشطب'], ['description', 'الوصف'], ['planned_qty', 'الكمية المخططة']], validateRow(r, env) {
      const R = adm_r(), code = adm_code(r.material_code), q = adm_num(r.planned_qty), seen = env.seen['مهمات أمر التكليف'];
      if (!code) return R.err('رقم الشطب فاضي');
      if (!material(code)) R.err(`الصنف ${code} مش في كتالوج المهمات — ارفعه الأول`);
      if (q == null || isNaN(q) || q <= 0) R.err('الكمية المخططة لازم رقم أكبر من صفر');
      if (seen[code]) R.err(`الصنف متكرر (صف ${seen[code]})`); seen[code] = r.__row;
      const cur = env.ex && DB.aoMaterials.find(x => x.aoId === env.ex.id && x.code === code);
      if (cur) { R.st = 'upd'; if (env.rev > 0 && q > 0) R.warn(`زيادة +${qty(q)} على ${qty(cur.plannedQty)}`); }
      return R;
    } },
  ],
  finalize(env, res) {
    const h = res['بيانات أمر التكليف'][0]; if (!h || h.res.errs.length) return;
    const okItems = res['بنود أمر التكليف'].filter(x => adm_rs(x) !== 'err').length, okMats = res['مهمات أمر التكليف'].filter(x => adm_rs(x) !== 'err').length;
    if (!okItems && !okMats) h.res.err('مفيش ولا بند أو صنف سليم في الملف');
    if (env.h.value && env.rev === 0 && okItems && Math.abs(env.value - env.h.value) / env.h.value > 0.01) h.res.warn(`القيمة المكتوبة ${money(env.h.value)} مختلفة عن الكميات × أسعار العقد (${money(env.value)})`);
    if (env.rev > 0) h.res.warn(`الملحق هيزوّد قيمة أمر التكليف بحوالي ${money(env.value)} جنيه`);
  },
  onCommit(v, env) {
    const k = env.k, h = env.h; let ao = env.ex;
    if (!ao) {
      const id = byId('aos', h.aoNo) ? `${h.aoNo}@${k.id}` : h.aoNo;
      ao = { id, no: h.aoNo, contractId: k.id, projectId: h.projectId, date: h.date, name: h.name || (byId('projects', h.projectId) || {}).name || '', revisions: [] };
      DB.aos.push(ao);
    } else if (env.rev === 0) Object.assign(ao, { projectId: h.projectId || ao.projectId, date: h.date || ao.date, name: h.name || ao.name || '' });
    ao.revisions = ao.revisions || [];
    const before = aoValue(ao.id), agg = {};
    v['بنود أمر التكليف'].forEach(({ row: r, res }) => { const id = res.data.itemId, q = adm_num(r.planned_qty), site = adm_code(r.site_code); const a = agg[id] = agg[id] || { q: 0, sites: {} }; a.q += q; if (site) a.sites[site] = (a.sites[site] || 0) + q; });
    Object.entries(agg).forEach(([itemId, a]) => {
      let x = DB.aoItems.find(y => y.aoId === ao.id && y.itemId === itemId);
      if (!x) { x = { aoId: ao.id, itemId, plannedQty: 0 }; DB.aoItems.push(x); }
      x.plannedQty = env.rev > 0 ? x.plannedQty + a.q : a.q;
      if (Object.keys(a.sites).length) { x.sites = env.rev > 0 ? { ...(x.sites || {}) } : {}; Object.entries(a.sites).forEach(([s, q]) => { x.sites[s] = (x.sites[s] || 0) + q; }); }
      Object.keys(a.sites).forEach(s => { if (!DB.aoSites.some(z => z.aoId === ao.id && z.code === s)) DB.aoSites.push({ aoId: ao.id, code: s, name: 'موقع ' + s }); });
    });
    v['مهمات أمر التكليف'].forEach(({ row: r }) => {
      const code = adm_code(r.material_code), q = adm_num(r.planned_qty);
      let x = DB.aoMaterials.find(y => y.aoId === ao.id && y.code === code);
      if (!x) { x = { aoId: ao.id, code, plannedQty: 0 }; DB.aoMaterials.push(x); }
      x.plannedQty = env.rev > 0 ? x.plannedQty + q : q;
    });
    if (h.value != null) ao.declaredValue = h.value;
    const after = aoValue(ao.id), file = adm_upSt('ao06').fileName || '';
    ao.revisions = ao.revisions.filter(r => r.n !== env.rev);
    ao.revisions.push({ n: env.rev, date: h.date || iso(TODAY), by: S.user.id, items: Object.keys(agg).length, mats: v['مهمات أمر التكليف'].length, added: after - before, value: after, file });
    ao.revisions.sort((a, b) => a.n - b.n);
    adm_st().contract = k.id; adm_st().ctab = 'aos';
    const held = DB.invoices.filter(i => i.aoId === ao.id && i.status === 'on_hold').length;
    return `${env.rev ? `ملحق ${env.rev} على` : 'أمر التكليف'} ${ao.no}${held ? ` — فيه ${held} مستخلص معلّق ممكن يترفع تعليقه دلوقتي` : ''}`;
  },
  sample(p) {
    const ao = p.aoId && byId('aos', p.aoId);
    if (ao) { // ملحق زيادة على أمر موجود
      const k = byId('contracts', ao.contractId), items = DB.aoItems.filter(x => x.aoId === ao.id).slice(0, 3), extra = DB.contractItems.find(i => i.contractId === k.id && !i.isGroup && i.unitPrice != null && !DB.aoItems.some(x => x.aoId === ao.id && x.itemId === i.id)), mat = DB.aoMaterials.find(x => x.aoId === ao.id);
      return {
        'بيانات أمر التكليف': [{ __row: 2, contract_no: k.no, ao_no: ao.no, revision: adm_lastRev(ao) + 1, ao_date: fmtD(TODAY), project_code: ao.projectId, name: 'ملحق زيادة', ao_value: '' }],
        'بنود أمر التكليف': adm_rows([...items.map(x => { const it = byId('contractItems', x.itemId); return { item_code: it.itemNo, description: it.description, site_code: '', planned_qty: Math.max(1, Math.round(x.plannedQty * 0.15)) }; }), ...(extra ? [{ item_code: extra.itemNo, description: extra.description, site_code: '', planned_qty: 5 }] : []), { item_code: '9-9-9', description: 'بند مش في العقد', site_code: '', planned_qty: 3 }]),
        'مهمات أمر التكليف': adm_rows(mat ? [{ material_code: mat.code, description: (material(mat.code) || {}).description || '', planned_qty: Math.max(0.1, Math.round(mat.plannedQty * 15) / 100) }] : []),
      };
    }
    const k = byId('contracts', p.contractId) || byId('contracts', 'k3') || DB.contracts[0];
    const prjId = (DB.aos.find(a => a.contractId === k.id) || {}).projectId || DB.projects[0].id;
    const its = DB.contractItems.filter(i => i.contractId === k.id && !i.isGroup && i.unitPrice != null).slice(0, 4);
    let n = 2400; while (DB.aos.some(a => a.contractId === k.id && a.no === 'WO-' + n)) n++;
    return {
      'بيانات أمر التكليف': [{ __row: 2, contract_no: k.no, ao_no: 'WO-' + n, revision: 0, ao_date: fmtD(TODAY), project_code: prjId, name: 'أمر تكليف تجريبي — المنطقة الجديدة', ao_value: '' }],
      'بنود أمر التكليف': adm_rows([...its.map((it, i) => ({ item_code: it.itemNo.replace(/-/g, i % 2 ? '.' : '-'), description: it.description, site_code: i === 0 ? '#201' : '', planned_qty: [6, 180, 2200, 900][i] || 10 })), ...(its[0] ? [{ item_code: its[0].itemNo, description: its[0].description, site_code: '#202', planned_qty: 4 }] : []), { item_code: '1-1', description: 'غرف التفتيش', site_code: '', planned_qty: 2 }, { item_code: '9-9-9', description: 'بند مش في المقايسة', site_code: '', planned_qty: 10 }]),
      'مهمات أمر التكليف': adm_rows([{ material_code: '1.1.4', description: '12 FIBER OPTIC CABLE', planned_qty: 2.4 }, { material_code: '2.1.1', description: 'HDPE Microduct', planned_qty: 950 }, { material_code: 'ZZ.9', description: 'صنف مش في الكتالوج', planned_qty: 5 }]),
    };
  },
});
/* 07 كتالوج المهمات */
adm_uploader({
  id: 'mat07', title: 'رفع كتالوج المهمات', templateFile: '07_كتالوج_المهمات', sheet: 'المهمات', perm: () => can('issues.import'),
  columns: [['material_code', 'رقم الشطب'], ['description', 'الوصف'], ['unit', 'الوحدة'], ['supplied_by', 'التوريد'], ['group', 'المجموعة']],
  validateRow(r, env) {
    const R = adm_r(), code = adm_code(r.material_code), seen = env.seen['المهمات'], sb = adm_code(r.supplied_by);
    if (!code) R.err('رقم الشطب فاضي'); if (!adm_code(r.description)) R.err('الوصف فاضي'); if (!adm_code(r.unit)) R.err('الوحدة فاضية');
    if (sb && !['المصرية للاتصالات', 'الشركة المنفذة'].includes(sb)) R.warn('التوريد مش من القائمة');
    if (code && seen[code]) R.err(`متكرر (صف ${seen[code]})`);
    const ex = code && material(code); if (ex) { R.st = 'upd'; if (adm_code(r.unit) && ex.unit !== adm_code(r.unit) && DB.materialIssues.some(i => i.code === code)) R.warn(`الوحدة هتتغير من ${ex.unit} وفيه منصرف عليه`); }
    if (code) seen[code] = r.__row; return R;
  },
  onCommit(v) { v['المهمات'].forEach(({ row: r }) => { const code = adm_code(r.material_code); let m = material(code); if (!m) { m = { code }; DB.materials.push(m); } Object.assign(m, { description: adm_code(r.description), unit: adm_code(r.unit), suppliedBy: adm_code(r.supplied_by), group: adm_code(r.group) }); }); },
  sample: () => ({ 'المهمات': adm_rows([{ material_code: '1.1.9', description: '96 FIBER OPTIC CABLE', unit: 'KM', supplied_by: 'المصرية للاتصالات', group: 'Supply of F.O. Cables' }, { material_code: '2.1.1', description: 'HDPE Single Microduct 14/10 mm', unit: 'M', supplied_by: 'المصرية للاتصالات', group: 'Ducts' }, { material_code: '5.2.1', description: 'Splitter 1:8', unit: '', supplied_by: 'الشركة المنفذة', group: '' }]) }),
});
/* 08 المنصرف من المخازن */
adm_uploader({
  id: 'iss08', title: 'رفع المنصرف من المخازن', templateFile: '08_المنصرف_من_المخازن', sheet: 'المنصرف', perm: () => can('issues.import'),
  hint: 'كل إذن صرف في صف. المنصرف بيتقارن بالمخطط في أمر التكليف والمنفذ في المستخلصات.',
  columns: [['contract_no', 'العقد'], ['ao_no', 'أمر التكليف'], ['material_code', 'رقم الشطب'], ['qty', 'المنصرف'], ['issue_date', 'التاريخ', 'd'], ['issue_ref', 'إذن الصرف'], ['returned_qty', 'المرتجع']],
  validateRow(r, env) {
    const R = adm_r(), k = adm_contractByNo(r.contract_no), aoNo = adm_code(r.ao_no), code = adm_code(r.material_code), q = adm_num(r.qty), ret = adm_num(r.returned_qty) ?? 0, d = adm_date(r.issue_date), ref = adm_code(r.issue_ref), seen = env.seen['المنصرف'];
    if (!k) R.err(`العقد ${adm_code(r.contract_no) || '(فاضي)'} مش متسجل`);
    const ao = k && DB.aos.find(a => a.contractId === k.id && a.no === aoNo);
    if (k && !ao) R.err(`أمر التكليف ${aoNo || '(فاضي)'} مش على العقد ده`);
    if (ao && S.user.scope.type !== 'all' && !adm_aoIn(ao.id)) R.err('أمر التكليف ده خارج نطاقك');
    if (!code) R.err('رقم الشطب فاضي'); else if (!material(code)) R.err(`الصنف ${code} مش في الكتالوج`);
    if (q == null || isNaN(q) || q < 0) R.err('الكمية المنصرفة لازم رقم'); if (isNaN(ret) || ret < 0) R.err('الكمية المرتجعة لازم رقم موجب');
    if (!q && !ret) R.err('مفيش كمية منصرفة ولا مرتجعة');
    if (!d) R.err(d === false ? 'تاريخ الصرف مش مفهوم' : 'تاريخ الصرف إلزامي'); else if (d > iso(TODAY)) R.warn('تاريخ الصرف في المستقبل');
    if (!ref) R.err('رقم إذن الصرف إلزامي');
    const key = `${aoNo}|${code}|${ref}`; if (seen[key]) R.err(`نفس الإذن متكرر (صف ${seen[key]})`); seen[key] = r.__row;
    if (ao && material(code) && !R.errs.length) {
      R.data.aoId = ao.id;
      const ex = DB.materialIssues.find(x => x.aoId === ao.id && x.code === code && x.ref === ref); if (ex) R.st = 'upd';
      const plan = (DB.aoMaterials.find(x => x.aoId === ao.id && x.code === code) || {}).plannedQty;
      env.cum = env.cum || {}; const ck = ao.id + '|' + code; env.cum[ck] = (env.cum[ck] || 0) + (q || 0) - ret;
      const tot = sum(DB.materialIssues.filter(x => x.aoId === ao.id && x.code === code && x !== ex), x => x.qty) + env.cum[ck];
      if (!plan) R.warn('الصنف مش مخطط في أمر التكليف');
      else if (tot > plan * 1.1) R.warn(`المنصرف التراكمي ${qty(tot)} أكبر من المخطط ${qty(plan)}`);
    }
    return R;
  },
  onCommit(v) {
    v['المنصرف'].forEach(({ row: r, res }) => {
      const code = adm_code(r.material_code), ref = adm_code(r.issue_ref), q = adm_num(r.qty) || 0, ret = adm_num(r.returned_qty) || 0;
      let x = DB.materialIssues.find(y => y.aoId === res.data.aoId && y.code === code && y.ref === ref);
      if (!x) { x = { id: uid('mi'), aoId: res.data.aoId, code, ref }; DB.materialIssues.push(x); }
      Object.assign(x, { qty: Math.round((q - ret) * 1000) / 1000, issuedQty: q, returnedQty: ret, date: adm_date(r.issue_date) });
    });
  },
  sample() {
    const ao = byId('aos', 'ao1') || DB.aos[0], k = byId('contracts', ao.contractId), m = DB.aoMaterials.filter(x => x.aoId === ao.id), un = DB.materials.find(x => !m.some(y => y.code === x.code));
    const ao2 = DB.aos.find(a => a.id !== ao.id && a.contractId === ao.contractId) || ao, m2 = DB.aoMaterials.find(x => x.aoId === ao2.id);
    return { 'المنصرف': adm_rows([
      ...(m[0] ? [{ contract_no: k.no, ao_no: ao.no, material_code: m[0].code, qty: Math.round(m[0].plannedQty * 10) / 100 || 1, issue_date: fmtD(addWd(TODAY, -2)), issue_ref: 'إذن صرف 7781', returned_qty: '' }] : []),
      ...(m2 ? [{ contract_no: k.no, ao_no: ao2.no, material_code: m2.code, qty: Math.round(m2.plannedQty * 20) / 100 || 1, issue_date: fmtD(addWd(TODAY, -1)), issue_ref: 'إذن صرف 7790', returned_qty: Math.round(m2.plannedQty * 2) / 100 || '' }] : []),
      ...(un ? [{ contract_no: k.no, ao_no: ao.no, material_code: un.code, qty: 2, issue_date: fmtD(TODAY), issue_ref: 'إذن صرف 7802', returned_qty: '' }] : []),
      { contract_no: k.no, ao_no: 'WO-0000', material_code: '1.1.4', qty: 1, issue_date: fmtD(TODAY), issue_ref: 'إذن صرف 7803', returned_qty: '' },
      { contract_no: k.no, ao_no: ao.no, material_code: '1.1.4', qty: 1, issue_date: 'بكرة', issue_ref: '', returned_qty: '' },
    ]) };
  },
});
/* 12 الأجازات الرسمية */
adm_uploader({
  id: 'hol12', title: 'رفع الأجازات الرسمية', templateFile: '12_الأجازات_الرسمية', sheet: 'الأجازات', perm: () => can('workflow.config'),
  hint: 'الأيام دي مش بتتحسب في الـ SLA — غير الجمعة والسبت.',
  columns: [['date', 'التاريخ', 'd'], ['name', 'المناسبة']],
  validateRow(r, env) {
    const R = adm_r(), d = adm_date(r.date), seen = env.seen['الأجازات'];
    if (!d) R.err(d === false ? 'التاريخ مش مفهوم (يوم/شهر/سنة)' : 'التاريخ فاضي');
    if (!adm_code(r.name)) R.err('اسم المناسبة فاضي');
    if (d) { if (seen[d]) R.err(`التاريخ متكرر (صف ${seen[d]})`); seen[d] = r.__row; if (DB.holidays.includes(d)) R.st = 'upd'; const w = new Date(d + 'T00:00:00').getDay(); if (w === 5 || w === 6) R.warn(`اليوم ده ${ADM_DAYS[w]} — أصلاً مش بيتحسب`); }
    return R;
  },
  onCommit(v) { v['الأجازات'].forEach(({ row: r }) => { const d = adm_date(r.date); if (!DB.holidays.includes(d)) DB.holidays.push(d); DB.holidayNames[d] = adm_code(r.name); }); DB.holidays.sort(); },
  sample: () => ({ 'الأجازات': adm_rows([{ date: '07/01/2027', name: 'عيد الميلاد المجيد' }, { date: '25/01/2027', name: 'عيد الشرطة وثورة يناير' }, { date: '06/10/2026', name: 'عيد القوات المسلحة' }, { date: '16/10/2026', name: 'يوم جمعة' }, { date: 'بكرة', name: 'تاريخ غلط' }]) }),
});

/* ═════════════════════════ 1) الهيكل والمشاريع ═════════════════════════ */
function adm_tog(key) { const o = adm_st().open; o[key] = !o[key]; render(); }
function adm_sel(t, id) { const st = adm_st(); st.sel = { t, id }; adm_path(t, id).forEach(x => { st.open[x.t + ':' + x.n.id] = 1; }); render(); }
function adm_treeAll(on) { const st = adm_st(); st.open = {}; if (on) ADM_ORDER.forEach(t => DB[t].forEach(n => { st.open[t + ':' + n.id] = 1; })); render(); }
function adm_hit(t, n, q) { return (n.name + ' ' + n.id).toLowerCase().includes(q) || adm_kids(t, n.id).some(k => k.t !== 'projects' && adm_hit(k.t, k.n, q)); }
function adm_tNode(t, n, depth, q, cnt, st) {
  if (q && !adm_hit(t, n, q)) return '';
  const L = ADM_LV[t], key = t + ':' + n.id, kids = adm_kids(t, n.id).filter(k => k.t !== 'projects');
  const open = q ? true : !!st.open[key], sel = st.sel && st.sel.t === t && st.sel.id === n.id, c = cnt[key] || 0;
  const row = `<div role="treeitem" aria-level="${depth + 1}" aria-selected="${!!sel}" ${kids.length ? `aria-expanded="${open}"` : ''} tabindex="0" onclick="adm_sel(${adm_q(t)},${adm_q(n.id)})" onkeydown="if(event.key==='Enter')adm_sel(${adm_q(t)},${adm_q(n.id)})"
    style="display:flex;align-items:center;gap:6px;padding:5px 8px;padding-inline-start:${6 + depth * 20}px;border-radius:var(--r);cursor:pointer;${sel ? 'background:var(--sel);color:var(--brand-tx);font-weight:600' : ''}">
    ${kids.length ? `<button class="btn sm icon gh" onclick="event.stopPropagation();adm_tog(${adm_q(key)})" aria-label="${open ? 'قفل' : 'فتح'} ${esc(n.name)}">${icon(open ? 'chevron-down' : 'chevron-left')}</button>` : '<span style="width:28px;flex:none"></span>'}
    <span style="color:${t === 'techUnits' ? 'var(--in6)' : 'var(--brand-tx)'};display:inline-flex">${icon(L.icon)}</span>
    <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.name)}</span>
    <span class="sm mut num">${esc(n.id)}</span>${c ? `<span class="bd n num" title="مستخلصات">${c}</span>` : ''}</div>`;
  return row + (open ? kids.map(k => adm_tNode(k.t, k.n, depth + 1, q, cnt, st)).join('') : '');
}
function adm_nodeDetail(st, cnt, edit) {
  const n = st.sel && byId(st.sel.t, st.sel.id);
  if (!n) return `<div class="card">${emptyState('mouse-pointer-click', 'اختار أي مستوى من الشجرة', '<div>هتشوف تفاصيله واللي تحته، وتقدر تعدّل أو تضيف.</div>')}</div>`;
  const t = st.sel.t, L = ADM_LV[t], path = adm_path(t, n.id), kids = adm_kids(t, n.id), users = t === 'techUnits' ? DB.users.filter(u => u.role === 'tech_affairs' && u.scope.type === 'sector' && u.scope.id === n.sectorId) : adm_scopeUsers(t, n.id);
  const parent = path.length > 1 ? path[path.length - 2].n : null;
  const kidTypes = L.kids;
  return `<div class="card"><div class="ch"><span class="bd p">${icon(L.icon)} ${L.one}</span><h3 style="flex:1;min-width:0">${esc(n.name)}</h3>
    ${edit ? `${adm_btnEdit(`adm_form(${adm_q(t)},${adm_q(n.id)})`)}${adm_btnDel(`adm_del(${adm_q(t)},${adm_q(n.id)})`)}` : ''}</div>
    <div class="cb stack">
      <div class="crumbs" style="margin:0">${adm_pathTxt(t, n.id)}</div>
      <div class="kv"><div><span>الكود</span><b class="num">${esc(n.id)}</b></div><div><span>تابع لـ</span><b>${parent ? esc(parent.name) : '—'}</b></div><div><span>مستخلصات</span><b class="num">${cnt[t + ':' + n.id] || 0}</b></div><div><span>${t === 'techUnits' ? 'المراجعين' : 'مستخدمين على النطاق'}</span><b class="num">${users.length}</b></div>${n.gmEmail ? `<div><span>إيميل المدير العام</span><b class="sm" dir="ltr">${esc(n.gmEmail)}</b></div>` : ''}</div>
      ${t === 'techUnits' ? `<div class="alert i">${icon('info')}<div>الشئون الفنية بتراجع مستخلصات القطاع كله (${esc((byId('sectors', n.sectorId) || {}).name || '—')}).</div></div>` : ''}
      ${edit && kidTypes.length ? `<div class="row">${kidTypes.map(k => `<button class="btn sm" onclick="${k === 'projects' ? `adm_form('projects',null,${adm_q({ centralId: n.id })})` : `adm_form(${adm_q(k)},null,${adm_q({ [ADM_LV[k].fk]: n.id })})`}">${icon('plus')} ${ADM_LV[k].one}</button>`).join('')}</div>` : ''}
      ${kidTypes.map(k => { const list = kids.filter(x => x.t === k); return `<div><div class="sm b mut" style="margin-bottom:4px">${ADM_LV[k].many} <span class="num">(${list.length})</span></div>${list.length ? `<div class="tw"><table><tbody>${list.map(x => `<tr class="click" onclick="${k === 'projects' ? `adm_form('projects',${adm_q(x.n.id)})` : `adm_sel(${adm_q(k)},${adm_q(x.n.id)})`}"><td>${icon(ADM_LV[k].icon)} ${esc(x.n.name)}</td><td class="sm mut num">${esc(x.n.id)}</td><td class="n">${N(cnt[k + ':' + x.n.id] || 0)} <span class="sm mut">مستخلص</span></td></tr>`).join('')}</tbody></table></div>` : `<div class="sm mut">لسه مفيش ${ADM_LV[k].many} تحته</div>`}</div>`; }).join('')}
      ${users.length ? `<div><div class="sm b mut" style="margin-bottom:4px">${t === 'techUnits' ? 'المراجعين' : 'المستخدمين على النطاق ده'}</div><div class="row">${users.map(u => `<span class="bd n">${esc(u.name)} · ${esc(DB.roles[u.role].label)}</span>`).join('')}</div></div>` : ''}
    </div></div>`;
}
View.register('org', {
  title: 'الهيكل والمشاريع',
  render() {
    if (!adm_nav('org')) return adm_denied('الهيكل والمشاريع', 'الشاشة دي لمدير النظام وفريق المتابعة PMO.');
    const st = adm_st(), cnt = adm_invCount(), edit = adm_orgEdit();
    const tabs = [['tree', 'الهيكل', DB.centrals.length, 'network'], ['projects', 'المشروعات', DB.projects.length, 'folder-kanban'], ['types', 'أنواع المشروعات', DB.projectTypes.length, 'layers'], ['companies', 'الشركات', DB.companies.length, 'briefcase']];
    const up = { tree: adm_upBtn('org01', 'رفع الهيكل'), projects: adm_upBtn('org02', 'رفع المشروعات'), types: adm_upBtn('org02', 'رفع المشروعات'), companies: adm_upBtn('org03', 'رفع الشركات') }[st.orgTab] || '';
    const add = edit ? { tree: `<button class="btn pr" onclick="adm_form('presidencies')">${icon('plus')} رئاسة قطاعات</button>`, projects: `<button class="btn pr" onclick="adm_form('projects')">${icon('plus')} مشروع</button>`, types: `<button class="btn pr" onclick="adm_form('projectTypes')">${icon('plus')} نوع مشروع</button>`, companies: `<button class="btn pr" onclick="adm_form('companies')">${icon('plus')} شركة</button>` }[st.orgTab] : '';
    let body = '';
    if (st.orgTab === 'tree') body = adm_orgTree(st, cnt, edit);
    else if (st.orgTab === 'projects') body = adm_orgProjects(st, cnt, edit);
    else if (st.orgTab === 'types') body = adm_orgTypes(cnt, edit);
    else body = adm_orgCompanies(cnt, edit);
    return pageHeader({ title: 'الهيكل والمشاريع', sub: 'الرئاسات والقطاعات والإدارات والسنترالات، والمشروعات والشركات', actions: up + add })
      + `<div class="alert p mb">${icon('info')}<div><b>الهيكل بيضيفه مدير النظام</b> — والمستخلصات بتورث مكانها في الهيكل من أمر التكليف ← المشروع ← السنترال.</div></div>`
      + `<div class="grid g5 mb">${[['presidencies', 'landmark'], ['sectors', 'building-2'], ['gdepts', 'building'], ['depts', 'briefcase'], ['centrals', 'radio-tower']].map(([t, ic]) => kpi(ic, ADM_LV[t].many, DB[t].length, t === 'sectors' ? `${DB.techUnits.length} شئون فنية` : '')).join('')}</div>`
      + adm_tabs(st.orgTab, tabs, "adm_set.bind(null,'orgTab')") + body + adm_upLog(['01_الهيكل_التنظيمي', '02_المشروعات', '03_الشركات']);
  },
});
function adm_orgTree(st, cnt, edit) {
  const q = st.q.trim().toLowerCase();
  const rows = DB.presidencies.map(p => adm_tNode('presidencies', p, 0, q, cnt, st)).join('');
  return `<div class="grid g21"><div class="card"><div class="ch"><h3>شجرة الهيكل</h3><span class="sp"></span><button class="btn sm gh" onclick="adm_treeAll(1)">${icon('chevrons-down')} فتح الكل</button><button class="btn sm gh" onclick="adm_treeAll(0)">${icon('chevrons-up')} قفل الكل</button></div>
    <div class="fbar" style="grid-template-columns:minmax(0,1fr)"><input class="in" id="adm-tq" placeholder="دوّر باسم أو كود…" value="${esc(st.q)}" oninput="adm_type('q',this)" aria-label="بحث في الهيكل"></div>
    <div class="cb" role="tree" aria-label="الهيكل التنظيمي" style="padding:8px">${rows || emptyState('search-x', 'مفيش نتايج', q ? '<div>جرّب كلمة تانية</div>' : '')}</div>
    <div class="cf"><span class="legend">${['presidencies', 'sectors', 'techUnits', 'gdepts', 'depts', 'centrals'].map(t => `<span>${icon(ADM_LV[t].icon)} ${ADM_LV[t].one}</span>`).join('')}</span></div></div>
    ${adm_nodeDetail(st, cnt, edit)}</div>`;
}
function adm_orgProjects(st, cnt, edit) {
  const q = st.pq.trim();
  const rows = DB.projects.filter(p => (!st.ptype || p.typeId === st.ptype) && (!q || [p.name, p.id, (byId('centrals', p.centralId) || {}).name].join(' ').includes(q)));
  return `<div class="card"><div class="fbar"><input class="in" id="adm-pq" placeholder="دوّر بالمشروع أو السنترال…" value="${esc(st.pq)}" oninput="adm_type('pq',this)" aria-label="بحث في المشروعات">${select('adm-pt', [['', 'كل الأنواع'], ...DB.projectTypes.map(t => [t.id, t.name])], st.ptype, `onchange="adm_set('ptype',this.value)" aria-label="نوع المشروع"`)}</div>
    ${rows.length ? `<div class="tw"><table><thead><tr><th>الكود</th><th>المشروع</th><th>النوع</th><th>السنترال</th><th>المكان في الهيكل</th><th class="n">أوامر تكليف</th><th class="n">مستخلصات</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${rows.map(p => {
      const c = byId('centrals', p.centralId), path = adm_path('centrals', p.centralId).slice(0, -1).reverse();
      return `<tr><td class="sm num">${esc(p.id)}</td><td><b>${esc(p.name)}</b>${p.notes ? `<div class="sm mut">${esc(p.notes)}</div>` : ''}</td><td><span class="bd n">${esc((byId('projectTypes', p.typeId) || {}).name || '—')}</span></td><td>${esc(c ? c.name : '—')}</td><td class="sm mut">${path.map(x => esc(x.n.name)).join(' · ') || '—'}</td><td class="n">${N(DB.aos.filter(a => a.projectId === p.id).length)}</td><td class="n">${N(cnt['projects:' + p.id] || 0)}</td>${edit ? `<td class="n" style="white-space:nowrap">${adm_btnEdit(`adm_form('projects',${adm_q(p.id)})`)}${adm_btnDel(`adm_del('projects',${adm_q(p.id)})`)}</td>` : ''}</tr>`;
    }).join('')}</tbody></table></div>` : emptyState('folder-search', 'مفيش مشروعات بالفلتر ده')}</div>`;
}
function adm_orgTypes(cnt, edit) {
  return `<div class="card"><div class="ch"><h3>أنواع المشروعات</h3><span class="sub">النوع بيحدد المستندات الإلزامية في المستخلص (بتتظبط من شاشة المسار)</span></div>${DB.projectTypes.length ? `<div class="tw"><table><thead><tr><th>الكود</th><th>النوع</th><th class="n">مشروعات</th><th class="n">مستندات إلزامية</th><th class="n">مستخلصات</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${DB.projectTypes.map(t => `<tr><td class="sm num">${esc(t.id)}</td><td><b>${esc(t.name)}</b></td><td class="n">${N(DB.projects.filter(p => p.typeId === t.id).length)}</td><td class="n">${N((DB.requiredDocs[t.id] || []).length)}</td><td class="n">${N(cnt['projectTypes:' + t.id] || 0)}</td>${edit ? `<td class="n" style="white-space:nowrap">${adm_btnEdit(`adm_form('projectTypes',${adm_q(t.id)})`)}${adm_btnDel(`adm_del('projectTypes',${adm_q(t.id)})`)}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : emptyState('layers', 'مفيش أنواع مشروعات')}</div>`;
}
function adm_orgCompanies(cnt, edit) {
  return `<div class="card">${DB.companies.length ? `<div class="tw"><table><thead><tr><th>الكود</th><th>الشركة</th><th>إيميل المستخلصات</th><th>التليفون</th><th class="n">عقود</th><th class="n">مستخدمين</th><th class="n">مستخلصات</th>${edit ? '<th></th>' : ''}</tr></thead><tbody>${DB.companies.map(c => `<tr><td class="sm num">${esc(c.id)}</td><td><b>${esc(c.name)}</b><div class="sm mut">${esc(c.fullName || '')}</div></td><td class="sm" dir="ltr" style="text-align:end">${esc(c.email || '—')}</td><td class="sm num">${esc(c.phone || '—')}</td><td class="n">${N(DB.contracts.filter(k => k.companyId === c.id).length)}</td><td class="n">${N(adm_scopeUsers('companies', c.id).length)}</td><td class="n">${N(cnt['companies:' + c.id] || 0)}</td>${edit ? `<td class="n" style="white-space:nowrap">${adm_btnEdit(`adm_form('companies',${adm_q(c.id)})`)}${adm_btnDel(`adm_del('companies',${adm_q(c.id)})`)}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : emptyState('briefcase', 'مفيش شركات لسه')}</div>`;
}

/* ═════════════════════════ 2) العقود وأوامر التكليف ═════════════════════════ */
function adm_contracts() {
  const u = S.user;
  if (u.scope.type === 'all') return DB.contracts;
  if (isCompany()) return DB.contracts.filter(k => k.companyId === u.scope.id);
  return DB.contracts.filter(k => DB.aos.some(a => a.contractId === k.id && adm_aoIn(a.id)));
}
const adm_aosOf = kid => DB.aos.filter(a => a.contractId === kid && (S.user.scope.type === 'all' || adm_aoIn(a.id)));
/** المفوتر (إجمالي معتمد) وعدد المستخلصات لكل أمر تكليف — غير المسودات */
function adm_billed() { const m = {}; DB.invoices.forEach(i => { if (i.status === 'draft') return; const x = m[i.aoId] = m[i.aoId] || { gross: 0, n: 0 }; try { x.gross += invTotals(i).gross; } catch (e) {} x.n++; }); return m; }
function adm_openContract(id) { const st = adm_st(); st.contract = id; st.ctab = 'boq'; st.bq = ''; render(); window.scrollTo(0, 0); }
View.register('contracts', {
  title: 'العقود وأوامر التكليف',
  render() {
    if (!adm_nav('contracts')) return adm_denied('العقود وأوامر التكليف');
    const st = adm_st(), list = adm_contracts();
    if (st.contract) { const k = list.find(x => x.id === st.contract); if (k) return adm_contractDetail(k); }
    return adm_contractList(list);
  },
});
function adm_contractList(list) {
  const st = adm_st(), billed = adm_billed(), co = isCompany();
  const info = k => { const aos = adm_aosOf(k.id), items = DB.contractItems.filter(i => i.contractId === k.id && !i.isGroup); const val = sum(aos, a => aoValue(a.id)), b = sum(aos, a => (billed[a.id] || {}).gross); return { aos, val, b, items: items.length, noPrice: items.filter(i => i.unitPrice == null).length }; };
  const q = st.cq.trim();
  const rows = list.filter(k => (!st.cco || k.companyId === st.cco) && (!q || [k.no, k.title, (byId('companies', k.companyId) || {}).name].join(' ').includes(q))).map(k => ({ k, ...info(k) }));
  const all = list.map(k => info(k)), tv = sum(all, x => x.val), tb = sum(all, x => x.b);
  return pageHeader({ title: 'العقود وأوامر التكليف', sub: co ? 'عقود شركتك وأوامر التكليف عليها — للعرض بس' : 'المقايسة والأسعار وأوامر التكليف والمفوتر عليها', actions: co ? '' : adm_upBtn('contract05', 'رفع عقد ومقايسة') + adm_upBtn('ao06', 'رفع أمر تكليف', {}, 'pr') })
    + (co ? `<div class="alert i mb">${icon('eye')}<div>دي بيانات عقودك زي ما هي متسجلة عند المصرية للاتصالات. لو فيه اختلاف كلّم الشئون الفنية.</div></div>` : '')
    + `<div class="grid g4 mb">${kpi('file-signature', 'العقود', list.length)}${kpi('clipboard-list', 'أوامر التكليف', sum(all, x => x.aos.length))}${kpi('wallet', 'قيمة أوامر التكليف', mShort(tv), 'جنيه — الكميات × أسعار العقد')}${kpi('receipt', 'المفوتر لحد دلوقتي', mShort(tb), `${pct(tb, tv).toFixed(0)}% من قيمة الأوامر`)}</div>`
    + `<div class="card"><div class="fbar"><input class="in" id="adm-cq" placeholder="دوّر برقم العقد أو الموضوع…" value="${esc(st.cq)}" oninput="adm_type('cq',this)" aria-label="بحث في العقود">${co ? '' : select('adm-cco', [['', 'كل الشركات'], ...DB.companies.map(c => [c.id, c.name])], st.cco, `onchange="adm_set('cco',this.value)" aria-label="الشركة"`)}</div>
    ${rows.length ? `<div class="tw"><table><thead><tr><th>رقم العقد</th>${co ? '' : '<th>الشركة</th>'}<th>الموضوع</th><th class="n">البنود</th><th class="n">أوامر التكليف</th><th class="n">قيمة الأوامر</th><th style="min-width:150px">المفوتر</th></tr></thead><tbody>${rows.map(x => `<tr class="click" onclick="adm_openContract(${adm_q(x.k.id)})"><td><b class="num">${esc(x.k.no)}</b></td>${co ? '' : `<td>${esc((byId('companies', x.k.companyId) || {}).name || '—')}</td>`}<td>${esc(x.k.title || '')}${x.noPrice ? `<div><span class="bd a">${x.noPrice} بند مالوش سعر</span></div>` : ''}</td><td class="n">${N(x.items)}</td><td class="n">${N(x.aos.length)}</td><td class="n"><span class="money">${money(x.val)}</span></td><td><span class="money sm">${money(x.b)}</span>${adm_prog(pct(x.b, x.val))}</td></tr>`).join('')}</tbody></table></div>` : emptyState('file-search', list.length ? 'مفيش عقود بالفلتر ده' : 'مفيش عقود في نطاقك', list.length ? '' : '<div>العقود بتظهر هنا لما يبقى عليها أوامر تكليف في نطاقك.</div>')}</div>`
    + (co ? '' : adm_upLog(['05_العقد_والمقايسة', '06_أمر_التكليف']));
}
function adm_contractDetail(k) {
  const st = adm_st(), co = byId('companies', k.companyId) || {}, aos = adm_aosOf(k.id), billed = adm_billed(), imp = can('master.import') && !isCompany();
  const items = DB.contractItems.filter(i => i.contractId === k.id).sort((a, b) => adm_cmpNo(a.itemNo, b.itemNo));
  const leaf = items.filter(i => !i.isGroup), noPrice = leaf.filter(i => i.unitPrice == null).length;
  const val = sum(aos, a => aoValue(a.id)), b = sum(aos, a => (billed[a.id] || {}).gross);
  const crumbs = `<div class="crumbs"><a onclick="adm_openContract(null)">العقود وأوامر التكليف</a>${icon('chevron-left')}<span>${esc(k.no)}</span></div>`;
  const head = crumbs + pageHeader({ title: `عقد <span class="num">${esc(k.no)}</span>`, sub: `${esc(co.fullName || co.name || '—')} — ${esc(k.title || '')}`, actions: `<button class="btn" onclick="adm_openContract(null)">${icon('arrow-right')} رجوع</button>` + (imp ? adm_upBtn('contract05', 'تحديث المقايسة', { contractId: k.id }) + adm_upBtn('ao06', 'رفع أمر تكليف', { contractId: k.id }, 'pr') : '') });
  const kv = `<div class="card mb"><div class="cb"><div class="kv">${[['الشركة', esc(co.name || '—')], ['العملة', esc(k.currency || '—')], ['ضريبة القيمة المضافة', N(qty(k.vatPct) + '%')], ['جدول الصرف', N(`${qty(k.payMonthlyPct || 100)}% شهري` + (k.asbuiltPct ? ` / ${qty(k.asbuiltPct)}% As-Built` : '') + (k.handoverPct ? ` / ${qty(k.handoverPct)}% تسليم` : ''))], ['خطاب الضمان النهائي', N(qty(k.finalGuaranteePct || 0) + '%')], ['غرامة التأخير', k.delayFinePctWeek ? N(`${qty(k.delayFinePctWeek)}% أسبوعياً (حد ${qty(k.delayFineCapPct)}%)`) : 'مش محددة'], ['الضمان الفني', N((k.warrantyMonths || 0) + ' شهر')], ['تاريخ البدء', N(fmtD(k.start))], ['قيمة أوامر التكليف', `<span class="money">${money(val)}</span>`], ['المفوتر', `<span class="money">${money(b)}</span> <span class="sm mut num">(${pct(b, val).toFixed(0)}%)</span>`]].map(([l, v]) => `<div><span>${l}</span><b>${v}</b></div>`).join('')}</div></div></div>`;
  const tabs = adm_tabs(st.ctab, [['boq', 'المقايسة', leaf.length, 'list-tree'], ['aos', 'أوامر التكليف', aos.length, 'clipboard-list']], "adm_set.bind(null,'ctab')");
  let body;
  if (st.ctab === 'aos') {
    body = `<div class="card">${aos.length ? `<div class="tw"><table><thead><tr><th>أمر التكليف</th><th>المشروع</th><th class="n">القيمة</th><th>المواقع</th><th style="min-width:160px">المفوتر</th><th class="n">مستخلصات</th><th>الملاحق</th></tr></thead><tbody>${aos.map(a => {
      const c = aoCtx(a.id), v = aoValue(a.id), bb = billed[a.id] || { gross: 0, n: 0 }, sites = DB.aoSites.filter(s => s.aoId === a.id), revs = (a.revisions || []).filter(r => r.n > 0), p = pct(bb.gross, v);
      return `<tr class="click ${p > 100 ? 'flag' : ''}" onclick="adm_openAo(${adm_q(a.id)})"><td><b class="num">${esc(a.no)}</b><div class="sm mut num">${fmtD(a.date)}</div></td><td>${esc(c.project.name)}<div class="sm mut">${esc(c.central.name)} · ${esc(c.dept.name)}</div></td><td class="n"><span class="money">${money(v)}</span></td><td>${sites.length ? `<div class="row" style="gap:4px">${sites.slice(0, 4).map(s => `<span class="bd n num">${esc(s.code)}</span>`).join('')}${sites.length > 4 ? `<span class="sm mut">+${sites.length - 4}</span>` : ''}</div>` : '<span class="mut">—</span>'}</td><td><span class="money sm">${money(bb.gross)}</span>${adm_prog(p)}</td><td class="n">${N(bb.n)}</td><td>${revs.length ? `<span class="bd p">${revs.length} ملحق</span>` : '<span class="mut sm">الأصلي</span>'}</td></tr>`;
    }).join('')}</tbody></table></div>` : emptyState('clipboard-list', 'مفيش أوامر تكليف على العقد ده', imp ? '<div>ارفع أمر تكليف من القالب.</div>' : '')}</div>`;
  } else {
    const plan = {}, bill = {};
    DB.aoItems.forEach(x => { if (aos.some(a => a.id === x.aoId)) plan[x.itemId] = (plan[x.itemId] || 0) + x.plannedQty; });
    DB.invoices.forEach(i => { if (i.status === 'draft' || !aos.some(a => a.id === i.aoId)) return; curRev(i).lines.forEach(l => { if (l.itemId) bill[l.itemId] = (bill[l.itemId] || 0) + (l.approvedQty ?? l.qty); }); });
    const q = st.bq.trim().toLowerCase(), shown = q ? items.filter(i => (i.itemNo + ' ' + i.description).toLowerCase().includes(q)) : items;
    body = (noPrice ? `<div class="alert mb">${icon('alert-triangle')}<div><b>${noPrice} بند مالوش سعر في العقد</b> — أي فوترة عليهم بتتصنّف C5 وبتروح للتسعير.</div></div>` : '')
      + `<div class="card"><div class="fbar" style="grid-template-columns:minmax(0,1fr)"><input class="in" id="adm-bq" placeholder="دوّر برقم البند أو الوصف…" value="${esc(st.bq)}" oninput="adm_type('bq',this)" aria-label="بحث في المقايسة"></div>
      ${shown.length ? `<div class="tw"><table><thead><tr><th>رقم البند</th><th>الوصف</th><th>الوحدة</th><th>نوع العمل</th><th class="n">كمية العقد</th><th class="n">سعر الوحدة</th><th class="n">المخطط في الأوامر</th><th class="n">المفوتر</th></tr></thead><tbody>${shown.map(i => {
        const lv = i.itemNo.split('-').length, pad = `padding-inline-start:${12 + (lv - 1) * 14}px`;
        if (i.isGroup) return `<tr><td class="num b" style="${pad};background:var(--brand-soft);color:var(--brand-tx)">${esc(i.itemNo)}</td><td colspan="7" class="b" style="background:var(--brand-soft);color:var(--brand-tx)">${esc(i.description)}</td></tr>`;
        const over = plan[i.id] && bill[i.id] > plan[i.id];
        return `<tr class="${over ? 'flag' : ''}"><td class="num" style="${pad}">${esc(i.itemNo)}</td><td>${esc(i.description)}</td><td class="sm">${esc(i.unit)}</td><td class="sm mut">${esc(i.workType || '—')}</td><td class="n">${N(qty(i.contractQty))}</td><td class="n">${i.unitPrice == null ? '<span class="bd a">مالوش سعر</span>' : `<span class="money">${money2(i.unitPrice)}</span>`}</td><td class="n">${N(qty(plan[i.id] || 0))}</td><td class="n ${over ? 'diff-up' : ''}">${N(qty(bill[i.id] || 0))}</td></tr>`;
      }).join('')}</tbody></table></div>` : emptyState('list-x', items.length ? 'مفيش بنود بالبحث ده' : 'المقايسة لسه فاضية', items.length ? '' : '<div>ارفع العقد والمقايسة من القالب.</div>')}</div>`;
  }
  return head + kv + tabs + body;
}
/** تفاصيل أمر التكليف: المخطط ↔ المفوتر، والمهمات المخططة ↔ المنصرف ↔ المنفذ */
function adm_openAo(aoId) {
  const c = aoCtx(aoId); if (!c) return;
  const a = c.ao, invs = aoInvoices(aoId).filter(i => i.status !== 'draft'), bill = {}, exec = {};
  invs.forEach(i => { const r = curRev(i); r.lines.forEach(l => { if (l.itemId) bill[l.itemId] = (bill[l.itemId] || 0) + (l.approvedQty ?? l.qty); }); r.materials.forEach(m => { exec[m.code] = (exec[m.code] || 0) + (m.executedQty || 0); }); });
  const items = DB.aoItems.filter(x => x.aoId === aoId).map(x => ({ ...x, it: byId('contractItems', x.itemId) })).filter(x => x.it).sort((p, q) => adm_cmpNo(p.it.itemNo, q.it.itemNo));
  const mats = DB.aoMaterials.filter(x => x.aoId === aoId), sites = DB.aoSites.filter(s => s.aoId === aoId), v = aoValue(aoId), revs = a.revisions || [];
  const imp = can('master.import') && !isCompany();
  const body = `<div class="kv">${[['العقد', `<span class="num">${esc(c.contract.no)}</span>`], ['الشركة', esc(c.company.name)], ['المشروع', esc(c.project.name)], ['السنترال', esc(c.central.name)], ['الإدارة', esc(c.dept.name)], ['التاريخ', N(fmtD(a.date))], ['القيمة', `<span class="money">${money(v)}</span>`], ['مستخلصات', N(invs.length)]].map(([l, x]) => `<div><span>${l}</span><b>${x}</b></div>`).join('')}</div>
    ${sites.length ? `<div class="row" style="gap:4px"><span class="sm mut">المواقع:</span>${sites.map(s => `<span class="bd n">${icon('map-pin')} ${esc(s.code)}</span>`).join('')}</div>` : ''}
    ${revs.length ? `<div><div class="sm b mut" style="margin-bottom:4px">الأصل والملاحق</div><div class="tw"><table><thead><tr><th>الملحق</th><th>التاريخ</th><th class="n">بنود</th><th class="n">مهمات</th><th class="n">القيمة المضافة</th><th class="n">القيمة بعده</th></tr></thead><tbody>${revs.map(r => `<tr><td>${r.n ? `<span class="bd p">ملحق ${r.n}</span>` : '<span class="bd n">الأصلي</span>'}</td><td class="sm num">${fmtD(r.date)}</td><td class="n">${N(r.items)}</td><td class="n">${N(r.mats)}</td><td class="n"><span class="money">${r.n ? '+' + money(r.added) : '—'}</span></td><td class="n"><span class="money">${money(r.value)}</span></td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div><div class="sm b mut" style="margin-bottom:4px">البنود: المخطط ↔ المفوتر التراكمي</div>${items.length ? `<div class="tw"><table><thead><tr><th>البند</th><th>الوصف</th><th class="n">المخطط</th><th class="n">المفوتر</th><th style="min-width:110px">النسبة</th></tr></thead><tbody>${items.map(x => { const bq = bill[x.itemId] || 0, p = pct(bq, x.plannedQty), over = bq > x.plannedQty; return `<tr class="${over ? 'flag' : ''}"><td class="num">${esc(x.it.itemNo)}</td><td class="sm">${esc(x.it.description)}${x.it.unitPrice == null ? ' <span class="bd a">مالوش سعر</span>' : ''}</td><td class="n">${N(qty(x.plannedQty))} <span class="sm mut">${esc(x.it.unit)}</span></td><td class="n ${over ? 'diff-up' : ''}">${N(qty(bq))}${over ? `<div class="sm">+${qty(bq - x.plannedQty)}</div>` : ''}</td><td>${adm_prog(p)}</td></tr>`; }).join('')}</tbody></table></div>` : emptyState('list-x', 'مفيش بنود مخططة')}</div>
    <div><div class="sm b mut" style="margin-bottom:4px">المهمات: المخطط ↔ المنصرف ↔ المنفذ</div>${mats.length ? `<div class="tw"><table><thead><tr><th>رقم الشطب</th><th>الصنف</th><th class="n">المخطط</th><th class="n">المنصرف</th><th class="n">المنفذ</th><th>ملاحظة</th></tr></thead><tbody>${mats.map(m => { const iss = sum(DB.materialIssues.filter(x => x.aoId === aoId && x.code === m.code), x => x.qty), ex = exec[m.code] || 0, mt = material(m.code) || {}; const f = adm_matFlags(m.plannedQty, iss, ex); return `<tr class="${f.cls === 'r' ? 'flag' : f.cls === 'a' ? 'warn' : ''}"><td class="num">${esc(m.code)}</td><td class="sm">${esc(mt.description || '—')} <span class="mut">${esc(mt.unit || '')}</span></td><td class="n">${N(qty(m.plannedQty))}</td><td class="n ${iss > m.plannedQty ? 'diff-up' : ''}">${N(qty(iss))}</td><td class="n ${ex > iss ? 'diff-up' : ''}">${N(qty(ex))}</td><td>${f.list.map(x => `<span class="bd ${x.cls}">${esc(x.t)}</span>`).join(' ') || '<span class="bd g">مظبوط</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : emptyState('package', 'مفيش مهمات مخططة')}</div>`;
  modal(`أمر التكليف <span class="num">${esc(a.no)}</span>`, body, `${imp ? `<button class="btn pr" onclick="adm_openUp('ao06',${adm_q({ aoId })})">${icon('file-plus-2')} ملحق زيادة</button>` : ''}${invs.length ? `<button class="btn" onclick="closeModal();openInv(${adm_q(invs[invs.length - 1].id)})">${icon('file-text')} آخر مستخلص</button>` : ''}<span class="sp1"></span><button class="btn" onclick="closeModal()">إغلاق</button>`, { size: 'lg' });
}
/** علامات المهمات: مخطط/منصرف/منفذ */
function adm_matFlags(planned, issued, executed) {
  const list = [];
  if (!planned) list.push({ cls: 'r', t: 'مش مخطط في أمر التكليف' });
  if (executed > issued + 1e-9) list.push({ cls: 'r', t: 'المنفذ أكبر من المنصرف' });
  if (planned && issued > planned * 1.1) list.push({ cls: 'a', t: 'المنصرف أكبر من المخطط' });
  if (issued - executed > Math.max(5, issued * 0.15)) list.push({ cls: 'a', t: 'رصيد منصرف عند الشركة' });
  return { list, cls: list.some(x => x.cls === 'r') ? 'r' : list.length ? 'a' : '' };
}

/* ═════════════════════════ 3) المهمات المنصرفة ═════════════════════════ */
View.register('issues', {
  title: 'المهمات المنصرفة',
  render() {
    if (!adm_nav('issues')) return adm_denied('المهمات المنصرفة', 'الشاشة دي للمخازن والمشتريات والشئون الفنية والمتابعة.');
    const st = adm_st(), all = S.user.scope.type === 'all';
    const aosAll = DB.aos.filter(a => all || adm_aoIn(a.id));
    const kIds = [...new Set(aosAll.map(a => a.contractId))], aos = aosAll.filter(a => (!st.fk || a.contractId === st.fk) && (!st.fao || a.id === st.fao));
    const aoSet = new Set(aos.map(a => a.id));
    const issues = DB.materialIssues.filter(x => aoSet.has(x.aoId) && (!st.fmat || x.code === st.fmat)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    // ملخص لكل أمر تكليف × صنف
    const sumRows = [];
    aos.forEach(a => {
      const exec = {}, billed = {};
      aoInvoices(a.id).filter(i => i.status !== 'draft').forEach(i => curRev(i).materials.forEach(m => { exec[m.code] = (exec[m.code] || 0) + (m.executedQty || 0); billed[m.code] = (billed[m.code] || 0) + (m.billedQty ?? m.executedQty ?? 0); }));
      const codes = new Set([...DB.aoMaterials.filter(x => x.aoId === a.id).map(x => x.code), ...DB.materialIssues.filter(x => x.aoId === a.id).map(x => x.code), ...Object.keys(exec)]);
      [...codes].filter(c => !st.fmat || c === st.fmat).sort().forEach(code => {
        const planned = (DB.aoMaterials.find(x => x.aoId === a.id && x.code === code) || {}).plannedQty || 0, issued = sum(DB.materialIssues.filter(x => x.aoId === a.id && x.code === code), x => x.qty), ex = exec[code] || 0;
        sumRows.push({ a, code, planned, issued, ex, billed: billed[code] || 0, f: adm_matFlags(planned, issued, ex) });
      });
    });
    const red = sumRows.filter(r => r.f.cls === 'r').length, amber = sumRows.filter(r => r.f.cls === 'a').length;
    const tabs = adm_tabs(st.itab, [['sum', 'ملخص أوامر التكليف', sumRows.length, 'scale'], ['list', 'أذون الصرف', issues.length, 'receipt'], ['cat', 'كتالوج المهمات', DB.materials.length, 'boxes']], "adm_set.bind(null,'itab')");
    const filt = `<div class="fbar">${select('adm-fk', [['', 'كل العقود'], ...kIds.map(id => { const k = byId('contracts', id); return [id, `${k.no} — ${(byId('companies', k.companyId) || {}).name || ''}`]; })], st.fk, `onchange="adm_st().fao='';adm_set('fk',this.value)" aria-label="العقد"`)}${select('adm-fao', [['', 'كل أوامر التكليف'], ...aosAll.filter(a => !st.fk || a.contractId === st.fk).map(a => [a.id, `${a.no} — ${(byId('projects', a.projectId) || {}).name || ''}`])], st.fao, `onchange="adm_set('fao',this.value)" aria-label="أمر التكليف"`)}${select('adm-fmat', [['', 'كل الأصناف'], ...DB.materials.map(m => [m.code, `${m.code} — ${m.description}`])], st.fmat, `onchange="adm_set('fmat',this.value)" aria-label="الصنف"`)}</div>`;
    let body;
    if (st.itab === 'cat') {
      body = `<div class="card">${DB.materials.length ? `<div class="tw"><table><thead><tr><th>رقم الشطب</th><th>الوصف</th><th>الوحدة</th><th>التوريد</th><th>المجموعة</th><th class="n">أوامر تكليف مخطط فيها</th><th class="n">إجمالي المنصرف</th></tr></thead><tbody>${DB.materials.map(m => `<tr><td class="num b">${esc(m.code)}</td><td>${esc(m.description)}</td><td class="sm">${esc(m.unit)}</td><td class="sm">${esc(m.suppliedBy || 'المصرية للاتصالات')}</td><td class="sm mut">${esc(m.group || '—')}</td><td class="n">${N(DB.aoMaterials.filter(x => x.code === m.code && aosAll.some(a => a.id === x.aoId)).length)}</td><td class="n">${N(qty(sum(DB.materialIssues.filter(x => x.code === m.code && aosAll.some(a => a.id === x.aoId)), x => x.qty)))}</td></tr>`).join('')}</tbody></table></div>` : emptyState('boxes', 'الكتالوج فاضي', '<div>ارفع كتالوج المهمات من القالب.</div>')}</div>`;
    } else if (st.itab === 'list') {
      body = `<div class="card">${filt}${issues.length ? `<div class="tw"><table><thead><tr><th>التاريخ</th><th>إذن الصرف</th><th>العقد</th><th>أمر التكليف</th><th>الصنف</th><th class="n">المنصرف</th><th class="n">المرتجع</th></tr></thead><tbody>${issues.slice(0, 400).map(x => { const a = byId('aos', x.aoId), k = byId('contracts', a.contractId), m = material(x.code) || {}; return `<tr><td class="sm num">${fmtD(x.date)}</td><td>${esc(x.ref)}</td><td class="sm num">${esc(k.no)}</td><td class="num">${esc(a.no)}</td><td><span class="num b">${esc(x.code)}</span> <span class="sm mut">${esc(m.description || '')}</span></td><td class="n">${N(qty(x.issuedQty ?? x.qty))} <span class="sm mut">${esc(m.unit || '')}</span></td><td class="n">${x.returnedQty ? N(qty(x.returnedQty)) : '<span class="mut">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : emptyState('receipt', 'مفيش أذون صرف بالفلتر ده')}</div>`;
    } else {
      body = `<div class="card">${filt}${sumRows.length ? `<div class="tw"><table><thead><tr><th>أمر التكليف</th><th>الصنف</th><th class="n">المخطط</th><th class="n">المنصرف</th><th class="n">المنفذ</th><th class="n">المفوتر</th><th class="n">الرصيد</th><th>ملاحظات</th></tr></thead><tbody>${sumRows.map(r => { const m = material(r.code) || {}; return `<tr class="${r.f.cls === 'r' ? 'flag' : r.f.cls === 'a' ? 'warn' : ''}"><td><b class="num">${esc(r.a.no)}</b><div class="sm mut">${esc((byId('projects', r.a.projectId) || {}).name || '')}</div></td><td><span class="num b">${esc(r.code)}</span><div class="sm mut">${esc(m.description || '—')} · ${esc(m.unit || '')}</div></td><td class="n">${N(qty(r.planned))}</td><td class="n ${r.planned && r.issued > r.planned * 1.1 ? 'diff-dn' : ''}">${N(qty(r.issued))}</td><td class="n ${r.ex > r.issued ? 'diff-up' : ''}">${N(qty(r.ex))}</td><td class="n">${N(qty(r.billed))}</td><td class="n">${N(qty(r.issued - r.ex))}</td><td>${r.f.list.map(x => `<span class="bd ${x.cls}">${esc(x.t)}</span>`).join(' ') || '<span class="bd g">مظبوط</span>'}</td></tr>`; }).join('')}</tbody></table></div>` : emptyState('package-search', 'مفيش مهمات بالفلتر ده')}<div class="cf">المنفذ = مجموع الكميات المنفذة في مستخلصات أمر التكليف (غير المسودات). الرصيد = المنصرف − المنفذ.</div></div>`;
    }
    return pageHeader({ title: 'المهمات المنصرفة', sub: 'المخطط في أمر التكليف ↔ المنصرف من المخازن ↔ المنفذ والمفوتر في المستخلصات', actions: adm_upBtn('mat07', 'رفع الكتالوج') + adm_upBtn('iss08', 'رفع المنصرف', {}, 'pr') })
      + `<div class="grid g4 mb">${kpi('boxes', 'أصناف في النطاق', new Set(sumRows.map(r => r.code)).size)}${kpi('receipt', 'أذون الصرف', issues.length)}${kpi('alert-octagon', 'مشاكل لازم تتراجع', red, 'منفذ أكبر من المنصرف أو صنف مش مخطط', red ? 'r' : '')}${kpi('alert-triangle', 'تحذيرات', amber, 'رصيد عند الشركة أو منصرف زيادة', amber ? 'a' : '')}</div>`
      + tabs + body + adm_upLog(['07_كتالوج_المهمات', '08_المنصرف_من_المخازن']);
  },
});

/* ═════════════════════════ 4) المستخدمين والصلاحيات ═════════════════════════ */
const ADM_PERM_AR = {
  'invoice.create': 'تقديم مستخلص جديد على البوابة',
  'invoice.viewAll': 'يشوف كل المستخلصات من غير قيود النطاق',
  'invoice.override': 'يحرّك المستخلص بدل أي محطة (تجاوز إداري)',
  'master.import': 'رفع العقود والمقايسات وأوامر التكليف والملاحق',
  'issues.import': 'رفع كتالوج المهمات والمنصرف من المخازن',
  'users.manage': 'إضافة المستخدمين وتعديل الأدوار والصلاحيات',
  'workflow.config': 'تعديل المسار والـ SLA وأسباب الإرجاع والإعدادات',
  'reports.view': 'فتح شاشة التقارير',
  'reports.export': 'تصدير التقارير Excel',
  'deductions.edit': 'تعديل الاستقطاعات والضمانات',
};
const adm_scopeOpts = type => type === 'all' ? [] : DB[ADM_SCOPE_TBL[type]].map(x => [x.id, x.name]);
function adm_deleg(u) {
  const d = DB.delegations.find(x => x.fromUserId === u.id && x.to >= iso(TODAY));
  if (d) { const t = userById(d.toUserId); return `<span class="bd a">مفوّض لـ ${esc(t ? t.name : '—')}</span><div class="sm mut num">${fmtD(d.from)} ← ${fmtD(d.to)}</div>`; }
  const b = u.delegateId && userById(u.delegateId);
  return b ? `<span class="sm">البديل: ${esc(b.name)}</span>` : '<span class="mut">—</span>';
}
function adm_invite(u, silent) {
  DB.emails.unshift({ id: uid('e'), to: u.email, toName: u.name, subject: 'دعوة للدخول على منظومة تتبع المستخلصات', body: `السيد/ ${u.name}\nتحية طيبة وبعد،\n\nتم إنشاء حساب لحضرتك على منظومة تتبع المستخلصات.\nالدور: ${(DB.roles[u.role] || {}).label || u.role}\nالنطاق: ${scopeLabel(u.scope)}\n\nحدد كلمة السر من الرابط ده (صالح 72 ساعة):\nhttps://invoices.te.eg/invite/${u.id}\n\nمنظومة تتبع المستخلصات — المصرية للاتصالات`, date: new Date(), status: 'sent' });
  u.invitedAt = new Date();
  adm_audit('invite', 'user:' + u.email, 'إرسال دعوة');
  if (!silent) { toast('اتبعتت الدعوة لـ ' + u.email, 'ok'); render(); }
}
function adm_uOpen(id) {
  const u = id ? userById(id) : null, d = u && DB.delegations.find(x => x.fromUserId === u.id && x.to >= iso(TODAY));
  adm_st().uform = u ? { id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role, stype: u.scope.type, sid: u.scope.id || '', delegateId: (d && d.toUserId) || u.delegateId || '', dfrom: d ? d.from : '', dto: d ? d.to : '' }
    : { id: null, name: '', email: '', phone: '', role: 'exec_mgr', stype: 'dept', sid: DB.depts[0] ? DB.depts[0].id : '', delegateId: '', dfrom: '', dto: '' };
  adm_uShow();
}
function adm_uRead() { const f = adm_st().uform; ['name', 'email', 'phone', 'role', 'stype', 'sid', 'delegateId', 'dfrom', 'dto'].forEach(k => { const e = document.getElementById('adm-u-' + k); if (e) f[k] = e.value; }); return f; }
function adm_uSync(what) {
  const f = adm_uRead();
  if (what === 'role') f.stype = (DB.roles[f.role] || {}).scope || 'all';
  if (what === 'role' || what === 'stype') { const o = adm_scopeOpts(f.stype); if (!o.some(x => x[0] === f.sid)) f.sid = o[0] ? o[0][0] : ''; }
  adm_uShow();
}
function adm_uShow() {
  const f = adm_st().uform, def = (DB.roles[f.role] || {}).scope, opts = adm_scopeOpts(f.stype);
  const body = `<div class="grid g2">${field('الاسم', `<input class="in" id="adm-u-name" value="${esc(f.name)}">`, { req: true, id: 'adm-u-name' })}${field('الإيميل', `<input class="in" id="adm-u-email" type="email" dir="ltr" value="${esc(f.email)}">`, { req: true, id: 'adm-u-email', hint: 'بيستخدم للدخول ولاستلام الإشعارات' })}${field('الموبايل', `<input class="in" id="adm-u-phone" dir="ltr" value="${esc(f.phone)}">`, { id: 'adm-u-phone' })}${field('الدور', select('adm-u-role', Object.entries(DB.roles).map(([k, r]) => [k, r.label]), f.role, `onchange="adm_uSync('role')"`), { req: true, id: 'adm-u-role' })}</div>
    <div class="grid g2">${field('نوع النطاق', select('adm-u-stype', Object.entries(ADM_SCOPE_T).map(([k, l]) => [k, l]), f.stype, `onchange="adm_uSync('stype')"`), { req: true, id: 'adm-u-stype', hint: def && def !== f.stype ? `<span class="e">الدور ده نطاقه المعتاد "${ADM_SCOPE_T[def]}"</span>` : 'بيتحدد أوتوماتيك من الدور — وتقدر تغيّره' })}${f.stype === 'all' ? field('النطاق', `<input class="in" readonly value="كل الجهات">`) : field(ADM_SCOPE_T[f.stype], select('adm-u-sid', opts, f.sid), { req: true, id: 'adm-u-sid' })}</div>
    <div class="alert i">${icon('eye')}<div>${esc(ADM_SCOPE_AR[f.stype] || '')}</div></div>
    <div class="grid g3">${field('البديل / المفوّض', select('adm-u-delegateId', [['', '— مفيش —'], ...DB.users.filter(u => u.id !== f.id).map(u => [u.id, `${u.name} — ${DB.roles[u.role].label}`])], f.delegateId), { id: 'adm-u-delegateId', hint: 'اللي بيستلم بداله وقت الأجازات' })}${field('التفويض من', `<input class="in" type="date" id="adm-u-dfrom" value="${esc(f.dfrom)}">`, { id: 'adm-u-dfrom', hint: 'اختياري' })}${field('لحد', `<input class="in" type="date" id="adm-u-dto" value="${esc(f.dto)}">`, { id: 'adm-u-dto' })}</div>`;
  modal(f.id ? 'تعديل مستخدم' : 'مستخدم جديد', body, `<button class="btn pr" onclick="adm_uSave(${f.id ? 'false' : 'true'})">${icon(f.id ? 'save' : 'send')} ${f.id ? 'حفظ' : 'حفظ وإرسال دعوة'}</button><button class="btn" onclick="closeModal()">إلغاء</button>`);
}
function adm_uSave(invite) {
  const f = adm_uRead(), email = adm_code(f.email).toLowerCase();
  if (!adm_code(f.name)) return toast('الاسم إلزامي', 'err');
  if (!ADM_EMAIL.test(email)) return toast('الإيميل شكله غلط', 'err');
  if (f.stype !== 'all' && !f.sid) return toast('اختار النطاق', 'err');
  const scope = f.stype === 'all' ? { type: 'all' } : { type: f.stype, id: f.sid };
  if (DB.users.some(u => u.id !== f.id && u.email.toLowerCase() === email && u.scope.type === scope.type && u.scope.id === scope.id)) return toast('فيه مستخدم بنفس الإيميل والنطاق', 'err');
  if (f.dfrom && f.dto && f.dto < f.dfrom) return toast('تاريخ نهاية التفويض قبل البداية', 'err');
  if ((f.dfrom || f.dto) && !f.delegateId) return toast('اختار المفوّض الأول', 'err');
  let u = f.id ? userById(f.id) : null;
  if (u && u.id === S.user.id && f.role !== u.role && !(DB.permissions['users.manage'] || []).includes(f.role)) return toast('مينفعش تغيّر دورك لدور مالوش إدارة المستخدمين — هتقفل على نفسك', 'err');
  const isNew = !u;
  if (!u) { u = { id: uid('u') }; DB.users.push(u); }
  Object.assign(u, { name: adm_code(f.name), email, phone: adm_code(f.phone), role: f.role, scope, delegateId: f.delegateId || null });
  DB.delegations = DB.delegations.filter(d => !(d.fromUserId === u.id && d.to >= iso(TODAY)));
  if (f.delegateId && f.dfrom && f.dto) DB.delegations.push({ fromUserId: u.id, toUserId: f.delegateId, from: f.dfrom, to: f.dto, note: 'تفويض من شاشة المستخدمين' });
  if (u.id === S.user.id) Object.assign(S.user, u);
  adm_audit(isNew ? 'create' : 'update', 'user:' + email, `${DB.roles[u.role].label} — ${scopeLabel(scope)}`);
  if (invite) adm_invite(u, true);
  closeModal(); toast(isNew ? `اتضاف ${u.name}${invite ? ' واتبعتتله دعوة' : ''}` : 'اتحفظ التعديل', 'ok');
}
function adm_permToggle(perm, role, on) {
  const arr = DB.permissions[perm] = DB.permissions[perm] || [];
  if (!on && perm === 'users.manage' && role === S.user.role) { toast('مينفعش تشيل الصلاحية دي من دورك وإنت شغال بيه — هتقفل على نفسك', 'err'); return render(); }
  if (on && !arr.includes(role)) arr.push(role);
  if (!on) DB.permissions[perm] = arr.filter(r => r !== role);
  adm_audit('permission', 'perm:' + perm, `${on ? 'إضافة' : 'شيل'} ${DB.roles[role].label}`);
  toast(`${on ? 'اتضافت' : 'اتشالت'} "${ADM_PERM_AR[perm] || perm}" ${on ? 'لـ' : 'من'} ${DB.roles[role].label}`, 'ok'); render();
}
/** العقد التنظيمية اللي في نطاق المستخدم */
function adm_scopeNodes(scope) {
  const ch = c => { const d = byId('depts', c.deptId), g = d && byId('gdepts', d.gdeptId), s = g && byId('sectors', g.sectorId), p = s && byId('presidencies', s.presidencyId); return { c, d, g, s, p }; };
  let cs = DB.centrals.map(ch).filter(x => x.p);
  const id = scope.id;
  if (scope.type === 'company') { const cids = new Set(DB.aos.filter(a => (byId('contracts', a.contractId) || {}).companyId === id).map(a => (byId('projects', a.projectId) || {}).centralId)); cs = cs.filter(x => cids.has(x.c.id)); }
  else if (scope.type !== 'all') { const f = { presidency: 'p', sector: 's', gdept: 'g', dept: 'd', central: 'c' }[scope.type]; cs = f ? cs.filter(x => x[f].id === id) : []; }
  const uniq = k => [...new Map(cs.map(x => [x[k].id, x[k]])).values()];
  return { presidencies: uniq('p'), sectors: uniq('s'), gdepts: uniq('g'), depts: uniq('d'), centrals: uniq('c') };
}
View.register('users', {
  title: 'المستخدمين والصلاحيات',
  render() {
    if (!can('users.manage')) return adm_denied('المستخدمين والصلاحيات', 'إدارة المستخدمين لمدير النظام بس.');
    const st = adm_st();
    const tabs = adm_tabs(st.utab, [['list', 'المستخدمين', DB.users.length, 'users'], ['perms', 'مصفوفة الصلاحيات', Object.keys(DB.permissions).length, 'key-round'], ['scope', 'مين يشوف إيه', null, 'scan-eye']], "adm_set.bind(null,'utab')");
    let body;
    if (st.utab === 'perms') body = adm_permMatrix();
    else if (st.utab === 'scope') body = adm_scopeTab(st);
    else {
      const q = st.uq.trim().toLowerCase();
      const rows = DB.users.filter(u => (!st.urole || u.role === st.urole) && (!q || (u.name + ' ' + u.email + ' ' + scopeLabel(u.scope)).toLowerCase().includes(q)));
      body = `<div class="card"><div class="fbar"><input class="in" id="adm-uq" placeholder="دوّر بالاسم أو الإيميل أو النطاق…" value="${esc(st.uq)}" oninput="adm_type('uq',this)" aria-label="بحث في المستخدمين">${select('adm-urole', [['', 'كل الأدوار'], ...Object.entries(DB.roles).map(([k, r]) => [k, `${r.label} (${DB.users.filter(u => u.role === k).length})`])], st.urole, `onchange="adm_set('urole',this.value)" aria-label="الدور"`)}</div>
      ${rows.length ? `<div class="tw"><table><thead><tr><th>الاسم</th><th>الدور</th><th>النطاق</th><th>التفويض</th><th class="n">يشوف</th><th></th></tr></thead><tbody>${rows.map(u => `<tr class="click" onclick="adm_uOpen(${adm_q(u.id)})"><td><b>${esc(u.name)}</b>${u.id === S.user.id ? ' <span class="bd p">إنت</span>' : ''}<div class="sm mut" dir="ltr" style="text-align:end">${esc(u.email)}</div></td><td><span class="bd p">${esc((DB.roles[u.role] || {}).label || u.role)}</span></td><td>${esc(scopeLabel(u.scope))}<div class="sm mut">${esc(ADM_SCOPE_T[u.scope.type] || '')}</div></td><td>${adm_deleg(u)}</td><td class="n">${N(visibleInvoices(u).length)} <span class="sm mut">مستخلص</span></td><td class="n" style="white-space:nowrap"><button class="btn sm gh" onclick="event.stopPropagation();adm_invite(userById(${adm_q(u.id)}))" title="إرسال دعوة">${icon('send')} ${u.invitedAt ? 'إعادة الدعوة' : 'إرسال دعوة'}</button>${adm_btnEdit(`adm_uOpen(${adm_q(u.id)})`)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('user-search', 'مفيش مستخدمين بالبحث ده')}</div>`;
    }
    return pageHeader({ title: 'المستخدمين والصلاحيات', sub: 'كل مستخدم ليه دور (بيحدد يعمل إيه) ونطاق (بيحدد يشوف إيه)', actions: adm_upBtn('users04', 'رفع المستخدمين') + `<button class="btn pr" onclick="adm_uOpen(null)">${icon('user-plus')} مستخدم جديد</button>` })
      + tabs + body + (st.utab === 'list' ? adm_upLog(['04_المستخدمين']) : '');
  },
});
function adm_permMatrix() {
  const roles = Object.keys(DB.roles), perms = Object.keys(DB.permissions);
  return `<div class="alert i mb">${icon('info')}<div>الاعتماد في كل محطة بيتحدد من المسار (الدور المسؤول عن المحطة). هنا الصلاحيات الإضافية — والتعديل بيتطبق فوراً.</div></div>
  <div class="card"><div class="tw"><table class="matrix"><thead><tr><th>الصلاحية</th>${roles.map(r => `<th title="${esc(DB.roles[r].label)}">${esc(DB.roles[r].label)}</th>`).join('')}</tr></thead><tbody>${perms.map(p => `<tr><td><b>${esc(ADM_PERM_AR[p] || p)}</b><div class="sm mut num">${esc(p)}</div></td>${roles.map(r => `<td><input type="checkbox" class="chk" ${(DB.permissions[p] || []).includes(r) ? 'checked' : ''} onchange="adm_permToggle(${adm_q(p)},${adm_q(r)},this.checked)" aria-label="${esc((ADM_PERM_AR[p] || p) + ' — ' + DB.roles[r].label)}"></td>`).join('')}</tr>`).join('')}</tbody>
  <tfoot><tr><td>عدد الصلاحيات</td>${roles.map(r => `<td class="num">${perms.filter(p => (DB.permissions[p] || []).includes(r)).length}</td>`).join('')}</tr></tfoot></table></div></div>`;
}
function adm_scopeTab(st) {
  const roles = Object.entries(DB.roles), u = userById(st.preview) || S.user;
  const vis = visibleInvoices(u), act = vis.filter(i => { try { return canAct(i, u); } catch (e) { return false; } }), nodes = adm_scopeNodes(u.scope), total = DB.invoices.filter(i => i.status !== 'draft').length;
  const ks = u.scope.type === 'all' ? DB.contracts : u.scope.type === 'company' ? DB.contracts.filter(k => k.companyId === u.scope.id) : DB.contracts.filter(k => DB.aos.some(a => a.contractId === k.id && adm_aoIn(a.id, u)));
  const chips = (t, list) => `<div><div class="sm b mut" style="margin-bottom:4px">${icon(ADM_LV[t].icon)} ${ADM_LV[t].many} <span class="num">(${list.length})</span></div><div class="row" style="gap:4px">${list.slice(0, 24).map(n => `<span class="bd n">${esc(n.name)}</span>`).join('') || '<span class="sm mut">—</span>'}${list.length > 24 ? `<span class="sm mut">+${list.length - 24}</span>` : ''}</div></div>`;
  return `<div class="grid g2"><div class="card"><div class="ch"><h3>النطاق حسب الدور</h3></div><div class="tw"><table><thead><tr><th>الدور</th><th>النطاق المعتاد</th><th>يعني إيه</th><th class="n">مستخدمين</th></tr></thead><tbody>${roles.map(([k, r]) => `<tr><td><span class="bd p">${esc(r.label)}</span></td><td>${esc(ADM_SCOPE_T[r.scope] || r.scope)}</td><td class="sm">${esc(ADM_SCOPE_AR[r.scope] || '')}</td><td class="n">${N(DB.users.filter(x => x.role === k).length)}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><div class="ch"><h3>${icon('scan-eye')} جرّب: المستخدم ده يشوف إيه؟</h3></div><div class="cb stack">
    ${field('اختار مستخدم', select('adm-prev', DB.users.map(x => [x.id, `${x.name} — ${DB.roles[x.role].label}`]), u.id, `onchange="adm_set('preview',this.value)"`), { id: 'adm-prev' })}
    <div class="row"><span class="bd p">${esc(DB.roles[u.role].label)}</span><span class="bd n">${esc(ADM_SCOPE_T[u.scope.type])}: ${esc(scopeLabel(u.scope))}</span></div>
    <div class="grid g3">${kpi('files', 'مستخلصات يشوفها', vis.length, `من ${total}`)}${kpi('inbox', 'عليه الدور دلوقتي', act.length)}${kpi('file-signature', 'عقود', ks.length)}</div>
    ${['presidencies', 'sectors', 'gdepts', 'depts', 'centrals'].map(t => chips(t, nodes[t])).join('')}
    <div class="sm mut">${esc(ADM_SCOPE_AR[u.scope.type] || '')}${u.role === 'company' ? ' والشركة بتشوف مسوداتها كمان.' : ' المسودات مش بتظهر غير للشركة صاحبتها.'}</div>
  </div></div></div>`;
}

/* ═════════════════════════ 5) المسار والـ SLA ═════════════════════════ */
const ADM_STEP_KEYS = () => Object.keys(DB.steps).filter(k => k !== 'company');
function adm_wf() { const st = adm_st(); if (!st.wf) st.wf = Object.fromEntries(Object.entries(DB.categories).map(([c, v]) => [c, v.path.map(p => p.slice())])); return st.wf; }
const adm_wfDirty = () => JSON.stringify(adm_wf()) !== JSON.stringify(Object.fromEntries(Object.entries(DB.categories).map(([c, v]) => [c, v.path])));
/** مستخلصات واقفة دلوقتي على محطة في فئة معينة (مينفعش نشيل المحطة) */
const adm_stuck = (cat, key) => DB.invoices.filter(i => (i.cat || i.suggestedCat || 'C1') === cat && ((i.status === 'active' && i.step === key) || (i.status === 'returned' && (i.returnTo === key || i.returnedFrom === key)) || (i.status === 'on_hold' && i.heldAt === key))).length;
function adm_wfToggle(cat, key, on) {
  const wf = adm_wf(), path = wf[cat], keys = ADM_STEP_KEYS();
  if (!on) {
    const n = adm_stuck(cat, key); if (n) { toast(`مينفعش تشيل "${stepShort(key)}" من ${cat} — فيه ${n} مستخلص واقف عليها دلوقتي`, 'err'); return render(); }
    if (path.length <= 1) { toast('المسار لازم يبقى فيه محطة واحدة على الأقل', 'err'); return render(); }
    wf[cat] = path.filter(p => p[0] !== key);
  } else if (!path.some(p => p[0] === key)) { // بتدخل في مكانها حسب ترتيب المحطات
    const ix = keys.indexOf(key), at = path.findIndex(p => keys.indexOf(p[0]) > ix);
    path.splice(at < 0 ? path.length : at, 0, [key, 2]);
  }
  render();
}
function adm_wfSla(cat, key, v) {
  const p = adm_wf()[cat].find(x => x[0] === key); if (!p) return;
  const n = adm_num(v); if (n != null && (isNaN(n) || n < 0 || n > 60)) { toast('الـ SLA لازم عدد أيام من 0 لـ 60', 'err'); return render(); }
  p[1] = n == null ? null : Math.round(n); render();
}
function adm_wfSave() {
  const wf = adm_wf();
  for (const [c, p] of Object.entries(wf)) {
    if (!p.length) return toast(`مسار ${c} فاضي`, 'err');
    if (p[p.length - 1][0] !== 'finance') return toast(`مسار ${c} لازم يخلص بالمالية`, 'err');
    const gone = DB.categories[c].path.filter(o => !p.some(x => x[0] === o[0])).find(o => adm_stuck(c, o[0]));
    if (gone) return toast(`فيه مستخلصات واقفة على "${stepShort(gone[0])}" في ${c}`, 'err');
  }
  Object.entries(wf).forEach(([c, p]) => { DB.categories[c].path = p.map(x => x.slice()); });
  const w = adm_num(adm_val('adm-warn')); if (w != null && !isNaN(w) && w >= 0) DB.slaWarnAt = Math.round(w);
  adm_audit('workflow', 'categories', Object.keys(wf).map(c => `${c}: ${totalSla(c)} يوم`).join('، '));
  adm_st().wf = null; toast('اتحفظ المسار — المستخلصات الجديدة والمفتوحة هتمشي عليه', 'ok'); render();
}
function adm_wfChain(cat, path) {
  const tot = sum(path, p => p[1]);
  return `<div class="row" style="align-items:flex-start;flex-wrap:nowrap;gap:12px;padding:10px 0;border-bottom:1px solid var(--bd1)"><div style="min-width:140px;flex:none"><span class="cat">${cat}</span> <span class="sm b num">${tot} يوم</span><div class="sm mut">${esc(DB.categories[cat].name)}</div></div>
    <div class="row" style="gap:4px;flex:1;min-width:0">${path.map((p, i) => `${i ? `<span class="mut" style="display:inline-flex">${icon('chevron-left')}</span>` : ''}<span class="bd p">${esc(stepShort(p[0]))} · <span class="num">${p[1] == null ? '—' : p[1]}</span>${p[1] == null ? '' : ' ي'}</span>`).join('')}</div></div>`;
}
function adm_rrAdd() { const v = adm_code(adm_val('adm-rr-new')); if (!v) return toast('اكتب السبب الأول', 'err'); DB.returnReasons.push({ id: uid('rr'), name: v }); adm_audit('create', 'returnReason', v); toast('اتضاف السبب', 'ok'); render(); }
function adm_rrRename(id, v) { const r = byId('returnReasons', id); v = adm_code(v); if (!r || !v) return render(); r.name = v; adm_audit('update', 'returnReason:' + id, v); toast('اتحفظ', 'ok'); render(); }
const adm_rrUsed = id => DB.invoices.filter(i => i.log.some(e => (e.reasonIds || []).includes(id))).length;
function adm_rrDel(id) { const n = adm_rrUsed(id); if (n) return toast(`السبب ده مستخدم في ${n} مستخلص — غيّر اسمه بدل ما تمسحه`, 'err'); const r = byId('returnReasons', id); confirmBox('مسح سبب إرجاع', `تمسح "<b>${esc(r.name)}</b>"؟`, 'امسح', () => { DB.returnReasons.splice(DB.returnReasons.indexOf(r), 1); adm_audit('delete', 'returnReason:' + id, r.name); toast('اتمسح', 'ok'); render(); }, 'dg'); }
function adm_rdToggle(t, d, on) { const a = DB.requiredDocs[t] = DB.requiredDocs[t] || []; if (on && !a.includes(d)) a.push(d); if (!on) DB.requiredDocs[t] = a.filter(x => x !== d); adm_audit('update', 'requiredDocs:' + t, `${on ? '+' : '−'} ${byId('docTypes', d).name}`); render(); }
function adm_holAdd() { const d = adm_date(adm_val('adm-hol-d')), n = adm_code(adm_val('adm-hol-n')); if (!d) return toast('اختار التاريخ', 'err'); if (DB.holidays.includes(d)) return toast('اليوم ده متسجل أجازة قبل كده', 'err'); DB.holidays.push(d); DB.holidays.sort(); DB.holidayNames[d] = n || 'أجازة رسمية'; adm_audit('create', 'holiday:' + d, n); toast('اتضافت الأجازة', 'ok'); render(); }
function adm_holDel(d) { DB.holidays = DB.holidays.filter(x => x !== d); delete DB.holidayNames[d]; adm_audit('delete', 'holiday:' + d, ''); toast('اتشالت الأجازة', 'ok'); render(); }
function adm_setSave() {
  const port = adm_num(adm_val('adm-s-smtpPort')), from = adm_code(adm_val('adm-s-smtpFrom'));
  if (port == null || isNaN(port)) return toast('رقم البورت لازم رقم', 'err');
  if (!ADM_EMAIL.test(from)) return toast('إيميل الإرسال شكله غلط', 'err');
  Object.assign(DB.settings, { smtpHost: adm_code(adm_val('adm-s-smtpHost')), smtpPort: port, smtpFrom: from, dailyDigestAt: adm_val('adm-s-dailyDigestAt'), weeklyReportDay: adm_val('adm-s-weeklyReportDay') });
  adm_audit('settings', 'smtp', DB.settings.smtpHost); toast('اتحفظت إعدادات الإيميل', 'ok'); render();
}
function adm_testMail() {
  DB.emails.unshift({ id: uid('e'), to: S.user.email, toName: S.user.name, subject: 'إيميل تجريبي — إعدادات الإرسال', body: `السيد/ ${S.user.name}\n\nده إيميل تجريبي من منظومة تتبع المستخلصات للتأكد من إعدادات الإرسال.\nالسيرفر: ${DB.settings.smtpHost}:${DB.settings.smtpPort}\nمن: ${DB.settings.smtpFrom}\n\nمنظومة تتبع المستخلصات — المصرية للاتصالات`, date: new Date(), status: 'sent' });
  adm_audit('email.test', 'smtp', S.user.email); toast('اتبعت إيميل تجريبي لـ ' + S.user.email + ' — تلاقيه في سجل الإيميلات', 'ok');
}
View.register('workflow', {
  title: 'المسار والـ SLA',
  render() {
    if (!can('workflow.config')) return adm_denied('المسار والـ SLA', 'تعديل المسار لمدير النظام وفريق المتابعة PMO.');
    const st = adm_st();
    const tabs = adm_tabs(st.wtab, [['path', 'المسار والـ SLA', null, 'git-branch'], ['reasons', 'أسباب الإرجاع', DB.returnReasons.length, 'undo-2'], ['docs', 'المستندات الإلزامية', DB.docTypes.length, 'file-check-2'], ['hol', 'الأجازات الرسمية', DB.holidays.length, 'calendar-off'], ['mail', 'إعدادات الإيميل', null, 'mail']], "adm_set.bind(null,'wtab')");
    let body = '';
    if (st.wtab === 'path') {
      const wf = adm_wf(), cats = Object.keys(DB.categories), keys = ADM_STEP_KEYS(), dirty = adm_wfDirty();
      body = (dirty ? `<div class="alert mb">${icon('alert-triangle')}<div style="flex:1"><b>فيه تعديلات مش محفوظة</b> — المستخلصات مش هتتأثر غير لما تحفظ.</div><button class="btn sm" onclick="adm_st().wf=null;render()">${icon('undo-2')} تراجع</button><button class="btn sm pr" onclick="adm_wfSave()">${icon('save')} حفظ المسار</button></div>` : '')
        + `<div class="card mb"><div class="ch"><h3>المحطات × الفئات</h3><span class="sub">علّم المحطة عشان تدخل المسار، واكتب الـ SLA بأيام العمل (فاضي = بدون SLA)</span><span class="sp"></span><label class="sm row" for="adm-warn" style="gap:6px">التنبيه الأصفر قبل الميعاد بـ <input class="cellin" id="adm-warn" type="number" min="0" max="5" value="${esc(DB.slaWarnAt)}" style="width:60px"> يوم</label></div>
        <div class="tw"><table class="matrix"><thead><tr><th>المحطة</th><th>المسؤول</th>${cats.map(c => `<th title="${esc(DB.categories[c].name)}"><span class="cat">${c}</span></th>`).join('')}</tr></thead><tbody>${keys.map(k => `<tr><td><b>${esc(DB.steps[k].short)}</b><div class="sm mut">${esc(DB.steps[k].name)}</div></td><td class="sm">${esc((DB.roles[DB.steps[k].role] || {}).label || '')}</td>${cats.map(c => { const p = wf[c].find(x => x[0] === k); return `<td><div class="row" style="justify-content:center;flex-wrap:nowrap;gap:6px"><input type="checkbox" class="chk" ${p ? 'checked' : ''} onchange="adm_wfToggle(${adm_q(c)},${adm_q(k)},this.checked)" aria-label="${esc(DB.steps[k].short)} في ${c}">${p ? `<input class="cellin" type="number" min="0" max="60" style="width:64px" value="${p[1] == null ? '' : p[1]}" placeholder="—" onchange="adm_wfSla(${adm_q(c)},${adm_q(k)},this.value)" aria-label="SLA ${esc(DB.steps[k].short)} ${c}">` : '<span style="width:64px"></span>'}</div></td>`; }).join('')}</tr>`).join('')}</tbody>
        <tfoot><tr><td>إجمالي الـ SLA</td><td></td>${cats.map(c => `<td><span class="num">${sum(wf[c], p => p[1])}</span> يوم<div class="sm" style="font-weight:500"><span class="num">${wf[c].length}</span> محطة</div></td>`).join('')}</tr></tfoot></table></div>
        <div class="cf row sb"><span>المحطة الجديدة بتدخل في مكانها حسب ترتيب المحطات. ومينفعش تشيل محطة عليها مستخلصات دلوقتي.</span><button class="btn sm pr" onclick="adm_wfSave()" ${dirty ? '' : 'disabled'}>${icon('save')} حفظ المسار</button></div></div>
        <div class="card"><div class="ch"><h3>${icon('route')} شكل المسار لكل فئة</h3><span class="sub">معاينة حية — بتتحدث مع كل تعديل</span></div><div class="cb" style="padding-top:4px;overflow-x:auto">${cats.map(c => adm_wfChain(c, wf[c])).join('')}</div></div>`;
    } else if (st.wtab === 'reasons') {
      body = `<div class="card"><div class="ch"><h3>أسباب الإرجاع</h3><span class="sub">اللي بيختار منها المراجع لما يرجّع مستخلص — الاسم بيتعدل وانت بتكتب وبيتحفظ لما تسيب الخانة</span></div><div class="tw"><table><thead><tr><th>السبب</th><th class="n">استُخدم في</th><th></th></tr></thead><tbody>${DB.returnReasons.map(r => { const n = adm_rrUsed(r.id); return `<tr><td><input class="in" value="${esc(r.name)}" onchange="adm_rrRename(${adm_q(r.id)},this.value)" aria-label="اسم السبب"></td><td class="n">${N(n)} <span class="sm mut">مستخلص</span></td><td class="n"><button class="btn sm icon gh" onclick="adm_rrDel(${adm_q(r.id)})" ${n ? `title="مستخدم — ممكن تغيّر الاسم بس"` : 'title="مسح"'} aria-label="مسح السبب">${icon('trash-2')}</button></td></tr>`; }).join('')}</tbody></table></div>
        <div class="cb row" style="flex-wrap:nowrap"><input class="in" id="adm-rr-new" placeholder="سبب جديد… مثلاً: شهادة الضمان منتهية" onkeydown="if(event.key==='Enter')adm_rrAdd()" aria-label="سبب إرجاع جديد"><button class="btn pr" onclick="adm_rrAdd()">${icon('plus')} إضافة</button></div></div>`;
    } else if (st.wtab === 'docs') {
      body = `<div class="card"><div class="ch"><h3>المستندات الإلزامية لكل نوع مشروع</h3><span class="sub">المستخلص مش هيتقدّم غير لما المستندات المعلّمة تبقى مرفقة</span></div><div class="tw"><table class="matrix"><thead><tr><th>المستند</th>${DB.projectTypes.map(t => `<th>${esc(t.name)}</th>`).join('')}</tr></thead><tbody>${DB.docTypes.map(d => `<tr><td>${esc(d.name)}</td>${DB.projectTypes.map(t => `<td><input type="checkbox" class="chk" ${(DB.requiredDocs[t.id] || []).includes(d.id) ? 'checked' : ''} onchange="adm_rdToggle(${adm_q(t.id)},${adm_q(d.id)},this.checked)" aria-label="${esc(d.name + ' — ' + t.name)}"></td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr><td>عدد الإلزامي</td>${DB.projectTypes.map(t => `<td class="num">${(DB.requiredDocs[t.id] || []).length}</td>`).join('')}</tr></tfoot></table></div></div>`;
    } else if (st.wtab === 'hol') {
      const list = DB.holidays.slice().sort(), up = list.filter(d => d >= iso(TODAY));
      body = `<div class="grid g21"><div class="card"><div class="ch"><h3>الأجازات الرسمية</h3><span class="sub">مش بتتحسب في الـ SLA — زي الجمعة والسبت</span><span class="sp"></span>${adm_upBtn('hol12', 'رفع من Excel', {}, 'sm')}</div>${list.length ? `<div class="tw"><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>المناسبة</th><th></th></tr></thead><tbody>${list.map(d => `<tr class="${d < iso(TODAY) ? '' : 'sel'}"><td class="num">${fmtD(d)}</td><td class="sm">${ADM_DAYS[new Date(d + 'T00:00:00').getDay()]}</td><td>${esc(DB.holidayNames[d] || 'أجازة رسمية')}</td><td class="n">${adm_btnDel(`adm_holDel(${adm_q(d)})`, 'شيل الأجازة')}</td></tr>`).join('')}</tbody></table></div>` : emptyState('calendar-off', 'مفيش أجازات متسجلة')}</div>
        <div class="stack"><div class="card"><div class="ch"><h3>إضافة أجازة</h3></div><div class="cb stack">${field('التاريخ', `<input class="in" type="date" id="adm-hol-d">`, { req: true, id: 'adm-hol-d' })}${field('المناسبة', `<input class="in" id="adm-hol-n" placeholder="مثلاً: عيد الفطر">`, { id: 'adm-hol-n' })}<button class="btn pr" onclick="adm_holAdd()">${icon('plus')} إضافة</button></div></div>
        <div class="card"><div class="cb"><div class="kv"><div><span>الجاية من النهارده</span><b class="num">${up.length}</b></div><div><span>أقرب أجازة</span><b>${up[0] ? `${N(fmtD(up[0]))} · ${esc(DB.holidayNames[up[0]] || '')}` : '—'}</b></div></div></div></div></div></div>` + adm_upLog(['12_الأجازات_الرسمية']);
    } else {
      const s = DB.settings, mails = DB.emails.filter(e => !e.invoiceId).slice(0, 5);
      body = `<div class="grid g21"><div class="card"><div class="ch"><h3>إعدادات الإرسال (SMTP)</h3></div><div class="cb stack"><div class="grid g2">
        ${field('سيرفر SMTP', `<input class="in" id="adm-s-smtpHost" dir="ltr" value="${esc(s.smtpHost)}">`, { id: 'adm-s-smtpHost' })}${field('البورت', `<input class="in" id="adm-s-smtpPort" type="number" dir="ltr" value="${esc(s.smtpPort)}">`, { id: 'adm-s-smtpPort' })}
        ${field('الإرسال من', `<input class="in" id="adm-s-smtpFrom" type="email" dir="ltr" value="${esc(s.smtpFrom)}">`, { id: 'adm-s-smtpFrom', hint: 'الإيميلات بتطلع باسم المنظومة من العنوان ده' })}${field('ملخص يومي الساعة', `<input class="in" id="adm-s-dailyDigestAt" type="time" value="${esc(s.dailyDigestAt)}">`, { id: 'adm-s-dailyDigestAt', hint: 'ملخص بالمتأخر والقريب من الميعاد لكل مسؤول' })}
        ${field('تقرير أسبوعي يوم', select('adm-s-weeklyReportDay', ADM_DAYS, s.weeklyReportDay), { id: 'adm-s-weeklyReportDay' })}</div>
        <div class="row"><button class="btn pr" onclick="adm_setSave()">${icon('save')} حفظ</button><button class="btn" onclick="adm_testMail()">${icon('send')} إرسال إيميل تجريبي</button></div>
        <div class="alert i">${icon('flask-conical')}<div>في الديمو الإيميلات مش بتتبعت فعلاً — بتتسجل في "سجل الإيميلات".</div></div></div></div>
        <div class="card"><div class="ch"><h3>آخر إيميلات النظام</h3><span class="sub">دعوات وتجارب</span></div>${mails.length ? `<div class="tw"><table><tbody>${mails.map(e => `<tr><td><b class="sm">${esc(e.subject)}</b><div class="sm mut" dir="ltr" style="text-align:end">${esc(e.to)}</div></td><td class="sm num">${fmtDT(e.date)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('mail', 'لسه مفيش', '<div>جرّب "إرسال إيميل تجريبي".</div>')}</div></div>`;
    }
    return pageHeader({ title: 'المسار والـ SLA', sub: 'مسار كل فئة تجاوز ومدة كل محطة بأيام العمل، وأسباب الإرجاع والمستندات والأجازات' }) + tabs + body;
  },
});
