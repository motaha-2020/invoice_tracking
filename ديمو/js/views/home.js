/* home.js — الرئيسية بتوجّه كل دور للشاشة المناسبة له */
View.register('home', {
  title: 'الرئيسية',
  render(p) {
    const target = isCompany() ? 'co-home' : (['pmo', 'admin', 'presidency_head', 'sector_head', 'gm', 'committee', 'planning', 'finance'].includes(S.user.role) ? 'dash' : 'inbox');
    const v = VIEWS[target];
    return v ? v.render(p) : emptyState('construction', 'الصفحة دي لسه بتتبني', target);
  },
  after(p) {
    const target = isCompany() ? 'co-home' : (['pmo', 'admin', 'presidency_head', 'sector_head', 'gm', 'committee', 'planning', 'finance'].includes(S.user.role) ? 'dash' : 'inbox');
    VIEWS[target] && VIEWS[target].after && VIEWS[target].after(p);
  },
});
