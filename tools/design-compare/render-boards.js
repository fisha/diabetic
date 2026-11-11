// Renders design board states to PNG without the design tool's runtime.
// node board.js <boardsDir> <outDir> <spec>; spec lines: Board|name|{"props"}|{"state"}
const fs = require('fs'); const { chromium } = require('playwright');
const [dir, out, specFile] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
function inPage({ src, props, state }) {
  class DCLogic { constructor(p) { this.props = p || {}; this.state = undefined; } setState(o) { this.state = Object.assign({}, this.state || {}, o); } }
  const noop = () => 0;
  const C = new Function('DCLogic', 'setTimeout', 'setInterval', src + '\nreturn Component;')(DCLogic, noop, noop);
  const c = new C(props); c.props = props; c.state = Object.keys(state).length ? { ...state } : undefined;
  const vals = c.renderVals();
  const get = (scope, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), scope);
  const evalExpr = (scope, e) => { e = e.trim(); if (e === 'true') return true; if (e === 'false') return false; if (/^-?\d+$/.test(e)) return +e; return get(scope, e); };
  const fill = (s, scope) => s.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, p) => { const x = evalExpr(scope, p); return x == null || typeof x === 'function' ? '' : String(x); });
  const whole = (s) => { const m = s.match(/^\s*\{\{\s*([^}]+?)\s*\}\}\s*$/); return m ? m[1] : null; };
  function walk(node, scope) {
    if (node.nodeType === 3) { if (node.nodeValue.includes('{{')) node.nodeValue = fill(node.nodeValue, scope); return; }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') {
      const list = evalExpr(scope, whole(node.getAttribute('list')) || '') || []; const as = node.getAttribute('as');
      const frag = document.createDocumentFragment();
      list.forEach((it, i) => { for (const ch of node.childNodes) { const cl = ch.cloneNode(true); frag.appendChild(cl); walk(cl, { ...scope, [as]: it, $index: i }); } });
      node.replaceWith(frag); return;
    }
    if (tag === 'sc-if') {
      const ok = !!evalExpr(scope, whole(node.getAttribute('value')) || 'false');
      if (!ok) { node.remove(); return; }
      const kids = [...node.childNodes]; node.replaceWith(...kids); kids.forEach((k) => walk(k, scope)); return;
    }
    for (const a of [...node.attributes]) {
      if (/^on[A-Z]/.test(a.name) || a.name.startsWith('hint-')) { node.removeAttribute(a.name); continue; }
      if (a.value.includes('{{')) { const w = whole(a.value); const v = w ? evalExpr(scope, w) : null; if (w && typeof v === 'boolean') { if (a.name === 'disabled' || a.name === 'checked' || a.name === 'hidden') { v ? node.setAttribute(a.name, '') : node.removeAttribute(a.name); } else node.setAttribute(a.name, String(v)); } else node.setAttribute(a.name, fill(a.value, scope)); }
    }
    if (tag === 'template') return;
    for (const ch of [...node.childNodes]) walk(ch, scope);
  }
  const root = document.querySelector('x-dc'); walk(root, vals);
  document.querySelectorAll('helmet').forEach((h) => { document.head.append(...h.childNodes); h.remove(); });
}
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const line of fs.readFileSync(specFile, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))) {
    const [board, name, propsJ, stateJ] = line.split('|'); const props = JSON.parse(propsJ || '{}'); const state = JSON.parse(stateJ || '{}');
    const html = fs.readFileSync(`${dir}/${board}.dc.html`, 'utf8');
    const src = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await page.setContent(html.replace(/<script[\s\S]*?<\/script>/g, ''), { waitUntil: 'load' });
    try { await page.evaluate(inPage, { src, props, state }); } catch (e) { errs.push(name + ': ' + e.message.split('\n')[0]); }
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/${name}.png` }); await page.close(); console.log(name);
  }
  await b.close(); console.log(errs.length ? errs.join('\n') : 'ok');
})();
