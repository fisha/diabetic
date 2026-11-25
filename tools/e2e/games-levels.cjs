// Games levels, favorites and the maze countdown (Guy, 25 Nov 2026, PM-523, PM-525). Stars a game on the Games screen
// and filters All / Favorites; the level reached in the runner, bricks and clouds is saved on the server and the game
// then starts from it; the maze shows a countdown. End-to-end against the test server (services/api:
// uvicorn tests.e2e_server:app on port 8000).
// Usage: PGURL=postgresql://steady:steady@localhost:5432/steady_e2e node tools/e2e/games-levels.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from a database without gl@example.com.
const http = require('http'); const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const API = 'http://localhost:8000';
const PG = process.env.PGURL || 'postgresql://steady:steady@localhost:5432/steady_e2e';
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' };
const results = []; const ok = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); };
const api = async (p, { method = 'GET', body, token } = {}) => {
  const r = await fetch(API + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body && JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => null) };
};
const sql = (q) => execFileSync('psql', [PG, '-tAc', q]).toString().trim();
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Stedio', style: 'warm' }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8092, async () => {
  const base = 'http://localhost:8092';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'gl@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'gl@example.com', password: 'correct horse battery' } })).json.access_token;
    const uid = sql("select id from users where email = 'gl@example.com'");
    sql(`update users set approved_at = now() where id = '${uid}'`);
    const docs = (await api('/consent', { token: tk })).json;
    if (docs && docs.documents) await api('/consent/accept', { method: 'POST', token: tk, body: { versions: Object.fromEntries(docs.documents.map((d) => [d.kind, d.version])), at: new Date().toISOString() } });

    const runs = process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'dark']];
    let first = true;
    for (const [lang, scheme] of runs) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage(); global.lastPage = page;
      page.on('pageerror', (e) => errors.push(e.message));
      page.setDefaultTimeout(8000);
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      const he = lang === 'he';
      const L = he
        ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון', all: 'הכול', fav: 'מועדפים', add: 'הוספת ריצה עם Stedio למועדפים', rm: 'הסרת ריצה עם Stedio מהמועדפים', addMaze: 'הוספת מבוך הצעדים למועדפים', runner: 'ריצה עם Stedio', empty: 'עוד אין מועדפים', lv: (n) => `שלב ${n}` }
        : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account', all: 'All', fav: 'Favorites', add: 'Add Run with Stedio to favorites', rm: 'Remove Run with Stedio from favorites', addMaze: 'Add Steps maze to favorites', runner: 'Run with Stedio', empty: 'No favorites yet', lv: (n) => `Level ${n}` };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('gl@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(4000);
      await shot('00-signed-in');
      await page.goto(base + '/games'); await page.waitForTimeout(5000);
      await shot('01-games-all');
      if (first) {
        // Favorites: empty first, then a starred game is the only arcade game under Favorites, and stays after a reload.
        await page.getByRole('radio', { name: L.fav, exact: true }).click(); await page.waitForTimeout(600);
        ok(`${lang}-${scheme} empty favorites say how to add one`, (await page.getByText(L.empty).count()) > 0);
        await shot('02-fav-empty');
        await page.getByRole('radio', { name: L.all, exact: true }).click(); await page.waitForTimeout(600);
        await page.getByRole('button', { name: L.add, exact: true }).click(); await page.waitForTimeout(400);
        await page.getByRole('button', { name: L.addMaze, exact: true }).click(); await page.waitForTimeout(1200);
        ok(`${lang}-${scheme} starring is saved`, JSON.stringify((await api('/games', { token: tk })).json.favorites) === '["runner","maze"]');
      }
      await page.reload(); await page.waitForTimeout(3000);
      ok(`${lang}-${scheme} a starred game shows its star after a reload`, await page.getByRole('button', { name: L.rm, exact: true }).isVisible());
      await page.getByRole('radio', { name: L.fav, exact: true }).click(); await page.waitForTimeout(800);
      ok(`${lang}-${scheme} Favorites shows only starred games`, (await page.getByRole('button', { name: new RegExp('^' + L.runner) }).count()) === 1 && (await page.getByText(he ? 'קפיצות לבנים' : 'Brick bounce').count()) === 0);
      await shot('03-fav');
      await page.getByRole('radio', { name: L.all, exact: true }).click(); await page.waitForTimeout(400);
      if (first) {
        // The runner's level reached is sent and kept; the next game starts there.
        await page.goto(base + '/games/runner'); await page.waitForTimeout(3000);
        const fr = page.frameLocator('iframe');
        await fr.locator('#go').click(); await page.waitForTimeout(500);
        ok(`${lang}-${scheme} runner shows level 1`, (await fr.locator('#lvl').textContent()) === L.lv(1));
        await shot('04-runner-l1');
        await api('/games/level', { method: 'POST', token: tk, body: { game: 'runner', level: 3 } });
        await api('/games/level', { method: 'POST', token: tk, body: { game: 'clouds', level: 2 } });
        first = false;
      }
      await page.goto(base + '/games/runner'); await page.waitForTimeout(3500);
      const fr = page.frameLocator('iframe');
      ok(`${lang}-${scheme} the runner starts from the level reached`, (await fr.locator('#lvl').textContent()) === L.lv(3), await fr.locator('#lvl').textContent());
      await shot('05-runner-start-l3');
      await fr.locator('[data-lvd="-1"]').click(); await page.waitForTimeout(200);
      ok(`${lang}-${scheme} an earlier level can be picked`, (await fr.locator('.lvv').textContent()) === L.lv(2));
      await fr.locator('[data-lvd="1"]').click();
      await fr.locator('#go').click(); await page.waitForTimeout(1500);
      await shot('06-runner-l3-play');
      await page.goto(base + '/games/clouds'); await page.waitForTimeout(3500);
      ok(`${lang}-${scheme} clouds start from level 2`, (await page.frameLocator('iframe').locator('#lvl').textContent()) === L.lv(2));
      await shot('07-clouds-start');
      await page.goto(base + '/games/maze'); await page.waitForTimeout(3500);
      const mz = page.frameLocator('iframe');
      await mz.locator('#go').click(); await page.waitForTimeout(2500);
      const hud = await mz.locator('#hud').textContent();
      ok(`${lang}-${scheme} the maze counts down`, /1:2[6-8]/.test(hud), hud);
      await shot('08-maze');
      await ctx.close();
    }
  } catch (e) {
    results.push('ERROR ' + e.message.split('\n')[0]); if (global.lastPage) await global.lastPage.screenshot({ path: path.join(out, 'zz-fail.png') });
  }
  if (errors.length) results.push('PAGE ERRORS ' + errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  const failed = results.some((r) => !r.startsWith('PASS'));
  await browser.close(); server.close(); process.exit(failed ? 1 : 0);
});
