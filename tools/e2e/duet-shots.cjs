// Duet design screenshots (PM-335): opens demo scenarios (realistic generated data, no fixtures in the app) and
// captures a list of screens in English and Hebrew, day and night, for comparison with the round 4 mockups.
// Needs the test server (services/api: uvicorn tests.e2e_server:app, STEADY_ADMIN_EMAILS=admin@example.com) and a web
// export built with EXPO_PUBLIC_API_URL=http://localhost:8000.
// DPR=2: pixel density of the shots (the website uses 2). Usage: node tools/e2e/duet-shots.cjs <web export> <out dir> [scenario] [routes comma-separated] [variants e.g. en:light,he:dark]
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const [root, out, scenario = 't1-780g', routesArg = '/companion', variantsArg = 'en:light,he:light,en:dark'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.css': 'text/css' };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8091, async () => {
  const base = 'http://localhost:8091';
  const browser = await chromium.launch();
  try {
    const A = { email: 'admin@example.com', password: 'correct horse battery' };
    await api('/auth/sign-up', { method: 'POST', body: A });
    const atk = (await api('/auth/sign-in', { method: 'POST', body: A })).json.access_token;
    const link = (await api('/admin/demo/team-link', { method: 'POST', token: atk })).json.link;
    const key = link.split('#k=')[1];
    for (const v of variantsArg.split(',')) {
      const [lang, scheme] = v.split(':');
      const s = (await api('/demo/session', { method: 'POST', body: { link: key, scenario, locale: lang } })).json;
      if (!s || !s.access_token) throw new Error('no demo session: ' + JSON.stringify(s));
      const ctx = await browser.newContext({ viewport: process.env.VIEW ? { width: +process.env.VIEW.split('x')[0], height: +process.env.VIEW.split('x')[1] } : { width: 393, height: 852 }, colorScheme: scheme === 'dark' ? 'dark' : 'light', deviceScaleFactor: Number(process.env.DPR || 1) });
      const stored = { refreshToken: s.refresh_token, email: s.email, hasProfile: s.has_profile, access: { token: s.access_token, until: Date.now() + 10 * 60000 } };
      const viewing = s.viewing ? { viewing: { ownerId: s.viewing.owner_id, name: s.viewing.name, scopes: s.viewing.scopes }, ownDraft: null } : null;
      await ctx.addInitScript(([st, lang, vw, ts]) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        // SIGNEDOUT=1: no session, for the welcome, sign-up and sign-in screens.
        if (st) localStorage.setItem('steady.session', JSON.stringify(st)); else localStorage.removeItem('steady.session');
        localStorage.setItem('steady.preferences', JSON.stringify({ locale: lang, takeBreak: false, ...(ts ? { textSize: ts } : null) }));
        if (vw) localStorage.setItem('steady.viewing', JSON.stringify(vw)); else localStorage.removeItem('steady.viewing');
      }, [process.env.SIGNEDOUT ? null : stored, lang, viewing, process.env.TEXTSIZE ?? null]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      // AHEAD=<minutes>: the page's clock runs that far ahead, so the latest reading is that old (board x69, stale).
      if (process.env.AHEAD) await page.clock.install({ time: Date.now() + Number(process.env.AHEAD) * 60_000 });
      // NOOPENERS=1: the main screen without Stedio's question (board p01), for comparison; the demo always has one.
      // GREETING=1: only the greeting bubble (the demo also has a question), for comparison with p01.
      if (process.env.GREETING) await page.route('**/conversation/openers', async (r) => { const res = await r.fetch(); const j = await res.json(); r.fulfill({ response: res, body: JSON.stringify({ ...j, openers: j.openers.filter((o) => o.kind === 'greeting') }) }); });
      // CARE=1: a clinic request (c1) and a clinic already shared with (c2), for the care team screens (x88, z34).
      // Screenshot tooling only: the app shows whatever /care-team returns.
      if (process.env.CARE) {
        const y = new Date(Date.now() - 86_400_000); y.setHours(14, 20, 0, 0);
        const base = { city: 'Tel Aviv', clinic: 'Diabetes clinic', expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), questions: null, questions_sent_at: null, requested_at: new Date().toISOString(), requested_by: null, team: [] };
        const body = { consent_version: 'clinic-2026-11-19',
          requests: [{ ...base, id: 'c1', status: 'pending', scopes: [], decided_at: null, last_viewed_at: null, last_viewed_by: null }],
          clinics: [{ ...base, id: 'c2', status: 'accepted', scopes: ['sensor', 'labs'], decided_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), last_viewed_at: y.toISOString(), last_viewed_by: null }] };
        await page.route('**/care-team', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }));
      }
      // LABS=1: saved lab results on two test dates, one corrected after the report was read and one in words (PM-347),
      // posted to the test server as the person would save them. LABSCAN=1: the photo picker gets a small image and the
      // reading answers with rows (one in words) and a result it could not read, for the review screen.
      if (process.env.LABS) {
        const d = (k) => new Date(Date.now() - k * 86_400_000).toISOString().slice(0, 10);
        const rows = [[3, { test: 'a1c', name: 'HbA1c', value: 6.9, unit: '%', read_value: 6.9, range_text: '4.0-5.6' }], [3, { test: 'creatinine', name: 'Creatinine', value: 1.44, unit: 'mg/dL', read_value: 0.94, range_text: '0.6-1.2' }],
          [3, { test: 'other', name: 'Urine glucose', value: null, result_text: 'Negative', read_text: 'Negative', unit: '' }], [3, { test: 'ldl', name: 'LDL', value: 98, unit: 'mg/dL', read_value: 98 }], [90, { test: 'a1c', name: 'HbA1c', value: 7.2, unit: '%', read_value: 7.2 }]];
        for (const [i, [k, data]] of rows.entries()) {
          await api('/records', { method: 'POST', token: s.access_token, body: { idempotency_key: `shots-lab-${lang}-${Date.now()}-${i}`, kind: 'lab', occurred_at: `${d(k)}T08:00:00+00:00`, entered_at: new Date().toISOString(), source: 'manual', data: { source: 'lab_report', taken_on: d(k), ...data } } });
        }
      }
      if (process.env.LABSCAN) {
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        page.on('filechooser', (fc) => fc.setFiles({ name: 'report.png', mimeType: 'image/png', buffer: png }));
        const scan = { provider: 'shots', taken_on: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), skipped: 2, skipped_names: ['Urine ketones', 'Urine protein'],
          rows: [{ test: 'creatinine', name: 'Creatinine', value: 0.94, unit: 'mg/dL', range_text: '0.6-1.2' }, { test: 'other', name: 'Urine glucose', value: null, result_text: 'Negative', unit: '', range_text: 'Negative' }, { test: 'tsh', name: 'TSH', value: 2.1, unit: 'mIU/L', range_text: '0.4-4.0' }] };
        await page.route('**/labs/scan', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(scan) }));
      }
      // ROWS=1: a set change three days ago and a lab result, for the Overview status rows (z21). Screenshot tooling only.
      if (process.env.ROWS) {
        const h = { 'access-control-allow-origin': '*' };
        await page.route('**/devices/events?**', (r) => r.fulfill({ contentType: 'application/json', headers: h, body: JSON.stringify([{ group: 'set_changed', code: 'set_change', occurred_at: new Date(Date.now() - 3 * 86_400_000).toISOString() }]) }));
        await page.route('**/records?**kind=lab**', (r) => r.fulfill({ contentType: 'application/json', headers: h, body: JSON.stringify([{ data: { test: 'a1c', name: 'HbA1c', value: 6.8, unit: '%', taken_on: new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10) } }]) }));
      }
      // BODY=1: a day of Apple Health data for "Body today" (a phone with Health connected; the simulator has none).
      if (process.env.BODY) {
        const at = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
        const body = { steps: 6420, steps_usual: 7100, distance_km: 4.6, heart: { mean: 74, low: 58, high: 121 }, resting: 61, resting_usual: 63,
          night: { bed: new Date(Date.parse(at(23)) - 86_400_000).toISOString(), wake: at(6), asleep_min: 412, in_bed_min: 440, awake: 2, deep_min: 74, rem_min: 96 },
          night_vs_usual: 'usual', exercise_min: 28, exercise_usual: 25, energy_kcal: 410, energy_usual: 450 };
        const day = (k) => new Date(Date.now() - k * 86_400_000).toISOString().slice(0, 10);
        const hours = (f) => Array.from({ length: new Date().getHours() + 1 }, (_, h) => ({ hour: h, value: f(h) }));
        const details = { day: day(0), steps_hours: hours((h) => (h < 7 ? 0 : 200 + ((h * 137) % 900))), steps_days: [6420, 5024, 7856, 5974, 9763, 4081, 13120].map((v, k) => ({ day: day(k), value: v })),
          distance_hours: [], distance_days: [], energy_hours: [], energy_days: [], exercise_hours: [], exercise_days: [], heart_hours: [], resting_days: [], nights: [], segments: [] };
        const h = { 'access-control-allow-origin': '*' };
        await page.route('**/health-data/today/details**', (r) => r.fulfill({ contentType: 'application/json', headers: h, body: JSON.stringify(details) }));
        await page.route(/\/health-data\/today(\?|$)/, (r) => r.fulfill({ contentType: 'application/json', headers: h, body: JSON.stringify(body) }));
      }
      // SENSORTYPES=libre3,...: the sensor types a connected device can tell the end of (the demo has no device link).
      if (process.env.SENSORTYPES) await page.route(/\/settings(\?|$)/, async (r) => { const res = await r.fetch(); const j = await res.json(); r.fulfill({ response: res, body: JSON.stringify({ ...j, sensor_end_types: process.env.SENSORTYPES.split(',') }) }); });
      // ASKQ=<text>: Stedio asks that follow-up question on the main screen (board z05).
      if (process.env.ASKQ) await page.route('**/conversation/openers', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ openers: [{ id: 'f-shot', kind: 'follow_up', text: process.env.ASKQ }], refreshing: false }) }));
      if (process.env.NOOPENERS) await page.route('**/conversation/openers', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ openers: [], refreshing: false }) }));
      for (const r of routesArg.split(',')) {
        await page.goto(base + r); await page.waitForTimeout(Number(process.env.WAIT || 6000));
        // Quiet mode left on by an earlier shot of /break covers every screen: end it first, except on /break itself.
        if (r !== '/break' && (await page.getByTestId('break-end').count())) { await page.getByTestId('break-end').click(); await page.goto(base + r); await page.waitForTimeout(4000); }
        // OPEN=<text>: tap the first element with that text (for example the insights line) before the shot; several
        // taps in turn are separated by ">>" (OPEN='^Sabich$>>^Save meal').
        for (const step of (process.env.OPEN ?? '').split('>>').filter(Boolean)) { await page.getByText(new RegExp(step)).filter({ visible: true }).last().click(); await page.waitForTimeout(1500); }
        const name = `${process.env.TEXTSIZE ? process.env.TEXTSIZE + "-" : ""}${process.env.NOOPENERS ? 'p01-' : ''}${process.env.GREETING ? 'greet-' : ''}${process.env.OPEN ? 'open-' : ''}${process.env.VIEW ? process.env.VIEW + '-' : ''}${scenario}-${r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}-${lang}-${scheme}.png`;
        // PROBE=a|b|c: print where each text sits (for pixel comparison with the mockups).
        if (process.env.PROBE) for (const q of process.env.PROBE.split('|')) { const b = await page.getByText(q, { exact: true }).first().boundingBox().catch(() => null); console.log('probe', q, b && [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]); }
        // TREE=text: print the boxes of that text's ancestors (to find stray spacing).
        if (process.env.TREE) console.log(await page.evaluate((q) => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.textContent.trim() === q) break; const out = []; let e = n && n.parentElement; while (e && out.length < 14) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); out.push(`${Math.round(r.y)} h${Math.round(r.height)} pt${cs.paddingTop} mt${cs.marginTop} gap${cs.rowGap} kids[${[...e.children].map((c) => { const b = c.getBoundingClientRect(); return Math.round(b.y) + ':' + Math.round(b.height); }).join(' ')}]`); e = e.parentElement; } return out.join('\n'); }, process.env.TREE));
        // SCROLL=<px>: scroll the screen's list down that far before the shot (lower parts of a long screen).
        if (process.env.SCROLL) { await page.mouse.move(196, 400); await page.mouse.wheel(0, Number(process.env.SCROLL)); await page.waitForTimeout(900); }
        // AXE=1: run axe-core (WCAG 2.0-2.2 A and AA rules) on the screen and print each violation (PM-572).
        if (process.env.AXE) {
          await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
          const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
          for (const v of res.violations) console.log('axe', r, lang, scheme, v.id, v.impact, v.nodes.length, v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]).join(' | '));
          if (!res.violations.length) console.log('axe', r, lang, scheme, 'clean');
          // AXE=2: each failing element's accessible name and visible text, to find the component.
          if (process.env.AXE === '2') for (const v of res.violations) for (const n of v.nodes) console.log('axenode', r, v.id, JSON.stringify(await page.evaluate((sel) => { const e = document.querySelector(sel); return e && { label: e.getAttribute('aria-label'), text: e.innerText.replace(/\s+/g, ' ').slice(0, 120), testid: e.getAttribute('data-testid'), fg: n => 0 }; }, n.target[0])), (n.any.concat(n.all, n.none)[0] || {}).message || '');
        }
        if (process.env.EVAL) console.log('eval', JSON.stringify(await page.evaluate(process.env.EVAL)));
        await page.screenshot({ path: path.join(out, name) });
        console.log('shot', name);
      }
      await ctx.close();
    }
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close(); server.close();
});
