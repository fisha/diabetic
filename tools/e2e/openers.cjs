// Speech bubbles on the main screen (Guy, 15 Nov 2026): the companion's greeting and a question about something the
// person logged, over the character; tapping one offers text or voice, and text opens the conversation with it.
// End-to-end against the test server (services/api: uvicorn tests.e2e_server:app) and its own database.
// Usage: DB=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/openers.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up o@example.com and logs a meal two hours ago.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000'; const DB = process.env.DB;
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const sql = (q) => execFileSync('psql', [DB, '-v', 'ON_ERROR_STOP=1', '-qtAc', q]).toString().trim();
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'o@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'o@example.com', password: 'correct horse battery' } })).json.access_token;
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString();
    for (const lang of ['en', 'he']) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `op-meal-${lang}`, kind: 'meal', occurred_at: at, entered_at: at, source: 'manual', data: { items: [{ name: lang === 'he' ? 'שקשוקה' : 'Shakshuka', unit: 'plate', qty: 1, carbs_g: 30, prov: 'est' }], ate: 'all', carbs_total_g: 30, any_unknown: false } } });
      // Written in the background on the first ask; the second has them.
      const uid = sql("select id from users where email = 'o@example.com'");
      sql(`update user_settings set openers = '{}' where user_id = '${uid}'`);
      sql(`delete from messages where user_id = '${uid}'`);
      const first = (await api('/conversation/openers', { token: tk })).json;
      await wait(500);
      const second = (await api('/conversation/openers', { token: tk })).json;
      ok(`${lang} server: greeting first, then a follow-up written in the background`, first.openers[0]?.kind === 'greeting' && first.refreshing && second.openers.some((o) => o.kind === 'follow_up'), JSON.stringify(second.openers.map((o) => o.text)));
    }

    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const uid = sql("select id from users where email = 'o@example.com'");
      sql(`update user_settings set openers = '{}' where user_id = '${uid}'`);
      sql(`delete from messages where user_id = '${uid}'`);
      await api('/conversation/openers', { token: tk }); await wait(500);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, locale: 'en-US' });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const L = lang === 'he'
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', text: 'להמשיך בכתב', voice: 'לדבר בקול', q: 'איך היה השקשוקה?', from: 'הודעה מ-Noa' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', text: 'Reply in text', voice: 'Talk by voice', q: 'How was the shakshuka?', from: 'Message from Noa' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('o@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      const later = page.getByText(lang === 'he' ? 'אחר כך' : 'Later', { exact: true }).last();
      if (await later.isVisible().catch(() => false)) { await later.click(); await page.waitForTimeout(800); }
      await shot('01-bubbles');
      const bubbles = page.getByRole('button', { name: new RegExp(`^${L.from}:`) });
      const n = await bubbles.count();
      ok(`${lang} ${scheme}: two bubbles over the character`, n === 2, String(n));
      const follow = page.getByRole('button', { name: new RegExp(`^${L.from}: ${lang === 'he' ? 'איך היה' : 'How was the'}`) }).first();
      const asked = ((await follow.getAttribute('aria-label').catch(() => '')) || '').split(': ').slice(1).join(': ');
      ok(`${lang} ${scheme}: the follow-up about the meal`, (await follow.count()) > 0);
      if (!(await follow.count())) { await ctx.close(); continue; }
      await follow.click(); await page.waitForTimeout(800);
      ok(`${lang} ${scheme}: text and voice offered`, (await page.getByText(L.text, { exact: true }).count()) > 0 && (await page.getByText(L.voice, { exact: true }).count()) > 0);
      await shot('02-choices');
      await page.getByText(L.text, { exact: true }).last().click(); await page.waitForTimeout(2500);
      await shot('03-text');
      const body = await page.locator('body').innerText();
      ok(`${lang} ${scheme}: the conversation opens with the question`, !!asked && body.includes(asked), asked);
      const stored = sql(`select count(*) from messages where user_id = '${uid}' and flags->'about'->>'kind' = 'opener'`);
      ok(`${lang} ${scheme}: stored as the companion's opening`, stored === '1', stored);
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
