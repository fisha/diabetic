// The conversations list (PM-220, Guy 18 Nov 2026): a short title, one line with the day and time, a tap opens that
// conversation and writing goes on in it, and a swipe deletes it. End-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app), whose stand-in model names a conversation from its first words.
// Usage: node tools/e2e/history.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Needs psql access to the e2e database (E2E_DATABASE, default steady_e2e) to move one conversation to yesterday.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const DB = process.env.E2E_DATABASE || 'postgresql://steady:steady@localhost:5432/steady_e2e';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sql = (q) => execFileSync('psql', [DB, '-qtAc', q]).toString().trim();
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
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'light'], ['he', 'dark']])) {
      const he = lang === 'he';
      const email = `hist-${lang}-${scheme}-${Date.now()}@example.com`; const pw = 'correct horse battery';
      await api('/auth/sign-up', { method: 'POST', body: { email, password: pw } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: pw } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
      // Yesterday's conversation and today's, through the API; yesterday's is moved back a day in the database.
      const said = he ? ['ארוחת בוקר שקטה היום', 'הליכה בערב עם הכלב'] : ['Quiet breakfast this morning', 'Evening walk with the dog'];
      const old = (await api('/conversation/messages', { method: 'POST', token: tk, body: { client_id: `h-${lang}-${scheme}-1`, text: said[0] } })).json.conversation_id;
      sql(`update conversations set started_at = started_at - interval '27 hours', last_message_at = last_message_at - interval '27 hours' where id = '${old}'`);
      sql(`update messages set created_at = created_at - interval '27 hours' where conversation_id = '${old}'`);
      const today = (await api('/conversation/messages', { method: 'POST', token: tk, body: { client_id: `h-${lang}-${scheme}-2`, text: said[1] } })).json.conversation_id;
      ok(`${lang} ${scheme}: two conversations`, old && today && old !== today);
      // The first list asks for titles in the background; the stand-in writes them at once.
      await api('/conversations', { token: tk });
      await new Promise((r) => setTimeout(r, 1500));
      const listed = (await api('/conversations', { token: tk })).json;
      ok(`${lang} ${scheme}: titles written`, listed.length === 2 && listed.every((c) => c.title !== c.first), JSON.stringify(listed.map((c) => c.title)));

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => !/findNodeHandle/.test(e.message) && errors.push(e.message));
      page.setDefaultTimeout(8000);
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { hist: 'שיחות', resumed: 'המשך השיחה מ־', box: 'הודעה ל', send: 'שליחה', del: 'מחיקת השיחה', today: 'היום', yday: 'אתמול' }
        : { hist: 'Conversations', resumed: 'Resumed conversation from', box: 'Message Noa', send: 'Send', del: 'Delete conversation', today: 'Today', yday: 'Yesterday' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(email);
      await page.getByLabel(L.pw, { exact: true }).fill(pw);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);

      await page.getByLabel(T.hist, { exact: true }).first().click(); await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-01-list.png`) });
      const titleOld = listed.find((c) => c.id === old).title;
      ok(`${lang} ${scheme}: rows show the title`, (await page.getByText(titleOld, { exact: true }).count()) > 0);
      ok(`${lang} ${scheme}: rows show today and yesterday with a time`, (await page.getByText(new RegExp(`^${T.today}, \\d\\d:\\d\\d · `)).count()) > 0 && (await page.getByText(new RegExp(`^${T.yday}, \\d\\d:\\d\\d · `)).count()) > 0);

      // Tap yesterday's: it opens in text with the "resumed" line, showing its own messages.
      await page.getByText(titleOld, { exact: true }).first().click(); await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-02-opened.png`) });
      ok(`${lang} ${scheme}: the conversation opens`, (await page.getByText(said[0], { exact: true }).count()) > 0 && (await page.getByText(said[1], { exact: true }).count()) === 0);
      ok(`${lang} ${scheme}: resumed line`, (await page.getByText(new RegExp(`^${T.resumed}`)).count()) > 0);

      // Writing goes on in it, and it is the current one then.
      const box = page.getByLabel(T.box, { exact: false }).first();
      await box.fill(he ? 'ועוד משהו' : 'One more thing'); await page.getByLabel(T.send, { exact: true }).first().click(); await page.waitForTimeout(2500);
      const now = (await api('/conversation/messages', { token: tk })).json;
      ok(`${lang} ${scheme}: writing goes on in the opened conversation`, now.conversation_id === old && now.messages.length === 4, `${now.conversation_id} ${now.messages.length}`);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-03-went-on.png`) });

      if (process.env.SWIPE !== '0') {
        // Swipe a row to the side to delete it (Guy, 18 Nov 2026: deleting is by swiping, never a delete button).
        await page.getByLabel(T.hist, { exact: true }).first().click(); await page.waitForTimeout(2000);
        const todayTitle = listed.find((c) => c.id === today).title;
        const row = page.getByText(todayTitle, { exact: true }).first();
        const b = await row.boundingBox();
        const y = b.y + b.height / 2; const from = he ? 40 : 350; const to = he ? 330 : 60;
        await page.mouse.move(from, y); await page.mouse.down();
        for (let i = 1; i <= 12; i++) await page.mouse.move(from + ((to - from) * i) / 12, y);
        await page.mouse.up(); await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(out, `${lang}-${scheme}-04-swiped.png`) });
        // The uncovered action (or, with a screen reader or on the web, the row's own Delete) is named with the row.
        const del = page.getByRole('button', { name: new RegExp(`${todayTitle}`) }).filter({ hasNotText: todayTitle });
        if ((await del.count()) > 0) await del.first().click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(out, `${lang}-${scheme}-05-confirm.png`) });
        // Confirm in the dialog.
        const confirm = page.getByRole('button', { name: T.del, exact: true });
        if ((await confirm.count()) > 0) await confirm.last().click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(out, `${lang}-${scheme}-06-deleted.png`) });
        const after = (await api('/conversations', { token: tk })).json;
        ok(`${lang} ${scheme}: swipe deletes it on the server`, after.length === 1 && after[0].id === old, String(after.length));
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
