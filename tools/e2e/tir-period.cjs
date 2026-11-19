// Main screen time-in-range tile (PM-289, Guy 19 Nov 2026): a tap steps Last 24 hours -> Today so far -> Last 7 days and
// back, the title carries the person's range in parentheses, and the small arrow beside it still opens the Overview.
// End-to-end against the test server (services/api: uvicorn tests.e2e_server:app). Synthetic readings for this check only.
// Usage: node tools/e2e/tir-period.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up p@example.com.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm', classic: true }, checkIns: { frequency: 'moreAtFirst' } };
const SIZES = { small: { width: 375, height: 667 }, large: { width: 440, height: 956 } };
const EMAIL = 'p@example.com'; const PW = 'correct horse battery';

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8092, async () => {
  const base = 'http://localhost:8092';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: EMAIL, password: PW } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: EMAIL, password: PW } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    // Seven days of 5-minute sensor readings up to 3 minutes ago: in range, except high from 30 to 20 hours ago (in the
    // last 24 hours, not today) and high for the whole day four days back (only in the week). The three periods differ.
    const items = []; let n = 0; const now = Date.now(); const day4 = new Date(now - 4 * 86400000).toDateString();
    for (let t = now - 7 * 86400000; t < now - 180000; t += 5 * 60000) {
      const high = (t > now - 30 * 3600000 && t < now - 20 * 3600000) || new Date(t).toDateString() === day4;
      items.push({ sample_id: `e2e-tp-${n}`, measured_at: new Date(t).toISOString(), value: high ? 230 : 110 + ((n * 13) % 50), unit: 'mg/dL', method: 'sensor' }); n++;
    }
    for (let i = 0; i < items.length; i += 1000) await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items: items.slice(i, i + 1000) } });
    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light', 'large'], ['he', 'light', 'large'], ['he', 'dark', 'large'], ['en', 'dark', 'small'], ['he', 'light', 'small']];
    for (const [lang, scheme, size] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', tir: 'זמן בטווח', periods: ['24 השעות האחרונות', 'היום עד עכשיו', '7 הימים האחרונים'], open: 'פתיחת סקירה' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', tir: 'Time in range', periods: ['Last 24 hours', 'Today so far', 'Last 7 days'], open: 'Open Overview' };
      const tag = `${lang} ${scheme} ${size}`;
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(EMAIL);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.goto(`${base}/companion`); await page.waitForTimeout(7000);
      const title = page.getByText(L.tir, { exact: true }).first(); const range = page.getByText(/^\(\u2066?70–180\u2069?\)$/).first();
      const titleText = (await title.count()) && (await range.count()) ? `${await title.innerText()} ${await range.innerText()}` : '';
      ok(`${tag}: title with the range in brackets under it`, !!titleText && (await range.boundingBox()).y > (await title.boundingBox()).y, titleText);
      const g = await page.getByText(he ? 'סוכר' : 'Glucose', { exact: true }).first().boundingBox(); const tb = await title.boundingBox();
      ok(`${tag}: both tile titles on one line`, !!g && !!tb && Math.abs(g.y + g.height / 2 - (tb.y + 18)) < 4, g && tb ? `${g.y} ${tb.y}` : '');
      const tile = page.getByRole('button', { name: new RegExp(`^${L.tir} \\(`) }).first();
      const read = async () => (await tile.getAttribute('aria-label')) || '';
      const seen = [];
      for (let i = 0; i < 4; i++) {
        const label = await read();
        const pct = (label.match(/: (\d+)%/) || [])[1];
        seen.push({ label, pct });
        const p = L.periods[i % 3];
        ok(`${tag}: step ${i} shows "${p}" with a figure`, label.endsWith(p) && pct != null, label);
        if (i < 3) await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${size}-0${i + 1}-${['24h', 'today', 'week'][i]}.png`) });
        await tile.click({ position: { x: 40, y: 90 } }); await page.waitForTimeout(400);
        ok(`${tag}: step ${i} tap stays on the main screen`, page.url().endsWith('/companion'), page.url());
      }
      ok(`${tag}: the three periods give different figures`, new Set(seen.slice(0, 3).map((s) => s.pct)).size === 3, seen.map((s) => s.pct).join(' / '));
      ok(`${tag}: back to the last 24 hours after a full round`, seen[3].pct === seen[0].pct);
      // The arrow beside the title opens the Overview.
      await page.getByRole('link', { name: L.open, exact: true }).first().click(); await page.waitForTimeout(1500);
      ok(`${tag}: arrow opens Overview`, page.url().includes('/overview'), page.url());
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
