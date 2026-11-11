// Web dashboard end-to-end check against the test API (localhost:8000, CORS for localhost:3000) and the website
// running with `next start -p 3000` (built with NEXT_PUBLIC_STEADY_API_URL=http://localhost:8000).
// Usage: node tools/e2e/web.cjs <screenshot dir>. Start from an empty database: it signs up w@example.com.
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000'; const WEB = 'http://localhost:3000';
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '70-180' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.png`), fullPage: true });
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'w@example.com', password: 'correct horse battery' } });
    const tw = (await api('/auth/sign-in', { method: 'POST', body: { email: 'w@example.com', password: 'correct horse battery' } })).json;
    await api('/profile', { method: 'PUT', token: tw.access_token, body: { locale: 'en', answers: ANSWERS } });
    // Yesterday: a full day of sensor readings every 5 minutes, 20% above the range.
    const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0, 0, 0, 0);
    for (let b = 0; b < 288; b += 12) {
      const rs = await Promise.all(Array.from({ length: 12 }, (_, j) => {
        const i = b + j; const at = new Date(y.getTime() + i * 300000).toISOString();
        return api('/glucose', { method: 'POST', token: tw.access_token, body: { idempotency_key: `web-sensor-${i}`, measured_at: at, entered_at: at, source: 'manual', method: 'sensor', value: i % 5 === 0 ? 220 : 120, unit: 'mg/dL' } });
      }));
      if (rs.some((r) => r.status !== 201)) throw new Error('seeding failed: ' + rs.map((r) => r.status).join(','));
    }
    const m = new Date(Date.now() - 2 * 3600000).toISOString();
    await api('/records', { method: 'POST', token: tw.access_token, body: { idempotency_key: 'web-meal-1', kind: 'meal', occurred_at: m, entered_at: m, source: 'manual', data: { items: [{ name: 'Rice', unit: 'cup', qty: 1, carbs_g: 45, prov: 'user' }], ate: 'all', carbs_total_g: 45, any_unknown: false } } });

    await page.goto(`${WEB}/en/dashboard`); await page.waitForTimeout(1500);
    ok('sign-in card when signed out', await page.getByText('Sign in to your dashboard').isVisible());
    await page.getByLabel('Email').fill('w@example.com'); await page.getByLabel('Password').fill('wrong password!');
    await page.getByRole('button', { name: 'Sign in' }).click(); await page.waitForTimeout(1200);
    ok('wrong password message', await page.getByText('That email and password don’t match an account.').isVisible());
    await page.getByLabel('Password').fill('correct horse battery');
    await page.getByRole('button', { name: 'Sign in' }).click(); await page.waitForTimeout(2500);
    ok('signed in as', await page.getByText('Signed in as w@example.com').isVisible());
    ok('time in range kpi', await page.getByText('Time in range (70–180)').isVisible() && await page.getByText('80%', { exact: true }).isVisible());
    ok('readings kpi', await page.locator('.kv', { hasText: /^288$/ }).isVisible());
    ok('meals kpi', await page.locator('.kv', { hasText: /^1$/ }).first().isVisible());
    await shot('w01-overview');

    await page.getByRole('link', { name: 'Timeline' }).click(); await page.waitForTimeout(2500);
    ok('timeline meal row', await page.getByText('≈ 45 g carbs').first().isVisible());
    await page.getByRole('radio', { name: 'Meals' }).click(); await page.waitForTimeout(400);
    ok('meal filter', (await page.locator('tbody tr').count()) === 1);
    await page.getByText('≈ 45 g carbs').first().click(); await page.waitForTimeout(1000);
    ok('selected entry', await page.getByText('No corrections.').isVisible());
    await shot('w02-timeline');

    await page.getByRole('link', { name: 'Insights' }).click(); await page.waitForTimeout(2000);
    await shot('w03-insights');
    ok('insights page', await page.getByText('Observations come from your records. They are not causes or treatment advice.').isVisible());

    await page.getByRole('link', { name: 'Settings' }).click(); await page.waitForTimeout(2000);
    await page.getByRole('switch', { name: 'Help improve models' }).click(); await page.waitForTimeout(1500);
    ok('training saved', await page.getByText('Saved to your account.').isVisible() && (await api('/profile', { token: tw.access_token })).json.answers.consent.training === true);
    await shot('w04-settings');

    await page.getByRole('link', { name: 'Export' }).click(); await page.waitForTimeout(1500);
    await page.getByRole('radio', { name: 'CSV files' }).click();
    await page.getByRole('button', { name: 'Create export' }).click(); await page.waitForTimeout(3500);
    ok('export ready', await page.getByText(/steady-export-.*\.zip · /).isVisible());
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.getByRole('button', { name: 'Download' }).click()]);
    const bytes = fs.readFileSync(await dl.path());
    ok('downloaded zip', bytes.slice(0, 2).toString() === 'PK', dl.suggestedFilename());
    await shot('w05-export');

    // Sign out: sections show the sign-in card again.
    await page.getByRole('button', { name: 'Sign out' }).click(); await page.waitForTimeout(800);
    ok('signed out', await page.getByText('Sign in to your dashboard').isVisible());
    // Hebrew dashboard is right-to-left.
    await page.goto(`${WEB}/he/dashboard`); await page.waitForTimeout(1500);
    ok('hebrew rtl', (await page.locator('html').getAttribute('dir')) === 'rtl' && await page.getByText('כניסה ללוח הבקרה').isVisible());
    await shot('w06-he-signin');
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); await page.screenshot({ path: path.join(out, 'zz-fail.png') }); console.log('fail url', page.url());
  }
  console.log(results.join('\n'));
  console.log(errors.length ? 'page errors:\n' + [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close();
})();
