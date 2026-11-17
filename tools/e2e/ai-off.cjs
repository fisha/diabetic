// AI features switch (PM-177, Guy 17 Nov 2026) end-to-end check against the test server
// (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/ai-off.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up a@example.com.
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
const AT = new Date().toISOString();
const ANSWERS = { version: 1, consent: { service: true, training: false, ai: true, legal: true, at: AT }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'a@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'a@example.com', password: 'correct horse battery' } })).json.access_token;
    const consent = async () => (await api('/consent', { token: tk })).json;
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const c0 = await consent();
      if (c0.ai_off) await api('/consent/accept', { method: 'POST', token: tk, body: { versions: { ai: c0.documents.find((d) => d.kind === 'ai').version }, at: AT } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { sw: 'שליחת מידע למנוע AI חיצוני', off: 'תכונות ה־AI כבויות', go: 'פתיחת הגדרות הפרטיות' }
        : { sw: 'Send data to an external AI engine', off: 'AI features are off', go: 'Open privacy settings' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('a@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await shot('00-after-sign-in');
      await page.goto(`${base}/settings/privacy`); await page.waitForTimeout(3000);
      const sw = page.getByRole('switch', { name: T.sw }).first();
      ok(`${lang} ${scheme}: AI switch on and not locked`, (await sw.count()) > 0 && (await sw.isChecked()) && (await sw.isEnabled()));
      await shot('01-privacy-on');
      await sw.click(); await page.waitForTimeout(2500);
      await shot('02-privacy-off');
      let c = await consent();
      ok(`${lang} ${scheme}: off recorded on the server`, c.ai === false && c.ai_off === true && c.pending.length === 0, JSON.stringify({ ai: c.ai, off: c.ai_off, pending: c.pending }));
      ok(`${lang} ${scheme}: switch shows off`, !(await sw.isChecked()));
      await page.goto(`${base}/companion`); await page.waitForTimeout(4000);
      await shot('03-companion-off');
      ok(`${lang} ${scheme}: companion says AI features are off`, (await page.getByText(T.off, { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: no consent screen while off`, !page.url().includes('consent-update'), page.url());
      await page.getByText(T.go, { exact: true }).first().click(); await page.waitForTimeout(3000);
      ok(`${lang} ${scheme}: link opens privacy settings`, page.url().includes('/settings/privacy'), page.url());
      const sw2 = page.getByRole('switch', { name: T.sw }).first();
      ok(`${lang} ${scheme}: switch still off on return`, !(await sw2.isChecked()));
      await sw2.click(); await page.waitForTimeout(2500);
      ok(`${lang} ${scheme}: switch shows on`, await sw2.isChecked());
      c = await consent();
      ok(`${lang} ${scheme}: on again`, c.ai === true && c.ai_off === false, JSON.stringify({ ai: c.ai, off: c.ai_off }));
      await page.goto(`${base}/companion`); await page.waitForTimeout(4000);
      await shot('04-companion-on');
      ok(`${lang} ${scheme}: companion back`, (await page.getByText(T.off, { exact: true }).count()) === 0);
      await ctx.close();
    }
  } catch (e) {
    results.push(`FAIL exception — ${e.message}`);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close(); server.close();
  console.log(results.join('\n'));
  console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length}`);
});
