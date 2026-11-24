// Settings Profiles block, no row descriptions, My Stedio, milestones moved (PM-498); routine tab headings (PM-487, Guy 24 Nov 2026): in Settings > Routine, the Activity & fitness blocks (Steps, Active
// energy, Workout minutes, Stand hours, Workouts) have headings that are larger and stronger than the rows under them.
// Also shots of Settings > WhatsApp without the "If you haven't written to Stedio in the last day" note (PM-497).
// Usage: node tools/e2e/settings-polish.cjs <web export (EXPO_PUBLIC_API_URL=http://localhost:8000)> <screenshot dir>
// Needs the test server (services/api: uvicorn tests.e2e_server:app, STEADY_WHATSAPP_ENABLED=true). The WhatsApp link
// and the waiting-list approval are made with LINK_SQL (a psql command for the test database), since the real link needs a message from a phone.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm', callMe: 'Dana' }, checkIns: { frequency: 'moreAtFirst' } };
const PW = 'correct horse battery';
const run = Date.now().toString(36);
const A11Y = { en: 'Accessibility', he: 'נגישות' };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    const email = `rh-${run}@example.com`;
    await api('/auth/sign-up', { method: 'POST', body: { email, password: PW } });
    // The test database lets the account past the waiting list, as an admin would.
    if (process.env.LINK_SQL) execSync(`${process.env.LINK_SQL} "UPDATE users SET approved_at = now(), email_verified_at = coalesce(email_verified_at, now()) WHERE email = '${email}'"`);
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email, password: PW } })).json.access_token;
    const docs = (await api('/consent', { token: tk })).json;
    await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((x) => [x.kind, x.version])), at: new Date().toISOString() } });
    await api('/consent/ai', { method: 'POST', token: tk, body: { at: new Date().toISOString() } });

    // Three weeks of steps, active energy, exercise minutes, stood hours and a few runs, as the phone would send them.
    const items = []; let n = 0;
    const at = (h, m, daysAgo) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d; };
    const s = (type, start, end, value, unit, data) => items.push({ type, sample_id: `rh-${String(n++).padStart(8, '0')}`, start: start.toISOString(), end: end.toISOString(), value, unit, origin: 'com.apple.health.watch', ...(data ? { data } : {}) });
    for (let d = 1; d <= 21; d++) {
      const wk = [0, 6].includes(at(12, 0, d).getDay());
      s('steps', at(17, 0, d), at(18, 0, d), (wk ? 5200 : 7800) + 150 * (d % 5), 'count');
      s('active_energy', at(17, 0, d), at(18, 0, d), 380 + 12 * (d % 6), 'kcal');
      s('exercise_time', at(17, 0, d), at(18, 0, d), 24 + (d % 4) * 3, 'min');
      for (let h = 8; h < 8 + 9 + (d % 3); h++) s('stand_hour', at(h, 0, d), at(h, 59, d), 1, 'count');
      if (d % 3 === 0) s('workout', at(18, 0, d), at(18, 35, d), null, null, { activity: 37 });
    }
    s('steps', at(0, 30, 0), at(Math.max(1, new Date().getHours()), 0, 0), 3100, 'count');
    const r = await api('/health-data/samples', { method: 'POST', token: tk, body: { store: 'apple_health', items } });
    ok('health samples saved', r.status === 200, JSON.stringify(r.json).slice(0, 120));
    const act = (await api('/health-data/activity?kinds=2', { token: tk })).json;
    ok('activity has blocks', !!act, JSON.stringify(act).slice(0, 160));
    if (process.env.LINK_SQL) execSync(`${process.env.LINK_SQL} "INSERT INTO whatsapp_links (id, user_id, phone_sealed, phone_hash, phone_last3, linked_at, kinds_off) SELECT gen_random_uuid(), id, 'x', md5(id::text), '123', now(), '[]'::jsonb FROM users WHERE email = '${email}'"`);
    const wa = (await api('/whatsapp', { token: tk })).json;
    ok('WhatsApp linked', wa && wa.linked, JSON.stringify(wa).slice(0, 120));

    for (const [lang, scheme] of [['en', 'light'], ['en', 'dark'], ['he', 'light'], ['he', 'dark']]) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click().catch(() => null); await page.waitForTimeout(800); }
      await page.getByText(he ? 'כבר יש לי חשבון' : 'I already have an account', { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(he ? 'אימייל' : 'Email', { exact: true }).fill(email);
      await page.getByLabel(he ? 'סיסמה' : 'Password', { exact: true }).fill(PW);
      await page.getByText(he ? 'כניסה' : 'Sign in', { exact: true }).last().click(); await page.waitForTimeout(4500);

      const st = he ? 'הגדרות' : 'Settings';
      await page.getByRole('tab', { name: st }).first().click({ timeout: 3000 }).catch(() => page.getByText(st, { exact: true }).last().click());
      await page.waitForTimeout(3000);
      // Settings (PM-498): the Profiles block first, no description lines, "My Stedio", milestones beside WhatsApp.
      const txt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} Profiles block`, txt.includes(he ? 'פרופילים' : 'Profiles') && txt.includes(he ? 'פרופיל שקט' : 'Quiet profile') && txt.includes(he ? 'פרופיל מתקדם' : 'Advanced profile'));
      ok(`${lang}-${scheme} My Stedio`, txt.includes(he ? 'ה־Stedio שלי' : 'My Stedio'));
      ok(`${lang}-${scheme} no description lines`, !txt.includes(he ? 'לדבר עם Stedio בוואטסאפ' : 'Talk to Stedio in WhatsApp') && !txt.includes(he ? 'רק המדידה האחרונה, בלי תזכורות' : 'Only your latest reading, no nudges'));
      ok(`${lang}-${scheme} old mode rows gone`, !txt.includes(he ? 'מצב פשוט' : 'Simple mode'));
      const order = ['WhatsApp', he ? 'אבני הדרך שלי' : 'My milestones', he ? 'התראות' : 'Notifications'].map((w) => txt.indexOf(w));
      ok(`${lang}-${scheme} milestones right after WhatsApp`, order[0] > 0 && order[1] > order[0] && order[2] > order[1], order.join(','));
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-00-settings.png`) });
      await page.getByRole('radio', { name: he ? 'פרופיל פשוט' : 'Simple profile' }).first().click(); await page.waitForTimeout(1500);
      // Simple profile hides My milestones, as Simple mode did (PM-450).
      const simpleTxt = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} Simple profile turns on`, !simpleTxt.includes(he ? 'אבני הדרך שלי' : 'My milestones'));
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-00b-settings-simple.png`) });
      await page.getByRole('radio', { name: he ? 'פרופיל מתקדם' : 'Advanced profile' }).first().click(); await page.waitForTimeout(1500);
      await page.getByText(he ? 'פרופיל שקט' : 'Quiet profile', { exact: true }).last().click(); await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-00c-quiet-page.png`) });
      await page.goBack().catch(() => null); await page.waitForTimeout(2500);
      // Accessibility without "Increase contrast" (PM-499).
      await page.getByText(A11Y[lang], { exact: true }).last().click(); await page.waitForTimeout(2500);
      const a11y = await page.evaluate(() => document.body.innerText);
      ok(`${lang}-${scheme} no Increase contrast`, !a11y.includes(he ? 'הגברת ניגודיות' : 'Increase contrast') && a11y.includes(he ? 'גודל טקסט' : 'Text size'));
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-00d-accessibility.png`) });
      await page.goBack().catch(() => null); await page.waitForTimeout(2500);
      await page.getByText(he ? 'שגרה, בדיקות וזיכרון' : 'Routine, check-ins and memory', { exact: true }).last().click(); await page.waitForTimeout(4000);
      const head = page.getByText(he ? 'פעילות וכושר' : 'Activity & fitness', { exact: true }).first();
      await head.scrollIntoViewIfNeeded().catch(() => null); await page.waitForTimeout(600);
      const steps = page.getByRole('heading', { name: he ? 'צעדים' : 'Steps', exact: true }).last();
      const row = page.getByText(/A usual day:|יום רגיל:/).last();
      const fs1 = await steps.evaluate((e) => parseFloat(getComputedStyle(e).fontSize) * 1000 + parseInt(getComputedStyle(e).fontWeight, 10)).catch(() => 0);
      const fs2 = await row.evaluate((e) => parseFloat(getComputedStyle(e).fontSize) * 1000 + parseInt(getComputedStyle(e).fontWeight, 10)).catch(() => 0);
      ok(`${lang}-${scheme} block heading stronger than its rows`, fs1 > fs2 && fs1 >= Math.floor(fs2 / 1000) * 1000, `${fs1} vs ${fs2}`);
            await steps.evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => window.scrollBy(0, -140)); await page.waitForTimeout(500);
      // Scroll the screen's own scroller so the card starts near the top.
      await steps.evaluate((e) => { let p = e.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 10 && getComputedStyle(p).overflowY !== 'visible')) p = p.parentElement; if (p) p.scrollTop += e.getBoundingClientRect().top - 170; });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-01-routine-activity.png`) });
      await steps.evaluate((e) => { let p = e.parentElement; while (p && !(p.scrollHeight > p.clientHeight + 10 && getComputedStyle(p).overflowY !== 'visible')) p = p.parentElement; if (p) p.scrollTop += 560; });
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-02-routine-activity-more.png`) });

      await page.goBack().catch(() => null); await page.waitForTimeout(2500);
      await page.getByText('WhatsApp', { exact: true }).last().click(); await page.waitForTimeout(3500);
      const note = await page.getByText(/in the last day|ביממה האחרונה/).count();
      ok(`${lang}-${scheme} WhatsApp note gone`, note === 0, String(note));
      await page.screenshot({ path: path.join(out, `${lang}-${scheme}-03-whatsapp.png`) });
      await ctx.close();
    }
  } catch (e) { ok('run', false, e.message.split('\n')[0]); }
  ok('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close(); server.close();
  console.log(results.join('\n'));
  console.log(`${results.filter((x) => x.startsWith('PASS')).length}/${results.length}`);
});
