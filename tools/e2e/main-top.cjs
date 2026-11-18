// Main screen top (PM-238, Guy 18 Nov 2026): the insights line with a count that opens into cards with back/next and
// "N/M", time in range so far today beside the latest reading, and the floating tab bar with the round plus.
// End-to-end against the test server (services/api: uvicorn tests.e2e_server:app). Synthetic readings for this check only.
// Usage: node tools/e2e/main-top.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up m@example.com.
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
const EMAIL = 'm@example.com'; const PW = 'correct horse battery';

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: EMAIL, password: PW } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: EMAIL, password: PW } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    // Six days of 5-minute sensor readings up to 3 minutes ago; high around this hour on the earlier days.
    const items = []; let n = 0; const hour = new Date().getHours();
    for (let t = Date.now() - 6 * 86400000; t < Date.now() - 180000; t += 5 * 60000) {
      const d = new Date(t); const earlier = t < Date.now() - 2 * 3600000;
      const high = earlier && Math.abs(d.getHours() - hour) <= 1;
      items.push({ sample_id: `e2e-mt-${n}`, measured_at: d.toISOString(), value: high ? 215 + (n % 20) : 105 + ((n * 13) % 60), unit: 'mg/dL', method: 'sensor' }); n++;
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
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', ins: 'תובנות', tir: 'זמן בטווח', glu: 'סוכר', next: 'התובנה הבאה', fold: 'סגירת התובנות', add: 'תיעוד מהיר', so: 'עד עכשיו היום', health: 'בריאות', comp: 'מלווה', talk: 'שיחה', hist: 'שיחות', text: 'מעבר לטקסט', report: 'דוח לביקור במרפאה' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', ins: 'Insights', tir: 'Time in range', glu: 'Glucose', next: 'Next insight', fold: 'Close insights', add: 'Quick log', so: 'So far today', health: 'Health', comp: 'Companion', talk: 'Talk', hist: 'Conversations', text: 'Switch to text', report: 'Report for my clinic' };
      const tag = `${lang} ${scheme} ${size}`;
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(EMAIL);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.goto(`${base}/companion`); await page.waitForTimeout(7000);
      const pill = page.getByRole('button', { name: new RegExp(`^${L.ins}, \\d+$`) });
      const has = (await pill.count()) > 0;
      const count = has ? Number((await pill.first().getAttribute('aria-label')).split(', ')[1]) : 0;
      ok(`${tag}: insights line with a count`, has && count > 0, `count ${count}`);
      ok(`${tag}: time in range tile`, (await page.getByText(L.so, { exact: true }).count()) > 0 && (await page.getByText(L.tir, { exact: true }).count()) > 0);
      ok(`${tag}: glucose tile with age`, (await page.getByText(L.glu, { exact: true }).count()) > 0 && (await page.getByText(he ? /דק|עכשיו/ : /min|now/).count()) > 0);
      // Tiles side by side on one row.
      const a = await page.getByText(L.tir, { exact: true }).first().boundingBox(); const b = await page.getByText(L.glu, { exact: true }).first().boundingBox();
      ok(`${tag}: tiles on one row`, !!a && !!b && Math.abs(a.y - b.y) < 30 && Math.abs(a.x - b.x) > 100);
      const plus = page.getByRole('button', { name: L.add, exact: true });
      // One plus, the round one beside the tab bar (Guy, 18 Nov 2026: the header's plus went).
      ok(`${tag}: plus only beside the tab bar`, (await plus.count()) === 1);
      // Only the insights line on top: no character name in a header (Guy, 18 Nov 2026).
      ok(`${tag}: no name header on the main screen`, (await page.getByRole('heading', { name: /Noa/ }).count()) === 0);
      // History and text as icons under "Tap to talk", whole and above the tab bar, also on a small phone.
      const bar = await page.getByRole('tablist').first().boundingBox();
      for (const name of [L.hist, L.text]) {
        const bx = await page.getByRole('button', { name, exact: true }).first().boundingBox().catch(() => null);
        ok(`${tag}: ${name} icon clear of the tab bar`, !!bx && !!bar && bx.y >= 0 && bx.y + bx.height <= bar.y, bx && bar ? `${Math.round(bx.y + bx.height)} <= ${Math.round(bar.y)}` : 'missing');
      }
      // The Talk tab: a sound wave with its name, no orb (Guy, 18 Nov 2026: too many circles).
      const talk = page.getByRole('tab', { name: L.talk, exact: true });
      ok(`${tag}: Talk tab named and selected`, (await talk.count()) === 1 && (await talk.getAttribute('aria-selected')) === 'true');
      ok(`${tag}: Talk tab shows its label`, (await talk.getByText(L.talk, { exact: true }).count()) === 1);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${size}-01-main.png`) });
      if (has) {
        const before = (await page.getByText(L.tir, { exact: true }).first().boundingBox())?.y;
        await pill.first().click(); await page.waitForTimeout(800);
        // The open card lies over the tiles (Guy, 18 Nov 2026): nothing under it moves.
        const after = (await page.getByText(L.tir, { exact: true }).first().boundingBox())?.y;
        ok(`${tag}: open card does not push the tiles`, before != null && after != null && Math.abs(before - after) < 1, `${before} -> ${after}`);
        ok(`${tag}: opens on 1/${count}`, (await page.getByText(`1/${count}`).count()) > 0);
        await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${size}-02-open.png`) });
        if (count > 1) {
          await page.getByRole('button', { name: L.next, exact: true }).click(); await page.waitForTimeout(500);
          ok(`${tag}: next goes to 2/${count}`, (await page.getByText(`2/${count}`).count()) > 0);
          await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${size}-03-next.png`) });
        }
        await page.getByRole('button', { name: L.fold, exact: true }).click(); await page.waitForTimeout(500);
        ok(`${tag}: folds back to the line`, (await pill.count()) > 0);
      }
      if ((await plus.count()) === 1) {
        await plus.click(); await page.waitForTimeout(1500);
        ok(`${tag}: plus opens Quick log`, page.url().includes('/log'), page.url());
      }
      // The clinic visit report is in the Health group of Profile (Guy, 18 Nov 2026).
      await page.goto(`${base}/profile`); await page.waitForTimeout(4000);
      const y = async (txt) => (await page.getByText(txt, { exact: true }).first().boundingBox())?.y ?? -1;
      const [h, r, c] = [await y(L.health.toUpperCase()), await y(L.report), await y(L.comp.toUpperCase())];
      ok(`${tag}: clinic report under Health`, h > 0 && r > h && (c < 0 || r < c), `${h} ${r} ${c}`);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${size}-04-profile.png`) });
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
