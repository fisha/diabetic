// Quiet mode, called Take a break until PM-284 (PM-257, Guy 18 Nov 2026; on the main screen since PM-274, 19 Nov): the switch under the character turns the whole app into one black screen with the latest
// reading in big, coloured by the person's own range; past 15 minutes "Not current" with the time and no value; a small
// icon ends it; the server holds the state (pushes withheld but the glucose look-back); steady://break turns it on.
// End-to-end against the test server (services/api: uvicorn tests.e2e_server:app). Synthetic readings for this check only.
// Usage: node tools/e2e/take-a-break.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up b@example.com and s@example.com.
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
const PW = 'correct horse battery';

async function account(email, lang) {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  const docs = (await api('/consent', { token: tk })).json;
  await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
  await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
  return tk;
}
let n = 0;
const reading = (tk, minutesAgo, value) =>
  api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items: [{ sample_id: `e2e-brk-${n++}`, measured_at: new Date(Date.now() - minutesAgo * 60000).toISOString(), value, unit: 'mg/dL', method: 'sensor' }] } });

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  const errors = [];
  const signIn = async (page, email, he) => {
    await page.goto(base); await page.waitForTimeout(2000);
    if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
    await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
    await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill(email);
    await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
    await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(5000);
  };
  try {
    const tk = await account('b@example.com', 'en');
    // [language, scheme, size, latest value, expected colour]: in range, below and above the person's 70-180.
    const runs = [['en', 'light', 'large', 128, 'rgb(169, 200, 230)'], ['he', 'dark', 'large', 64, 'rgb(240, 183, 154)'], ['he', 'light', 'small', 236, 'rgb(210, 188, 235)'], ['en', 'dark', 'small', 141, 'rgb(169, 200, 230)']];
    for (const [lang, scheme, size, value, colour] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      await reading(tk, 2, value);
      const he = lang === 'he';
      const L = he ? { title: 'מצב שקט', end: 'לצאת ממצב שקט', on: 'מצב שקט פעיל' } : { title: 'Quiet mode', end: 'End quiet mode', on: 'Quiet mode on' };
      const tag = `${lang} ${scheme} ${size}`;
      const ctx = await browser.newContext({ viewport: SIZES[size], colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      await signIn(page, 'b@example.com', he);
      // Not in Profile any more (Guy, 19 Nov 2026, PM-274).
      await page.goto(`${base}/profile`); await page.waitForTimeout(4000);
      ok(`${tag}: no switch in Profile`, (await page.getByRole('switch', { name: L.title, exact: true }).count()) === 0);
      // On the main screen, under the character, beside the history and text icons, clear of the tab bar.
      await page.goto(`${base}/companion`); await page.waitForTimeout(6000);
      const sw = page.getByRole('switch', { name: L.title, exact: true });
      ok(`${tag}: main screen has the switch`, (await sw.count()) === 1);
      const sb = await sw.first().boundingBox().catch(() => null); const bar = await page.getByRole('tablist').first().boundingBox();
      const hb = await page.getByRole('button', { name: he ? 'שיחות' : 'Conversations', exact: true }).first().boundingBox().catch(() => null);
      ok(`${tag}: switch clear of the tab bar`, !!sb && !!bar && sb.y + sb.height <= bar.y, sb && bar ? `${Math.round(sb.y + sb.height)} <= ${Math.round(bar.y)}` : 'missing');
      ok(`${tag}: switch in the icons row`, !!sb && !!hb && Math.abs(sb.y + sb.height / 2 - (hb.y + hb.height / 2)) < 12);
      // The label on the far side of the switch: after it in reading order (right of it in English, left in Hebrew).
      const lb = await page.getByText(L.title, { exact: true }).first().boundingBox().catch(() => null);
      ok(`${tag}: label after the switch`, !!sb && !!lb && (he ? lb.x + lb.width <= sb.x + 2 : lb.x >= sb.x + sb.width - 2));
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${size}-01-main.png`) });
      await sw.first().click(); await page.waitForTimeout(2500);
      const end = page.getByRole('button', { name: L.end, exact: true });
      ok(`${tag}: break screen with the end icon`, (await end.count()) === 1);
      // The value is wrapped in direction marks (isolateLtr).
      const big = page.getByTestId('break-screen').getByText(new RegExp(`^[\u2066-\u2069]*${value}[\u2066-\u2069]*$`)).first();
      ok(`${tag}: latest value in big`, (await big.count()) === 1 && ((await big.boundingBox())?.height ?? 0) > 100, `${(await big.boundingBox().catch(() => null))?.height}`);
      ok(`${tag}: coloured by own range`, (await big.evaluate((e) => getComputedStyle(e).color).catch(() => '')) === colour);
      ok(`${tag}: black screen`, (await page.evaluate(() => { const e = document.elementFromPoint(20, innerHeight - 30); let x = e; while (x && getComputedStyle(x).backgroundColor === 'rgba(0, 0, 0, 0)') x = x.parentElement; return x ? getComputedStyle(x).backgroundColor : ''; })) === 'rgb(0, 0, 0)');
      ok(`${tag}: the time and age show`, (await page.getByText(he ? /לפני|עכשיו/ : /ago|now/).count()) > 0);
      ok(`${tag}: no insights or tab bar visible`, await page.evaluate(() => { const t = document.querySelector('[role="tablist"]'); if (!t) return true; const b = t.getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !t.contains(e); }));
      const st = (await api('/follow-ups/break', { token: tk })).json;
      ok(`${tag}: server has the break on`, st && st.on === true);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-${size}-02-break.png`) });
      // Stays after the app opens again.
      await page.goto(`${base}/companion`); await page.waitForTimeout(5000);
      ok(`${tag}: still on after reopening`, (await page.getByRole('button', { name: L.end, exact: true }).count()) === 1);
      await page.getByRole('button', { name: L.end, exact: true }).click(); await page.waitForTimeout(2000);
      ok(`${tag}: the end icon ends it`, (await page.getByRole('button', { name: L.end, exact: true }).count()) === 0 && (await page.getByRole('tablist').count()) > 0);
      ok(`${tag}: server has it off`, (await api('/follow-ups/break', { token: tk })).json.on === false);
      // steady://break (the Action Button's Shortcut) opens it again.
      await page.goto(`${base}/break`); await page.waitForTimeout(4000);
      ok(`${tag}: /break turns it on`, (await page.getByRole('button', { name: L.end, exact: true }).count()) === 1);
      await page.getByRole('button', { name: L.end, exact: true }).click(); await page.waitForTimeout(1500);
      await ctx.close();
    }
    // A reading older than 15 minutes: "Not current" with its time, never the value (PM-226).
    const ts = await account('s@example.com', 'he');
    await reading(ts, 40, 155);
    for (const [lang, scheme] of [['he', 'dark'], ['en', 'light']]) {
      await api('/profile', { method: 'PUT', token: ts, body: { locale: lang, answers: ANSWERS } });
      await api('/follow-ups/break', { method: 'PUT', token: ts });
      const ctx = await browser.newContext({ viewport: SIZES.large, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      await signIn(page, 's@example.com', he);
      await page.goto(`${base}/companion`); await page.waitForTimeout(5000);
      const tag = `${lang} ${scheme} stale`;
      ok(`${tag}: break from the server`, (await page.getByRole('button', { name: he ? 'לצאת ממצב שקט' : 'End quiet mode', exact: true }).count()) === 1);
      ok(`${tag}: says not current`, (await page.getByText(he ? 'לא עדכני' : 'Not current', { exact: true }).count()) > 0);
      ok(`${tag}: no value`, (await page.getByTestId('break-screen').getByText(/155/).count()) === 0 && (await page.getByTestId('break-screen').count()) === 1);
      ok(`${tag}: last reading time`, (await page.getByText(he ? /קריאה אחרונה/ : /Last reading/).count()) > 0);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-large-03-not-current.png`) });
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
