// Lab report reading and the results table (PM-213, Guy 17 Nov 2026), end-to-end against the test server
// (services/api: uvicorn tests.e2e_server:app), whose stand-in reader returns the same three results for any photo.
// Usage: node tools/e2e/labs.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from a database without labs-*@example.com. One account per language and theme; one earlier A1c from 2025 is
// saved first, so the table shows an earlier result.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Sage', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
// A tiny valid PNG (1x1), standing in for a photo of a report.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const photo = path.join(out, 'report.png'); fs.writeFileSync(photo, PNG);
const pdf = path.join(out, 'report.pdf'); fs.writeFileSync(pdf, Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'));

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
      const email = `labs-${lang}-${scheme}@example.com`; const pw = 'correct horse battery';
      await api('/auth/sign-up', { method: 'POST', body: { email, password: pw } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: pw } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
      const earlier = { test: 'a1c', name: 'HbA1c', value: 7.2, unit: '%', taken_on: '2025-06-10', source: 'lab_report', range_text: '4.0-5.6' };
      const saved = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `pm213-${lang}-${scheme}`, kind: 'lab', occurred_at: '2025-06-10T08:00:00Z', entered_at: new Date().toISOString(), source: 'manual', data: earlier } });
      ok(`${lang} ${scheme}: earlier result saved`, saved.status === 201 || saved.status === 200, String(saved.status));

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      // findNodeHandle on web is raised by the sign-in screen on main as well, not by these screens.
      page.on('pageerror', (e) => !/findNodeHandle/.test(e.message) && errors.push(e.message));
      page.setDefaultTimeout(8000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he
        ? { title: 'תוצאות בדיקות', choose: 'בחירת תמונות', review: 'בדיקת התוצאות', save: 'שמירת 3 תוצאות', a1c: 'HbA1c', zinc: 'Zinc', what: 'מה הבדיקה הזו', skipped: 'תוצאה אחת בלי מספר' }
        : { title: 'Test results', choose: 'Choose photos', review: 'Check the results', save: 'Save 3 results', a1c: 'HbA1c', zinc: 'Zinc', what: 'What this test is', skipped: 'One result without a number' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(email);
      await page.getByLabel(L.pw, { exact: true }).fill(pw);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await page.goto(base + '/labs'); await page.waitForTimeout(3500);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-01-table-before.png`) });
      ok(`${lang} ${scheme}: table opens`, (await page.getByText(T.title, { exact: true }).count()) > 0);

      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: T.choose }).first().click();
      await (await chooser).setFiles(photo);
      await page.getByText(T.review, { exact: true }).first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-02-review.png`), fullPage: true });
      ok(`${lang} ${scheme}: review shows the three rows and the left-out one`, (await page.getByText(T.zinc).count()) > 0 && (await page.getByText(T.skipped).count()) > 0);
      // Uncheck nothing; save all three.
      await page.getByRole('button', { name: T.save }).first().click();
      await page.getByText(T.title, { exact: true }).first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-03-table-after.png`) });
      const labs = (await api('/labs', { token: tk })).json || [];
      ok(`${lang} ${scheme}: four results stored, the read ones as lab reports with the printed range`, labs.length === 4 && labs.filter((r) => r.data.range_text === '<100').length === 1, String(labs.length));
      await page.getByRole('button', { name: new RegExp(he ? 'המוגלובין מסוכרר|A1c' : 'A1c') }).first().click().catch(async () => page.getByText(/A1c/).first().click());
      await page.waitForTimeout(1500);
      // The table's rows open the test date's screen (PM-263); a row there opens what the test is.
      if ((await page.getByText(T.what, { exact: true }).count()) === 0) {
        await page.getByRole('button', { name: new RegExp(he ? 'המוגלובין מסוכרר|A1c' : 'A1c') }).first().click().catch(() => {});
        await page.waitForTimeout(800);
      }
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-04-explained.png`) });
      ok(`${lang} ${scheme}: tapping a row shows what the test is`, (await page.getByText(T.what, { exact: true }).count()) > 0);
      // Duet x90: one test date's own screen.
      const d = new Date(); const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await page.goto(`${base}/labs/${ymd}`); await page.getByText(T.a1c).first().waitFor({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-06-day.png`) });
      ok(`${lang} ${scheme}: the date's screen lists the results`, (await page.getByText(T.a1c).count()) > 0);
      if (!he) {
        await page.goto(`${base}/labs`); await page.waitForTimeout(3000);
        // A PDF from Files (PM-213, native build from 18 Nov 2026; the web has a file input).
        const pick = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: 'Upload a PDF' }).first().click();
        await (await pick).setFiles(pdf);
        await page.getByText(T.review, { exact: true }).first().waitFor({ timeout: 15000 });
        ok('en: a PDF opens the review too', (await page.getByText(T.zinc).count()) > 0);
        await page.screenshot({ path: path.join(out, `${lang}-${scheme}-05-pdf-review.png`) });
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
