// A parent likes the child's meal and asks about a journal row; the child answers there (PM-486, PM-490, Guy 24 Nov
// 2026). The parent, viewing the child: Journal > the insulin row > a question; the meal row > Like. The child: the
// question pops up, "Answer" opens the row, the answer is sent. The parent: the answer pops up.
// Usage: node tools/e2e/row-questions.cjs <web export (EXPO_PUBLIC_API_URL=http://localhost:8000)> <screenshot dir>
// Needs the test server (services/api: uvicorn tests.e2e_server:app) with email sign-up open.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const run = Date.now().toString(36);
const d = new Date(); const birth = { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear() - 15) };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const consent = async (tk) => {
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((x) => [x.kind, x.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    };
    const signUp = async (email) => {
      await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
      return (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
    };

    const kidMail = `rq-kid-${run}@example.com`; const momMail = `rq-mom-${run}@example.com`;
    const kid = await signUp(kidMail); const mom = await signUp(momMail);
    await consent(kid); await consent(mom);
    await api('/auth/birth', { method: 'PUT', token: kid, body: { birth } });
    const inv = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose', 'insights', 'journal'], consent: true, relation: 'mom', guardian: true } })).json;
    await api('/sharing/accept', { method: 'POST', token: mom, body: { code: inv.code, guardian_confirm: true } });
    const now = Date.now(); const iso = (minAgo) => new Date(now - minAgo * 60000).toISOString();
    const meal = await api('/records', { method: 'POST', token: kid, body: { idempotency_key: `rq-${run}-m1`, kind: 'meal', occurred_at: iso(90), entered_at: iso(90), source: 'manual', data: { items: [{ name: 'Pita', unit: 'g', qty: 100, carbs_g: 50, prov: 'est' }], ate: 'all', carbs_total_g: 50, any_unknown: false } } });
    ok('meal logged', meal.status < 300);
    ok('insulin logged', (await api('/records', { method: 'POST', token: kid, body: { idempotency_key: `rq-${run}-i1`, kind: 'insulin', occurred_at: iso(40), entered_at: iso(40), source: 'manual', data: { insulin: 'Rapid', units: 3 } } })).status < 300);

    const signIn = async (page, email, he) => {
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill(email);
      await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(4500);
    };
    const tab = async (page, name) => {
      await page.getByRole('tab', { name }).first().click({ timeout: 3000 }).catch(() => page.getByText(name, { exact: true }).last().click());
      await page.waitForTimeout(3000);
    };

    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark']]) {
      const he = lang === 'he';
      for (const [tk, callMe] of [[kid, 'Noam'], [mom, 'Dana']]) {
        await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: { ...ANSWERS, ...(tk === kid ? { ageGate: 'under18', birth } : {}), companion: { ...ANSWERS.companion, callMe } } } });
      }
      const shot = (page, name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: false });
      const ctx = () => browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });

      // The parent, viewing Noam.
      const c1 = await ctx(); const p1 = await c1.newPage(); p1.on('pageerror', (e) => errors.push(e.message)); p1.setDefaultTimeout(6000);
      await signIn(p1, momMail, he);
      await shot(p1, '00-signed-in');
      await p1.getByText(he ? 'החלפה' : 'Switch', { exact: true }).first().click(); await p1.waitForTimeout(1000);
      await p1.getByText('Noam', { exact: true }).last().click(); await p1.waitForTimeout(3500);
      await tab(p1, he ? 'יומן' : 'Journal');
      await p1.getByText(/Rapid/).first().click(); await p1.waitForTimeout(2000);
      const qText = he ? `מה אכלת פה? ${lang}` : `What did you eat here? ${lang}`;
      ok(`${lang} ask box on the insulin row`, await p1.getByText(he ? 'לשאול את Noam על זה' : 'Ask Noam about this', { exact: true }).isVisible().catch(() => false));
      await p1.getByLabel(he ? 'השאלה שלך לNoam' : 'Your question to Noam', { exact: true }).fill(qText);
      await shot(p1, '01-parent-asks');
      await p1.getByText(he ? 'לשלוח שאלה' : 'Send question', { exact: true }).click(); await p1.waitForTimeout(2000);
      ok(`${lang} question shows, waiting`, await p1.getByText(he ? 'עוד אין תשובה' : 'No answer yet', { exact: true }).first().isVisible().catch(() => false));
      await shot(p1, '02-parent-asked');
      await p1.getByText(he ? 'יומן' : 'Journal', { exact: true }).first().click().catch(() => null);
      await p1.goBack().catch(() => null); await p1.waitForTimeout(1500);
      await tab(p1, he ? 'יומן' : 'Journal');
      await p1.getByText('Pita').first().click(); await p1.waitForTimeout(2000);
      const like = p1.getByText(he ? 'לייק לארוחה 👍' : 'Like this meal 👍', { exact: true });
      // Liked once in the first round: the second shows it liked.
      if (!he) ok(`${lang} like button on the meal`, await like.isVisible().catch(() => false));
      if (!he) { await like.click(); await p1.waitForTimeout(1500); }
      ok(`${lang} liked`, await p1.getByText(he ? 'נשלח לייק 👍' : 'Liked 👍', { exact: true }).isVisible().catch(() => false));
      await shot(p1, '03-parent-liked');
      await c1.close();

      // The child: the question pops up; Answer opens the row.
      const c2 = await ctx(); const p2 = await c2.newPage(); p2.on('pageerror', (e) => errors.push(e.message)); p2.setDefaultTimeout(6000);
      await signIn(p2, kidMail, he);
      await p2.waitForTimeout(2000);
      // Mom's like comes first, with the meal's time; the question follows once it is closed.
      if (!he) ok(`${lang} child sees the like with the meal`, await p2.getByText(he ? /על הארוחה שלך!/ : /liked your meal!/).first().isVisible().catch(() => false));
      await shot(p2, '04a-child-like');
      await p2.getByText(he ? 'תודה!' : 'Thanks!', { exact: true }).last().click().catch(() => null); await p2.waitForTimeout(1500);
      const pop = p2.getByText(he ? /^שאלה מ/ : /has a question$/).first();
      ok(`${lang} child gets the pop-up`, await pop.isVisible().catch(() => false));
      ok(`${lang} pop-up has the words`, await p2.getByText(qText, { exact: true }).first().isVisible().catch(() => false));
      await shot(p2, '04-child-popup');
      await p2.getByText(he ? 'לענות' : 'Answer', { exact: true }).last().click(); await p2.waitForTimeout(3500);
      const box = p2.getByLabel(he ? 'התשובה שלך' : 'Your answer', { exact: true });
      ok(`${lang} the row opens with an answer box`, await box.isVisible().catch(() => false));
      const aText = he ? `פסטה ${lang}` : `Pasta ${lang}`;
      await box.fill(aText);
      await shot(p2, '05-child-answers');
      await p2.getByText(he ? 'לשלוח תשובה' : 'Send answer', { exact: true }).click(); await p2.waitForTimeout(2000);
      ok(`${lang} answer shows on the row`, await p2.getByText(aText, { exact: true }).isVisible().catch(() => false));
      await shot(p2, '06-child-answered');
      await c2.close();

      // The parent: the answer pops up.
      const c3 = await ctx(); const p3 = await c3.newPage(); p3.on('pageerror', (e) => errors.push(e.message)); p3.setDefaultTimeout(6000);
      await signIn(p3, momMail, he);
      await p3.waitForTimeout(2000);
      ok(`${lang} parent gets the answer`, await p3.getByText(aText, { exact: true }).isVisible().catch(() => false));
      await shot(p3, '07-parent-answer');
      await p3.getByText(he ? 'אישור' : 'OK', { exact: true }).last().click(); await p3.waitForTimeout(1000);
      ok(`${lang} the answer closes`, !(await p3.getByText(aText, { exact: true }).isVisible().catch(() => false)));
      await c3.close();
    }
    const likes = (await api(`/sharing/${(await api('/sharing', { token: mom })).json.viewing[0].id}/likes`, { token: mom })).json;
    ok('like stored once', Array.isArray(likes) && likes.length === 1, JSON.stringify(likes));
  } catch (e) {
    results.push(`FAIL crashed — ${e.message}`);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
});
