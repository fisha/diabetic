// Records end-to-end check (insulin, activity, note, meal; delete) against a running API and PostgreSQL.
// Usage: node tools/e2e/records.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up c@example.com.
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

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); global.lastPage = page;
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  const tab = async (name) => { await page.getByText(name, { exact: true }).last().click(); await page.waitForTimeout(1800); };
  const chip = async (name) => { await tab('Companion'); await page.getByText(name, { exact: true }).first().click(); await page.waitForTimeout(1500); };
  const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } });
    const tc = (await api('/auth/sign-in', { method: 'POST', body: { email: 'c@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: tc.access_token, body: { locale: 'en', answers: ANSWERS } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('c@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2000);

    // Insulin taken.
    await chip('Insulin taken');
    await page.getByLabel('Amount, units', { exact: true }).fill('4');
    await page.getByText('Meal', { exact: true }).last().click();
    await shot('r01-insulin');
    await page.getByText('Save record', { exact: true }).last().click(); await page.waitForTimeout(1500);
    ok('insulin saved toast', await page.getByText('Saved to your journal').first().isVisible());

    // Activity with the board defaults.
    await chip('Activity');
    await page.getByText('Save activity', { exact: true }).last().click(); await page.waitForTimeout(1500);
    ok('activity saved toast', await page.getByText('Saved to your journal').first().isVisible());

    // Symptoms note.
    await chip('Note');
    await page.getByText('Tired', { exact: true }).click();
    await page.getByText('Save note', { exact: true }).last().click(); await page.waitForTimeout(1500);
    ok('note saved toast', await page.getByText('Saved to your journal').first().isVisible());

    // Meal entered by hand: a custom food with typed carbs.
    await chip('Meal');
    await page.getByText('Search foods and enter amounts', { exact: true }).first().click(); await page.waitForTimeout(1200);
    await page.getByText('Add a food', { exact: true }).first().click(); await page.waitForTimeout(800);
    await page.getByPlaceholder('Search foods').first().fill('Pita');
    await page.waitForTimeout(500);
    await page.getByText('Add “Pita”', { exact: true }).click(); await page.waitForTimeout(800);
    await page.getByLabel('Carbs in grams for Pita').fill('33');
    await shot('r02-meal-review');
    await page.getByText('Save meal', { exact: true }).last().click(); await page.waitForTimeout(2000);
    ok('meal saved screen', await page.getByText('Meal saved').first().isVisible());
    await shot('r03-meal-saved');

    const listed = (await api(`/records?${range}`, { token: tc.access_token })).json;
    ok('server has 4 records', listed.length === 4, JSON.stringify(listed.map((r) => r.kind)));
    const meal = listed.find((r) => r.kind === 'meal');
    ok('meal carbs stored', meal && meal.data.carbs_total_g === 33 && meal.data.items[0].prov === 'man', JSON.stringify(meal && meal.data));

    // Journal shows every kind (navigate inside the app: the web session lives in memory).
    await page.getByText('View in journal', { exact: true }).first().click(); await page.waitForTimeout(2000);
    await tab('Journal');
    await shot('r04-journal');
    ok('journal insulin', await page.getByText('Insulin, 4 units').first().isVisible());
    ok('journal activity', await page.getByText('Walk, 30 min').first().isVisible());
    ok('journal note', await page.getByText('Tired').first().isVisible());
    ok('journal meal', await page.getByText('Meal ≈ 33 g carbs').first().isVisible());

    // Delete the activity.
    await page.getByText('Walk, 30 min').first().click(); await page.waitForTimeout(800);
    await shot('r05-detail');
    await page.getByText('Delete', { exact: true }).first().click(); await page.waitForTimeout(500);
    await page.getByText('Delete entry', { exact: true }).click(); await page.waitForTimeout(2000);
    ok('deleted toast', await page.getByText('Entry deleted.').first().isVisible());
    ok('activity gone from journal', (await page.getByText('Walk, 30 min').count()) === 0);
    const after = (await api(`/records?${range}`, { token: tc.access_token })).json;
    ok('server has 3 records', after.length === 3);

    // Time correction on insulin keeps history.
    await page.getByText('Insulin, 4 units').first().click(); await page.waitForTimeout(800);
    await page.getByText('Edit', { exact: true }).first().click(); await page.waitForTimeout(800);
    await page.getByText('Save correction', { exact: true }).click(); await page.waitForTimeout(2000);
    const ins = (await api(`/records?${range}&kind=insulin`, { token: tc.access_token })).json[0];
    ok('insulin revision 2', ins.revision === 2);
    await shot('r06-after-edit');
    ok('note is today', (await page.getByText('Thu 1 Jan').count()) === 0);

    // A journal meal opens in the meal editor; saving changes it (a revision), never adds a second meal.
    await page.getByText('Meal ≈ 33 g carbs').first().click(); await page.waitForTimeout(800);
    await page.getByText('Edit', { exact: true }).first().click(); await page.waitForTimeout(800);
    await page.getByText('Open meal editor', { exact: true }).click(); await page.waitForTimeout(2500);
    await page.getByText('Half', { exact: true }).first().click(); await page.waitForTimeout(300);
    await shot('r07-meal-edit');
    await page.getByText('Save correction', { exact: true }).last().click(); await page.waitForTimeout(2000);
    const meals = (await api(`/records?${range}&kind=meal`, { token: tc.access_token })).json;
    ok('meal corrected in place', meals.length === 1 && meals[0].revision === 2 && meals[0].data.carbs_total_g === 17, JSON.stringify(meals.map((m) => [m.revision, m.data.carbs_total_g])));
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
