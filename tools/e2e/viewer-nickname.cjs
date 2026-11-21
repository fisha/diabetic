// Viewer settings (PM-385, Guy 21 Nov 2026): while viewing someone, the viewer's own "Sharing settings" sit last, and the
// viewer can give the person a name of their own, seen only by the viewer (viewing strip, switcher, companion).
// Usage: node tools/e2e/viewer-nickname.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Needs the test server (services/api: uvicorn tests.e2e_server:app) on an empty database.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const account = async (email, name) => {
      await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: name } } } });
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
      return tk;
    };
    const son = await account('nick-son@example.com', 'Itay');
    const dad = await account('nick-dad@example.com', 'Guy');
    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark']]) {
      const he = lang === 'he';
      for (const [tk, n] of [[son, 'Itay'], [dad, 'Guy']]) await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: n } } } });
      for (const v of (await api('/sharing', { token: son })).json.viewers) await api(`/sharing/${v.id}`, { method: 'DELETE', token: son });
      const code = (await api('/sharing/invites', { method: 'POST', token: son, body: { scopes: ['glucose', 'insights'], consent: true } })).json.code;
      const share = (await api('/sharing/accept', { method: 'POST', token: dad, body: { code } })).json;

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 1 });
      const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: true });
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill('nick-dad@example.com');
      await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(4500);
      await page.getByText(he ? 'החלפה' : 'Switch', { exact: true }).first().click(); await page.waitForTimeout(1000);
      await page.getByText('Itay', { exact: true }).last().click(); await page.waitForTimeout(3500);
      const settings = he ? 'הגדרות' : 'Settings';
      await page.getByRole('tab', { name: settings }).first().click({ timeout: 3000 }).catch(() => page.getByText(settings, { exact: true }).last().click());
      await page.waitForTimeout(2500);
      await shot('01-viewer-settings');
      const y = async (txt) => (await page.getByText(txt, { exact: true }).last().boundingBox())?.y ?? -1;
      const manage = await y(he ? 'הגדרות שיתוף' : 'Sharing settings'); const back = await y(he ? 'חזרה לנתונים שלי' : 'Back to my own data');
      ok(`${lang} ${scheme}: my sharing settings sit last`, manage > back && back > 0, `${manage} > ${back}`);
      const field = page.getByLabel(he ? 'שם או כינוי' : 'Name or nickname', { exact: true });
      await field.fill('Yoni'); await field.press('Enter'); await page.waitForTimeout(2500);
      await shot('02-nickname-saved');
      const mine = (await api('/sharing', { token: dad })).json.viewing.find((x) => x.id === share.id);
      ok(`${lang} ${scheme}: nickname saved for the viewer`, mine && mine.name === 'Yoni' && mine.nickname === 'Yoni' && mine.own_name === 'Itay');
      ok(`${lang} ${scheme}: viewing strip uses the nickname`, (await page.getByText(/Yoni/).count()) > 1);
      ok(`${lang} ${scheme}: owner's side unchanged`, !JSON.stringify((await api('/sharing', { token: son })).json).includes('Yoni'));
      await field.fill(''); await field.press('Enter'); await page.waitForTimeout(2500);
      ok(`${lang} ${scheme}: cleared goes back to the person's name`, (await api('/sharing', { token: dad })).json.viewing[0].name === 'Itay');
      await ctx.close();
    }
  } catch (e) { results.push(`FAIL crashed — ${e.message}`); }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
});
