// The upgraded visit report (PM-214, Guy 17 Nov 2026) end to end against the test server (services/api: uvicorn
// tests.e2e_server:app): a visit with several people, suggested questions ticked as boxes plus one of the person's own,
// meals with photos and Health data in the PDF, the report kept with the visit on the phone (Guy chose "only on the
// phone"), and the person's own summary of it. Synthetic readings for this check only. In the web build the kept visits
// live in memory for the session, as everything the protected store holds there.
// Usage: node tools/e2e/visit-report.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <out dir>
// Start from an empty database: it signs up v-en@example.com and v-he@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PW = 'correct horse battery';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token, raw } = {}) => {
  const r = await fetch(API + p, { method, headers: { ...(raw ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: raw ?? (body && JSON.stringify(body)) });
  const buf = Buffer.from(await r.arrayBuffer());
  let json = null; try { json = JSON.parse(buf.toString()); } catch { /* a file */ }
  return { status: r.status, json, buf };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-160' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Sol', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const day = (ms) => new Date(ms).toLocaleDateString('sv');
const photo = fs.readFileSync(path.join(__dirname, '../../apps/mobile/assets/icon.png'));

async function setup(email, locale) {
  await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
  const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
  const docs = (await api('/consent', { token: tk })).json;
  await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
  await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
  await api('/profile', { method: 'PUT', token: tk, body: { locale, answers: ANSWERS } });
  let items = []; let n = 0;
  const start = Date.now() - 35 * 86400000;
  for (let t = start; t < Date.now() - 300000; t += 900000) {
    const h = new Date(t).getHours();
    const v = h >= 17 ? 175 + (n % 7) * 9 : h < 6 ? 95 + (n % 4) * 6 : 125 + (n % 5) * 8;
    items.push({ sample_id: `visit-${email.replace(/[^a-z]/g, '')}-${n++}`, measured_at: new Date(t).toISOString(), value: v, unit: 'mg/dL', method: 'sensor' });
    if (items.length === 1000) { await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } }); items = []; }
  }
  if (items.length) await api('/glucose/import', { method: 'POST', token: tk, body: { store: 'health_connect', items } });
  // Ten days of steps and sleep from Apple Health.
  const hs = [];
  for (let d = 1; d <= 10; d++) {
    const s = new Date(Date.now() - d * 86400000); s.setHours(18, 0, 0, 0);
    hs.push({ type: 'steps', sample_id: `st-${locale}-${d}`, start: s.toISOString(), end: s.toISOString(), value: 5200 + d * 410, origin: 'iPhone' });
    const b = new Date(Date.now() - d * 86400000); b.setHours(0, 30, 0, 0);
    hs.push({ type: 'sleep', sample_id: `sl-${locale}-${d}`, start: b.toISOString(), end: new Date(b.getTime() + (6.5 + (d % 3) * 0.5) * 3600000).toISOString(), origin: 'Watch', data: { stage: 'core' } });
  }
  await api('/health-data/samples', { method: 'POST', token: tk, body: { store: 'apple_health', items: hs } });
  // Yesterday's lunch with a photo, and the insulin for it six minutes later.
  const fd = new FormData(); fd.append('file', new Blob([photo], { type: 'image/png' }), 'meal.png');
  const pid = (await api('/meal/photos', { method: 'POST', token: tk, raw: fd })).json.photo_id;
  const y = new Date(Date.now() - 86400000); y.setHours(13, 0, 0, 0);
  const meal = { items: [{ name: locale === 'he' ? 'שניצל' : 'Schnitzel', unit: 'g', qty: 150, carbs_g: 18, protein_g: 32, fat_g: 14, prov: 'est' }, { name: locale === 'he' ? 'אורז' : 'Rice', unit: 'cup', qty: 1, carbs_g: 44, protein_g: 4, fat_g: 1, prov: 'est' }], ate: 'most', carbs_total_g: 52, protein_total_g: 30, fat_total_g: 12, any_unknown: false, photo_id: pid, photo_ids: [pid], note: locale === 'he' ? 'ארוחת צהריים בעבודה' : 'lunch at work' };
  const m = await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `vr-meal-${locale}`, kind: 'meal', occurred_at: y.toISOString(), entered_at: y.toISOString(), source: 'photo-estimate', data: meal } });
  ok(`${locale}: meal with photo saved`, m.status === 201 || m.status === 200, String(m.status));
  await api('/records', { method: 'POST', token: tk, body: { idempotency_key: `vr-ins-${locale}`, kind: 'insulin', occurred_at: new Date(y.getTime() + 6 * 60000).toISOString(), entered_at: y.toISOString(), source: 'manual', data: { insulin: 'Fiasp', units: 5 } } });
  const visit = await api('/visit', { method: 'PUT', token: tk, body: { date: day(Date.now() + 2 * 86400000), with: ['diabetes_doctor', 'dietitian'] } });
  ok(`${locale}: visit with two people saved`, visit.status === 200 && visit.json.with_all.length === 2, JSON.stringify(visit.json));
  return tk;
}

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8092, async () => {
  const base = 'http://localhost:8092';
  const browser = await chromium.launch();
  const errors = [];
  let page;
  try {
    const tokens = { en: await setup('v-en@example.com', 'en'), he: await setup('v-he@example.com', 'he') };
    const ran = (await api('/e2e/agents/prepare', { method: 'POST' })).json;
    ok('visit preparation written', ran && ran.ran && ran.ran.done >= 2, JSON.stringify(ran));
    for (const [lang, scheme] of [['en', 'light'], ['he', 'light'], ['he', 'dark']]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(8000);
      const he = lang === 'he';
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`), fullPage: true });
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', prof: 'פרופיל', priv: 'פרטיות ונתונים', care: 'שיתוף עם הצוות המטפל', name: 'השם שלך על הדוח', add: 'הוספת שאלה', addBtn: 'הוספה', details: 'להוסיף כל ארוחה, אינסולין ומדידה', photos: 'להוסיף תמונות של הארוחות', create: 'ליצור ולשתף', ready: 'הדוח מוכן', again: 'דוח נוסף', past: 'הביקורים שלי', summary: 'הסיכום שלי מהביקור', saved: 'נשמר', mine: 'אפשר לדבר על הלילות?', who: 'רופא/ת סוכרת, דיאטנ/ית' }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', prof: 'Profile', priv: 'Privacy and data', care: 'Share with my care team', name: 'Your name on the report', add: 'Add a question', addBtn: 'Add', details: 'Add every meal, insulin and reading', photos: 'Add meal photos', create: 'Create and share', ready: 'Your report is ready', again: 'Make another report', past: 'My visits', summary: 'My summary of the visit', saved: 'Saved', mine: 'Can we talk about my nights?', who: 'Diabetes doctor, Dietitian' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill(`v-${lang}@example.com`);
      await page.getByLabel(L.pw, { exact: true }).fill(PW);
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      const later = page.getByText(he ? 'אחר כך' : 'Later', { exact: true });
      if (await later.count()) { await later.last().click(); await page.waitForTimeout(1000); }
      await page.getByRole('tab', { name: L.prof }).first().click().catch(async () => page.getByText(L.prof, { exact: true }).last().click());
      await page.waitForTimeout(2500);
      await page.getByText(L.priv, { exact: true }).first().click(); await page.waitForTimeout(2500);
      await page.getByText(L.care, { exact: true }).first().click(); await page.waitForTimeout(4500);
      ok(`${lang} ${scheme}: the visit shows both people`, (await page.getByText(new RegExp(L.who.replace(/[/()]/g, '.'))).count()) > 0);
      const boxes = page.getByRole('checkbox');
      ok(`${lang} ${scheme}: suggested questions offered as boxes`, (await boxes.count()) > 0, String(await boxes.count()));
      await shot('01-form');
      if (scheme === 'light') {
        await page.getByLabel(L.name, { exact: true }).fill(he ? 'דנה לוי' : 'Dana Levi');
        await boxes.first().click(); await page.waitForTimeout(300);
        await page.getByLabel(L.add, { exact: true }).fill(L.mine);
        await page.getByText(L.addBtn, { exact: true }).last().click(); await page.waitForTimeout(400);
        const states = await page.getByRole('checkbox').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label')}=${e.getAttribute('aria-checked')}`));
        ok(`${lang}: own question added ticked`, states.some((x) => x.startsWith(L.mine) && x.endsWith('=true')), states.join(' | '));
        await page.getByRole('switch', { name: L.details }).click().catch(async () => page.getByText(L.details, { exact: true }).click());
        await page.waitForTimeout(400);
        await page.getByRole('switch', { name: L.photos }).click().catch(async () => page.getByText(L.photos, { exact: true }).click());
        await page.waitForTimeout(400);
        await shot('02-questions-ticked');
        const created = page.waitForResponse((r) => r.url().endsWith('/reports/clinic'));
        await page.getByText(L.create, { exact: true }).last().click();
        const reportId = (await (await created).json()).id;
        await page.getByText(L.ready, { exact: true }).first().waitFor({ timeout: 30000 });
        ok(`${lang}: report made`, true);
        await shot('03-ready');
        const pdf = await api(`/exports/${reportId}/file`, { token: tokens[lang] });
        fs.writeFileSync(path.join(out, `visit-report-${lang}.pdf`), pdf.buf);
        ok(`${lang}: the PDF has the photo`, pdf.buf.includes(Buffer.from('/Subtype /Image')), `${pdf.buf.length} bytes`);
        await page.getByText(L.again, { exact: true }).last().click(); await page.waitForTimeout(1500);
        await page.getByText(L.past, { exact: true }).first().scrollIntoViewIfNeeded();
        ok(`${lang}: past visits listed`, (await page.getByText(L.past, { exact: true }).count()) > 0);
        await shot('04-past-visits');
        await page.getByTestId(/^visit-/).first().click(); await page.waitForTimeout(2500);
        await page.getByLabel(L.summary, { exact: true }).fill(he ? 'הרופאה ביקשה לבדוק שוב את הלילות. הדיאטנית נתנה רעיונות לארוחות בוקר.' : 'The doctor wants to look at the nights again. The dietitian gave breakfast ideas.');
        await page.getByText(L.saved, { exact: true }).first().waitFor({ timeout: 8000 });
        ok(`${lang}: own summary saved on the phone`, true);
        ok(`${lang}: the report is listed with the visit`, (await page.getByText(he ? 'צפייה' : 'View', { exact: true }).count()) > 0);
        await shot('05-visit-detail');
      }
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (page) await page.screenshot({ path: path.join(out, 'zz-fail.png') }).catch(() => {});
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  await browser.close(); server.close();
  process.exit(results.some((r) => !r.startsWith('PASS')) ? 1 : 0);
});
