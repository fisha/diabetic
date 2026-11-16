// Trusted person and following (DAP-19, Guy 16 Nov 2026) end-to-end check against the test server (services/api: uvicorn tests.e2e_server:app).
// Usage: node tools/e2e/sharing.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000 and EXPO_PUBLIC_WEBSITE_URL=http://localhost:8090> <screenshot dir>
// Start from an empty database: it signs up son@example.com and dad@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token, view } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(view ? { 'X-View-As': view } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const tab = (page, name) => page.getByRole('tab', { name }).first().click({ timeout: 3000 }).catch(() => page.getByText(name, { exact: true }).last().click());
let lastPage = null;

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const account = async (email, name, locale) => {
      await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: name } } } });
      return tk;
    };
    const son = await account('son@example.com', 'Itay', 'en');
    const dad = await account('dad@example.com', 'Guy', 'en');
    const sonId = (await api('/auth/me', { token: son })).json.id;
    // A day of sensor readings for the son, a meal in his journal (not shared).
    let items = []; let n = 0;
    for (let t = Date.now() - 26 * 3600000; t < Date.now() - 300000; t += 15 * 60000) {
      const h = new Date(t).getHours();
      items.push({ sample_id: `share-e2e-${n++}`, measured_at: new Date(t).toISOString(), value: h >= 18 && h < 21 ? 205 : 120, unit: 'mg/dL', method: 'sensor' });
    }
    await api('/glucose/import', { method: 'POST', token: son, body: { store: 'health_connect', items } });
    await api('/records', { method: 'POST', token: son, body: { idempotency_key: 'shr-meal-1', kind: 'meal', occurred_at: new Date(Date.now() - 3600000).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items: [{ name: 'Rice', unit: 'g', qty: 100, carbs_g: 28, prov: 'wt', weighed: true }], ate: 'all', carbs_total_g: 28, any_unknown: false } } });

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['he', 'light'], ['en', 'light'], ['he', 'dark']])) {
      const he = lang === 'he';
      for (const tk of [son, dad]) await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: tk === son ? 'Itay' : 'Guy' } } } });
      // Clean slate: no shares between them.
      for (const v of (await api('/sharing', { token: son })).json.viewers) await api(`/sharing/${v.id}`, { method: 'DELETE', token: son });
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { next: 'המשך', agree: 'אני מסכים/ה, ליצור הזמנה', partner: 'משפחה', accept: 'לאשר ולצפות', sw: 'החלפה', me: 'הנתונים שלי', send: 'שליחה', ph: 'לשאול על הנתונים של Itay…', journal: 'יומן', comp: 'מלווה' }
        : { next: 'Continue', agree: 'I agree, create the invite', partner: 'Family', accept: 'Accept and view', sw: 'Switch', me: 'My data', send: 'Send', ph: "Ask about Itay's data…", journal: 'Journal', comp: 'Companion' };
      const signIn = async (page, email) => {
        await page.goto(base); await page.waitForTimeout(2000);
        if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
        await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
        await page.getByLabel(L.email, { exact: true }).fill(email);
        await page.getByLabel(L.pw, { exact: true }).fill(PW);
        await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      };
      const ctxFor = () => browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });

      // The son invites his dad: family, readings and insights, then the consent screen.
      const c1 = await ctxFor(); const p1 = await c1.newPage(); p1.on('pageerror', (e) => errors.push(e.message)); p1.setDefaultTimeout(6000);
      const shot1 = (name) => p1.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      await signIn(p1, 'son@example.com');
      lastPage = p1; await tab(p1, he ? 'פרופיל' : 'Profile'); await p1.waitForTimeout(2000);
      await p1.getByText(he ? 'שיתוף' : 'Sharing', { exact: true }).first().click(); await p1.waitForTimeout(2500);
      await p1.getByRole('radio', { name: T.partner }).first().click();
      await shot1('01-invite-form');
      await p1.getByText(T.next, { exact: true }).last().click(); await p1.waitForTimeout(800);
      await shot1('02-consent');
      await p1.getByText(T.agree, { exact: true }).last().click(); await p1.waitForTimeout(2000);
      await shot1('03-invite-made');
      const inv = (await api('/sharing', { token: son })).json.viewers[0];
      ok(`${lang} ${scheme}: invite with consent and chosen parts`, inv && inv.consent_at && inv.relation === 'family' && inv.scopes.join() === 'glucose,insights', JSON.stringify(inv && inv.scopes));
      await c1.close();

      // The dad opens the link, sees whose data and what, accepts, and is switched to his son's data.
      const c2 = await ctxFor(); const p2 = await c2.newPage(); lastPage = p2; p2.on('pageerror', (e) => errors.push(e.message)); p2.setDefaultTimeout(6000);
      const shot2 = (name) => p2.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      // The link opened before signing in: sign in, then the invite opens again by itself.
      await p2.goto(`${base}/share?code=${inv.code}`); await p2.waitForTimeout(2500);
      if (he) { await p2.getByText('עברית', { exact: true }).first().click().catch(() => null); await p2.waitForTimeout(500); }
      await shot2('04a-link-signed-out');
      await p2.getByText(L.go, { exact: true }).last().click(); await p2.waitForTimeout(1500);
      await p2.getByLabel(L.email, { exact: true }).fill('dad@example.com');
      await p2.getByLabel(L.pw, { exact: true }).fill(PW);
      await p2.getByText(L.go, { exact: true }).last().click(); await p2.waitForTimeout(4000);
      await shot2('04-link-preview');
      ok(`${lang} ${scheme}: link shows the son's name`, (await p2.getByText(/Itay/).count()) > 0);
      await p2.getByText(T.accept, { exact: true }).last().click(); await p2.waitForTimeout(4500);
      await shot2('05-viewing-overview');
      ok(`${lang} ${scheme}: journal tab hidden (not shared)`, (await p2.getByRole('tab', { name: T.journal }).count()) === 0);
      const seen = (await api('/sharing', { token: son })).json.viewers[0];
      ok(`${lang} ${scheme}: owner sees "last viewed"`, !!seen.last_viewed_at);
      await p2.getByText(T.sw, { exact: true }).first().click(); await p2.waitForTimeout(1000);
      await shot2('06-switcher');
      ok(`${lang} ${scheme}: switcher lists my data and the son`, (await p2.getByText(T.me, { exact: true }).count()) > 0 && (await p2.getByText('Itay', { exact: true }).count()) > 0);
      await p2.keyboard.press('Escape'); await p2.waitForTimeout(500);
      await p2.getByText(he ? 'חזרה' : 'Back', { exact: true }).last().click().catch(() => null); await p2.waitForTimeout(800);
      // The dad's own conversation about his son's data.
      await tab(p2, T.comp); await p2.waitForTimeout(2500);
      await p2.getByLabel(T.ph).fill(he ? 'איך היה לו היום?' : 'How was his day?');
      await p2.getByRole('button', { name: T.send }).last().click(); await p2.waitForTimeout(3000);
      await shot2('07-about-chat');
      ok(`${lang} ${scheme}: chat reply`, (await p2.getByText(he ? /רוב המדידות/ : /most readings/).count()) > 0);
      const sonConv = (await api('/conversations', { token: son })).json;
      ok(`${lang} ${scheme}: son sees none of it`, Array.isArray(sonConv) && sonConv.length === 0);
      await tab(p2, he ? 'פרופיל' : 'Profile'); await p2.waitForTimeout(2000);
      await shot2('08-viewer-home');
      // Back to his own data in one tap.
      await p2.getByText(T.sw, { exact: true }).first().click(); await p2.waitForTimeout(800);
      await p2.getByText(T.me, { exact: true }).last().click(); await p2.waitForTimeout(3000);
      await shot2('09-back-to-mine');
      ok(`${lang} ${scheme}: own data again (journal tab back)`, (await p2.getByRole('tab', { name: T.journal }).count()) > 0);
      await c2.close();

      // Someone close with no diabetes data of their own (DAP-7 "family"): the code is entered on that screen.
      const friend = (await api('/auth/sign-in', { method: 'POST', body: { email: 'friend@example.com', password: PW } })).json.access_token
        || (await api('/auth/sign-up', { method: 'POST', body: { email: 'friend@example.com', password: PW } }), (await api('/auth/sign-in', { method: 'POST', body: { email: 'friend@example.com', password: PW } })).json.access_token);
      await api('/auth/persona', { method: 'PUT', token: friend, body: { persona: 'family' } });
      const fcode = (await api('/sharing/invites', { method: 'POST', token: son, body: { scopes: ['glucose'], relation: 'friend', consent: true } })).json.code;
      const c3 = await ctxFor(); const p3 = await c3.newPage(); lastPage = p3; p3.on('pageerror', (e) => errors.push(e.message)); p3.setDefaultTimeout(6000);
      await signIn(p3, 'friend@example.com');
      await p3.getByLabel(he ? 'קוד הזמנה' : 'Invite code', { exact: true }).fill(fcode);
      await p3.screenshot({ path: path.join(out, `${lang}-${scheme}-10-family-code.png`) });
      await p3.getByText(T.next, { exact: true }).last().click(); await p3.waitForTimeout(2500);
      await p3.getByText(T.accept, { exact: true }).last().click(); await p3.waitForTimeout(4000);
      await p3.screenshot({ path: path.join(out, `${lang}-${scheme}-11-family-viewing.png`) });
      ok(`${lang} ${scheme}: someone close with no data of their own follows by code`, (await p3.getByText(/Itay/).count()) > 0 && (await p3.getByRole('tab', { name: T.journal }).count()) === 0);
      await c3.close();
      for (const v of (await api('/sharing', { token: son })).json.viewers) if (v.name !== 'Guy') await api(`/sharing/${v.id}`, { method: 'DELETE', token: son });
    }
  } catch (e) {
    ok('no exception', false, e.stack);
    if (lastPage) await lastPage.screenshot({ path: path.join(out, 'zz-failure.png') }).catch(() => null);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
