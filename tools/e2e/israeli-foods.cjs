// Israeli food list (DAP-16): Hebrew food search with typical portions and the Ministry of Health source line.
// Usage: node tools/e2e/israeli-foods.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir> [he|en] [light|dark]
// Start from an empty database: it signs up h@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const lang = process.argv[4] || 'he'; const scheme = process.argv[5] || 'light';
const API = 'http://localhost:8000';
const msg = (l) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../packages/i18n/messages', `${l}.json`), 'utf8'));
const en = msg('en'); const tr = msg(lang);
// A label in either language, since the sign-in page may show before the profile's language applies.
const either = (k) => new RegExp(`^(${[en[k], tr[k]].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`);
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: lang === 'he' ? 'he-IL' : 'en-US' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${n}.png`) });
  const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
  const email = `h-${lang}-${scheme}@example.com`;
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email, password: 'correct horse battery' } });
    const tf = (await api('/auth/sign-in', { method: 'POST', body: { email, password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: tf.access_token, body: { locale: lang, answers: ANSWERS } });

    // The server answers Hebrew from the Israeli list, with portions and the source.
    const found = (await api(`/meal/foods?q=${encodeURIComponent('פיטה')}`, { token: tf.access_token })).json;
    ok('server: spelling variant finds pita', found.length > 0 && found[0].name.startsWith('פיתה') && found[0].source === 'moh-tzameret', found[0] && found[0].name);
    ok('server: typical portion', found[0].portions[0].unit === 'piece' && found[0].portions[0].grams > 0);

    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel(either('wd.si_email')).first().fill(email).catch(() => page.getByLabel(either('onb.a_email')).first().fill(email));
    await page.getByLabel(either('onb.a_pw')).first().fill('correct horse battery');
    await page.getByText(either('onb.a_signin')).last().click(); await page.waitForTimeout(2500);

    await page.goto(`${base}/meal`); await page.waitForTimeout(2500);
    await page.getByText(tr['meal.m_desc'], { exact: true }).last().click(); await page.waitForTimeout(1000);
    await page.locator('textarea').first().fill('banana');
    await page.getByText(tr['meal.find'], { exact: true }).last().click(); await page.waitForTimeout(2500);

    await page.getByText(tr['meal.add'], { exact: true }).first().click(); await page.waitForTimeout(800);
    await page.getByPlaceholder(tr['meal.search']).first().fill('שקשוקא'); await page.waitForTimeout(1500);
    await shot('01-search-shakshuka');
    ok('search: spelling variant shows shakshuka', await page.getByText(/^שקשוקה/).first().isVisible());
    ok('search: source line', await page.getByText(tr['meal.src_moh'], { exact: true }).first().isVisible());
    const serving = tr['meal.serving'].replace('{amount}', '');
    ok('search: typical portion line', await page.getByText(new RegExp(serving.trim())).first().isVisible());

    await page.getByPlaceholder(tr['meal.search']).first().fill('פיתה'); await page.waitForTimeout(1500);
    await shot('02-search-pita');
    const first = found[0];
    await page.getByText(first.name, { exact: true }).first().click(); await page.waitForTimeout(800);
    await shot('03-review-pita');
    const carbs = Math.round(first.carbs_per_100g * first.portions[0].grams / 100);
    await page.getByText(tr['meal.save'], { exact: true }).last().click(); await page.waitForTimeout(2000);
    const meals = (await api(`/records?${range}&kind=meal`, { token: tf.access_token })).json;
    const pita = meals.length && meals[0].data.items.find((i) => i.name === first.name);
    ok('saved: pita as one piece with its carbs', !!pita && pita.unit === 'piece' && pita.qty === 1 && Math.round(pita.carbs_g) === carbs, JSON.stringify(pita));
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await page.screenshot({ path: path.join(out, `${lang}-${scheme}-zz-fail.png`) });
  }
  ok('no page errors', errors.length === 0, errors.join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => !r.startsWith('PASS')) ? 1 : 0);
});
