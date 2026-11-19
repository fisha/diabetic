// Delete by swiping (Guy, 18 Nov 2026, PM-222) end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/swipe-delete.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from a database without s@example.com: it signs up s@example.com and logs meals through the API. Checks, in
// English (light) and Hebrew (light and dark): the journal entry has no Delete button; a swipe toward the start of the
// reading direction (left in English, right in Hebrew) asks, and the delete reaches the server; a short swipe uncovers
// Delete on the carbs breakdown; a swipe the other way uncovers nothing.
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

/** Drags from the row's middle by dx pixels, in small steps like a finger. */
async function swipe(page, locator, dx) {
  await locator.scrollIntoViewIfNeeded();
  const b = await locator.boundingBox();
  const x = b.x + b.width / 2; const y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(x + (dx * i) / 12, y + i * 0.3); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.waitForTimeout(600);
}

/** Watches the row for 2.5 s after a screen opens: the farthest it slid toward the start (PM-287 hint). */
async function watchHint(page, locator, toStart) {
  const start = await locator.boundingBox().catch(() => null);
  if (!start) return { most: 0, back: 0 };
  let most = 0; let end = start;
  for (let k = 0; k < 50; k++) {
    const b = await locator.boundingBox().catch(() => null);
    if (b) { most = Math.max(most, (b.x - start.x) * toStart); end = b; }
    await page.waitForTimeout(50);
  }
  return { most, back: Math.abs(end.x - start.x) };
}

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 's@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 's@example.com', password: 'correct horse battery' } })).json.access_token;
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: ANSWERS } });
    const docs = (await api('/consent', { token: tk })).json;
    if (docs && docs.documents) await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await api('/settings', { method: 'PUT', token: tk, body: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }).catch(() => null);
    const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d; };
    const hour = new Date().getHours();
    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']];
    // Two meals per run: one deleted from the journal, one kept for the breakdown's short swipe.
    // A run of its own: names unique to this run, so earlier runs' meals don't count.
    const tag = String(Date.now() % 100000);
    let i = 0;
    for (const [lang] of runs) {
      for (const [name, carbs] of [[`Toast ${lang}${i}x${tag}`, 22], [`Rice ${lang}${i}x${tag}`, 40]]) {
        const items = [{ name, unit: 'g', qty: 100, carbs_g: carbs, protein_g: 5, prov: 'wt', weighed: true }];
        const r = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `sw-${i}-${name.replace(/\W/g, "_")}-${Date.now()}`, kind: 'meal', occurred_at: at(Math.max(0, hour - 1), 5 + i).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items, ate: 'all', carbs_total_g: carbs, any_unknown: false, protein_total_g: 5 } } });
        ok(`meal ${name} saved`, r.status === 200 || r.status === 201, String(r.status));
      }
      i++;
    }
    const meals = async () => ((await api(`/records?kind=meal&since=${encodeURIComponent(at(0).toISOString())}&until=${encodeURIComponent(at(23, 59).toISOString())}`, { token: tk })).json || []).map((r) => r.data.items[0].name);

    i = 0;
    for (const [lang, scheme] of runs) {
      const he = lang === 'he';
      const toast = `Toast ${lang}${i}x${tag}`; const rice = `Rice ${lang}${i}x${tag}`; i++;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', journal: 'יומן', overview: 'סקירה', ask: 'למחוק את הרשומה?', yes: 'מחיקת הרשומה', del: 'מחיקה', carbs: 'פחמימות עד עכשיו', close: 'סגירה', back: 'חזרה' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', journal: 'Journal', overview: 'Overview', ask: 'Delete this entry?', yes: 'Delete entry', del: 'Delete', carbs: 'Carbs so far', close: 'Close', back: 'Back' };
      // Toward the start of the reading direction: left in English, right in Hebrew.
      const toStart = he ? 1 : -1;
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('s@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      // Accept any pending legal or AI screens the same way a person would not be needed here: the API accepted them.
      await page.getByRole('tab', { name: L.journal }).first().click().catch(async () => page.getByText(L.journal, { exact: true }).last().click());
      // The hint (PM-287): the first meal (the newest) slides toward the start a moment after the list shows, then back.
      const first = page.getByRole('button', { name: /(Rice|Toast) \w+x\d+/ }).first();
      await first.waitFor({ timeout: 8000 });
      const hintSeen = await watchHint(page, first, toStart);
      ok(`${lang} ${scheme}: journal hint nudges the first row toward the start`, hintSeen.most > 20, `${Math.round(hintSeen.most)} px`);
      ok(`${lang} ${scheme}: and it comes back`, hintSeen.back < 2, `${hintSeen.back} px`);
      await shot('00-journal-after-hint');
      const row = page.getByRole('button', { name: new RegExp(toast) }).first();
      ok(`${lang} ${scheme}: journal shows the meal`, await row.isVisible().catch(() => false));
      await shot('01-journal');

      // The detail has no Delete button any more.
      await row.click(); await page.waitForTimeout(1500);
      ok(`${lang} ${scheme}: entry detail has Edit`, (await page.getByRole('button', { name: he ? 'עריכה' : 'Edit', exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: entry detail has no Delete button`, (await page.getByRole('button', { name: he ? 'מחיקה' : 'Delete', exact: true }).count()) === 0);
      await shot('02-detail-no-delete');
      await page.getByRole('button', { name: L.back }).first().click(); await page.waitForTimeout(1500);

      // The wrong way uncovers nothing.
      await swipe(page, row, -toStart * 150);
      await shot('02b-after-wrong-way');
      ok(`${lang} ${scheme}: swipe the other way uncovers nothing`, !(await page.getByRole('button', { name: new RegExp(`^${L.del}, ${toast}`) }).first().isVisible().catch(() => false)));

      // A long swipe toward the start asks, then deletes on the server.
      await swipe(page, row, toStart * 300);
      ok(`${lang} ${scheme}: long swipe asks first`, await page.getByText(L.ask, { exact: true }).first().isVisible().catch(() => false));
      await shot('03-swipe-ask');
      await page.getByText(L.yes, { exact: true }).last().click(); await page.waitForTimeout(3000);
      ok(`${lang} ${scheme}: deleted entry leaves the journal`, (await page.getByRole('button', { name: new RegExp(toast) }).count()) === 0);
      const left = await meals();
      ok(`${lang} ${scheme}: delete reached the server`, !left.includes(toast) && left.includes(rice), left.join(','));
      await shot('04-after-delete');

      // Overview > carbs breakdown: a short swipe uncovers Delete; tapping the row closes it again.
      // A reward for logging meals may open over the screen; "Later" closes it.
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true }).last();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(800); }
      await page.getByRole('tab', { name: L.overview }).first().click().catch(async () => page.getByText(L.overview, { exact: true }).last().click());
      await page.waitForTimeout(3500);
      const tile = page.getByRole('button', { name: new RegExp(`^${L.carbs},`) }).first();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(800); }
      await tile.scrollIntoViewIfNeeded().catch(() => null);
      await tile.click(); await page.waitForTimeout(2500);
      const bRow = page.getByRole('button', { name: new RegExp(`^${rice}`) }).first();
      ok(`${lang} ${scheme}: breakdown shows the meal`, await bRow.isVisible().catch(() => false));
      // After a swipe the person knows: no more hints.
      const bFirst = page.getByRole('button', { name: /^(Rice|Toast) / }).first();
      const bSlid = await watchHint(page, bFirst, toStart);
      ok(`${lang} ${scheme}: no hint once the person has swiped`, bSlid.most < 2, `${Math.round(bSlid.most)} px`);
      await swipe(page, bRow, toStart * 70);
      const uncovered = page.getByRole('button', { name: `${L.del}, ${rice}`, exact: true }).first();
      ok(`${lang} ${scheme}: short swipe uncovers Delete`, await uncovered.isVisible().catch(() => false));
      const ub = await uncovered.boundingBox().catch(() => null); const rb = await bRow.boundingBox().catch(() => null);
      ok(`${lang} ${scheme}: Delete sits at the end of the row`, ub && rb && (he ? ub.x < rb.x : ub.x > rb.x), JSON.stringify({ ub, rb }));
      await shot('05-breakdown-uncovered');
      await swipe(page, bRow, -toStart * 120);
      const back = await bRow.boundingBox().catch(() => null); const list = await page.getByText(rice, { exact: true }).first().boundingBox().catch(() => null);
      ok(`${lang} ${scheme}: swiping back closes it`, back && rb && Math.abs(back.x - (rb.x - toStart * 88)) < 2, JSON.stringify({ back, list }));
      ok(`${lang} ${scheme}: nothing else was deleted`, (await meals()).includes(rice));
      await shot('06-breakdown-closed');
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
