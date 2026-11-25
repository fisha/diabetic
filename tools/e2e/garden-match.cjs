// Garden match (Guy, 25 Nov 2026: "a Candy Crush style game", PM-524): the tile on the Games screen, the level card at the level reached (shared level store),
// the board with the glucose bar and coins on top, swaps, and the end of a level adding coins on the server.
// Usage: node tools/e2e/garden-match.cjs <web export built with EXPO_PUBLIC_API_URL=http://localhost:8000> <screenshot dir>
// Start from an empty database: it signs up g@example.com.
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
const ANSWERS = { version: 1, consent: { service: true, training: false, at: new Date().toISOString() }, ageGate: 'adult', diabetesType: 'type1', birth: { day: '', month: '', year: '' }, units: 'mgdl', body: { height: '', heightUnit: 'cm', weight: '', weightUnit: 'kg', measured: 'today' }, rapid: [], basal: [], insulinOther: false, insulinUnknown: false, pumpOther: '', sensorOther: '', ratios: { unknown: true, periods: [], correction: '', target: '80-140' }, history: { notes: '' }, routine: { checkInTimes: [] }, companion: { avatar: 'sage', name: 'Noa', style: 'warm', accessories: { hat: 'party' } }, checkIns: { frequency: 'moreAtFirst' } };

const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(8090, async () => {
  const base = 'http://localhost:8090';
  const browser = await chromium.launch();
  const errors = [];
  try {
    await api('/auth/sign-up', { method: 'POST', body: { email: 'g@example.com', password: 'correct horse battery' } });
    const tk = (await api('/auth/sign-in', { method: 'POST', body: { email: 'g@example.com', password: 'correct horse battery' } })).json.access_token;
    // A level reached earlier (shared level store, PM-523): the game starts there.
    await api('/games/level', { method: 'POST', token: tk, body: { game: 'garden', level: 3 } });
    for (const [lang, scheme] of (process.env.ONLY ? [process.env.ONLY.split(':')] : [['en', 'light'], ['he', 'dark']])) {
      await api('/profile', { method: 'PUT', token: tk, body: { locale: lang, answers: ANSWERS } });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, locale: 'en-US', deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
      const shot = (name) => page.screenshot({ path: path.join(out, `${lang}-${scheme}-${name}.png`) });
      page.setDefaultTimeout(6000);
      const he = lang === 'he';
      const L = he ? { email: 'אימייל', pw: 'סיסמה', go: 'כניסה', have: 'כבר יש לי חשבון' } : { email: 'Email', pw: 'Password', go: 'Sign in', have: 'I already have an account' };
      const T = he ? { name: 'התאמות בגינה', level: 'שלב 3', start: 'התחלה', again: ['לנסות שוב', 'לשלב הבא'], back: 'חזרה למשחקים' } : { name: 'Garden match', level: 'Level 3', start: 'Start', again: ['Try again', 'Next level'], back: 'Back to games' };
      await page.goto(base); await page.waitForTimeout(2000);
      if (he) { await page.getByText('עברית', { exact: true }).first().click(); await page.waitForTimeout(800); }
      await page.getByText(L.have, { exact: true }).last().click(); await page.waitForTimeout(1500);
      await page.getByLabel(L.email, { exact: true }).fill('g@example.com');
      await page.getByLabel(L.pw, { exact: true }).fill('correct horse battery');
      await page.getByText(L.go, { exact: true }).last().click(); await page.waitForTimeout(5000);
      await page.goto(`${base}/games`); await page.waitForTimeout(3500); await shot('00-games');
      ok(`${lang} ${scheme}: Garden match tile on the Games screen`, (await page.getByText(T.name, { exact: true }).count()) > 0);
      await page.getByText(T.name, { exact: true }).first().scrollIntoViewIfNeeded();
      await shot('01-games-list');
      await page.getByText(T.name, { exact: true }).first().click(); await page.waitForTimeout(3500);
      const frame = page.frameLocator('iframe');
      // The level reached so far (3, or higher once the first run won a level).
      const reached = (await api('/games', { token: tk })).json.levels.garden;
      const want = T.level.replace('3', String(reached));
      ok(`${lang} ${scheme}: level card at the level reached`, reached >= 3 && (await frame.getByText(want, { exact: true }).count()) > 0, want);
      await shot('02-level-card');
      const before = (await api('/games', { token: tk })).json.coins;
      await frame.getByText(T.start, { exact: true }).click(); await page.waitForTimeout(800);
      await shot('03-board');
      // Play by dragging neighbours until the level ends (out of moves or done).
      const box = await page.locator('iframe').boundingBox();
      const cv = await frame.locator('#cv').boundingBox();
      const sc = cv.width / 361;
      let swaps = 0;
      for (let i = 0; i < 900; i++) {
        if (await frame.locator('#ov').isVisible()) break;
        const r = Math.floor(Math.random() * 8), c = Math.floor(Math.random() * 7), horiz = Math.random() < 0.5;
        const x0 = cv.x + (9 + c * 49 + 24) * sc, y0 = cv.y + (76 + r * 49 + 24) * sc;
        const x1 = x0 + (horiz ? (c < 6 ? 40 : -40) : 0) * sc, y1 = y0 + (horiz ? 0 : (r < 7 ? 40 : -40)) * sc;
        await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 4 }); await page.mouse.up();
        await page.waitForTimeout(260); swaps++;
        if (swaps === 40) await shot('04-playing');
      }
      await page.waitForTimeout(2500);
      const ended = await frame.locator('#ov').isVisible();
      ok(`${lang} ${scheme}: the level ends`, ended, `${swaps} drags`);
      await shot('05-end');
      ok(`${lang} ${scheme}: end screen has play again and back`, (await frame.getByText(T.again[0], { exact: true }).count()) + (await frame.getByText(T.again[1], { exact: true }).count()) > 0 && (await frame.getByText(T.back, { exact: true }).count()) > 0);
      const after = (await api('/games', { token: tk })).json;
      ok(`${lang} ${scheme}: coins added on the server`, after.coins > before && (after.best.garden ?? 0) > 0, `${before} -> ${after.coins}, best ${after.best.garden}`);
      await ctx.close();
    }
  } catch (e) { results.push('FAIL exception — ' + e.message); }
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log(results.join('\n'));
  console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length}`);
  await browser.close(); server.close();
});
