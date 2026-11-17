// The preparing agents (PM-182..184, Guy 17 Nov 2026) end to end against the test server (services/api: uvicorn
// tests.e2e_server:app), whose stand-in model writes plain lines from the tool results. Synthetic readings for this
// check only. The server runs the agents when asked (POST /e2e/agents/prepare, test server only).
// Usage: node tools/e2e/agents.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up n-en@example.com and n-he@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PW = 'correct horse battery';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-160' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Sol', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const day = (ms) => new Date(ms).toLocaleDateString('sv');

async function setup(email, locale) {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  const docs = (await api('/consent', { token: tk })).json;
  await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
  await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
  await api('/profile', { method: 'PUT', token: tk, body: { locale, answers: ANSWERS } });
  // 35 days of 15-minute sensor readings: evenings higher than mornings.
  let items = []; let n = 0;
  const start = Date.now() - 35 * 86400000;
  for (let t = start; t < Date.now() - 300000; t += 900000) {
    const h = new Date(t).getHours();
    const v = h >= 17 ? 175 + (n % 7) * 3 : h < 6 ? 110 : 125 + (n % 5) * 4;
    items.push({ sample_id: `agents-${email.replace(/[^a-z]/g, "")}-${n++}`, measured_at: new Date(t).toISOString(), value: v, unit: 'mg/dL', method: 'sensor' });
    if (items.length === 1000) { await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } }); items = []; }
  }
  if (items.length) await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } });
  const y = new Date(Date.now() - 86400000); y.setHours(13, 0, 0, 0);
  await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `ag-meal-${email}`, kind: 'meal', occurred_at: y.toISOString(), entered_at: y.toISOString(), source: 'manual', data: { items: [{ name: 'Pita with hummus', unit: 'g', qty: 150, carbs_g: 45, prov: 'est' }], ate: 'all', carbs_total_g: 45, any_unknown: false } } });
  const visit = await api('/visit', { method: 'PUT', token: tk, body: { date: day(Date.now() + 2 * 86400000), with: 'diabetes_doctor' } });
  ok(`${locale}: visit saved`, visit.status === 200, JSON.stringify(visit.json));
  return tk;
}

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  const errors = [];
  let page;
  try {
    const tokens = { en: await setup('n-en@example.com', 'en'), he: await setup('n-he@example.com', 'he') };
    const ran = (await api('/e2e/agents/prepare', { method: 'POST' })).json;
    ok('agents wrote the notes', ran.ran && ran.ran.done === 6, JSON.stringify(ran));
    for (const lang of ['en', 'he']) {
      for (const kind of ['daily_summary', 'pattern_watch', 'visit_prep']) {
        const n = (await api(`/notes/${kind}`, { token: tokens[lang] })).json;
        ok(`${lang}: ${kind} written`, n && n.facts.length > 0, n ? n.facts.map((f) => f.text).join(' | ') : 'none');
      }
    }
    for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['he', 'dark']]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(8000);
      const he = lang === 'he';
      const shot = (name, full = true) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: full });
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', ov: 'סקירה', read: 'לקריאת הסיכום', day: 'יום', week: 'שבוע', weekSum: 'השבוע', y: 'אתמול במילים', w: 'השבועות האחרונים שלך בהשוואה', prof: 'פרופיל', priv: 'פרטיות ונתונים', care: 'שיתוף עם הצוות המטפל', visit: 'הביקור הבא', before: 'לקראת הביקור', add: 'להוסיף לשאלות שלי', q: 'שאלות לביקור (לא חובה)' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', ov: 'Overview', read: 'Read summary', day: 'Day', week: 'Week', weekSum: 'This week', y: 'Yesterday in words', w: 'Your last weeks compared', prof: 'Profile', priv: 'Privacy and data', care: 'Share with my care team', visit: 'Next visit', before: 'Before your visit', add: 'Add to my questions', q: 'Questions for the visit (optional)' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(`n-${lang}@example.com`);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.getByText(L.ov, { exact: true }).last().click(); await page.waitForTimeout(5000);
      // An unlocked accessory (rewards) may greet first: "Later".
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true });
      if (await later.count()) { await later.last().click(); await page.waitForTimeout(1000); }
      const radio = (name) => page.getByRole('radio', { name, exact: true }).first();
      await radio(L.day).click(); await page.waitForTimeout(3000);
      await page.getByText(L.read, { exact: true }).first().click(); await page.waitForTimeout(3500);
      ok(`${lang} ${scheme}: today's summary shows yesterday in words`, (await page.getByText(L.y, { exact: true }).count()) > 0);
      await shot('01-day-summary');
      await page.goBack(); await page.waitForTimeout(2500);
      if (!(await radio(L.week).count())) { await page.getByText(L.ov, { exact: true }).last().click(); await page.waitForTimeout(3000); }
      await radio(L.week).click(); await page.waitForTimeout(3000);
      await page.getByText(L.read, { exact: true }).first().click(); await page.waitForTimeout(3500);
      ok(`${lang} ${scheme}: the week summary shows the weeks compared`, (await page.getByText(L.w, { exact: true }).count()) > 0);
      await shot('02-week-summary');
      await page.goBack(); await page.waitForTimeout(2500);
      await page.getByRole('tab', { name: L.prof }).first().click().catch(async () => page.getByText(L.prof, { exact: true }).last().click());
      await page.waitForTimeout(2500);
      await page.getByText(L.priv, { exact: true }).first().click(); await page.waitForTimeout(2500);
      await page.getByText(L.care, { exact: true }).first().click(); await page.waitForTimeout(4000);
      ok(`${lang} ${scheme}: next visit on the clinic report`, (await page.getByText(L.visit, { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: visit preparation shown`, (await page.getByText(L.before, { exact: true }).count()) > 0);
      await shot('03-visit-prep');
      await page.getByText(L.add, { exact: true }).first().click(); await page.waitForTimeout(800);
      const q = await page.getByLabel(L.q, { exact: true }).inputValue();
      ok(`${lang} ${scheme}: questions added to the report`, q.length > 10, q.slice(0, 80));
      await shot('04-questions-added');
      await ctx.close();
    }
    // With the AI features off, nothing is shown and nothing more is written.
    await api('/consent/ai/off', { method: 'POST', token: tokens.en, body: { at: new Date().toISOString() } });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', locale: 'en-US', deviceScaleFactor: 2 });
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base); await page.waitForTimeout(2000);
    await page.getByText('I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill('n-en@example.com');
    await page.getByLabel('Password', { exact: true }).fill(PW);
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(5000);
    await page.getByRole('tab', { name: 'Profile' }).first().click().catch(async () => page.getByText('Profile', { exact: true }).last().click());
    await page.waitForTimeout(2500);
    await page.getByText('Privacy and data', { exact: true }).first().click(); await page.waitForTimeout(2500);
    await page.getByText('Share with my care team', { exact: true }).first().click(); await page.waitForTimeout(4000);
    ok('ai off: no preparation shown', (await page.getByText('Before your visit', { exact: true }).count()) === 0);
    ok('ai off: says why', (await page.getByText(/The AI features are off, so no preparation is written/).count()) > 0);
    await page.screenshot({ path: path.join(out, 'en-light-05-ai-off.png'), fullPage: true });
    await ctx.close();
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (page) await page.screenshot({ path: path.join(out, 'zz-fail.png') }).catch(() => {});
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => !r.startsWith('PASS')) ? 1 : 0);
});
