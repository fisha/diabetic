// Favorite meals (PM-425, Guy 23 Nov 2026), end-to-end against the test server (services/api: uvicorn
// tests.e2e_server:app). Each run signs up its own person per language and theme, logs a recent meal again with "Also
// save to favorites", sees the one-time photo suggestion, logs it from Favorites (no photo, no model call), and sees
// the favorite's photo in its row once one is kept.
// Usage: node tools/e2e/repeat-meal.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
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
  en: { have: 'I already have an account', email: 'Email', pw: 'Password', go: 'Sign in', save: 'Save meal', saved: 'Saved to your journal', toggle: 'Also save to favorites', name: 'Name of the meal', fav: 'Favorites', favSaved: 'Saved to your favorites', ask: 'Add a photo of this favorite?', later: 'Not now', add: 'Add to favorites', favName: 'Breakfast' },
  he: { have: 'כבר יש לי חשבון', email: 'אימייל', pw: 'סיסמה', go: 'כניסה', save: 'שמירת הארוחה', saved: 'נשמר ביומן', toggle: 'שמירה גם במועדפים', name: 'שם הארוחה', fav: 'מועדפים', favSaved: 'נשמרה במועדפים', ask: 'לצלם את הארוחה המועדפת?', later: 'לא עכשיו', add: 'הוספה למועדפים', favName: 'ארוחת בוקר' },
};
const ITEMS = [{ name: 'Oatmeal', unit: 'g', qty: 60, carbs_g: 36, prov: 'man' }, { name: 'Greek yogurt', unit: 'g', qty: 150, carbs_g: 6, prov: 'man' }, { name: 'Banana', unit: 'piece', qty: 1, carbs_g: 23, prov: 'man' }];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  const has = async (page, text) => (await page.evaluate(() => document.body.innerText)).replace(/[⁦-⁩‎‏]/g, '').includes(text);
  try {
    for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['he', 'dark']]) {
      const T = TEXT[lang];
      const stamp = Date.now(); const email = `fav-${lang}-${scheme}-${stamp}@example.com`;
      await api('/auth/sign-up', { method: 'POST', body: { email, password: 'correct horse battery' } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: 'correct horse battery' } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const d3 = new Date(Date.now() - 3 * 86400000);
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `fav-r-${lang}-${scheme}-${stamp}`, kind: 'meal', occurred_at: d3.toISOString(), entered_at: d3.toISOString(), source: 'manual', data: { items: ITEMS, ate: 'all', carbs_total_g: 65, any_unknown: false } } });

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const analyses = [];
      page.on('request', (r) => { if (/\/meal\/(photos\/[^/]+\/analyze|parse)/.test(r.url())) analyses.push(r.url()); });
      const shot = (name, full = false) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: full });
      await page.goto(base); await page.getByText('I already have an account', { exact: true }).first().waitFor({ timeout: 20000 }); await page.waitForTimeout(500);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(T.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(T.email, { exact: true }).fill(email);
      await page.getByLabel(T.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(T.go, { exact: true }).last().click(); await page.waitForURL((u) => !/sign-in|welcome/.test(u.pathname), { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(3000);

      // 1. A recent meal, logged again and saved to favorites from the review.
      await page.goto(`${base}/meal`);
      await page.getByText('Oatmeal, Greek yogurt, Banana', { exact: true }).first().waitFor({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1500);
      ok(`${lang} ${scheme}: no Favorites section before any favorite`, !(await page.getByText(T.fav, { exact: true }).first().isVisible().catch(() => false)));
      await page.getByText('Oatmeal, Greek yogurt, Banana', { exact: true }).first().click(); await page.waitForTimeout(1500);
      ok(`${lang} ${scheme}: review offers "Also save to favorites"`, await has(page, T.toggle));
      await page.getByTestId('meal-fav-toggle').click(); await page.waitForTimeout(400);
      const nameField = page.getByLabel(T.name, { exact: true }).last();
      ok(`${lang} ${scheme}: name field starts with the foods`, (await nameField.inputValue()) === 'Oatmeal, Greek yogurt, Banana');
      await nameField.fill(T.favName);
      await page.getByTestId('meal-fav-toggle').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      await shot('01-review-favorite-on');
      await page.getByText(T.save, { exact: false }).last().click(); await page.waitForTimeout(3000);
      ok(`${lang} ${scheme}: meal saved and favorite saved`, (await has(page, T.saved)) && (await has(page, T.favSaved)));
      ok(`${lang} ${scheme}: photo suggested for the favorite with no photo`, await has(page, T.ask));
      ok(`${lang} ${scheme}: no second "Add to favorites" on the saved screen`, !(await has(page, T.add)));
      await shot('02-saved-photo-ask');
      let favs = (await api('/meal/usual', { token: tk })).json;
      ok(`${lang} ${scheme}: favorite stored once, with its name, foods, and the suggestion recorded`, favs.length === 1 && favs[0].name === T.favName && favs[0].items.length === 3 && favs[0].photo_asked === true && favs[0].photo_id === null, JSON.stringify(favs.map((f) => [f.name, f.photo_asked])));
      await page.getByText(T.later, { exact: true }).last().click(); await page.waitForTimeout(500);
      ok(`${lang} ${scheme}: "Not now" closes the suggestion`, !(await has(page, T.ask)));

      // 2. Logged from Favorites: no toggle, no photo suggestion again, no model call.
      await page.goto(`${base}/meal`);
      await page.getByText(T.favName, { exact: true }).first().waitFor({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1500);
      ok(`${lang} ${scheme}: Favorites section lists the favorite`, (await has(page, T.fav)) && (await has(page, T.favName)));
      await shot('03-favorites-list');
      await page.getByText(T.favName, { exact: true }).first().click(); await page.waitForTimeout(1500);
      ok(`${lang} ${scheme}: review opens with the favorite's foods, without the toggle`, (await has(page, 'Greek yogurt')) && !(await has(page, T.toggle)));
      await page.getByText(T.save, { exact: false }).last().click(); await page.waitForTimeout(3000);
      ok(`${lang} ${scheme}: saved, photo not suggested a second time, no add button`, (await has(page, T.saved)) && !(await has(page, T.ask)) && !(await has(page, T.add)));
      await shot('04-saved-from-favorite');
      const range = `since=${encodeURIComponent(new Date(Date.now() - 4 * 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
      const meals = (await api(`/records?${range}&kind=meal`, { token: tk })).json;
      const today = meals.filter((m) => Math.abs(new Date(m.occurred_at).getTime() - Date.now()) < 10 * 60000);
      ok(`${lang} ${scheme}: two meals today, same carbs, no photo`, today.length === 2 && today.every((m) => m.data.carbs_total_g === 65 && !m.data.photo_id), JSON.stringify(today.map((m) => m.data.carbs_total_g)));
      ok(`${lang} ${scheme}: no photo analysis or parsing was asked`, analyses.length === 0, analyses.join(' '));

      // 3. A favorite with a kept photo shows it in its row.
      const form = new FormData(); form.append('file', new Blob([PNG], { type: 'image/png' }), 'fav.png');
      const up = await (await fetch(API + '/meal/photos', { method: 'POST', headers: { authorization: `Bearer ${tk}` }, body: form })).json();
      await api(`/meal/usual/${favs[0].id}`, { method: 'PATCH', token: tk, body: { photo_id: up.photo_id } });
      await page.goto(`${base}/meal`);
      await page.getByText(T.favName, { exact: true }).first().waitFor({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(2500);
      const photoLabel = lang === 'he' ? `תמונה של ${T.favName}` : `Photo of ${T.favName}`;
      ok(`${lang} ${scheme}: the favorite's photo shows in its row`, (await page.locator(`[aria-label="${photoLabel}"]`).count()) > 0);
      await shot('05-favorite-with-photo');
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
