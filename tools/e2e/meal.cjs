// Meal photo, description and food search end-to-end check against the test server (stand-in food provider).
// Usage: node tools/e2e/meal.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up f@example.com.
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
  // A fake microphone and an automatic permission grant stand in for the person dictating.
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const page = await ctx.newPage(); global.lastPage = page;
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  const meal = async () => { await page.getByText('Companion', { exact: true }).last().click(); await page.waitForTimeout(1500); await page.getByRole('button', { name: 'Meal', exact: true }).last().click(); await page.waitForTimeout(1500); };
  const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'f@example.com', password: 'correct horse battery' } });
    const tf = (await api('/auth/sign-in', { method: 'POST', body: { email: 'f@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: tf.access_token, body: { locale: 'en', answers: ANSWERS } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('f@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);

    // Photo: choose from photos, use it, analysis, review with a question, save with the photo.
    await meal();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Choose from photos', { exact: true }).click()]);
    await chooser.setFiles('/tmp/meal.png'); await page.waitForTimeout(1500);
    await page.getByText('Use this photo', { exact: true }).click(); await page.waitForTimeout(3000);
    await shot('m01-review-photo');
    ok('review lists foods from the photo', await page.getByText('Rice').first().isVisible() && await page.getByText('Soup').first().isVisible());
    ok('question shown', await page.getByText('Cream or broth?').first().isVisible());
    await page.getByText('Broth', { exact: true }).click(); await page.waitForTimeout(300);
    await page.getByText('Save meal', { exact: true }).last().click(); await page.waitForTimeout(2000);
    ok('meal saved', await page.getByText('Meal saved').first().isVisible());
    let meals = (await api(`/records?${range}&kind=meal`, { token: tf.access_token })).json;
    ok('photo meal stored with photo and estimate', meals.length === 1 && meals[0].source === 'photo-estimate' && !!meals[0].data.photo_id && meals[0].data.carbs_total_g === Math.round(44.8 + 18), JSON.stringify(meals[0] && meals[0].data));
    await page.getByText('View in journal', { exact: true }).first().click().catch(() => {}); await page.waitForTimeout(1500);

    // Description: two foods.
    await meal();
    await page.getByText('Describe it by voice or text', { exact: true }).last().click(); await page.waitForTimeout(1000);
    // Dictation adds the transcribed words to what was typed (the test transcriber hears "My reading is 142").
    await page.locator('textarea').first().fill('banana');
    await page.getByText('Dictate', { exact: true }).last().click(); await page.waitForTimeout(1500);
    ok('dictation listening', await page.getByText('Finish', { exact: true }).last().isVisible());
    await page.getByText('Finish', { exact: true }).last().click(); await page.waitForTimeout(3000);
    ok('dictation added words', (await page.locator('textarea').first().inputValue()) === 'banana My reading is 142', await page.locator('textarea').first().inputValue());
    await page.locator('textarea').first().fill('banana and toast');
    await page.getByText('Find foods', { exact: true }).last().click(); await page.waitForTimeout(2500);
    ok('description parsed', await page.getByText('Banana').first().isVisible() && await page.getByText('Toast').first().isVisible());
    await shot('m02-review-text');

    // Search adds a food with its database carbs.
    await page.getByText('Add a food', { exact: true }).first().click(); await page.waitForTimeout(800);
    await page.getByPlaceholder('Search foods').first().fill('apple'); await page.waitForTimeout(1500);
    await shot('m03-search');
    ok('search result', await page.getByText('Apple, raw').first().isVisible());
    await page.getByText('Apple, raw').first().click(); await page.waitForTimeout(800);
    await page.getByText('Save meal', { exact: true }).last().click(); await page.waitForTimeout(2000);
    meals = (await api(`/records?${range}&kind=meal`, { token: tf.access_token })).json;
    const text = meals.find((m) => m.source !== 'photo-estimate');
    ok('described meal stored', !!text && text.data.items.length === 3 && text.data.carbs_total_g === Math.round(30 + 30 + 20), JSON.stringify(text && text.data));
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', global.lastPage.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
