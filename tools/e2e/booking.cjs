// Booking help (PM-141, Guy 17 Nov 2026): asking the companion to book a dietitian or a diabetes nurse shows the health fund's booking page and phone line, end-to-end against the test server (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/booking.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up bk@example.com.
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
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'bk@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'bk@example.com', password: 'correct horse battery' } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const he = lang === 'he';
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      // The container has no route to the funds' sites; the fund's page is answered here and only its address is checked.
      await ctx.route(/\.co\.il\//, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: 'fund page' }));
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('bk@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await shot('00-after-sign-in');
      await page.getByLabel(he ? 'מעבר לטקסט' : 'Switch to text', { exact: true }).first().click(); await page.waitForTimeout(800);
      const say = async (text) => {
        await page.getByLabel(he ? 'הודעה ל' : 'Message ', { exact: false }).first().fill(text);
        await page.getByLabel(he ? 'שליחה' : 'Send', { exact: true }).first().click(); await page.waitForTimeout(2500);
      };
      // No fund known yet: the card asks which fund, then shows that fund's page and phone line.
      await say(he ? 'אני רוצה לקבוע תור לדיאטנית' : 'Can you book me an appointment with a dietitian?');
      ok(`${lang}-${scheme} card asks for the fund`, await page.getByText(he ? 'מה קופת החולים שלך?' : 'Which health fund are you with?').last().isVisible());
      await shot('01-choose-fund');
      await page.getByText(he ? 'כללית' : 'Clalit', { exact: true }).last().click(); await page.waitForTimeout(800);
      const t1 = (await page.locator('body').innerText()).replace(/[⁦-⁩]/g, '');
      ok(`${lang}-${scheme} Clalit phone shown`, t1.includes('*2700'), t1.slice(-300));
      ok(`${lang}-${scheme} open button`, await page.getByText(he ? 'פתיחת כללית' : 'Open Clalit', { exact: true }).last().isVisible());
      await shot('02-fund-chosen');
      // The fund the person named comes with the request.
      await say(he ? 'אני צריך תור לאחות סוכרת במכבי' : 'I need an appointment with the diabetes nurse at Maccabi');
      const t2 = (await page.locator('body').innerText()).replace(/[⁦-⁩]/g, '');
      ok(`${lang}-${scheme} nurse card with Maccabi`, t2.includes('*3555') && t2.includes(he ? 'אחות סוכרת' : 'Diabetes nurse'));
      await shot('03-nurse-maccabi');
      const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 4000 }).catch(() => null), page.getByText(he ? 'פתיחת מכבי' : 'Open Maccabi', { exact: true }).last().click()]);
      ok(`${lang}-${scheme} opens the fund's own page`, !!popup && /^https:\/\/www\.maccabi4u\.co\.il\//.test(popup.url()), popup && popup.url());
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
