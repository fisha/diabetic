// After a meal is saved, "Back to main screen" and "View in journal" close the whole Log a meal flow and land on the
// normal tab (PM-528, Guy 26 Nov 2026). Before the fix the saved screen popped one meal screen and pushed a second set
// of tabs over the still-open flow (on iOS a sheet with the meal screen under it).
// Against the test server (services/api: uvicorn tests.e2e_server:app, STEADY_CORS_ORIGINS=http://localhost:8090).
// Usage: node tools/e2e/meal-closes-after-save.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
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
const TEXT = {
  en: { have: 'I already have an account', email: 'Email', pw: 'Password', go: 'Sign in', agree: 'Agree and continue', self: 'For myself', cont: 'Continue', quick: 'Quick log', meal: /^Meal\b/, desc: 'Describe by voice or text', find: 'Find foods', save: 'Save meal', saved: 'Saved to your journal', home: 'Back to main screen', jrn: 'View in journal', how: 'How would you like to log it?', x: 'Close and return to conversation' },
  he: { have: 'כבר יש לי חשבון', email: 'אימייל', pw: 'סיסמה', go: 'כניסה', agree: 'אישור והמשך', self: 'בשביל עצמי', cont: 'המשך', quick: 'תיעוד מהיר', meal: /^ארוחה/, desc: 'תיאור בקול או בטקסט', find: 'מציאת מאכלים', save: 'שמירת הארוחה', saved: 'נשמר ביומן', home: 'חזרה למסך הראשי', jrn: 'הצגה ביומן', how: 'איך תרצו לרשום אותה?', x: 'סגירה וחזרה לשיחה' },
};

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  // Text anywhere in the page, shown or kept under another screen.
  const inDom = (page, text) => page.evaluate((s) => document.body.textContent.replace(/[⁦-⁩‎‏]/g, '').includes(s), text);
  try {
    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark']]) {
      const T = TEXT[lang];
      const email = `mc-${lang}-${Date.now()}@example.com`;
      await api('/auth/sign-up', { method: 'POST', body: { email, password: 'correct horse battery' } });
      const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: 'correct horse battery' } })).json.access_token;
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(8000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      await page.goto(base); await page.getByText('I already have an account', { exact: true }).first().waitFor({ timeout: 20000 }); await page.waitForTimeout(500);
      if (lang === 'he') { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(T.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(T.email, { exact: true }).fill(email);
      await page.getByLabel(T.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(T.go, { exact: true }).last().click(); await page.waitForURL((u) => !/sign-in|welcome/.test(u.pathname), { timeout: 20000 }).catch(() => {}); await page.waitForTimeout(3000);
      // A new account answers who it is for first.
      if (await page.getByText(T.self, { exact: true }).first().isVisible().catch(() => false)) {
        await page.getByText(T.self, { exact: true }).first().click();
        await page.getByText(T.cont, { exact: true }).last().click(); await page.waitForTimeout(3500);
      }
      for (let i = 0; i < 2; i++) {
        const agree = page.getByText(T.agree, { exact: true }).last();
        if (await agree.isVisible().catch(() => false)) { await agree.click(); await page.waitForTimeout(2000); }
      }

      await shot('00-start');
      for (const exit of ['home', 'jrn']) {
        // The + in the tab bar, then Meal, Describe, one food, Save.
        await page.getByRole('button', { name: T.quick }).last().click(); await page.waitForTimeout(1200);
        await page.getByRole('button', { name: T.meal }).first().click(); await page.waitForTimeout(1500);
        await page.getByText(T.desc, { exact: true }).last().click(); await page.waitForTimeout(1000);
        await page.locator('textarea').last().fill('banana');
        await page.getByText(T.find, { exact: true }).last().click(); await page.waitForTimeout(2500);
        await page.getByText(new RegExp('^' + T.save)).last().click(); await page.waitForTimeout(2000);
        ok(`${lang} ${scheme} ${exit}: meal saved`, await page.getByText(T.saved).first().isVisible().catch(() => false));
        if (exit === 'home') await shot('01-saved');
        await page.getByText(T[exit], { exact: true }).last().click(); await page.waitForTimeout(2500);
        await shot(`02-after-${exit}`);
        const want = exit === 'home' ? /\/overview$|\/$/ : /\/journal$/;
        ok(`${lang} ${scheme} ${exit}: lands on the ${exit === 'home' ? 'Overview' : 'Journal'} tab`, want.test(new URL(page.url()).pathname), page.url());
        ok(`${lang} ${scheme} ${exit}: the meal flow is closed, not left under the tab`, !(await inDom(page, T.how)) && !(await inDom(page, T.saved)));
      }
      // The flow's own X still closes it, from the Journal tab, back to the Journal tab.
      await page.getByRole('button', { name: T.quick }).last().click(); await page.waitForTimeout(1200);
      await page.getByRole('button', { name: T.meal }).first().click(); await page.waitForTimeout(1500);
      await page.getByRole('button', { name: T.x }).first().click(); await page.waitForTimeout(2000);
      ok(`${lang} ${scheme} x: the X closes the flow back to the Journal tab`, /\/journal$/.test(new URL(page.url()).pathname) && !(await inDom(page, T.how)), page.url());
      await ctx.close();
    }
  } catch (e) {
    ok('no exception', false, e.stack);
  }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
  await browser.close(); server.close();
});
