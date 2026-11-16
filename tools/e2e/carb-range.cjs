// Carb estimate ranges with confidence, and usual meals (DAP-15, Guy 16 Nov 2026), end-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app), whose stand-in food analyzer gives the rice a weight range of 120-220 g
// around 160 g and medium confidence, and the soup no range.
// Usage: node tools/e2e/carb-range.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up r@example.com. Needs /tmp/meal.png (any PNG).
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const TEXT = {
  en: { have: 'I already have an account', email: 'Email', pw: 'Password', go: 'Sign in', lib: 'Choose from photos', use: 'Use this photo', save: 'Save meal',
    riceRange: 'Likely 34–62 g · medium confidence', mealRange: 'Likely 52–80 g · medium confidence', usualSave: 'Save as a usual meal', name: 'Name of the meal',
    add: 'Save', saved: 'Saved to your usual meals', usual: 'Usual meals', remove: 'Remove Lunch at work from usual meals' },
  he: { have: 'כבר יש לי חשבון', email: 'אימייל', pw: 'סיסמה', go: 'כניסה', lib: 'בחירה מהתמונות', use: 'להשתמש בתמונה', save: 'שמירת הארוחה',
    riceRange: 'טווח סביר 34–62 גרם · ביטחון בינוני', mealRange: 'טווח סביר 52–80 גרם · ביטחון בינוני', usualSave: 'שמירה כארוחה קבועה', name: 'שם הארוחה',
    add: 'שמירה', saved: 'נשמרה בארוחות הקבועות', usual: 'ארוחות קבועות', remove: 'הסרת Lunch at work מהארוחות הקבועות' },
};

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  // Text with numbers is wrapped in direction marks (isolateAuto), so it is matched as a part of the element's text.
  const has = async (page, text) => (await page.evaluate(() => document.body.innerText)).replace(/[\u2066-\u2069]/g, '').includes(text);
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'r@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'r@example.com', password: 'correct horse battery' } })).json.access_token;
    const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      const T = TEXT[lang];
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: true });
      await page.goto(base); await page.waitForTimeout(2000);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(T.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(T.email, { exact: true }).fill('r@example.com');
      await page.getByLabel(T.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(T.go, { exact: true }).last().click(); await page.waitForTimeout(4000);

      // A photo: the rice has a range and confidence, the soup none; the total shows the meal's range.
      await page.goto(`${base}/meal`); await page.waitForTimeout(2500);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText(T.lib, { exact: true }).click()]);
      await chooser.setFiles('/tmp/meal.png'); await page.waitForTimeout(1500);
      await page.getByText(T.use, { exact: true }).click(); await page.waitForTimeout(3500);
      await shot('01-review-range');
      ok(`${lang} ${scheme}: rice shows its likely range and confidence`, await has(page, T.riceRange));
      ok(`${lang} ${scheme}: the total shows the meal's range`, await has(page, T.mealRange));

      if (lang === 'en') {
        // Typing the carbs replaces the estimate: no range on that food any more.
        await page.getByRole('button', { name: /^About 45 grams of carbs, estimate\./ }).first().click(); await page.waitForTimeout(400);
        await page.getByLabel('Carbs in grams for Rice').fill('50'); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
        ok('typed carbs remove the food range', !(await has(page, T.riceRange)));
        ok('no meal range once no food has one', !(await has(page, 'Likely ')));
        await shot('02-typed-no-range');
      }

      await page.getByText(T.save, { exact: true }).last().click(); await page.waitForTimeout(2500);
      const meals = (await api(`/records?${range}&kind=meal`, { token: tk })).json;
      const last = meals.reduce((a, b) => (a.received_at > b.received_at ? a : b)).data;
      if (lang === 'en') ok('typed meal stored with the first estimate and no range', last.items[0].carbs_g === 50 && last.items[0].est_carbs_g === 44.8 && last.carbs_low_total_g == null, JSON.stringify(last.items[0]));
      else ok(`${lang} ${scheme}: estimate stored with its range`, last.items[0].carbs_low_g === 33.6 && last.items[0].carbs_high_g === 61.6 && last.carbs_low_total_g === 52 && last.confidence === 'medium', JSON.stringify(last).slice(0, 300));

      // Save it as a usual meal from the saved screen, then log it again from "Log a meal".
      if (lang === 'en' || scheme === 'light') {
        await page.getByText(T.usualSave, { exact: true }).last().click(); await page.waitForTimeout(500);
        await page.getByLabel(T.name, { exact: true }).fill('Lunch at work');
        await shot('03-usual-name');
        await page.getByText(T.add, { exact: true }).last().click(); await page.waitForTimeout(1500);
        ok(`${lang}: usual meal saved`, await has(page, T.saved));
        await shot('04-usual-saved');
      }
      await page.goto(`${base}/meal`); await page.waitForTimeout(2500);
      await shot('05-start-usual');
      ok(`${lang} ${scheme}: usual meals listed on Log a meal`, (await has(page, T.usual)) && (await has(page, 'Lunch at work')));
      if (lang === 'en') {
        await page.getByText('Lunch at work', { exact: true }).click(); await page.waitForTimeout(1500);
        ok('usual meal opens with its foods and no estimate range', (await has(page, 'Rice')) && !(await has(page, 'Likely ')));
        await shot('06-usual-review');
        await page.goto(`${base}/meal`); await page.waitForTimeout(2500);
      }
      if (scheme === 'dark') {
        await page.getByRole('button', { name: T.remove }).first().click(); await page.waitForTimeout(1500);
        ok('usual meal removed', (await api('/meal/usual', { token: tk })).json.length === 1);
      }
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
