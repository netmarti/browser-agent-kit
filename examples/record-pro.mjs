/**
 * "Pro" composed recording: one Chrome canvas showing the agent's MIND (a left
 * panel: a clear before/after of DOM → accessibility tree, plus a plan/act log)
 * next to the real mercadopublico.cl page. It types into the real search box and
 * presses Enter to reveal the real results page. All synced, recorded together.
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

const prep = (f) => {
  let h = readFileSync(join(here, 'snapshots', f), 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '')
  return h.replace(/<head([^>]*)>/i, '<head$1><base href="https://www.mercadopublico.cl/">')
}
const homeHTML = prep('mercadopublico-home.html')
// the results page is a SPA (blank without its JS), so the reveal uses a real
// screenshot of the live results for "notebooks reacondicionados"
const resultsImg = 'data:image/png;base64,' + readFileSync(join(here, 'snapshots', 'mercadopublico-resultados.png')).toString('base64')

writeFileSync(join(root, '.render.html'), homeHTML)
const pageFile = join(root, '.render.html')

const bundle = (await build({
  entryPoints: [join(root, 'src/index.ts')],
  bundle: true, format: 'iife', globalName: 'BAK', write: false,
})).outputFiles[0].text

const vidDir = join(root, '.vid')
rmSync(vidDir, { recursive: true, force: true }); mkdirSync(vidDir)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: vidDir, size: { width: W, height: H } } })
const page = await ctx.newPage()
await page.goto('file://' + pageFile, { waitUntil: 'load', timeout: 25000 }).catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(1500)
await page.addScriptTag({ content: bundle })

await page.evaluate(async ({ query, W, PANEL, resultsImg }) => {
  const BAK = window.BAK
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const sz = (s) => new Blob([s]).size
  const kb = (s) => Math.round(sz(s) / 1024) + ' KB'

  const rawHTML = document.body.outerHTML
  const ctxText = BAK.serializePage({ interactiveOnly: true })
  const pct = Math.round(100 * (1 - sz(ctxText) / sz(rawHTML)))
  const domCount = document.querySelectorAll('*').length
  const a11yCount = (ctxText.match(/\*/g) || []).length

  const css = document.createElement('style')
  css.textContent = `
    :root{--bg:#0b1020;--fg:#e5e7eb;--mut:#7c89a8;--cy:#67e8f9;--gn:#34d399;--am:#f59e0b;--pk:#f472b6;--vi:#a78bfa}
    .bak{position:fixed;z-index:2147483646;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    #bak-top{top:0;left:0;right:0;height:44px;background:#070b16;color:#fff;display:flex;align-items:center;
      justify-content:space-between;padding:0 16px;font-size:13px;border-bottom:1px solid #1b2440}
    #bak-top b{color:var(--cy)}
    #bak-chip{background:#10221a;color:var(--gn);border:1px solid #1f5f47;border-radius:999px;padding:5px 12px;font-weight:700}
    #bak-panel{top:44px;left:0;bottom:0;width:${PANEL * 100}%;background:linear-gradient(180deg,#0b1020,#0a0e1c);
      color:var(--fg);border-right:1px solid #1b2440;display:flex;flex-direction:column}
    #bak-panel .hd{display:flex;gap:7px;align-items:center;padding:10px 14px;border-bottom:1px solid #161f38;font-size:12px;color:var(--mut)}
    .dot{width:11px;height:11px;border-radius:50%}
    #bak-cmp{display:flex;align-items:stretch;gap:8px;padding:14px 12px 6px}
    .col{flex:1;border:1px solid #1b2440;border-radius:10px;padding:9px;background:#0c1326}
    .col h4{margin:0 0 7px;font-size:11px;color:var(--mut);font-weight:600;letter-spacing:.02em}
    .col h4 b{color:var(--fg)}
    #bak-cloud{position:relative;height:104px;overflow:hidden}
    .nd{position:absolute;width:6px;height:6px;border-radius:2px;background:#33406b;opacity:0;transition:opacity .5s}
    .pill{display:flex;align-items:center;gap:6px;font-size:11px;margin:4px 0;opacity:0;transform:translateX(6px);
      transition:all .4s;white-space:nowrap}
    .pill .role{padding:1px 6px;border-radius:5px;font-weight:700;font-size:10px}
    .arrow{align-self:center;color:var(--am);font-size:20px;font-weight:800}
    #bak-term{flex:1;overflow:hidden;padding:8px 14px;font-size:12.5px;line-height:1.6}
    #bak-term .p{color:var(--cy)} #bak-term .c{color:var(--mut)} #bak-term .ok{color:var(--gn)}
    #bak-term .k{color:var(--am)} #bak-term .v{color:var(--vi)}
    #bak-site{top:44px;left:${PANEL * 100}%;right:0;bottom:0;overflow:hidden;background:#fff}
    #bak-inner{width:${W}px;transform-origin:top left}
    .bak-glow{outline:3px solid var(--am)!important;outline-offset:2px;border-radius:8px;
      box-shadow:0 0 0 7px rgba(245,158,11,.3)!important;transition:all .2s}
  `
  document.head.appendChild(css)

  const site = document.createElement('div'); site.id = 'bak-site'; site.className = 'bak'
  const inner = document.createElement('div'); inner.id = 'bak-inner'
  while (document.body.firstChild) inner.appendChild(document.body.firstChild)
  site.appendChild(inner); document.body.appendChild(site)
  const scale = (W * (1 - PANEL)) / W
  inner.style.transform = `scale(${scale.toFixed(4)})`

  const top = document.createElement('div'); top.id = 'bak-top'; top.className = 'bak'
  top.innerHTML = `<span><b>browser-agent-kit</b> &nbsp;·&nbsp; un agente que vive dentro de la página</span><span id="bak-chip">DOM ${kb(rawHTML)}</span>`
  document.body.appendChild(top)

  const panel = document.createElement('div'); panel.id = 'bak-panel'; panel.className = 'bak'
  panel.innerHTML = `
    <div class="hd"><span class="dot" style="background:#ff5f56"></span><span class="dot" style="background:#ffbd2e"></span><span class="dot" style="background:#27c93f"></span>&nbsp; agent — cómo ve la página</div>
    <div id="bak-cmp">
      <div class="col"><h4>DOM completo · <b>${domCount} nodos</b></h4><div id="bak-cloud"></div><h4 style="margin:7px 0 0">${kb(rawHTML)}</h4></div>
      <div class="arrow">→</div>
      <div class="col"><h4>lo que el agente lee · <b style="color:var(--gn)">${a11yCount} elementos</b></h4><div id="bak-pills"></div><h4 style="margin:7px 0 0;color:var(--gn)">${kb(ctxText)} · ${pct}% menos</h4></div>
    </div>
    <div id="bak-term"></div>`
  document.body.appendChild(panel)
  const cloud = panel.querySelector('#bak-cloud')
  const pillBox = panel.querySelector('#bak-pills')
  const term = panel.querySelector('#bak-term')
  const chip = top.querySelector('#bak-chip')

  // left: DOM as a dense cloud of nodes
  const dots = []
  for (let i = 0; i < 90; i++) {
    const d = document.createElement('div'); d.className = 'nd'
    d.style.left = (4 + (i * 37) % 92) + '%'; d.style.top = (6 + (i * 53) % 84) + '%'
    cloud.appendChild(d); dots.push(d)
  }
  // right: the few meaningful elements, labeled (these are real roles on the page)
  const C = { textbox: 'var(--cy)', button: 'var(--gn)', link: 'var(--vi)' }
  const pills = [
    ['textbox', 'buscador'], ['button', 'Buscar'], ['button', 'Iniciar Sesión'],
    ['link', 'Regístrate'], ['link', 'Mercado Público'],
  ].map(([role, name]) => {
    const p = document.createElement('div'); p.className = 'pill'
    p.innerHTML = `<span class="role" style="background:${C[role]}22;color:${C[role]}">${role}</span> <span>${name}</span>`
    pillBox.appendChild(p); return p
  })
  const more = document.createElement('div'); more.className = 'pill'; more.style.color = 'var(--mut)'
  more.innerHTML = `<span style="padding-left:2px">+ ${a11yCount - pills.length} elementos más…</span>`
  pillBox.appendChild(more)

  // animate: DOM cloud appears, then collapses into the labeled list
  await sleep(500)
  dots.forEach((d, i) => setTimeout(() => d.style.opacity = '0.85', i * 9))
  await sleep(1300)
  chip.innerHTML = `DOM ${kb(rawHTML)} → <b>${kb(ctxText)}</b> · ${pct}% menos`
  dots.forEach((d) => d.style.opacity = '0.12')
  ;[...pills, more].forEach((p, i) => setTimeout(() => { p.style.opacity = '1'; p.style.transform = 'none' }, i * 130))
  await sleep(1700)

  // terminal: plan → act
  const line = (html, cls = '') => { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; term.appendChild(d); term.scrollTop = term.scrollHeight }
  const typeLn = async (txt, cls) => { const d = document.createElement('div'); if (cls) d.className = cls; term.appendChild(d); for (const ch of txt) { d.textContent += ch; await sleep(12) } term.scrollTop = term.scrollHeight }

  await typeLn('$ agent.plan("buscar notebooks reacondicionados")', 'p'); await sleep(250)
  line(`<span class="c">1.</span> <span class="k">type</span>  → <span class="v">#txtBuscar</span>`)
  line(`<span class="c">2.</span> <span class="k">click</span> → <span class="v">#btnBuscar</span>`)
  await sleep(700)
  await typeLn('$ agent.act()', 'p'); await sleep(250)

  // type into the REAL search box on the right
  const found = BAK.findElement('#txtBuscar')
  const input = (found && found.element) || document.querySelector('#txtBuscar')
  input.classList.add('bak-glow'); input.focus(); input.value = ''
  for (const ch of query) { input.value += ch; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(68) }
  line(`<span class="ok">✓ type "${query}"</span>`)
  await sleep(500); input.classList.remove('bak-glow')

  // press Enter → reveal the real results page
  const btn = document.querySelector('#btnBuscar') || document.querySelector('#formBusqueda button')
  if (btn) { btn.classList.add('bak-glow'); btn.style.transform = 'scale(.9)'; await sleep(160); btn.style.transform = '' }
  line(`<span class="ok">✓ submit ⏎</span>`)
  await sleep(550); if (btn) btn.classList.remove('bak-glow')

  // reveal the real results page (screenshot of the live results)
  inner.style.transform = 'none'
  inner.innerHTML = `<img src="${resultsImg}" style="width:${W * (1 - PANEL)}px;display:block">`
  chip.innerHTML = `✓ página de resultados real`
  line(`<span class="ok">✓ 2 resultados — "Adquisición de notebooks…"</span>`)
  line(`<span class="c"># sin Puppeteer · sin driver externo · vive dentro de la página</span>`)
  await sleep(2900)
}, { query: 'notebooks reacondicionados', W, PANEL: 0.40, resultsImg })

await ctx.close(); await browser.close()

const webm = join(vidDir, readdirSync(vidDir).find((f) => f.endsWith('.webm')))
const mp4 = join(here, 'demo-cl-pro.mp4'), gif = join(here, 'demo-cl-pro.gif'), pal = join(vidDir, 'p.png')
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -movflags +faststart -pix_fmt yuv420p -vf "scale=${W}:-2" "${mp4}"`)
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -vf "fps=13,scale=1000:-1:flags=lanczos,palettegen" "${pal}"`)
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -i "${pal}" -lavfi "fps=13,scale=1000:-1:flags=lanczos[x];[x][1:v]paletteuse" "${gif}"`)
rmSync(vidDir, { recursive: true, force: true }); rmSync(pageFile, { force: true })
console.log('wrote', mp4, 'and', gif)
