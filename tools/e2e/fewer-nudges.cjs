// Fewer nudges (burnout mode, DAP-18 / PM-118, 16 Nov 2026) end-to-end check against the test server
// (services/api: uvicorn tests.e2e_server:app), which stands in for the model.
// Usage: node tools/e2e/fewer-nudges.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up n@example.com. Seeds let-go check-ins with psql (PGDATABASE, default steady_e2e).
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sql = (q) => execFileSync('psql', ['-h', 'localhost', '-U', 'steady', '-tA', '-c', q, process.env.PGDATABASE || 'steady_e2e'], { env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'steady' } }).toString().trim();
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'n@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'n@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'n@example.com'");
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      await api('/follow-ups/fewer-nudges', { method: 'DELETE', token: tk });
      // Three check-ins of the companion's, sent and not answered: the offer's condition. Its last "no" is cleared.
      sql(`update user_settings set routine_state = routine_state::jsonb - 'nudges_offer_hidden' where user_id = '${uid}'`);
      sql(`delete from follow_ups where user_id = '${uid}'`);
      for (let i = 0; i < 3; i++) sql(`insert into follow_ups (id, user_id, idempotency_key, series_id, kind, title, origin, due_at, repeat, status, sent_at) values (gen_random_uuid(), '${uid}', 'fn-${lang}-${scheme}-${i}', gen_random_uuid(), 'check_in', 'How was lunch?', 'app', now() - interval '${i + 1} day', 'once', 'notAnswered', now() - interval '${i + 1} day')`);
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      ok(`${lang} ${scheme}: server offers it`, (await api('/follow-ups/fewer-nudges', { token: tk })).json.offer === true);
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { offer: 'רוצה שבוע רגוע יותר?', yes: 'כן, לשבוע', no: 'לא תודה', checkins: 'בדיקות', title: 'פחות הודעות', week: 'לשבועיים', off: 'לכבות', onOff: 'פחות הודעות עד שתכבה.' }
        : { offer: 'Want a quieter week?', yes: 'Yes, for a week', no: 'No thanks', checkins: 'Check-ins', title: 'Fewer nudges', week: 'For two weeks', off: 'Turn off', onOff: 'Fewer nudges until you turn it off.' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('n@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await shot('00-after-sign-in');
      // The offer on the main screen: swipe the carousel to it.
      const offer = page.getByText(T.offer, { exact: true }).first();
      ok(`${lang} ${scheme}: offer card on the main screen`, (await offer.count()) > 0);
      if (await offer.count()) {
        await offer.scrollIntoViewIfNeeded().catch(() => {});
        await shot('01-offer');
        if (lang === 'en') {
          await page.getByText(T.no, { exact: true }).first().click(); await page.waitForTimeout(1500);
          const st = (await api('/follow-ups/fewer-nudges', { token: tk })).json;
          ok('No thanks: offer gone, mode off', st.offer === false && st.on === false, JSON.stringify(st));
          ok('No thanks: card gone', (await page.getByText(T.offer, { exact: true }).count()) === 0);
        } else {
          await page.getByText(T.yes, { exact: true }).first().click(); await page.waitForTimeout(1500);
          const st = (await api('/follow-ups/fewer-nudges', { token: tk })).json;
          const days = st.until ? (Date.parse(st.until) - Date.now()) / 86_400_000 : 0;
          ok(`${lang} ${scheme}: Yes turns it on for a week`, st.on === true && days > 6.9 && days < 7.1, JSON.stringify(st));
          ok(`${lang} ${scheme}: card gone`, (await page.getByText(T.offer, { exact: true }).count()) === 0);
          await api('/follow-ups/fewer-nudges', { method: 'DELETE', token: tk });
        }
      }
      // The switch on Routine > Check-ins.
      await page.goto(`${base}/routine?tab=checkins`); await page.waitForTimeout(3500);
      await shot('02a-routine');
      const sw = page.getByRole('switch', { name: T.title }).first();
      await sw.scrollIntoViewIfNeeded();
      await shot('02-switch-off');
      await sw.click(); await page.waitForTimeout(1000);
      await shot('03-how-long');
      await page.getByText(T.week, { exact: true }).last().click(); await page.waitForTimeout(1500);
      let st = (await api('/follow-ups/fewer-nudges', { token: tk })).json;
      const days = st.until ? (Date.parse(st.until) - Date.now()) / 86_400_000 : 0;
      ok(`${lang} ${scheme}: two weeks saved`, st.on === true && days > 13.9 && days < 14.1, JSON.stringify(st));
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
      await shot('04-on-banner');
      ok(`${lang} ${scheme}: banner shows`, (await page.getByText(T.off, { exact: true }).count()) > 0);
      await page.getByText(T.off, { exact: true }).first().click(); await page.waitForTimeout(1500);
      st = (await api('/follow-ups/fewer-nudges', { token: tk })).json;
      ok(`${lang} ${scheme}: turned off from the banner`, st.on === false, JSON.stringify(st));
      if (lang === 'en') {
        await page.getByRole('switch', { name: T.title }).first().click(); await page.waitForTimeout(800);
        await page.getByText('Until I turn it off', { exact: true }).last().click(); await page.waitForTimeout(1500);
        ok('until turned off: banner words', (await page.getByText(T.onOff, { exact: true }).count()) > 0);
        st = (await api('/follow-ups/fewer-nudges', { token: tk })).json;
        ok('until turned off: saved', st.on === true && st.until === null, JSON.stringify(st));
        await page.getByRole('switch', { name: T.title }).first().click(); await page.waitForTimeout(1500);
        ok('switch off ends it', (await api('/follow-ups/fewer-nudges', { token: tk })).json.on === false);
      }
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
});
