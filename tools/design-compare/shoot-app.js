// Serves the web export as a SPA and screenshots routes. Spec: "route|day|en[|action]" ; action = click:<text>
const http = require('http'); const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const root = process.argv[2]; const out = process.argv[3]; fs.mkdirSync(out, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0, async () => {
  const port = server.address().port;
  const browser = await chromium.launch();
  const specs = fs.readFileSync(process.argv[4], 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const errors = [];
  for (const spec of specs) {
    const [route, theme, locale, ...actions] = spec.split('|');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: theme === 'night' ? 'dark' : 'light' });
    await ctx.addInitScript((l) => localStorage.setItem('steady.preferences', JSON.stringify({ locale: l })), locale);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${spec}: ${e.message}`));
    page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`${spec}: console ${msg.type()} ${msg.text().slice(0, 200)}`); });
    await page.goto(`http://localhost:${port}${route}`);
    await page.waitForTimeout(1200);
    for (const a of actions) {
      const i0 = a.indexOf(':'); const kind = a.slice(0, i0); const arg = a.slice(i0 + 1);
      if (kind === 'click') await page.getByText(arg, { exact: true }).last().click();
      if (kind === 'press') await page.getByLabel(arg, { exact: true }).last().click();
      if (kind === 'fill') { const [label, value] = arg.split('='); await page.getByLabel(label, { exact: true }).fill(value); }
      await page.waitForTimeout(500);
    }
    const h = await page.evaluate(() => { const s = [...document.querySelectorAll('div')].filter(d => d.scrollHeight > d.clientHeight + 20 && getComputedStyle(d).overflowY !== 'visible'); return s.length ? Math.max(...s.map(x => x.scrollHeight - x.clientHeight)) : 0; });
    if (h > 0) { await page.setViewportSize({ width: 390, height: Math.min(844 + h + 20, 6000) }); await page.waitForTimeout(400); }
    const name = spec.replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(name, page.url().replace(`http://localhost:${port}`, ''));
    await ctx.close();
  }
  console.log(errors.length ? [...new Set(errors)].join('\n') : 'no page errors');
  await browser.close(); server.close();
});
