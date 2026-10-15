/* demo_smoke.js — بيحمّل الديمو في Node (DOM وهمي) ويرسم كل شاشة متسجلة بكل مستخدم.
   التشغيل:  node scripts/demo_smoke.js            (كل الشاشات)
             node scripts/demo_smoke.js invoice inbox (شاشات معينة)
   بيطبع أي exception أو "undefined"/"NaN" ظاهر في الـ HTML. exit code 1 لو فيه أخطاء. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'ديمو');
const only = process.argv.slice(2);
const el = () => ({ innerHTML: '', value: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setSelectionRange() {}, focus() {}, appendChild() {}, remove() {}, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, style: {} });
const ctx = {
  console, Math, Date, JSON, Object, Array, String, Number, Error, Promise, isNaN, parseFloat, parseInt, setTimeout, clearTimeout, Set, Map, RegExp, Intl,
  localStorage: { getItem() { return null; }, setItem() {} },
  document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, documentElement: { dataset: {} }, body: el(), createElement: el },
  location: {}, matchMedia: () => ({ matches: false }), innerWidth: 1400, scrollTo() {}, FileReader: function () {}, XLSX: undefined, lucide: undefined,
};
ctx.window = ctx; vm.createContext(ctx);
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="(js\/[^"?]+)/g)].map(m => m[1]);
for (const f of scripts) vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
vm.runInContext('seedInvoices()', ctx);

const res = vm.runInContext(`(() => {
  const only = ${JSON.stringify(only)};
  const out = { ok: 0, errors: [] };
  const keys = Object.keys(VIEWS).filter(k => !only.length || only.includes(k));
  for (const u of DB.users) {
    S.user = u; S.ui = {};
    for (const k of keys) {
      const params = k === 'invoice' ? { id: visibleInvoices(u)[0]?.id } : {};
      if (k === 'invoice' && !params.id) continue;
      try {
        S.route = k; S.params = params;
        const h = VIEWS[k].render(params) || '';
        const bad = h.match(/>[^<]*\\b(undefined|NaN|null)\\b[^<]*</);
        if (bad) out.errors.push(k + ' @' + u.role + ' [' + u.id + ']: يظهر "' + bad[1] + '" في: ' + bad[0].slice(0, 90));
        else out.ok++;
      } catch (e) { out.errors.push(k + ' @' + u.role + ' [' + u.id + ']: ' + e.message + ' ' + (e.stack || '').split('\\n')[1]); }
    }
  }
  out.views = keys;
  return out;
})()`, ctx);
console.log('views:', res.views.join(', '));
console.log('renders ok:', res.ok, ' errors:', res.errors.length);
[...new Set(res.errors)].slice(0, 40).forEach(e => console.log('  ✗', e));
process.exit(res.errors.length ? 1 : 0);
