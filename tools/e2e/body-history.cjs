// Height, weight and period history, medicines as rows (Guy, 24 Nov 2026, PM-501..503).
// Settings > Diabetes profile: the "Last period" row for a woman; Height and weight shows the earlier values and a chart
// of each from two measurements (a weight from Apple Health read-only beside them); Last period adds a day and lists them;
// Medicines shows one row per medicine, the old text split on commas.
// Usage: node tools/e2e/body-history.cjs <web export (EXPO_PUBLIC_API_URL=http://localhost:8000)> <screenshot dir>
// Needs the test server (services/api: uvicorn tests.e2e_server:app) and LINK_SQL (a psql command for its database),
// which moves the earlier entries back in time as if they were saved months ago.
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
const body = (height, weight) => ({ height, heightUnit: 'cm', weight, weightUnit: 'kg', measured: 'today' });
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', sex: 'female', birth: { day: '3', month: '4', year: '1995' }, units: 'mgdl', body: body('158', '52'), rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, meds: { list: [], other: '', more: 'Eltroxin 50, vitamin D, iron' }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm', callMe: 'Dana' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const run = Date.now().toString(36);
const iso = (daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0, 10); };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const email = `bh-${run}@example.com`;
    await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
    sql(`UPDATE users SET approved_at = now(), email_verified_at = coalesce(email_verified_at, now()) WHERE email = '${email}'`);
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((x) => [x.kind, x.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    // Three saves of height and weight, each moved back as if saved months apart.
    const uid = `(SELECT id FROM users WHERE email = '${email}')`;
    for (const [h, w, ago] of [['158', '52', 300], ['161', '54', 180], ['163.5', '55', 60]]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, body: body(h, w) } } });
      sql(`UPDATE body_entries SET \\"on\\" = current_date - ${ago} WHERE user_id = ${uid} AND \\"on\\" = current_date`);
    }
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, body: body('165', '55.5') } } });
    const at = new Date(Date.now() - 20 * 86400000);
    await api('/health-data/samples', { method: 'POST', token: tk, body: { store: 'apple_health', items: [{ type: 'weight', sample_id: `bh-${run}-w1`, start: at.toISOString(), end: at.toISOString(), value: 55.2, unit: 'kg', origin: 'com.apple.health' }] } });
    for (const d of [58, 30, 2]) await api('/profile/body/periods', { method: 'POST', token: tk, body: { on: iso(d) } });
    const hist = (await api('/profile/body', { token: tk })).json;
    ok('history: 4 heights, 5 weights (one from Apple Health), 3 periods', hist.height.length === 4 && hist.weight.length === 5 && hist.period.length === 3, JSON.stringify(hist).slice(0, 200));
    const prof = (await api('/profile', { token: tk })).json;
    ok('medicines split into rows', JSON.stringify(prof.answers.meds.items) === JSON.stringify(['Eltroxin 50', 'vitamin D', 'iron']));

    for (const [lang, scheme] of [['en', 'light'], ['en', 'dark'], ['he', 'light'], ['he', 'dark']]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, body: body('165', '55.5') } } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
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
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(4500);
      const st = he ? 'הגדרות' : 'Settings';
      await page.getByRole('tab', { name: st }).first().click({ timeout: 3000 }).catch(() => page.getByText(st, { exact: true }).last().click());
      await page.waitForTimeout(2500);
      await page.getByText(he ? 'פרופיל סוכרת' : 'Diabetes profile', { exact: true }).first().click(); await page.waitForTimeout(3000);
      let txt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} Last period row`, txt.includes(he ? 'וסת אחרונה' : 'Last period'));
      await shot('01-profile');
      await page.getByText(he ? 'גובה ומשקל' : 'Height and weight', { exact: true }).first().click(); await page.waitForTimeout(2500);
      txt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} height history and chart`, txt.includes(he ? 'גבהים קודמים' : 'Earlier heights') && txt.includes(he ? 'גדילה' : 'Growth') && txt.includes('163.5'));
      ok(`${lang}-${scheme} weight from Apple Health listed`, txt.includes('Apple Health') && txt.includes('55.2'));
      await shot('02-body');
      await page.mouse.move(195, 500); await page.mouse.wheel(0, 900); await page.waitForTimeout(800);
      await shot('02-body-lower');
      await page.mouse.wheel(0, 1200); await page.waitForTimeout(800);
      await shot('02-body-end');
      await page.goBack(); await page.waitForTimeout(1500);
      await page.getByText(he ? 'וסת אחרונה' : 'Last period', { exact: true }).first().click(); await page.waitForTimeout(2500);
      txt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} periods listed`, txt.includes(he ? 'הווסתות שלך' : 'Your periods'));
      await shot('03-period', true);
      await page.goBack(); await page.waitForTimeout(1500);
      await page.getByText(he ? 'תרופות' : 'Medicines', { exact: true }).first().click(); await page.waitForTimeout(2500);
      const vals = await page.evaluate(() => [...document.querySelectorAll('input')].map((i) => i.value));
      ok(`${lang}-${scheme} one row per medicine`, ['Eltroxin 50', 'vitamin D', 'iron', ''].every((v) => vals.includes(v)), JSON.stringify(vals));
      await shot('04-meds', true);
      // PM-508: the medicines habit offers the person's own medicines.
      await page.goBack(); await page.waitForTimeout(1200); await page.goBack(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'תיעוד מהיר' : 'Quick log', { exact: true }).first().click();
      await page.waitForTimeout(1500);
      await page.getByText(he ? 'עוד' : 'More', { exact: true }).last().click(); await page.waitForTimeout(800);
      await page.getByText(he ? 'הרגל' : 'Habit', { exact: true }).first().click(); await page.waitForTimeout(2000);
      await page.getByText(he ? 'נטילת תרופות' : 'Medicines taken', { exact: true }).first().click(); await page.waitForTimeout(800);
      txt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} medicines habit offers own medicines`, txt.includes(he ? 'אילו תרופות' : 'Which medicines') && txt.includes('Eltroxin 50') && txt.includes('iron'));
      await page.getByText('vitamin D', { exact: true }).first().click(); await page.waitForTimeout(400);
      await shot('05-habit-meds', true);
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
