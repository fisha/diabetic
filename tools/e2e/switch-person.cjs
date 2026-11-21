// Switching between one's own data and a followed person's (PM-328, Guy 20 Nov 2026): the Journal (and the Overview)
// never shows one person's entries under the other, and needs no pull to refresh after a switch.
// Usage: node tools/e2e/switch-person.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000 and EXPO_PUBLIC_WEBSITE_URL=http://localhost:8090> <screenshot dir>
// Against the test server (services/api: uvicorn tests.e2e_server:app) from an empty database, with
// STEADY_CORS_ORIGINS=["http://localhost:8090"], STEADY_ALLOW_EMAIL_SIGN_UP=true, STEADY_REQUIRE_EMAIL_VERIFICATION=false,
// STEADY_REQUIRE_APPROVAL=false. Signs up kid@example.com and parent@example.com. ONLY=he:light runs one look.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const tab = (page, name) => page.getByRole('tab', { name }).first().click({ timeout: 3000 }).catch(() => page.getByText(name, { exact: true }).last().click());
const meal = (key, name, carbs, minAgo) => ({ idempotency_key: key, kind: 'meal', occurred_at: new Date(Date.now() - minAgo * 60000).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items: [{ name, unit: 'g', qty: 100, carbs_g: carbs, prov: 'wt', weighed: true }], ate: 'all', carbs_total_g: carbs, any_unknown: false } });
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
    const accept = async (tk) => {
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    };
    const account = async (email, name) => {
      await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: name } } } });
      await accept(tk);
      return tk;
    };
    const kid = await account('kid@example.com', 'Yonatan');
    const parent = await account('parent@example.com', 'Guy');
    // Each has meals of their own, with names only they have.
    for (const [k, n, c, m] of [['switch-kid-1', 'Pizza', 60, 90], ['switch-kid-2', 'Popcorn', 20, 200]]) await api('/records', { method: 'POST', token: kid, body: meal(k, n, c, m) });
    for (const [k, n, c, m] of [['switch-par-1', 'Salad', 10, 60], ['switch-par-2', 'Omelette', 4, 240]]) await api('/records', { method: 'POST', token: parent, body: meal(k, n, c, m) });
    // The kid shares readings and the journal with the parent, who accepts.
    const code = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose', 'journal'], relation: 'family', consent: true } })).json.code;
    const acc = await api('/sharing/accept', { method: 'POST', token: parent, body: { code } });
    ok('parent follows the kid with the journal shared', acc.status === 200, String(acc.status));

    const KID = ['Pizza', 'Popcorn']; const MINE = ['Salad', 'Omelette'];
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['he', 'light'], ['en', 'light'], ['he', 'dark']])) {
      const he = lang === 'he';
      for (const tk of [kid, parent]) await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: tk === kid ? 'Yonatan' : 'Guy' } } } });
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he ? { sw: 'החלפה', me: 'הנתונים שלי', journal: 'יומן', overview: 'סקירה' } : { sw: 'Switch', me: 'My data', journal: 'Journal', overview: 'Overview' };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });
      const p = await ctx.newPage(); lastPage = p; p.on('pageerror', (e) => errors.push(e.message)); p.setDefaultTimeout(6000);
      const shot = (name) => p.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      await p.goto(base); await p.waitForTimeout(2000);
      if (he) { await p.getByText('עברית', { exact: true }).first().click().catch(() => null); await p.waitForTimeout(800); }
      await p.getByText(L.have, { exact: true }).last().click(); await p.waitForTimeout(1500);
      await p.getByLabel(L.email, { exact: true }).fill('parent@example.com');
      await p.getByLabel(L.pw, { exact: true }).fill(PW);
      await p.getByText(L.go, { exact: true }).last().click(); await p.waitForTimeout(4000);
      const seen = async (names) => { const r = []; for (const n of names) if ((await p.getByText(new RegExp(n)).count()) > 0) r.push(n); return r; };
      const check = async (label, want, not) => {
        const has = await seen(want); const leak = await seen(not);
        ok(`${lang} ${scheme}: ${label} shows its own entries`, has.length === want.length, `shown ${has.join(',') || 'none'}`);
        ok(`${lang} ${scheme}: ${label} shows none of the other person's`, leak.length === 0, leak.join(','));
      };
      const switchTo = async (who) => {
        await p.getByText(T.sw, { exact: true }).first().click(); await p.waitForTimeout(800);
        await p.getByText(who, { exact: true }).last().click(); await p.waitForTimeout(2500);
      };
      // Own journal first, so the tab is mounted with the parent's entries.
      await tab(p, T.journal); await p.waitForTimeout(2500);
      await shot('01-my-journal');
      await check('my journal', MINE, KID);
      // Three rounds, as Guy does it: to the kid and back, no pull to refresh.
      for (let round = 1; round <= 3; round++) {
        await switchTo('Yonatan');
        // PM-384 (Guy, 21 Nov 2026): viewing someone opens on Talk, not Overview.
        ok(`${lang} ${scheme} round ${round}: switch lands on Talk`, new URL(p.url()).pathname === '/companion', p.url());
        await tab(p, T.journal); await p.waitForTimeout(2500);
        if (round === 1) await shot('02-kid-journal');
        await check(`round ${round}: kid's journal`, KID, MINE);
        await tab(p, T.overview); await p.waitForTimeout(1500);
        await switchTo(T.me);
        await tab(p, T.journal); await p.waitForTimeout(2500);
        if (round === 1) await shot('03-my-journal-again');
        await check(`round ${round}: my journal again`, MINE, KID);
      }
      // A quick switch while the journal is still loading: the answer for the first person never lands on the second.
      await switchTo('Yonatan');
      await tab(p, T.journal); await p.waitForTimeout(150);
      await switchTo(T.me);
      await tab(p, T.journal); await p.waitForTimeout(3000);
      await shot('04-after-quick-switch');
      await check('after a quick switch', MINE, KID);
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
    if (lastPage) await lastPage.screenshot({ path: path.join(out, 'zz-failure.png') }).catch(() => null);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
