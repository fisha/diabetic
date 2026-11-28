// The person's own challenge (Guy, 28 Nov 2026, PM-649): made up in the app with what and within how many days, ticked
// on its Overview card, celebrated when met, "Running late" when today is needed, and refused for a glucose target.
// English and Hebrew, day and night. Same test server and web export as challenge-states.cjs.
// Usage: node tools/e2e/own-challenge.cjs <web export> <screenshot dir>
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
      en: { week: 'This week: ', own: 'Make up my own', title: 'Your own challenge', start: 'Start my challenge', habit: 'Challenges are for habits', mine: 'My challenge', done: 'Met 🎉', late: 'Running late', text: 'Walk 15 minutes after dinner', bad: 'Keep my sugar under 140' },
      he: { week: 'השבוע: ', own: 'להמציא אתגר משלי', title: 'אתגר משלך', start: 'להתחיל את האתגר', habit: 'אתגרים הם להרגלים', mine: 'האתגר שלי', done: 'הושלם 🎉', late: 'באיחור', text: 'הליכה אחרי ארוחת ערב', bad: 'סוכר מתחת ל-140' },
    };
    for (const [lang, scheme] of [['en', 'light'], ['he', 'dark'], ['en', 'dark'], ['he', 'light']]) {
      const T = L[lang];
      const name = (n) => path.join(out, `${lang}-${scheme === 'dark' ? 'night' : 'day'}-${n}.png`);
      const s = (await api('/demo/session', { method: 'POST', body: { link: key, scenario: 't1-780g', locale: lang } })).json;
      // The demo person is the same on every run: start without own challenges.
      for (const c of (await api('/young', { token: s.access_token })).json.custom || []) await api(`/young/challenges/custom/${c.id}`, { method: 'DELETE', token: s.access_token });
      await api('/young/challenges', { method: 'PUT', token: s.access_token, body: { ids: ['log_dinner'] } });
      // A late one (both days needed) and a met one, so every card state is on the screen.
      const late = await api('/young/challenges/custom', { method: 'POST', token: s.access_token, body: { text: lang === 'he' ? 'מים בכל ארוחה' : 'Water with every meal', times: 3, days: 3 } });
      const met = await api('/young/challenges/custom', { method: 'POST', token: s.access_token, body: { text: lang === 'he' ? 'לישון עד 23:00' : 'Bed by 11', times: 1, days: 3 } });
      check(`${lang}: own challenges saved`, late.status === 201 && met.status === 201, JSON.stringify([late.json, met.json]));
      check(`${lang}: marked today`, (await api(`/young/challenges/custom/${met.json.id}/today`, { method: 'PUT', token: s.access_token, body: { done: true } })).status === 204);
      check(`${lang}: a glucose target is refused`, (await api('/young/challenges/custom', { method: 'POST', token: s.access_token, body: { text: T.bad, times: 3, days: 7 } })).status === 422);
      const stored = { refreshToken: s.refresh_token, email: s.email, hasProfile: s.has_profile, access: { token: s.access_token, until: Date.now() + 10 * 60000 } };
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, colorScheme: scheme });
      await ctx.addInitScript(([st, lang]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('steady.session', JSON.stringify(st)); localStorage.setItem('steady.preferences', JSON.stringify({ locale: lang, takeBreak: false })); }, [stored, lang]);
      // A late one needs a day already gone (day one is never late): that card's answer is rewritten in the browser to its
      // second day (test tooling only, never the app); the server's own late rule is covered by the API tests.
      const water = lang === 'he' ? 'מים בכל ארוחה' : 'Water with every meal';
      await ctx.route('**/young', async (route) => {
        if (route.request().method() !== 'GET') return route.continue();
        const r = await route.fetch(); const j = await r.json();
        await route.fulfill({ response: r, json: { ...j, custom: (j.custom || []).map((c) => (c.text === water && !c.today ? { ...c, target: 2, days: 3, late: true, left: 2 } : c)) } });
      });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/'); await page.waitForTimeout(7000);
      if (await page.getByTestId('break-end').count()) { await page.getByTestId('break-end').click(); await page.goto(base + '/'); await page.waitForTimeout(5000); }
      const mine = page.getByText(T.mine).first();
      await mine.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(600);
      check(`${lang}: the own cards show on Overview`, (await page.getByText(T.mine).count()) >= 1 && (await page.getByText(T.done).count()) >= 1);
      check(`${lang}: a late own challenge says so`, (await page.getByText(T.late, { exact: true }).count()) >= 1);
      await page.screenshot({ path: name('cards') });
      // Tick today on the late one from its card.
      await page.getByRole('checkbox', { name: new RegExp(lang === 'he' ? 'מים בכל ארוחה' : 'Water with every meal') }).click(); await page.waitForTimeout(2000);
      const y = (await api('/young', { token: s.access_token })).json;
      check(`${lang}: the tick counts today`, y.custom.some((c) => c.id === late.json.id && c.today && c.met === 1), JSON.stringify(y.custom));
      // Create one in the app: the picker, "Make up my own", the sheet.
      await page.getByText(new RegExp('^' + T.week)).first().click(); await page.waitForTimeout(1200);
      await page.screenshot({ path: name('picker') });
      await page.getByText(T.own).last().click(); await page.waitForTimeout(1200);
      check(`${lang}: the create sheet opens`, (await page.getByText(T.title).count()) > 0);
      await page.getByRole('textbox').last().fill(T.bad); await page.getByText(T.start).last().click(); await page.waitForTimeout(1500);
      check(`${lang}: the sheet says habits only`, (await page.getByText(new RegExp(T.habit)).count()) > 0);
      await page.screenshot({ path: name('sheet-habits') });
      await page.getByRole('textbox').last().fill(T.text); await page.waitForTimeout(300);
      await page.screenshot({ path: name('sheet') });
      await page.getByText(T.start).last().click(); await page.waitForTimeout(2500);
      const y2 = (await api('/young', { token: s.access_token })).json;
      check(`${lang}: created from the app`, y2.custom.some((c) => c.text === T.text && c.target === 7 && c.days === 7), JSON.stringify(y2.custom.map((c) => c.text)));
      await page.getByText(T.text).first().scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(600);
      check(`${lang}: the new card shows`, (await page.getByText(T.text).count()) > 0);
      await page.screenshot({ path: name('created') });
      check(`${lang}: no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } catch (e) { console.error(e); results.push(false); }
  await browser.close(); server.close();
  const failed = results.filter((r) => !r).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
});
