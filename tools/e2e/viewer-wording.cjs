// Viewer wording (PM-313, Guy 19 Nov 2026): while viewing someone's shared data, "your range" names the person
// ("Yonatan's range", "בטווח של יונתן"); one's own data keeps "your". Against the test server (services/api:
// uvicorn tests.e2e_server:app) and an empty database.
// Usage: node tools/e2e/viewer-wording.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
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
const tab = (page, name) => page.getByRole('tab', { name }).first().click({ timeout: 3000 }).catch(() => page.getByText(name, { exact: true }).last().click());

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
    const account = async (email, name, locale) => {
      await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: name } } } });
      await accept(tk);
      return tk;
    };
    const son = await account('yonatan@example.com', 'יונתן', 'he');
    const dad = await account('abba@example.com', 'Guy', 'he');
    // Two weeks of sensor readings, high every evening: an "above the range in the evening" insight. The dad has none.
    const items = []; let n = 0;
    for (let t = Date.now() - 14 * 86400000; t < Date.now() - 300000; t += 15 * 60000) {
      const h = new Date(t).getHours();
      items.push({ sample_id: `viewer-wording-${n++}`, measured_at: new Date(t).toISOString(), value: h >= 18 && h < 22 ? 215 : 120, unit: 'mg/dL', method: 'sensor' });
    }
    // The import takes at most 1000 readings at a time.
    for (const [tk, pre] of [[son, ''], [dad, 'd-']]) {
      for (let i = 0; i < items.length; i += 1000) {
        await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items: items.slice(i, i + 1000).map((x) => ({ ...x, sample_id: pre + x.sample_id })) } });
      }
    }
    await api('/records', { method: 'POST', token: son, body: { idempotency_key: 'vw-meal-1', kind: 'meal', occurred_at: new Date(Date.now() - 3600000).toISOString(), entered_at: new Date().toISOString(), source: 'manual', data: { items: [{ name: 'Rice', unit: 'g', qty: 100, carbs_g: 28, prov: 'wt', weighed: true }], ate: 'all', carbs_total_g: 28, any_unknown: false } } });
    const inv = (await api('/sharing/invites', { method: 'POST', token: son, body: { scopes: ['glucose', 'insights', 'journal'], relation: 'dad', consent: true } })).json;
    const acc = await api('/sharing/accept', { method: 'POST', token: dad, body: { code: inv.code } });
    ok('share accepted', acc.status === 200 || acc.status === 201, String(acc.status));

    for (const [lang, scheme] of [['he', 'light'], ['en', 'light'], ['he', 'dark']]) {
      const he = lang === 'he';
      await api('/profile', { method: 'PUT', token: dad, body: { locale: lang, answers: { ...ANSWERS, companion: { ...ANSWERS.companion, callMe: 'Guy' } } } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: he ? 'he-IL' : 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message)); page.setDefaultTimeout(6000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const body = () => page.evaluate(() => document.body.innerText);
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill('abba@example.com');
      await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(4500);
      await tab(page, he ? 'סקירה' : 'Overview'); await page.waitForTimeout(3000);
      // A new item unlocked by the two weeks of readings is celebrated once: later.
      await page.getByText(he ? 'אחר כך' : 'Later', { exact: true }).last().click({ timeout: 1500 }).catch(() => null); await page.waitForTimeout(600);
      await shot('01-own-overview');
      const own = await body();
      ok(`${lang} ${scheme}: own data says "your"`, he ? /שלך/.test(own) : /\byour\b/i.test(own));
      // Switch to the son's data.
      await page.getByText(he ? 'החלפה' : 'Switch', { exact: true }).first().click(); await page.waitForTimeout(1000);
      await page.getByText('יונתן', { exact: true }).last().click(); await page.waitForTimeout(4000);
      await tab(page, he ? 'סקירה' : 'Overview'); await page.waitForTimeout(3500);
      await shot('02-viewing-overview');
      const pages = { overview: await body() };
      await page.mouse.wheel(0, 1600); await page.waitForTimeout(1200); await shot('03-viewing-overview-lower');
      pages.overviewLower = await body();
      await tab(page, he ? 'שיחה' : 'Talk'); await page.waitForTimeout(3000);
      await shot('04-viewing-talk');
      const ins = page.getByText(he ? 'תובנות' : 'Insights', { exact: true }).first();
      if (await ins.count()) { await ins.click(); await page.waitForTimeout(1200); await shot('05-viewing-talk-insights'); }
      pages.talk = await body();
      // Every insight of the son's, on the All insights page.
      const allLink = page.getByText(he ? 'כל התובנות' : 'All insights', { exact: true }).first();
      if (await allLink.count()) {
        await allLink.click(); await page.waitForTimeout(3000); await shot('055-viewing-all-insights');
        pages.insights = await body();
        await page.mouse.wheel(0, 1600); await page.waitForTimeout(800); pages.insights += '\n' + (await body());
        await page.goBack().catch(() => null); await page.waitForTimeout(1500);
      }
      await tab(page, he ? 'יומן' : 'Journal'); await page.waitForTimeout(3000);
      await shot('06-viewing-journal');
      pages.journal = await body();
      const all = Object.values(pages).join('\n');
      ok(`${lang} ${scheme}: viewing says the son's range`, he ? /הטווח של יונתן/.test(all) : /יונתן's range/.test(all), (all.match(he ? /[^\n]*של יונתן[^\n]*/ : /[^\n]*יונתן's[^\n]*/) || [''])[0].slice(0, 80));
      const your = all.split('\n').filter((l) => (he ? /הטווח שלך|בטווח שלך|לטווח שלך|הסוכר שלך|היומן שלך/ : /\byour (range|glucose|journal|readings|records|pump|device)\b/i).test(l));
      ok(`${lang} ${scheme}: no "your range" about the son`, your.length === 0, your.slice(0, 3).join(' | '));
      fs.writeFileSync(path.join(out, `${lang}-${scheme}-text.txt`), all);
      // Back to one's own data: "your" again.
      await page.getByText(he ? 'החלפה' : 'Switch', { exact: true }).first().click(); await page.waitForTimeout(800);
      await page.getByText(he ? 'הנתונים שלי' : 'My data', { exact: true }).last().click(); await page.waitForTimeout(3000);
      await tab(page, he ? 'סקירה' : 'Overview'); await page.waitForTimeout(3000);
      const back = await body();
      ok(`${lang} ${scheme}: own data again says "your"`, he ? /שלך/.test(back) : /\byour\b/i.test(back));
      await ctx.close();
    }
  } catch (e) {
    results.push(`FAIL exception — ${e.message.split('\n')[0]}`);
  } finally {
    ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    console.log(results.join('\n'));
    console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length}`);
    await browser.close(); server.close();
  }
});
