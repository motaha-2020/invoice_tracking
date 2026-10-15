# ديمو منظومة تتبع المستخلصات

ديمو HTML/JS من غير build — افتح `index.html` في المتصفح. البيانات كلها في الذاكرة (بترجع لأصلها مع كل reload).

## ترتيب الملفات

| الملف | الدور |
|---|---|
| `css/app.css` | الـ design system (هوية WE، RTL، فاتح/داكن). **كل الشاشات تستخدم الـ classes دي — ممنوع ألوان hex في views** |
| `js/data.js` | `DB` — نفس شكل جداول قاعدة البيانات (ERD). الهيكل، المشاريع، العقود وبنودها المتدرجة، أوامر التكليف ومواقعها وكمياتها، المهمات، المنصرف، المستخدمين، المسار والـ SLA |
| `js/core.js` | المنطق المشترك: lookups، حسابات المستخلص، الـ SLA، الصلاحيات والنطاق، `Flow` (كل حركات المسار)، Excel، الـ router، UI helpers، الـ shell (header/sidebar/login/Ctrl+K) |
| `js/seed.js` | بيولّد مستخلصات ويمشّيها في المسار بنفس دوال `Flow` |
| `js/views/*.js` | كل ملف بيسجّل شاشاته بـ `View.register(key, {...})` |
| `templates/*.xlsx` | قوالب الرفع الموحدة (نفس `../templates`) |

## إزاي تكتب شاشة

```js
View.register('inbox', {
  title: 'صندوق الوارد',
  render(params) { return pageHeader({ title: 'صندوق الوارد', sub: '...' }) + `<div class="card">...</div>`; },
  after(params) { /* اختياري: بعد ما الـ HTML يترسم (focus, listeners) */ },
});
```

- `render` بترجع **HTML string**. الأحداث inline: `onclick="myFn('${id}')"` — الدوال المستخدمة لازم تبقى global (`function x(){}` أو `window.x = ...`) وبأسماء فيها prefix الملف عشان مفيش تعارض (`co_`، `inv_`، `adm_`، `rep_`).
- حالة الشاشة (فلاتر، تاب مختار، wizard) في `S.ui.<prefix>` — وبعد أي تغيير `render()`.
- التنقل: `go('route', {id})`، `openInv(id)`.
- كل نص بيجي من بيانات يتعمله `esc()`. الأرقام `money()` / `qty()` جوه `N()` أو `.money`/`.num`.
- الأيقونات: `icon('name')` (lucide 0.454).

## الـ API المشترك (core.js)

**lookups**: `byId(table,id)` · `userById` · `material(code)` · `aoCtx(aoId)` / `ctx(inv)` ← `{ao, contract, company, project, type, central, dept, gdept, sector, presidency}` · `aoValue(aoId)` · `aoInvoices(aoId)` · `invById(id)`

**المستخلص**: `curRev(inv)` · `invLines(inv)` ← بنود بالسعر من العقد + `plannedQty, prevQty, approvedQty, cumQty, overQty, overPct, total, isNew, notInAo, changed` · `invMaterials(inv)` ← `planned, issued, prevExecuted, executed, cumExecuted, billed, balance, flags[]` · `suggestCategory(inv)` ← `{cat, reasons[]}` · `invTotals(inv)` ← `{gross, submitted, byWorkType, vat, deductions[], dedTotal, net, cumGross, aoValue, words}` · `missingDocs(inv)` · `numberToArabicWords(n)`

**المسار**: `pathOf(inv)` ← `[{key, sla, name, short, role, tentative}]` · `slaState(inv)` ← `{k, cls, label, el, sla}` · `holderLabel(inv)` · `cycleDays(inv)` · `stepDurations(inv)` · `stepName(k)` · `stepShort(k)` · `totalSla(cat)`

**الصلاحيات**: `inScope(user, inv)` · `visibleInvoices(user?)` · `canAct(inv, user?)` · `canOverride(inv)` · `can(perm)` · `isCompany()` · `stepHolders(inv, key)` · `scopeLabel(scope)`

**Flow** (الطريقة الوحيدة لتغيير حالة مستخلص — بتسجل log + audit + إشعار + إيميل):
`Flow.submit(inv)` · `Flow.setCategory(inv, cat, {note})` · `Flow.approve(inv, {note})` · `Flow.returnTo(inv, {target, reasonIds, note})` · `Flow.resubmit(inv, {note, revision})` · `Flow.updateApproved(inv, lineIdx, qty, {reason})` · `Flow.hold(inv, {reason})` · `Flow.release(inv)` · `Flow.pay(inv, {ref, method})`

**Excel**: `Excel.read(file)` ← Promise<rows[]> (أول شيت، أسماء الأعمدة من الصف الأول) · `Excel.download(filename, {sheet: [[header], [row]...]})`
> قوالب `templates/` فيها صف عناوين عربي + صف تاني بأسماء الأعمدة التقنية. عند القراءة: اقرا الشيت بالاسم واعتمد على الصف التاني (`XLSX.utils.sheet_to_json(ws, {range: 1})`).

**UI**: `pageHeader({title, sub, crumbs:[[label, route, params]], actions})` · `kpi(icon, label, value, sub, cls)` · `slaChip(inv)` · `statusBadge(inv)` · `catBadge(inv)` · `select(id, options, value, attrs)` · `field(label, control, {req, hint})` · `emptyState(icon, title, sub, action)` · `dropZone(id, title, sub, onFilesFnName, accept)` · `invRowCells(inv)` · `modal(title, body, foot, {size:'lg'})` · `closeModal()` · `confirmBox(title, msg, yesLabel, fn, cls)` · `toast(msg, 'ok'|'err')`

**utils**: `esc` `money` `money2` `qty` `mShort` `pct` `fmtD` `fmtDT` `iso` `wdBetween` `addWd` `sum` `groupBy` `uid` `icon` `N` · `TODAY`

## بيانات المستخلص (`DB.invoices[]`)

```
{ id, no, seq, aoId, period, kind: 'مدني'|'كهربي'|'مجمع'|'تخطيط', pathName,
  status: 'draft'|'active'|'returned'|'on_hold'|'paid', step, since, cat, suggestedCat,
  returnTo, returnedFrom, holdReason,
  revisions: [{ n, date, lines: [{itemId, qty, approvedQty?, approveNote?, siteCode?}],
                materials: [{code, executedQty, billedQty?}], attachments: [{id, docTypeId, name, size, date}] }],
  deductions: null | [{typeId, name, pct?, amount?}], log: [...], payment: {ref, method, date, amount} }
```

## الأدوار
`company` · `supervisor` (مشرف تنفيذ) · `exec_mgr` · `gm` · `tech_affairs` · `tech_office` · `planning` · `sector_head` · `presidency_head` · `committee` · `stores` · `finance` · `pmo` · `admin` — كل مستخدم ليه `scope: {type, id}` و`inScope` هو اللي بيحدد يشوف إيه.
