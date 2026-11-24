// Nutrition tiles and targets from the care team (Guy, 24 Nov 2026, PM-506, PM-507).
// Overview > Food today shows fat, fiber, calories, sugars, saturated fat and sodium beside carbs and protein, each with
// the person's own target when they typed one; the pencil chooses the tiles (saved on the server); Settings > Diabetes
// profile > Nutrition targets keeps what is typed. en/he, light/dark.
// Usage: node tools/e2e/nutrition-targets.cjs <web export (EXPO_PUBLIC_API_URL=http://localhost:8000)> <screenshot dir>
// Needs the test server (services/api: uvicorn tests.e2e_server:app) and LINK_SQL (a psql command for its database).
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sql = (q) => execSync(`${process.env.LINK_SQL} "${q}"`);
const TARGETS = { carbs: { amount: '45', per: 'meal', source: 'dietitian', setOn: '2026-11-20' }, kcal: { amount: '1800', per: 'day', source: 'dietitian', setOn: '2026-11-20' }, fiber: { amount: '25', per: 'day', source: 'dietitian', setOn: '2026-11-20' } };
const FOOD = { style: [], allergies: [], allergiesOther: '', intolerances: [], intolerancesOther: '', protein: 'yes', proteinTarget: { amount: '90', unit: 'g_day', source: 'dietitian', setOn: '2026-11-20' }, targets: TARGETS };
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', sex: 'male', birth: { day: '3', month: '4', year: '1985' }, units: 'mgdl', body: { height: '178', heightUnit: 'cm', weight: '80', weightUnit: 'kg' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, meds: { list: [], other: '', more: '' }, food: FOOD, companion: { avatar: 'sage', name: 'Stedio', style: 'warm', callMe: 'Dan' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const run = Date.now().toString(36);
const item = (name, carbs, extra) => ({ name, unit: 'g', qty: 100, carbs_g: carbs, protein_g: 12, fat_g: 9, fiber_g: 4, kcal: 320, sugar_g: 6, sat_fat_g: 3, sodium_mg: 480, prov: 'est', weighed: false, ...extra });
const meal = (key, at, name, carbs) => ({ kind: 'meal', occurred_at: at.toISOString(), entered_at: at.toISOString(), source: 'manual', idempotency_key: key, data: { items: [item(name, carbs)], ate: 'all', carbs_total_g: carbs, any_unknown: false, protein_total_g: 12, fat_total_g: 9, fiber_total_g: 4, kcal_total: 320, sugar_total_g: 6, sat_fat_total_g: 3, sodium_total_mg: 480 } });

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const email = `nt-${run}@example.com`;
    await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
    sql(`UPDATE users SET approved_at = now(), email_verified_at = coalesce(email_verified_at, now()) WHERE email = '${email}'`);
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((x) => [x.kind, x.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    await api('/settings', { method: 'PATCH', token: tk, body: { timezone: 'UTC' } });
    const p = await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: ANSWERS } });
    ok('profile with targets saved', p.status === 200, String(p.status));
    const now = new Date(); const mid = new Date(now); mid.setUTCHours(0, 0, 0, 0);
    const span = now - mid;
    for (const [i, [n, c]] of [['Oat porridge', 40], ['Chicken and rice', 55]].entries()) {
      const r = await api('/records', { method: 'POST', token: tk, body: meal(`nt-${run}-${i}`, new Date(mid.getTime() + span * (i + 1) / 3), n, c) });
      ok(`meal ${i} saved`, r.status < 300, JSON.stringify(r.json).slice(0, 200));
    }
    const s = (await api('/nutrition/summary', { token: tk, query: {} })).json;
    ok('summary has the targets', s.targets.length === 4, JSON.stringify(s.targets));

    for (const [lang, scheme] of [['en', 'light'], ['en', 'dark'], ['he', 'light'], ['he', 'dark']]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      await api('/settings', { method: 'PATCH', token: tk, body: { food_tiles: ['meals', 'carbs', 'protein', 'fat', 'fiber', 'kcal', 'sugar', 'sat_fat', 'sodium', 'full', 'weighed'] } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', timezoneId: 'UTC', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const shot = async (name, full) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: !!full });
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill(email);
      await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(4000);
      const ov = he ? 'סקירה' : 'Overview';
      await page.getByRole('tab', { name: ov }).first().click().catch(async () => page.getByText(ov, { exact: true }).last().click());
      await page.waitForTimeout(4000);
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true }).last();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(1000); }
      const title = page.getByText(he ? 'תזונה היום' : 'Food today', { exact: true }).first();
      await title.scrollIntoViewIfNeeded(); await page.waitForTimeout(1200);
      let txt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} new tiles`, ['Fat so far', 'Fiber so far', 'Calories so far', 'Sugars so far', 'Saturated fat so far', 'Sodium so far'].every((x) => txt.includes(he ? { 'Fat so far': 'שומן עד עכשיו', 'Fiber so far': 'סיבים עד עכשיו', 'Calories so far': 'קלוריות עד עכשיו', 'Sugars so far': 'סוכרים עד עכשיו', 'Saturated fat so far': 'שומן רווי עד עכשיו', 'Sodium so far': 'נתרן עד עכשיו' }[x] : x)));
      ok(`${lang}-${scheme} values`, txt.includes('640') && txt.includes('960'), '');
      ok(`${lang}-${scheme} targets beside`, txt.includes(he ? 'בארוחה' : 'a meal') && txt.includes('1,800') && txt.includes('25'));
      await page.evaluate(() => window.scrollBy(0, -60)); await page.waitForTimeout(300);
      await shot('01-food-today');
      await page.mouse.wheel(0, 400); await page.waitForTimeout(600);
      await shot('02-food-today-lower');
      await page.getByRole('button', { name: he ? 'לבחור מה יוצג בכרטיס' : 'Choose what the card shows' }).last().click(); await page.waitForTimeout(2000);
      await shot('03-choose');
      await page.getByTestId('food-tile-sodium').click(); await page.waitForTimeout(1500);
      const st = (await api('/settings', { token: tk })).json;
      ok(`${lang}-${scheme} choice saved`, !st.food_tiles.includes('sodium'), JSON.stringify(st.food_tiles));
      await page.goBack(); await page.waitForTimeout(1500);
      txt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} sodium hidden`, !txt.includes(he ? 'נתרן עד עכשיו' : 'Sodium so far'));
      // Settings > Diabetes profile > Nutrition targets.
      const stt = he ? 'הגדרות' : 'Settings';
      await page.getByRole('tab', { name: stt }).first().click({ timeout: 3000 }).catch(() => page.getByText(stt, { exact: true }).last().click());
      await page.waitForTimeout(2500);
      await page.getByText(he ? 'פרופיל סוכרת' : 'Diabetes profile', { exact: true }).first().click(); await page.waitForTimeout(2500);
      txt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} targets row`, txt.includes(he ? 'יעדי תזונה' : 'Nutrition targets') && txt.includes(he ? '4 יעדים' : '4 targets'));
      await shot('04-profile');
      await page.getByText(he ? 'יעדי תזונה' : 'Nutrition targets', { exact: true }).first().click(); await page.waitForTimeout(2500);
      await shot('05-targets', true);
      const fat = page.getByLabel(he ? 'שומן, ג׳' : 'Fat, g', { exact: true });
      await fat.fill(''); await fat.type('60'); await page.waitForTimeout(3500);
      const prof = (await api('/profile', { token: tk })).json;
      ok(`${lang}-${scheme} typed target saved`, prof.answers.food.targets.fat && prof.answers.food.targets.fat.amount === '60' && prof.answers.food.targets.fat.source === 'dietitian', JSON.stringify(prof.answers.food.targets.fat));
      await ctx.close();
    }
  } catch (e) {
    ok('run', false, String(e && e.stack || e).slice(0, 400));
  } finally {
    await browser.close(); server.close();
    console.log(results.join('\n'));
    if (errors.length) console.log('page errors:', [...new Set(errors)].slice(0, 5).join(' | '));
    process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
  }
});
