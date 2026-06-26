/**
 * "Pro" composed recording: one Chrome canvas showing the agent's MIND (a left
 * terminal panel + an animated network graph of DOM → accessibility tree) next
 * to the real mercadopublico.cl page, all synced and recorded together.
 *
 *   node examples/record-pro.mjs   ->  examples/demo-cl-pro.mp4 + .gif
 */
import { chromium } from 'playwright-core'
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const W = 1280, H = 800

let html = readFileSync(join(here, 'snapshots', 'mercadopublico-home.html'), 'utf8')
html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
html = html.replace(/<head([^>]*)>/i, '<head$1><base href="https://www.mercadopublico.cl/">')
const pageFile = join(root, '.render.html')
writeFileSync(pageFile, html)

const bundle = (await build({
  entryPoints: [join(root, 'src/index.ts')],
  bundle: true, format: 'iife', globalName: 'BAK', write: false,
})).outputFiles[0].text

const vidDir = join(root, '.vid')
rmSync(vidDir, { recursive: true, force: true }); mkdirSync(vidDir)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: vidDir, size: { width: W, height: H } }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
await page.goto('file://' + pageFile, { waitUntil: 'load', timeout: 25000 }).catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(1500)
await page.addScriptTag({ content: bundle })

await page.evaluate(async ({ query, W, PANEL }) => {
  const BAK = window.BAK
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const sz = (s) => new Blob([s]).size
  const kb = (s) => Math.round(sz(s) / 1024) + 'KB'

  // real numbers from the kit
  const rawHTML = document.body.outerHTML
  const ctxText = BAK.serializePage({ interactiveOnly: true })
  const pct = Math.round(100 * (1 - sz(ctxText) / sz(rawHTML)))
  const a11yLines = ctxText.split('\n').filter((l) => /\[(textbox|button|link|navigation|form)\]/.test(l))
  const domNodeCount = document.querySelectorAll('*').length

  // ── layout: left = agent panel (40%), right = the real page ──
  const css = document.createElement('style')
  css.textContent = `
    :root{--bg:#0b1020;--fg:#e5e7eb;--mut:#7c89a8;--cy:#67e8f9;--gn:#34d399;--am:#f59e0b;--pk:#f472b6;--vi:#a78bfa}
    .bak{position:fixed;z-index:2147483646;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    #bak-top{top:0;left:0;right:0;height:44px;background:#070b16;color:#fff;display:flex;align-items:center;
      justify-content:space-between;padding:0 16px;font-size:13px;border-bottom:1px solid #1b2440}
    #bak-top b{color:var(--cy);font-weight:700}
    #bak-chip{background:#10221a;color:var(--gn);border:1px solid #1f5f47;border-radius:999px;padding:5px 12px;font-weight:700}
    #bak-panel{top:44px;left:0;bottom:0;width:${PANEL * 100}%;background:linear-gradient(180deg,#0b1020,#0a0e1c);
      color:var(--fg);border-right:1px solid #1b2440;display:flex;flex-direction:column}
    #bak-panel .hd{display:flex;gap:7px;align-items:center;padding:11px 14px;border-bottom:1px solid #161f38;font-size:12px;color:var(--mut)}
    #bak-panel .dot{width:11px;height:11px;border-radius:50%}
    #bak-graphwrap{padding:8px 12px 2px}
    #bak-glabel{font-size:11.5px;color:var(--mut);padding:0 14px;height:16px}
    #bak-term{flex:1;overflow:hidden;padding:10px 14px;font-size:12.5px;line-height:1.55}
    #bak-term .p{color:var(--cy)} #bak-term .c{color:var(--mut)} #bak-term .ok{color:var(--gn)}
    #bak-term .k{color:var(--am)} #bak-term .v{color:var(--vi)}
    #bak-site{top:44px;left:${PANEL * 100}%;right:0;bottom:0;overflow:hidden;background:#fff}
    #bak-inner{width:${W}px;transform-origin:top left}
    .bak-glow{outline:3px solid var(--am)!important;outline-offset:2px;border-radius:8px;
      box-shadow:0 0 0 7px rgba(245,158,11,.3)!important;transition:all .2s}
  `
  document.head.appendChild(css)

  // move the real page into a scaled, clipped right region (keeps desktop layout)
  const site = document.createElement('div'); site.id = 'bak-site'; site.className = 'bak'
  const inner = document.createElement('div'); inner.id = 'bak-inner'
  while (document.body.firstChild) inner.appendChild(document.body.firstChild)
  site.appendChild(inner); document.body.appendChild(site)
  const rightW = W * (1 - PANEL)
  inner.style.transform = `scale(${(rightW / W).toFixed(4)})`

  // top bar
  const top = document.createElement('div'); top.id = 'bak-top'; top.className = 'bak'
  top.innerHTML = `<span><b>browser-agent-kit</b> &nbsp;·&nbsp; un agente que vive dentro de la página</span><span id="bak-chip">cargando…</span>`
  document.body.appendChild(top)

  // left panel
  const panel = document.createElement('div'); panel.id = 'bak-panel'; panel.className = 'bak'
  panel.innerHTML = `
    <div class="hd"><span class="dot" style="background:#ff5f56"></span><span class="dot" style="background:#ffbd2e"></span><span class="dot" style="background:#27c93f"></span>&nbsp; agent — cómo ve la página</div>
    <div id="bak-graphwrap"><svg id="bak-graph" width="100%" height="196" viewBox="0 0 460 196"></svg></div>
    <div id="bak-glabel"></div>
    <div id="bak-term"></div>`
  document.body.appendChild(panel)
  const svg = panel.querySelector('#bak-graph')
  const term = panel.querySelector('#bak-term')
  const glabel = panel.querySelector('#bak-glabel')
  const chip = top.querySelector('#bak-chip')
  const NS = 'http://www.w3.org/2000/svg'
  const mk = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); return e }

  // ── network graph: many DOM nodes collapsing into a few a11y nodes ──
  const N = 150
  const nodes = []
  for (let i = 0; i < N; i++) {
    const x = 18 + ((i * 67) % 424), y = 14 + ((i * 113) % 168)
    const c = mk('circle', { cx: x, cy: y, r: 2.4, fill: '#33406b', opacity: 0 })
    svg.appendChild(c); nodes.push({ c, x, y })
  }
  // survivors = the few interactive elements, arranged as a tidy column (the a11y tree)
  const survN = Math.min(11, a11yLines.length || 11)
  const colors = ['var(--cy)', 'var(--gn)', 'var(--am)', 'var(--pk)', 'var(--vi)']
  const links = []
  const rootX = 70, rootY = 98
  const survivors = nodes.slice(0, survN).map((nd, i) => {
    const tx = 150 + (i % 2) * 150, ty = 26 + Math.floor(i / 2) * 30
    const ln = mk('line', { x1: rootX, y1: rootY, x2: tx, y2: ty, stroke: '#2a3766', 'stroke-width': 1, opacity: 0 })
    svg.insertBefore(ln, svg.firstChild); links.push(ln)
    return { ...nd, tx, ty, color: colors[i % colors.length] }
  })
  const rootDot = mk('circle', { cx: rootX, cy: rootY, r: 6, fill: 'var(--cy)', opacity: 0 })
  svg.appendChild(rootDot)

  glabel.textContent = `DOM renderizado · ${domNodeCount.toLocaleString('es-CL')} nodos`
  chip.textContent = `${kb(rawHTML)} DOM`
  // phase 1: DOM appears (noise)
  for (let i = 0; i < nodes.length; i++) { nodes[i].c.style.transition = 'opacity .5s'; nodes[i].c.setAttribute('opacity', '0.8'); if (i % 12 === 0) await sleep(40) }
  await sleep(1100)

  // phase 2: collapse to the accessibility tree
  glabel.innerHTML = `árbol de accesibilidad · <b style="color:var(--gn)">${survN} elementos</b>`
  chip.innerHTML = `${kb(rawHTML)} DOM → <b>${kb(ctxText)}</b> · ${pct}% menos`
  rootDot.style.transition = 'opacity .6s'; rootDot.setAttribute('opacity', '1')
  for (const nd of nodes) {
    if (survivors.includes(nd)) continue
    nd.c.style.transition = 'opacity .7s'; nd.c.setAttribute('opacity', '0')
  }
  survivors.forEach((s, i) => {
    s.c.style.transition = 'all .8s cubic-bezier(.2,.7,.2,1)'
    s.c.setAttribute('cx', s.tx); s.c.setAttribute('cy', s.ty); s.c.setAttribute('r', '5'); s.c.setAttribute('fill', s.color)
    links[i].style.transition = 'opacity .8s'; links[i].setAttribute('opacity', '1')
  })
  await sleep(1500)

  // ── terminal: observe → plan → act (synced with the page) ──
  const line = (html, cls = '') => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; term.appendChild(d); term.scrollTop = term.scrollHeight }
  const type = async (el, txt, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; term.appendChild(d); for (const ch of txt) { d.innerHTML += ch === '<' ? '&lt;' : ch; await sleep(11) } term.scrollTop = term.scrollHeight }

  await type(term, '$ agent.observe()', 'p'); await sleep(250)
  for (const l of a11yLines.slice(0, 5)) line(`<span class="c">${l.trim().replace(/</g, '&lt;').slice(0, 46)}</span>`)
  line(`<span class="ok">→ ${kb(rawHTML)} DOM → ${kb(ctxText)} contexto (${pct}% menos)</span>`)
  await sleep(900)

  await type(term, '$ agent.plan("buscar notebooks reacondicionados")', 'p'); await sleep(250)
  line(`<span class="c">1.</span> <span class="k">type</span>  → <span class="v">#txtBuscar</span>`)
  line(`<span class="c">2.</span> <span class="k">click</span> → <span class="v">#btnBuscar</span>`)
  await sleep(800)

  await type(term, '$ agent.act()', 'p'); await sleep(300)

  // step 1 — type into the REAL search box on the right
  const found = BAK.findElement('#txtBuscar')
  const input = (found && found.element) || document.querySelector('#txtBuscar')
  input.classList.add('bak-glow'); input.focus(); input.value = ''
  line(`<span class="k">type</span> <span class="v">#txtBuscar</span> <span class="c">…</span>`)
  for (const ch of query) { input.value += ch; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(70) }
  line(`<span class="ok">✓ escribió "${query}"</span>`)
  await sleep(700); input.classList.remove('bak-glow')

  // step 2 — press the search button
  const btn = document.querySelector('#btnBuscar') || document.querySelector('#formBusqueda button')
  if (btn) { btn.classList.add('bak-glow'); btn.style.transform = 'scale(.9)'; await sleep(180); btn.style.transform = '' }
  line(`<span class="ok">✓ click #btnBuscar</span>`)
  await sleep(500); if (btn) btn.classList.remove('bak-glow')
  line(`<span class="c"># sin Puppeteer · sin driver externo · vive dentro de la página</span>`)
  await sleep(2400)
}, { query: 'notebooks reacondicionados', W, PANEL: 0.40 })

await ctx.close(); await browser.close()

const webm = join(vidDir, readdirSync(vidDir).find((f) => f.endsWith('.webm')))
const mp4 = join(here, 'demo-cl-pro.mp4'), gif = join(here, 'demo-cl-pro.gif'), pal = join(vidDir, 'p.png')
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -movflags +faststart -pix_fmt yuv420p -vf "scale=${W}:-2" "${mp4}"`)
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -vf "fps=13,scale=1000:-1:flags=lanczos,palettegen" "${pal}"`)
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -i "${pal}" -lavfi "fps=13,scale=1000:-1:flags=lanczos[x];[x][1:v]paletteuse" "${gif}"`)
rmSync(vidDir, { recursive: true, force: true }); rmSync(pageFile, { force: true })
console.log('wrote', mp4, 'and', gif)
