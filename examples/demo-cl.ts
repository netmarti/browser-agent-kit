/**
 * Real-site showcase — built for recording.
 *
 *   npx tsx examples/demo-cl.ts                       # mock LLM, no key needed
 *   ANTHROPIC_API_KEY=... npx tsx examples/demo-cl.ts # real Claude does the planning
 *   FAST=1 npx tsx examples/demo-cl.ts                # no pacing delays
 *
 * Runs the agent against a CAPTURED SNAPSHOT of the *rendered* DOM of
 * mercadopublico.cl (Chile's public-procurement portal). The snapshot was
 * taken once with a real browser (the site is a SPA — `curl` returns an empty
 * shell). The compression number is real; the agent operates the real markup.
 *
 * Point: a scraper sees an empty shell. This agent runs *after* render, inside
 * the page, reads the accessibility tree, and drives the real search box.
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { JSDOM, VirtualConsole } from 'jsdom'
import {
  ActionRegistry, ActionPlanner,
  typeAction, clickAction, navigateAction,
  serializePage,
} from '../src/index'

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
}
const FAST = !!process.env.FAST
const sleep = (ms: number) => new Promise((r) => setTimeout(r, FAST ? 0 : ms))
const line = () => console.log(C.dim('─'.repeat(60)))
async function scene(title: string) {
  console.log('\n' + C.bold(C.magenta(`▌ ${title}`)))
  await sleep(500)
}
const kb = (s: string) => `${(Buffer.byteLength(s) / 1024).toFixed(1)}KB`

// ── load the captured real DOM ──
const here = dirname(fileURLToPath(import.meta.url))
const snapshotPath = join(here, 'snapshots', 'mercadopublico-home.html')
const html = readFileSync(snapshotPath, 'utf8')
// swallow jsdom "Not implemented" noise from operating a static snapshot
const virtualConsole = new VirtualConsole()
virtualConsole.on('jsdomError', () => {})
const dom = new JSDOM(html, { url: 'https://www.mercadopublico.cl/Home', virtualConsole })
const g = globalThis as any
g.window = dom.window
g.document = dom.window.document
for (const k of ['Node', 'NodeFilter', 'Element', 'HTMLElement', 'HTMLInputElement',
  'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLImageElement', 'MutationObserver', 'Event']) {
  g[k] = (dom.window as any)[k]
}

function renderSearch(active = false, clicked = false) {
  const q = (document.querySelector('#txtBuscar') as HTMLInputElement)?.value || ''
  console.log(C.dim('  ┌─ mercadopublico.cl · Buscar licitaciones ───────────────┐'))
  console.log(C.dim('  │ ') + (active ? C.yellow('▸ ') : '  ') + '🔍  ' + (q ? C.green(q) : C.dim('—')))
  console.log(C.dim('  │ ') + '    ' + (clicked ? C.green('[ Buscar ] ✓') : C.bold('[ Buscar ]')))
  console.log(C.dim('  └─────────────────────────────────────────────────────────┘'))
}

async function claudeLLM(prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data: any = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data.content[0].text
}
// icon-only "Buscar" button has no accessible label, so target it by selector
const mockLLM = async () => JSON.stringify([
  { action: 'type', params: { target: '#txtBuscar', text: 'notebooks reacondicionados' }, reasoning: 'escribir el término en el buscador real' },
  { action: 'click', params: { target: '#btnBuscar' }, reasoning: 'ejecutar la búsqueda' },
])
const useReal = !!process.env.ANTHROPIC_API_KEY
const brain = useReal ? `Claude (${process.env.MODEL || 'haiku-4.5'})` : 'mock — export ANTHROPIC_API_KEY para Claude real'

async function main() {
  console.clear()
  console.log(C.bold(C.cyan('\n  browser-agent-kit')) + C.dim('  ·  un agente que vive DENTRO de la página'))
  console.log(C.dim('  demo: mercadopublico.cl (compras públicas del Estado de Chile)\n'))
  await sleep(800)

  await scene('1 · Un scraper externo no ve nada')
  console.log(`  ${C.bold('curl https://www.mercadopublico.cl')} ${C.dim('→')} ${C.red('166 bytes')}`)
  console.log(C.dim('  Es un SPA: el HTML servido es un cascarón vacío. El contenido'))
  console.log(C.dim('  recién existe DESPUÉS de que el navegador ejecuta el JavaScript.'))
  await sleep(1400)

  await scene('2 · El agente corre después del render, dentro de la página')
  const rawDOM = document.body.outerHTML
  const context = serializePage({ interactiveOnly: true })
  const saved = (100 * (1 - Buffer.byteLength(context) / Buffer.byteLength(rawDOM))).toFixed(0)
  console.log(`  DOM renderizado real   ${C.dim(kb(rawDOM).padStart(8))}`)
  console.log(`  árbol de accesibilidad ${C.green(kb(context).padStart(8))}   ${C.bold(C.green(`${saved}% más chico`))}`)
  await sleep(900)
  console.log(C.dim('\n  ── lo que el modelo ve del sitio real (extracto) ──'))
  const interesting = context.split('\n').filter((l) =>
    /Iniciar|Reg|formBusqueda|txtBuscar|btnBuscar|ChileCompra|Mercado P|Convenio/i.test(l)).slice(0, 9)
  console.log(interesting.map((l) => '  ' + C.dim(l.trim())).join('\n'))
  await sleep(1500)

  await scene('3 · El modelo planifica desde esa vista')
  console.log(`  cerebro: ${useReal ? C.green(brain) : C.yellow(brain)}`)
  const goal = 'Buscar licitaciones de notebooks reacondicionados en el portal.'
  console.log(C.dim(`  objetivo: ${goal}`))
  console.log(C.dim('\n  pensando...'))
  const registry = new ActionRegistry()
  ;[typeAction, clickAction, navigateAction].forEach((a) => registry.register(a))
  const planner = new ActionPlanner(registry, { llmCall: useReal ? claudeLLM : mockLLM, maxSteps: 6 })
  const plan = await planner.plan(goal)
  await sleep(600)
  plan.steps.forEach((s, i) =>
    console.log(`  ${C.cyan(`${i + 1}.`)} ${C.bold(s.action)} ${C.dim('→ ' + (s.params.target ?? s.params.url))}  ${C.dim(s.reasoning)}`))
  await sleep(1200)

  await scene('4 · El agente opera el buscador real')
  renderSearch()
  for (const step of plan.steps) {
    await sleep(700)
    const res = await registry.execute(step.action, step.params)
    console.log(`  ${res.success ? C.green('✓') : C.red('✗')} ${C.bold(step.action)} ${C.dim(res.message)}`)
    await sleep(150)
    renderSearch(step.action === 'type', step.action === 'click' && res.success)
    if (!res.success) break
  }

  await scene('Listo')
  console.log(`  El agente encontró el buscador entre ${C.bold('60+')} elementos del sitio real,`)
  console.log(`  leyendo ${C.bold(C.green(kb(context)))} de contexto en vez de ${C.bold(kb(rawDOM))} de DOM.`)
  console.log(C.dim('  Sin Puppeteer. Sin driver externo. Corre adentro, en la sesión real.'))
  line()
  console.log(C.dim('  github.com/nicolascine/browser-agent-kit  ·  MIT  ·  side project open source\n'))
}

main()
