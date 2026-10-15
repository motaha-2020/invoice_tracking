/* ============================================================
   seed.js — بيولّد مستخلصات تجريبية ويمشّيها في المسار بنفس دوال Flow
   عشان التاريخ والسجل والإشعارات تبقى متسقة مع منطق المنظومة الحقيقي
   ============================================================ */
function seedInvoices() {
  // التزام مالي جزئي (زي "تجديد الالتزام المالي" في خطابات أوامر التكليف الحقيقية)
  [['ao2', 0.55], ['ao9', 0.6]].forEach(([id, f]) => { byId('aos', id).financialCommitment = Math.round(aoValue(id) * f); });
  let seed = 23;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pick = a => a[Math.floor(rnd() * a.length)];
  const holder = (inv, key) => (stepHolders(inv, key)[0] || {}).id;
  const noCounter = { co1: 60, co2: 140, co3: 30 };
  const KINDS = ['مدني', 'مدني', 'كهربي', 'مجمع', 'تخطيط'];
  const periods = ['أبريل 2026', 'مايو 2026', 'يونيو 2026', 'يوليو 2026', 'أغسطس 2026', 'سبتمبر 2026'];

  function makeLines(aoId, prevCum, target, scenario) {
    const items = DB.aoItems.filter(x => x.aoId === aoId);
    const lines = [];
    items.forEach((x, idx) => {
      let f = target;
      if (scenario === 'C2' && idx === 0) f = 1.18;           // بند واحد متجاوز
      if (scenario === 'C3') f = 1.12;                          // الإجمالي +12%
      if (scenario === 'C4') f = 1.34;                          // الإجمالي +34%
      const cum = Math.round(x.plannedQty * f);
      const q = cum - (prevCum[x.itemId] || 0);
      if (q > 0) lines.push({ itemId: x.itemId, qty: q });
      prevCum[x.itemId] = cum;
    });
    if (scenario === 'C5') lines.push({ itemId: `${byId('aos', aoId).contractId}-2-3-1`, qty: ri(120, 480) }); // بند نحاس مالوش سعر في العقد
    return lines;
  }
  function makeMaterials(lines) {
    const out = [];
    lines.forEach(l => {
      if (!l.itemId) return;
      const it = byId('contractItems', l.itemId);
      const c = it && DB.itemCatalog.find(x => x.itemNo === it.itemNo);
      if (!c || !c.material) return;
      const q = l.qty * c.matFactor * (0.97 + rnd() * 0.08);
      const ex = out.find(m => m.code === c.material);
      if (ex) ex.executedQty += q; else out.push({ code: c.material, executedQty: q });
    });
    out.forEach(m => { m.executedQty = m.executedQty < 50 ? Math.round(m.executedQty * 100) / 100 : Math.round(m.executedQty); });
    return out;
  }
  function makeAttachments(typeId, date, dropOne) {
    let req = (DB.requiredDocs[typeId] || []).slice();
    if (dropOne) req = req.slice(0, -1);
    const ext = { dt3: 'zip', dt7: 'dwg' };
    return req.map(d => ({ id: uid('a'), docTypeId: d, name: `${byId('docTypes', d).name}.${ext[d] || 'pdf'}`, size: ri(180, 9800) * 1024, date }));
  }

  /** يمشّي المستخلص من التقديم لحد ما يوصل للنهارده أو يتصرف */
  function simulate(inv, d, { forceReturnAt = null, allowReturns = true } = {}) {
    const coUser = holder(inv, 'company');
    Flow.submit(inv, { by: coUser, date: d });
    let guard = 0;
    while (inv.status === 'active' && guard++ < 30) {
      const key = inv.step, sla = slaOf(inv, key) || 3;
      const by = holder(inv, key);
      // رجوع: للشركة أو لمحطة سابقة
      const wantReturn = forceReturnAt === key || (allowReturns && ['exec', 'tech', 'stores'].includes(key) && rnd() < 0.13 && !inv.log.some(e => e.action === 'return' && e.step === key));
      if (wantReturn) {
        const rd = addWd(d, ri(1, 2)); if (rd > TODAY) break;
        const toPrev = key === 'tech' && rnd() < 0.35 ? 'exec' : 'company';
        const reasons = toPrev === 'company' ? [pick(['rr1', 'rr2', 'rr3', 'rr8']), pick(['rr2', 'rr5', 'rr6'])].filter((v, i, a) => a.indexOf(v) === i) : ['rr4'];
        Flow.returnTo(inv, { target: toPrev, reasonIds: reasons, by, date: rd, note: toPrev === 'company' ? '- شهادة الاستلام الابتدائي غير مرفقة\n- الكميات في الحصر أكبر من الرسومات في بند الحفر' : 'مطلوب مذكرة تبرير التجاوز في بند سحب الكابل قبل المراجعة الفنية' });
        forceReturnAt = null;
        const back = addWd(rd, ri(1, 4)); if (back > TODAY) return;
        const resBy = toPrev === 'company' ? coUser : holder(inv, toPrev);
        Flow.resubmit(inv, { by: resBy, date: back, note: toPrev === 'company' ? 'تم إرفاق شهادة الاستلام وتعديل الحصر' : 'تم إرفاق مذكرة التجاوز' });
        d = back; continue;
      }
      const dur = Math.max(1, sla + ri(-1, sla > 3 ? 4 : 2));
      const nd = addWd(d, dur); if (nd > TODAY) break;
      if (key === 'exec') Flow.setCategory(inv, inv.suggestedCat, { by, date: nd });
      if (key === 'finance') Flow.pay(inv, { ref: String(ri(100000, 999999)), method: pick(['شيك', 'تحويل بنكي']), by, date: nd });
      else Flow.approve(inv, { by, date: nd });
      d = nd;
    }
  }

  DB.aos.forEach((ao, aoIdx) => {
    const c = aoCtx(ao.id);
    const n = ao.id === 'ao1' ? 3 : ri(2, 4);
    const prevCum = {};
    let start = addWd(TODAY, -(n * 40 + ri(0, 20)));
    for (let j = 0; j < n; j++) {
      const last = j === n - 1, recent = j >= n - 2;
      let scenario = recent ? pick(['C1', 'C1', 'C2', 'C2', 'C3', 'C4', 'C5']) : 'C1';
      if (ao.id === 'ao1' && last) scenario = 'C3';
      const target = last ? 0.55 + rnd() * 0.4 : 0.25 * (j + 1);
      const lines = makeLines(ao.id, prevCum, target, scenario);
      const no = ao.id === 'ao1' && last ? '191' : String(++noCounter[c.company.id]);
      const date = recent ? addWd(TODAY, -ri(3, last ? 30 : 45)) : start;
      const kind = pick(KINDS);
      const sites = DB.aoSites.filter(s => s.aoId === ao.id);
      const inv = {
        id: 'inv-' + ao.id + '-' + (j + 1), no, seq: j + 1, aoId: ao.id, period: periods[Math.min(periods.length - 1, j + 2 + (aoIdx % 2))],
        kind, pathName: `${kind === 'تخطيط' ? 'فاتورة تخطيط' : kind === 'كهربي' ? 'كهربي' : 'أعمال مدنية'} ${c.project.name.split('—')[0].trim()} — ${sites[j % sites.length].name}`,
        status: 'draft', step: null, since: date, cat: null, suggestedCat: null, returnTo: null, returnedFrom: null,
        revisions: [{ n: 1, date, lines, materials: makeMaterials(lines), attachments: makeAttachments(c.type.id, date, rnd() < 0.15) }],
        deductions: null, log: [], payment: null,
      };
      DB.invoices.push(inv);
      if (ao.id === 'ao1' && last) simulate(inv, addWd(TODAY, -9), { forceReturnAt: 'tech', allowReturns: false });
      else simulate(inv, date, { allowReturns: recent });
      start = addWd(start, ri(30, 45));
    }
  });

  // مسودة واحدة لبريدج عشان شاشة الشركة
  const dctx = aoCtx('ao4');
  const dl = DB.aoItems.filter(x => x.aoId === 'ao4').slice(0, 5).map(x => ({ itemId: x.itemId, qty: Math.round(x.plannedQty * 0.3) }));
  DB.invoices.push({ id: 'inv-draft-1', no: '205', seq: 99, aoId: 'ao4', period: 'أكتوبر 2026', kind: 'مدني', pathName: 'أعمال مدنية FTTH طلخا — كابينة جديدة', status: 'draft', step: null, since: TODAY, cat: null, suggestedCat: null, returnTo: null, returnedFrom: null,
    revisions: [{ n: 1, date: TODAY, lines: dl, materials: makeMaterials(dl), attachments: makeAttachments(dctx.type.id, TODAY, true).slice(0, 2) }], deductions: null, log: [], payment: null });

  // مستخلص معلّق بانتظار اعتماد ملحق زيادة أمر التكليف (زي حالات "بانتظار إعتماد أمر التكليف" في ملف الموقف)
  const big = DB.invoices.find(i => i.status === 'active' && ['C4', 'C5'].includes(i.cat || i.suggestedCat) && i.id !== 'inv-ao1-3');
  if (big) Flow.hold(big, { reason: 'بانتظار اعتماد ملحق زيادة أمر التكليف', by: 'u1', date: addWd(TODAY, -3) });

  // أمثلة مرتجعات مضمونة: واحد للشركة من كل شركة، وواحد لمحطة سابقة
  const actives = DB.invoices.filter(i => i.status === 'active' && i.id !== 'inv-ao1-3' && i.step !== 'sup');
  const seenCo = new Set();
  actives.forEach(i => {
    const co = ctx(i).company.id; if (seenCo.has(co)) return; seenCo.add(co);
    Flow.returnTo(i, { target: 'company', reasonIds: ['rr2', 'rr3'], by: holder(i, i.step), date: addWd(TODAY, -2), note: '- شهادة التسليم الابتدائي مش مرفقة\n- كمية بند الحفر الضيق في الحصر أكبر من الرسومات المعتمدة' });
  });
  const toPrev = actives.find(i => i.status === 'active' && ['tech', 'stores'].includes(i.step));
  if (toPrev) Flow.returnTo(toPrev, { target: 'exec', reasonIds: ['rr4'], by: holder(toPrev, toPrev.step), date: addWd(TODAY, -1), note: 'مطلوب مذكرة تبرير التجاوز موقّعة من مدير التنفيذ' });

  // الإشعارات القديمة مقروءة
  DB.notifications.forEach(n => { if (wdBetween(n.date, TODAY) > 2) n.read = true; });
  DB.notifications.sort((a, b) => new Date(b.date) - new Date(a.date));
  DB.emails.sort((a, b) => new Date(b.date) - new Date(a.date));
}
