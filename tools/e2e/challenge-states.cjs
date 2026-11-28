// Weekly challenge card states on Overview (Guy, 28 Nov 2026, PM-648): a met challenge is celebrated and offers the
// next one, a late one says "Running late" with the days to go, in English and Hebrew, day and night.
// The met and out-of-reach states come from the demo scenario's real records; the in-reach late state depends on the
// weekday, so that one shot rewrites the /young answer in the browser (test tooling only, never the app).
// Needs the test server (services/api: uvicorn tests.e2e_server:app with STEADY_ADMIN_EMAILS=admin@example.com,
// STEADY_ALLOW_EMAIL_SIGN_UP=true, STEADY_REQUIRE_EMAIL_VERIFICATION=false) and a web export built with
// EXPO_PUBLIC_API_URL=http://localhost:8000.
// Usage: node tools/e2e/challenge-states.cjs <web export> <screenshot dir>
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
    const L = {
      en: { met: 'Met', late: 'Running late', next: 'Try next:', done: 'Challenge met!', add: 'Add', toGo: 'to go' },
      he: { met: 'הושלם', late: 'באיחור', next: 'האתגר הבא:', done: 'האתגר הושלם!', add: 'הוספה', toGo: 'חסר' },
    };
    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark'], ['en', 'dark'], ['he', 'light']]) {
      const T = L[lang];
      const shot = async (page, name) => {
        const card = page.getByText(new RegExp(`^(${T.done}|${lang === 'he' ? 'השבוע' : 'This week'})`)).last();
        await card.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(out, `${lang}-${scheme === 'dark' ? 'night' : 'day'}-${name}.png`) });
      };
      for (const state of ['several', 'met', 'late']) {
        const s = (await api('/demo/session', { method: 'POST', body: { link: key, scenario: 't1-780g', locale: lang } })).json;
        const ids = state === 'several' ? ['move', 'log_dinner', 'talk'] : ['move'];
        check(`${lang} ${state}: challenges saved`, (await api('/young/challenges', { method: 'PUT', token: s.access_token, body: { ids } })).status === 204);
        const y = (await api('/young', { token: s.access_token })).json;
        const stored = { refreshToken: s.refresh_token, email: s.email, hasProfile: s.has_profile, access: { token: s.access_token, until: Date.now() + 10 * 60000 } };
        const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, colorScheme: scheme });
        await ctx.addInitScript(([st, lang]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('steady.session', JSON.stringify(st)); localStorage.setItem('steady.preferences', JSON.stringify({ locale: lang, takeBreak: false })); }, [stored, lang]);
        if (state === 'late') {
          // Two of three days done, today still to come: in reach, so the card says how many days are left.
          await ctx.route('**/young', async (route) => {
            if (route.request().method() !== 'GET') return route.continue();
            const r = await route.fetch(); const j = await r.json();
            const c = { id: 'move', met: 2, target: 3, done: false, late: true, left: 1 };
            await route.fulfill({ response: r, json: { ...j, active: [c], challenge: c, next: null } });
          });
        }
        const page = await ctx.newPage();
        const errors = []; page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(base + '/'); await page.waitForTimeout(7000);
        if (await page.getByTestId('break-end').count()) { await page.getByTestId('break-end').click(); await page.goto(base + '/'); await page.waitForTimeout(5000); }
        const move = y.active.find((c) => c.id === 'move');
        if (state === 'met') {
          check(`${lang}: a met challenge is celebrated`, move.done && (await page.getByText(T.done).count()) > 0);
          check(`${lang}: the next challenge is offered`, y.next != null && (await page.getByText(T.next).count()) > 0, String(y.next));
        } else if (state === 'several') {
          check(`${lang}: several, the met one says so`, (await page.getByText(T.met, { exact: true }).count()) > 0);
          check(`${lang}: several, a late one says so`, (await page.getByText(T.late, { exact: true }).count()) > 0, JSON.stringify(y.active));
        } else {
          check(`${lang}: late, the days still to go`, (await page.getByText(T.late, { exact: true }).count()) > 0 && (await page.getByText(new RegExp(T.toGo)).count()) > 0);
        }
        await shot(page, state);
        if (state === 'met' && lang === 'en' && scheme === 'light') {
          await page.getByText(T.next).last().click(); await page.waitForTimeout(2500);
          const after = (await api('/young', { token: s.access_token })).json;
          check(`${lang}: one tap adds the next challenge`, after.active.length === 2 && after.active.some((c) => c.id === y.next), JSON.stringify(after.active.map((c) => c.id)));
          await shot(page, 'met-added');
        }
        check(`${lang} ${state}: no page errors`, errors.length === 0, errors.join(' | '));
        await ctx.close();
      }
    }
  } catch (e) { console.error(e); results.push(false); }
  await browser.close(); server.close();
  const failed = results.filter((r) => !r).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
});
