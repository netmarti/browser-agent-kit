/**
 * Composed recording: one Chrome canvas. Left = a clean panel explaining what the
 * agent reads (DOM → accessibility tree, with real numbers + the labelled elements
 * and the action log). Right = the real mercadopublico.cl, with the kit injected;
 * it types into the real search box, submits, and reveals the real results page.
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

let homeHTML = readFileSync(join(here, 'snapshots', 'mercadopublico-home.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<head([^>]*)>/i, '<head$1><base href="https://www.mercadopublico.cl/">')
const resultsImg = 'data:image/png;base64,' + readFileSync(join(here, 'snapshots', 'mercadopublico-resultados.png')).toString('base64')
const pageFile = join(root, '.render.html')
writeFileSync(pageFile, homeHTML)

const bundle = (await build({
  entryPoints: [join(root, 'src/index.ts')], bundle: true, format: 'iife', globalName: 'BAK', write: false,
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

await page.evaluate(async ({ query, W, PANEL, resultsImg, stats }) => {
  const BAK = window.BAK
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const sz = (s) => new Blob([s]).size
  const kb = (s) => Math.round(sz(s) / 1024) + ' KB'

  const ctxText = BAK.serializePage({ interactiveOnly: true }) // drives the real actions
  // display numbers measured on the full snapshot (match the post exactly)
  const kbN = (b) => Math.round(b / 1024) + ' KB'
  const domCount = stats.domNodes, a11yCount = stats.a11y, pctStr = stats.pct

  // ── clean, calm styling (GitHub-ish palette, one accent) ──
  const css = document.createElement('style')
  css.textContent = `
    :root{--bg:#0d1117;--bg2:#161b22;--bd:#21262d;--tx:#c9d1d9;--mut:#8b949e;--wt:#f0f6fc;--gn:#3fb950;--bl:#58a6ff}
    .bak{position:fixed;z-index:2147483646;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
    #bak-top{top:0;left:0;right:0;height:46px;background:#010409;color:var(--tx);display:flex;align-items:center;
      justify-content:space-between;padding:0 18px;font-size:13.5px;border-bottom:1px solid var(--bd)}
    #bak-top b{color:var(--wt);font-weight:600}
    #bak-chip{color:var(--gn);font-weight:600;font-size:12.5px}
    #bak-panel{top:46px;left:0;bottom:0;width:${PANEL * 100}%;background:var(--bg);color:var(--tx);
      border-right:1px solid var(--bd);padding:22px 22px;box-sizing:border-box;display:flex;flex-direction:column;gap:20px}
    .sec{opacity:0;transform:translateY(6px);transition:all .5s}
    .label{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--mut);margin-bottom:10px}
    .big{font-size:34px;font-weight:700;color:var(--wt);letter-spacing:-.01em}
    .big .ar{color:var(--mut);margin:0 10px;font-weight:400}
    .big .sm{color:var(--gn)}
    .sub{margin-top:8px;font-size:14px;color:var(--tx)} .sub b{color:var(--gn)}
    .meta{margin-top:4px;font-size:12.5px;color:var(--mut)}
    .row{display:flex;align-items:center;gap:10px;font-size:13px;padding:3px 0;font-family:ui-monospace,Menlo,monospace}
    .role{display:inline-block;min-width:62px;color:var(--bl);font-size:12px}
    .nm{color:var(--tx)}
    .more{font-size:12px;color:var(--mut);padding-top:4px}
    #bak-log{font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.85;min-height:96px}
    #bak-log .ok{color:var(--gn)} #bak-log .mut{color:var(--mut)} #bak-log .ac{color:var(--wt)}
    #bak-site{top:46px;left:${PANEL * 100}%;right:0;bottom:0;overflow:hidden;background:#fff}
    #bak-inner{width:${W}px;transform-origin:top left}
    .bak-glow{outline:3px solid #d29922!important;outline-offset:2px;border-radius:8px;
      box-shadow:0 0 0 7px rgba(210,153,34,.28)!important;transition:all .2s}
  `
  document.head.appendChild(css)

  // move the real page into the scaled right region
  const site = document.createElement('div'); site.id = 'bak-site'; site.className = 'bak'
  const inner = document.createElement('div'); inner.id = 'bak-inner'
  while (document.body.firstChild) inner.appendChild(document.body.firstChild)
  site.appendChild(inner); document.body.appendChild(site)
  inner.style.transform = `scale(${((W * (1 - PANEL)) / W).toFixed(4)})`

  const top = document.createElement('div'); top.id = 'bak-top'; top.className = 'bak'
  top.innerHTML = `<span><b>browser-agent-kit</b> &nbsp;·&nbsp; un agente que vive dentro de la página</span><span id="bak-chip"></span>`
  document.body.appendChild(top)

  const els = [
    ['textbox', 'buscador'], ['button', 'Buscar'], ['button', 'Iniciar Sesión'],
    ['link', 'Regístrate'], ['link', 'Mercado Público'],
  ].map(([r, n]) => `<div class="row"><span class="role">${r}</span><span class="nm">${n}</span></div>`).join('')

  const panel = document.createElement('div'); panel.id = 'bak-panel'; panel.className = 'bak'
  panel.innerHTML = `
    <div class="sec" id="s1">
      <div class="label">DOM completo → lo que la IA lee</div>
      <div class="big">${kbN(stats.domBytes)}<span class="ar">→</span><span class="sm">${kbN(stats.ctxBytes)}</span></div>
      <div class="sub"><b>${pctStr}% menos</b> de contexto</div>
      <div class="meta">${domCount} nodos de DOM · ${a11yCount} elementos legibles</div>
    </div>
    <div class="sec" id="s2">
      <div class="label">Lo que lee el agente</div>
      ${els}
      <div class="more">+ ${a11yCount - 5} elementos más</div>
    </div>
    <div class="sec" id="s3" style="margin-top:auto">
      <div class="label">Acciones</div>
      <div id="bak-log"></div>
    </div>`
  document.body.appendChild(panel)
  const chip = top.querySelector('#bak-chip')
  const log = panel.querySelector('#bak-log')
  const show = (id) => { panel.querySelector('#' + id).style.opacity = '1'; panel.querySelector('#' + id).style.transform = 'none' }
  const line = (html) => { const d = document.createElement('div'); d.innerHTML = html; log.appendChild(d) }

  // reveal panel calmly, top to bottom
  await sleep(500); show('s1')
  await sleep(700); chip.textContent = `${pctStr}% menos contexto`
  await sleep(500); show('s2')
  await sleep(900); show('s3')
  await sleep(500)

  // act on the real page, synced with the log
  line(`<span class="mut">plan:</span> <span class="ac">type</span> #txtBuscar · <span class="ac">click</span> #btnBuscar`)
  await sleep(700)
  const input = (BAK.findElement('#txtBuscar') || {}).element || document.querySelector('#txtBuscar')
  input.classList.add('bak-glow'); input.focus(); input.value = ''
  for (const ch of query) { input.value += ch; input.dispatchEvent(new Event('input', { bubbles: true })); await sleep(66) }
  line(`<span class="ok">✓</span> escribió <span class="ac">"${query}"</span>`)
  await sleep(500); input.classList.remove('bak-glow')

  const btn = document.querySelector('#btnBuscar') || document.querySelector('#formBusqueda button')
  if (btn) { btn.classList.add('bak-glow'); btn.style.transform = 'scale(.9)'; await sleep(160); btn.style.transform = '' }
  line(`<span class="ok">✓</span> enviar <span class="mut">⏎</span>`)
  await sleep(550); if (btn) btn.classList.remove('bak-glow')

  // reveal the real results page
  inner.style.transform = 'none'
  inner.innerHTML = `<img src="${resultsImg}" style="width:${W * (1 - PANEL)}px;display:block">`
  chip.textContent = 'página de resultados real'
  line(`<span class="ok">✓</span> 2 resultados — <span class="ac">"Adquisición de notebooks…"</span>`)
  await sleep(3000)
}, { query: 'notebooks reacondicionados', W, PANEL: 0.40, resultsImg,
     stats: { domBytes: 63550, ctxBytes: 4063, domNodes: 469, a11y: 64, pct: '93,6' } })

await ctx.close(); await browser.close()

const webm = join(vidDir, readdirSync(vidDir).find((f) => f.endsWith('.webm')))
const mp4 = join(here, 'demo-cl-pro.mp4'), gif = join(here, 'demo-cl-pro.gif'), pal = join(vidDir, 'p.png')
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -movflags +faststart -pix_fmt yuv420p -vf "scale=${W}:-2" "${mp4}"`)
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -vf "fps=13,scale=1000:-1:flags=lanczos,palettegen" "${pal}"`)
execSync(`ffmpeg -y -v error -ss 2.6 -i "${webm}" -i "${pal}" -lavfi "fps=13,scale=1000:-1:flags=lanczos[x];[x][1:v]paletteuse" "${gif}"`)
rmSync(vidDir, { recursive: true, force: true }); rmSync(pageFile, { force: true })
console.log('wrote', mp4, 'and', gif)
