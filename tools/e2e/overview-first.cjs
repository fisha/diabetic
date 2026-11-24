// Overview as the first screen (Guy, 24 Nov 2026, PM-476): the app opens on Overview; the tab bar reads Overview, Talk,
// Journal, Settings; Overview has no page title, the glucose tile beside time in range on top, and one time in range;
// a tap on the time-in-range tile also moves the period below it; Talk shows only the reading's line above the
// character; Journal and Settings have no page title and the reading's line on top.
// Needs the test server (services/api: uvicorn tests.e2e_server:app with STEADY_ADMIN_EMAILS=admin@example.com,
// STEADY_ALLOW_EMAIL_SIGN_UP=true, STEADY_REQUIRE_EMAIL_VERIFICATION=false) and a web export built with
// EXPO_PUBLIC_API_URL=http://localhost:8000.
// Usage: node tools/e2e/overview-first.cjs <web export> <screenshot dir>
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const [root, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.css': 'text/css' };
const api = async (p, { method = 'GET', body, token } = {}) => { const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) }); return { status: r.status, json: await r.json().catch(() => null) }; };
const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`); };
const server = http.createServer((req, res) => { let p = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html'); res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(8095, async () => {
  const base = 'http://localhost:8095';
  const browser = await chromium.launch();
  try {
    const A = { email: 'admin@example.com', password: 'correct horse battery' };
    await api('/auth/sign-up', { method: 'POST', body: A });
    const atk = (await api('/auth/sign-in', { method: 'POST', body: A })).json.access_token;
    const key = (await api('/admin/demo/team-link', { method: 'POST', token: atk })).json.link.split('#k=')[1];
    for (const lang of ['en', 'he']) {
      const L = lang === 'he'
        ? { tabs: ['סקירה', 'שיחה', 'יומן', 'הגדרות'], ov: 'סקירה', jr: 'יומן', st: 'הגדרות', tir: 'זמן בטווח', week: 'שבוע', talk: 'הקישו כדי לדבר' }
        : { tabs: ['Overview', 'Talk', 'Journal', 'Settings'], ov: 'Overview', jr: 'Journal', st: 'Settings', tir: 'Time in range', week: 'Week', talk: 'Tap to talk' };
      const s = (await api('/demo/session', { method: 'POST', body: { link: key, scenario: 't1-780g', locale: lang } })).json;
      const stored = { refreshToken: s.refresh_token, email: s.email, hasProfile: s.has_profile, access: { token: s.access_token, until: Date.now() + 10 * 60000 } };
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await ctx.addInitScript(([st, lang]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('steady.session', JSON.stringify(st)); localStorage.setItem('steady.preferences', JSON.stringify({ locale: lang, takeBreak: false })); }, [stored, lang]);
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/'); await page.waitForTimeout(7000);
      if (await page.getByTestId('break-end').count()) { await page.getByTestId('break-end').click(); await page.goto(base + '/'); await page.waitForTimeout(5000); }
      check(`${lang}: opens on Overview`, page.url().endsWith('/overview'), page.url());
      const tabXs = [];
      for (const label of L.tabs) { const b = await page.getByText(label, { exact: true }).last().boundingBox().catch(() => null); tabXs.push(b ? b.x : null); }
      const order = tabXs.every((x) => x != null) && tabXs.every((x, i) => i === 0 || (lang === 'he' ? x < tabXs[i - 1] : x > tabXs[i - 1]));
      check(`${lang}: tab bar reads ${L.tabs.join(', ')}`, order, JSON.stringify(tabXs));
      const titles = async () => page.evaluate(() => [...document.querySelectorAll('[role="heading"]')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.textContent));
      check(`${lang}: Overview has no page title`, !(await titles()).includes(L.ov), JSON.stringify(await titles()));
      const tirTiles = page.getByRole('button', { name: new RegExp('^' + L.tir) });
      check(`${lang}: time in range tile on top`, (await tirTiles.count()) === 1, String(await tirTiles.count()));
      const tile = await tirTiles.first().boundingBox().catch(() => null);
      check(`${lang}: tile within the first 200 points`, !!tile && tile.y < 200, JSON.stringify(tile));
      await page.screenshot({ path: path.join(out, `${lang}-1-overview.png`) });
      // A tap moves the tile to the next period, and the period below with it (Day -> Week).
      await tirTiles.first().click(); await page.waitForTimeout(2500);
      // The week shows its dates as a range ("11/18 – 11/24"); a day shows "Today, …".
      const range = await page.getByText(/\d{1,2}[./]\d{1,2}\s*–\s*\d{1,2}[./]\d{1,2}/).count();
      check(`${lang}: a tap on the tile moves the period below to Week`, range > 0, String(range));
      await page.screenshot({ path: path.join(out, `${lang}-2-overview-week.png`) });
      await page.getByText(L.tabs[1], { exact: true }).last().click(); await page.waitForTimeout(3500);
      check(`${lang}: Talk shows the character`, (await page.getByText(L.talk, { exact: true }).count()) > 0);
      check(`${lang}: Talk has no time in range`, (await page.getByRole('button', { name: new RegExp('^' + L.tir) }).count()) === 0);
      check(`${lang}: Talk shows the reading's line`, (await page.getByText(/mg\/dL/).count()) > 0);
      await page.screenshot({ path: path.join(out, `${lang}-3-talk.png`) });
      for (const [i, label] of [[2, L.jr], [3, L.st]]) {
        await page.getByText(L.tabs[i], { exact: true }).last().click(); await page.waitForTimeout(3500);
        check(`${lang}: ${label} has no page title`, !(await titles()).includes(label), JSON.stringify(await titles()));
        const pill = await page.getByText(/mg\/dL/).first().boundingBox().catch(() => null);
        check(`${lang}: ${label} shows the reading's line on top`, !!pill && pill.y < 80, JSON.stringify(pill));
        await page.screenshot({ path: path.join(out, `${lang}-${i + 2}-${label}.png`) });
      }
      check(`${lang}: no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } catch (e) { console.error(e); check('no exception', false, e.message); }
  await browser.close(); server.close();
  const failed = results.filter((r) => !r).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
});
