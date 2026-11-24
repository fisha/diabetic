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
// The reading's line as it shows on screen: the topmost "mg/dL" text that is really on top at its place (screens kept
// behind the shown tab have the same text).
const pillBox = async (page) => {
  const boxes = [];
  for (const el of await page.getByText(/mg\/dL/).all()) {
    const b = await el.evaluate((e) => {
      const r = e.getBoundingClientRect(); if (!r.height || r.y < 0 || r.y > window.innerHeight) return null;
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return at && (at === e || e.contains(at) || at.contains(e)) ? { x: r.x, y: r.y, height: r.height } : null;
    }).catch(() => null);
    if (b) boxes.push(b);
  }
  boxes.sort((a, b) => a.y - b.y);
  return boxes[0] ?? null;
};
const results = []; const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ' — ' + detail}`); };
const server = http.createServer((req, res) => { let p = path.join(root, decodeURIComponent(req.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html'); res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); }).listen(8095, async () => {
  const base = 'http://localhost:8095';
  const browser = await chromium.launch();
  try {
    const A = { email: 'admin@example.com', password: 'correct horse battery' };
    await api('/auth/sign-up', { method: 'POST', body: A });
    const atk = (await api('/auth/sign-in', { method: 'POST', body: A })).json.access_token;
    const key = (await api('/admin/demo/team-link', { method: 'POST', token: atk })).json.link.split('#k=')[1];
    let adultTalk = null;
    for (const lang of ['en', 'he']) {
      const L = lang === 'he'
        ? { tabs: ['סקירה', 'שיחה', 'יומן', 'הגדרות'], ov: 'סקירה', jr: 'יומן', st: 'הגדרות', tir: 'זמן בטווח', week: 'שבוע', talk: 'הקישו כדי לדבר', ins: /^(תובנות|כל התובנות)/ }
        : { tabs: ['Overview', 'Talk', 'Journal', 'Settings'], ov: 'Overview', jr: 'Journal', st: 'Settings', tir: 'Time in range', week: 'Week', talk: 'Tap to talk', ins: /^(Insights|All insights)/ };
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
      // The line of cards under the two tiles (Guy, 24 Nov 2026, 11:10).
      const feed = await page.getByRole('button', { name: L.ins }).first().boundingBox().catch(() => null);
      check(`${lang}: the insights line sits under the tiles`, !!feed && !!tile && feed.y >= tile.y + tile.height, JSON.stringify({ feed, tile }));
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
      const talkPill = await pillBox(page);
      adultTalk = talkPill;
      await page.screenshot({ path: path.join(out, `${lang}-3-talk.png`) });
      for (const [i, label] of [[2, L.jr], [3, L.st]]) {
        await page.getByText(L.tabs[i], { exact: true }).last().click(); await page.waitForTimeout(3500);
        check(`${lang}: ${label} has no page title`, !(await titles()).includes(label), JSON.stringify(await titles()));
        const pill = await pillBox(page);
        check(`${lang}: ${label} shows the reading's line on top`, !!pill && pill.y < 80, JSON.stringify(pill));
        // At the same height as on Talk (Guy, 24 Nov 2026).
        check(`${lang}: ${label}'s reading line at Talk's height`, !!pill && !!talkPill && Math.abs(pill.y - talkPill.y) <= 1, JSON.stringify({ pill: pill?.y, talk: talkPill?.y }));
        if (i === 3) {
          // The person's name and photo before the search box (Guy, 24 Nov 2026).
          const search = await page.getByLabel(lang === 'he' ? 'חיפוש בהגדרות' : 'Search settings').first().boundingBox().catch(() => null);
          const acct = await page.getByText(/@demo\.stedio|@example\.com/).first().boundingBox().catch(() => null);
          check(`${lang}: Settings shows the account before the search box`, !!search && !!acct && acct.y < search.y, JSON.stringify({ acct, search }));
        }
        await page.screenshot({ path: path.join(out, `${lang}-${i + 2}-${label}.png`) });
      }
      check(`${lang}: no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    // Kids mode follows the same design (Guy, 24 Nov 2026): My days first, its top the child's reading tile beside time in
    // range with the cards above them and no page title; Talk shows only the reading's line, at the same height, then the
    // child's name and the character.
    const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'under18', diabetesType: 'type1', units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm', callMe: 'Noam' }, checkIns: { frequency: 'moreAtFirst' } };
    const PW = 'correct horse battery'; const run = Date.now().toString(36);
    const d = new Date(); const birth = { day: String(d.getDate()), month: String(d.getMonth() + 1), year: String(d.getFullYear() - 11) };
    const signUp = async (email) => { await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } }); return (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json; };
    const consent = async (tk) => {
      const docs = (await api('/consent', { token: tk })).json;
      await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((x) => [x.kind, x.version])), at: new Date().toISOString() } });
      await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });
    };
    const kidS = await signUp(`of-kid-${run}@example.com`); const momS = await signUp(`of-mom-${run}@example.com`);
    const kid = kidS.access_token; const mom = momS.access_token;
    await consent(kid); await consent(mom);
    await api('/auth/birth', { method: 'PUT', token: kid, body: { birth } });
    const inv = (await api('/sharing/invites', { method: 'POST', token: kid, body: { scopes: ['glucose', 'insights'], consent: true, relation: 'mom', guardian: true } })).json;
    await api('/sharing/accept', { method: 'POST', token: mom, body: { code: inv.code, guardian_confirm: true } });
    await api('/profile', { method: 'PUT', token: kid, body: { locale: 'en', answers: { ...ANSWERS, birth } } });
    await api('/profile', { method: 'PUT', token: mom, body: { locale: 'en', answers: { ...ANSWERS, ageGate: 'adult', birth: { day: '', month: '', year: '' }, companion: { ...ANSWERS.companion, callMe: 'Dana' } } } });
    const now = Date.now();
    for (const [m, v] of [[240, 140], [180, 165], [120, 190], [60, 120], [10, 131]]) {
      await api('/glucose', { method: 'POST', token: kid, body: { idempotency_key: `of-${run}-${m}`, measured_at: new Date(now - m * 60000).toISOString(), entered_at: new Date(now - m * 60000).toISOString(), source: 'manual', method: 'meter', value: v, unit: 'mg/dL' } });
    }
    for (const lang of ['en', 'he']) {
      const K = lang === 'he' ? { tabs: ['הימים שלי', 'שיחה', 'מדבקות'], days: 'הימים שלי', hi: 'Noam' } : { tabs: ['My days', 'Talk', 'Stickers'], days: 'My days', hi: 'Noam' };
      const si = (await api('/auth/sign-in', { method: 'POST', body: { email: `of-kid-${run}@example.com`, password: PW } })).json;
      const stored = { refreshToken: si.refresh_token, email: `of-kid-${run}@example.com`, hasProfile: true, access: { token: si.access_token, until: Date.now() + 10 * 60000 } };
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await ctx.addInitScript(([st, lang]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('steady.session', JSON.stringify(st)); localStorage.setItem('steady.preferences', JSON.stringify({ locale: lang, takeBreak: false })); }, [stored, lang]);
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/'); await page.waitForTimeout(7000);
      check(`kid ${lang}: opens on My days`, page.url().endsWith('/overview'), page.url());
      const xs = [];
      for (const label of K.tabs) { const b = await page.getByText(label, { exact: true }).last().boundingBox().catch(() => null); xs.push(b ? b.x : null); }
      check(`kid ${lang}: tab bar reads ${K.tabs.join(', ')}`, xs.every((x) => x != null) && xs.every((x, i) => i === 0 || (lang === 'he' ? x < xs[i - 1] : x > xs[i - 1])), JSON.stringify(xs));
      const heads = await page.evaluate(() => [...document.querySelectorAll('[role="heading"]')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.textContent));
      check(`kid ${lang}: My days has no page title`, !heads.includes(K.days), JSON.stringify(heads));
      const tir = page.getByRole('button', { name: new RegExp('^' + (lang === 'he' ? 'זמן בטווח' : 'Time in range')) });
      check(`kid ${lang}: time in range tile on top`, (await tir.count()) === 1, String(await tir.count()));
      const kt = await tir.first().boundingBox().catch(() => null);
      const kf = await page.getByRole('button', { name: lang === 'he' ? /^(תובנות|כל התובנות)/ : /^(Insights|All insights)/ }).first().boundingBox().catch(() => null);
      check(`kid ${lang}: tiles on top, the insights line right under them`, !!kt && kt.y < 120 && !!kf && kf.y >= kt.y + kt.height, JSON.stringify({ kt, kf }));
      await page.screenshot({ path: path.join(out, `kid-${lang}-1-days.png`) });
      await page.getByText(K.tabs[1], { exact: true }).last().click(); await page.waitForTimeout(3500);
      check(`kid ${lang}: Talk has no time in range`, (await tir.count()) === 0);
      const pill = await pillBox(page);
      check(`kid ${lang}: Talk's reading line at the adult Talk's height`, !!pill && !!adultTalk && Math.abs(pill.y - adultTalk.y) <= 1, JSON.stringify({ pill: pill?.y, adult: adultTalk?.y }));
      check(`kid ${lang}: Talk still greets the child`, (await page.getByText(new RegExp(K.hi)).count()) > 0);
      await page.screenshot({ path: path.join(out, `kid-${lang}-2-talk.png`) });
      check(`kid ${lang}: no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
    // Viewing someone one follows (Guy, 24 Nov 2026): their Overview with the insights line under the two tiles, and Talk
    // with only their reading's line above the character.
    for (const lang of ['en', 'he']) {
      const V = lang === 'he' ? { sw: 'החלפה', talk: 'שיחה', tir: 'זמן בטווח', ins: /^(תובנות|כל התובנות)/ } : { sw: 'Switch', talk: 'Talk', tir: 'Time in range', ins: /^(Insights|All insights)/ };
      const si = (await api('/auth/sign-in', { method: 'POST', body: { email: `of-mom-${run}@example.com`, password: PW } })).json;
      const stored = { refreshToken: si.refresh_token, email: `of-mom-${run}@example.com`, hasProfile: true, access: { token: si.access_token, until: Date.now() + 10 * 60000 } };
      const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
      await ctx.addInitScript(([st, lang]) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1'); localStorage.setItem('steady.session', JSON.stringify(st)); localStorage.setItem('steady.preferences', JSON.stringify({ locale: lang, takeBreak: false })); }, [stored, lang]);
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/'); await page.waitForTimeout(7000);
      await page.getByText(V.sw, { exact: true }).first().click(); await page.waitForTimeout(1000);
      await page.getByText('Noam', { exact: true }).last().click(); await page.waitForTimeout(4500);
      check(`viewer ${lang}: switching opens their Overview`, page.url().endsWith('/overview'), page.url());
      const tir = page.getByRole('button', { name: new RegExp('^' + V.tir) });
      const vt = await tir.first().boundingBox().catch(() => null);
      const vf = await page.getByRole('button', { name: V.ins }).first().boundingBox().catch(() => null);
      check(`viewer ${lang}: Overview has the insights line right under the tiles`, !!vt && !!vf && vf.y >= vt.y + vt.height, JSON.stringify({ vt, vf }));
      await page.screenshot({ path: path.join(out, `viewer-${lang}-1-overview.png`) });
      await page.getByText(V.talk, { exact: true }).last().click(); await page.waitForTimeout(3500);
      check(`viewer ${lang}: Talk has no time in range`, (await tir.count()) === 0, String(await tir.count()));
      check(`viewer ${lang}: Talk has no insights line`, (await page.getByRole('button', { name: V.ins }).count()) === 0);
      const pill = await pillBox(page);
      check(`viewer ${lang}: Talk shows the reading's line on top`, !!pill && pill.y < 140, JSON.stringify(pill));
      await page.screenshot({ path: path.join(out, `viewer-${lang}-2-talk.png`) });
      check(`viewer ${lang}: no page errors`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } catch (e) { console.error(e); check('no exception', false, e.message); }
  await browser.close(); server.close();
  const failed = results.filter((r) => !r).length;
  console.log(`${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
});
