/**
 * Records a VISUAL demo: a real Chrome window showing mercadopublico.cl, with
 * browser-agent-kit injected INTO the page. The agent reads the accessibility
 * tree, highlights the real search box, and types into it — all on screen.
 *
 *   node examples/record-visual.mjs
 *   -> examples/demo-cl-visual.mp4  +  examples/demo-cl-visual.gif
 *
 * Uses a captured snapshot of the rendered DOM (the site is a SPA). A <base> tag
 * lets the real CSS/images load so it looks like the live site; the page's own
 * scripts are stripped so only the agent runs.
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

// 1. styled, script-free snapshot
let html = readFileSync(join(here, 'snapshots', 'mercadopublico-home.html'), 'utf8')
html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
html = html.replace(/<head([^>]*)>/i, '<head$1><base href="https://www.mercadopublico.cl/">')
const pageFile = join(root, '.render.html')
writeFileSync(pageFile, html)

// 2. bundle the kit to an injectable IIFE (window.BAK)
const bundle = (await build({
  entryPoints: [join(root, 'src/index.ts')],
  bundle: true, format: 'iife', globalName: 'BAK', write: false,
})).outputFiles[0].text

// 3. record
const vidDir = join(root, '.vid')
rmSync(vidDir, { recursive: true, force: true }); mkdirSync(vidDir)
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: vidDir, size: { width: W, height: H } } })
const page = await ctx.newPage()
await page.goto('file://' + pageFile, { waitUntil: 'load', timeout: 25000 }).catch(() => {})
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(2000)
await page.addScriptTag({ content: bundle })

// 4. the on-page choreography (runs INSIDE the page)
await page.evaluate(async (query) => {
  const BAK = window.BAK
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const kb = (s) => (new Blob([s]).size / 1024).toFixed(0) + 'KB'

  // compression stat from the REAL page, via the kit
  const raw = document.body.outerHTML
  const ctx = BAK.serializePage({ interactiveOnly: true })
  const pct = Math.round(100 * (1 - new Blob([ctx]).size / new Blob([raw]).size))

  // HUD
  const css = document.createElement('style')
  css.textContent = `
    .bak-hud{position:fixed;z-index:2147483647;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
    .bak-top{top:0;left:0;right:0;height:46px;background:#0b1020;color:#fff;display:flex;align-items:center;
      justify-content:space-between;padding:0 18px;box-shadow:0 2px 14px rgba(0,0,0,.25)}
    .bak-top b{color:#67e8f9}
    .bak-chip{background:#10221a;color:#34d399;border:1px solid #1f5f47;border-radius:999px;padding:6px 14px;
      font-weight:700;font-size:13px}
    .bak-cap{bottom:0;left:0;right:0;min-height:54px;background:#0b1020;color:#fff;display:flex;align-items:center;
      gap:10px;padding:14px 18px;font-size:19px;box-shadow:0 -2px 14px rgba(0,0,0,.25)}
    .bak-cap .a{color:#f59e0b;font-weight:800}
    .bak-glow{outline:3px solid #f59e0b !important;outline-offset:3px;border-radius:8px;
      box-shadow:0 0 0 6px rgba(245,158,11,.25) !important;transition:all .25s}
    body{padding-top:46px !important;padding-bottom:64px !important}
  `
  document.head.appendChild(css)
  const top = document.createElement('div'); top.className = 'bak-hud bak-top'
  top.innerHTML = `<span><b>browser-agent-kit</b> · un agente que vive dentro de la página</span>
    <span class="bak-chip">DOM ${kb(raw)} → contexto ${kb(ctx)} · ${pct}% menos</span>`
  const cap = document.createElement('div'); cap.className = 'bak-hud bak-cap'
  const say = (html) => { cap.innerHTML = html }
  document.body.appendChild(top); document.body.appendChild(cap)

  await sleep(700)
  say('El sitio es un SPA. Un scraper ve un cascarón vacío…')
  await sleep(2200)
  say('El agente lee la página como <span class="a">árbol de accesibilidad</span> y encuentra el buscador.')
  await sleep(2000)

  // find + highlight the real search box, via the kit
  const found = BAK.findElement('#txtBuscar')
  const input = found ? found.element : document.querySelector('#txtBuscar')
  input.scrollIntoView({ block: 'center' })
  input.classList.add('bak-glow')
  await sleep(900)

  say('<span class="a">Escribe</span> el término en el buscador real…')
  input.focus(); input.value = ''
  for (const ch of query) {
    input.value += ch
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await sleep(70)
  }
  await sleep(900)
  input.classList.remove('bak-glow')

  // highlight + press the search button
  const btn = document.querySelector('#btnBuscar') || document.querySelector('#formBusqueda button')
  if (btn) {
    btn.classList.add('bak-glow'); btn.scrollIntoView({ block: 'center' })
    say('<span class="a">Ejecuta</span> la búsqueda.')
    await sleep(700)
    btn.style.transform = 'scale(.92)'; await sleep(160); btn.style.transform = ''
    await sleep(700)
    btn.classList.remove('bak-glow')
  }

  say('Sin Puppeteer. Sin driver externo. El agente <span class="a">vive dentro</span> de la página.')
  await sleep(2600)
}, 'notebooks reacondicionados')

await ctx.close(); await browser.close()

// 5. find the webm and transcode
const webm = join(vidDir, readdirSync(vidDir).find((f) => f.endsWith('.webm')))
const mp4 = join(here, 'demo-cl-visual.mp4')
const gif = join(here, 'demo-cl-visual.gif')
const pal = join(vidDir, 'palette.png')
execSync(`ffmpeg -y -v error -ss 1.8 -i "${webm}" -movflags +faststart -pix_fmt yuv420p -vf "scale=${W}:-2" "${mp4}"`)
execSync(`ffmpeg -y -v error -ss 1.8 -i "${webm}" -vf "fps=12,scale=960:-1:flags=lanczos,palettegen" "${pal}"`)
execSync(`ffmpeg -y -v error -ss 1.8 -i "${webm}" -i "${pal}" -lavfi "fps=12,scale=960:-1:flags=lanczos[x];[x][1:v]paletteuse" "${gif}"`)
rmSync(vidDir, { recursive: true, force: true })
rmSync(pageFile, { force: true })
console.log('wrote', mp4, 'and', gif)
