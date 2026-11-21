// Full-screen meal photo viewer (PM-368) end-to-end check against the test server (stand-in food provider).
// Usage: node tools/e2e/photo-viewer.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up v@example.com, logs one meal with a photo (/tmp/meal.png), then opens it.
// The test server needs STEADY_REQUIRE_APPROVAL=false STEADY_ALLOW_EMAIL_SIGN_UP=true STEADY_REQUIRE_EMAIL_VERIFICATION=false
// and STEADY_CORS_ORIGINS='["http://localhost:8091"]'.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`) });
  const viewer = () => page.getByTestId('photo-viewer-close');
  try {
    const U = { email: 'v@example.com', password: 'correct horse battery' };
    await api('/auth/sign-up', { method: 'POST', body: U });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: U })).json.access_token;
    await api('/profile', { method: 'PUT', token: tk, body: { locale: 'en', answers: ANSWERS } });
    const docs = (await api('/consent', { token: tk })).json.documents;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });
    await page.goto(`${base}/sign-in`); await page.waitForTimeout(1500);
    await page.getByLabel('Email', { exact: true }).fill(U.email);
    await page.getByLabel('Password', { exact: true }).fill(U.password);
    await page.getByText('Sign in', { exact: true }).last().click(); await page.waitForTimeout(2500);

    // Log a meal from a photo, as a person does.
    await page.goto(`${base}/meal`); await page.waitForTimeout(2500);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Choose from photos', { exact: true }).click()]);
    await chooser.setFiles('/tmp/meal.png'); await page.waitForTimeout(1500); await shot('m0-preview');
    await page.getByText('Use this photo', { exact: true }).click(); await page.waitForTimeout(3000); await shot('m1-review');
    await page.getByText('Broth', { exact: true }).click().catch(() => {}); await page.waitForTimeout(300);
    await page.getByText(/^Save meal/).last().click(); await page.waitForTimeout(2000);
    const range = `since=${encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}&until=${encodeURIComponent(new Date(Date.now() + 3600000).toISOString())}`;
    const meals = (await api(`/records?${range}&kind=meal`, { token: tk })).json || [];
    ok('meal saved with its photo', meals.length === 1 && !!meals[0].data.photo_id);

    for (const lang of ['en', 'he']) {
      await page.evaluate((l) => { const p = JSON.parse(localStorage.getItem('steady.preferences') || '{}'); localStorage.setItem('steady.preferences', JSON.stringify({ ...p, locale: l })); }, lang);
      await page.goto(`${base}/companion`); await page.waitForTimeout(3000);
      await page.getByText(lang === 'en' ? 'Journal' : 'יומן', { exact: true }).last().click(); await page.waitForTimeout(3000);
      await shot(`${lang}-0-journal`);
      await page.getByText(lang === 'en' ? 'Rice' : /אורז|Rice/).first().click(); await page.waitForTimeout(2500);
      await shot(`${lang}-1-meal-detail`);
      const photo = page.getByTestId('meal-photo').first();
      ok(`${lang}: photo in the meal detail is a button`, await photo.isVisible());
      await photo.click(); await page.waitForTimeout(1200);
      ok(`${lang}: tap opens the viewer`, await viewer().isVisible());
      const box = await viewer().boundingBox();
      ok(`${lang}: X on the leading side`, lang === 'en' ? box.x < 100 : box.x > 393 - 100, JSON.stringify(box));
      await shot(`${lang}-2-viewer`);
      // Double tap zooms in.
      await page.mouse.click(196, 426); await page.waitForTimeout(80); await page.mouse.click(196, 426); await page.waitForTimeout(900);
      await shot(`${lang}-3-zoomed`);
      await page.mouse.click(196, 426); await page.waitForTimeout(80); await page.mouse.click(196, 426); await page.waitForTimeout(900);
      if (lang === 'en') {
        await viewer().click(); await page.waitForTimeout(900);
        ok('X closes the viewer', !(await viewer().isVisible().catch(() => false)));
        // Swipe down closes it too.
        await photo.click(); await page.waitForTimeout(1200);
        await page.mouse.move(196, 400); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(196, 400 + i * 25); await page.waitForTimeout(16); }
        await shot('en-4-swiping'); await page.mouse.up(); await page.waitForTimeout(900);
        ok('swipe down closes the viewer', !(await viewer().isVisible().catch(() => false)));
      } else {
        await viewer().click(); await page.waitForTimeout(900);
      }
    }
  } catch (e) { results.push('ERROR ' + e.message); await shot('error'); }
  console.log(results.join('\n')); if (errors.length) console.log('page errors:', errors.slice(0, 5).join(' | '));
  await browser.close(); server.close();
  // A failed check or an error exits non-zero, so callers can tell a broken viewer from a pass.
  if (results.some((r) => !r.startsWith('PASS'))) process.exitCode = 1;
});
