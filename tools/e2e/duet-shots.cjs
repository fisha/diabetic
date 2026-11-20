// Duet design screenshots (PM-335): opens demo scenarios (realistic generated data, no fixtures in the app) and
// captures a list of screens in English and Hebrew, day and night, for comparison with the round 4 mockups.
// Needs the test server (services/api: uvicorn tests.e2e_server:app, STEADY_ADMIN_EMAILS=admin@example.com) and a web
// export built with EXPO_PUBLIC_API_URL=http://localhost:8000.
// Usage: node tools/e2e/duet-shots.cjs <web export> <out dir> [scenario] [routes comma-separated] [variants e.g. en:light,he:dark]
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
      const ctx = await browser.newContext({ viewport: process.env.VIEW ? { width: +process.env.VIEW.split('x')[0], height: +process.env.VIEW.split('x')[1] } : { width: 393, height: 852 }, colorScheme: scheme === 'dark' ? 'dark' : 'light', deviceScaleFactor: 1 });
      const stored = { refreshToken: s.refresh_token, email: s.email, hasProfile: s.has_profile, access: { token: s.access_token, until: Date.now() + 10 * 60000 } };
      const viewing = s.viewing ? { viewing: { ownerId: s.viewing.owner_id, name: s.viewing.name, scopes: s.viewing.scopes }, ownDraft: null } : null;
      await ctx.addInitScript(([st, lang, vw]) => {
        if (sessionStorage.getItem('seeded')) return;
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('steady.session', JSON.stringify(st));
        localStorage.setItem('steady.preferences', JSON.stringify({ locale: lang, takeBreak: false }));
        if (vw) localStorage.setItem('steady.viewing', JSON.stringify(vw)); else localStorage.removeItem('steady.viewing');
      }, [stored, lang, viewing]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log('pageerror', e.message));
      // NOOPENERS=1: the main screen without Stedio's question (board p01), for comparison; the demo always has one.
      if (process.env.NOOPENERS) await page.route('**/conversation/openers', (r) => r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ openers: [], refreshing: false }) }));
      for (const r of routesArg.split(',')) {
        await page.goto(base + r); await page.waitForTimeout(Number(process.env.WAIT || 6000));
        // Quiet mode left on by an earlier shot of /break covers every screen: end it first, except on /break itself.
        if (r !== '/break' && (await page.getByTestId('break-end').count())) { await page.getByTestId('break-end').click(); await page.goto(base + r); await page.waitForTimeout(4000); }
        // OPEN=<text>: tap the first element with that text (for example the insights line) before the shot.
        if (process.env.OPEN) { await page.getByText(new RegExp(process.env.OPEN)).first().click(); await page.waitForTimeout(1200); }
        const name = `${process.env.NOOPENERS ? 'p01-' : ''}${process.env.OPEN ? 'open-' : ''}${process.env.VIEW ? process.env.VIEW + '-' : ''}${scenario}-${r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}-${lang}-${scheme}.png`;
        await page.screenshot({ path: path.join(out, name) });
        console.log('shot', name);
      }
      await ctx.close();
    }
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close(); server.close();
});
