/**
 * Showcase demo — built for recording.
 *
 *   npx tsx examples/demo.ts                       # mock LLM, no key needed
 *   ANTHROPIC_API_KEY=... npx tsx examples/demo.ts # real Claude as the brain
 *   FAST=1 npx tsx examples/demo.ts                # no pacing delays
 *
 * One run shows the whole thesis:
 *   1. a heavy real-world DOM
 *   2. how the accessibility-tree view crushes it down for the LLM
 *   3. the LLM (Claude, if a key is set) planning from that compact view
 *   4. the agent filling a live form, step by step
 */
import { JSDOM } from 'jsdom'
import {
  ActionRegistry, ActionPlanner,
  typeAction, clickAction, navigateAction,
  serializePage,
} from '../src/index'

// ── tiny terminal helpers (no deps) ──
const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
}
const FAST = !!process.env.FAST
const sleep = (ms: number) => new Promise((r) => setTimeout(r, FAST ? 0 : ms))
const line = () => console.log(C.dim('─'.repeat(58)))
async function scene(title: string) {
  console.log('\n' + C.bold(C.magenta(`▌ ${title}`)))
  await sleep(500)
}

// ── A heavy, realistic page. Most of its weight is NON-interactive noise:
//    inline CSS/JS, marketing copy, nested cards — exactly what the
//    accessibility-tree view is meant to strip away. ──
const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.'
const html = `<!DOCTYPE html><html><head><title>Northwind — Open a business account</title>
<style>${'.card{border:1px solid #eaeaea;padding:16px;margin:8px;border-radius:8px;box-shadow:0 1px 2px rgba(0,0,0,.04)}'.repeat(300)}</style>
<script>${'window.__analytics=window.__analytics||[];window.__analytics.push(function(e){return fetch("/track",{method:"POST",body:JSON.stringify(e)})});'.repeat(250)}</script></head>
<body>
  <div class="cookie-bar">We use cookies to improve your experience. <button>Accept all</button> <button>Reject</button></div>
  <header class="site"><nav aria-label="Primary">
    ${['Products', 'Pricing', 'Business', 'Cards', 'Invoicing', 'Payroll', 'Docs', 'Login', 'Sign up'].map((t, i) => `<a href="/n${i}" class="nav">${t}</a>`).join('')}
  </nav></header>
  <section class="hero"><h2>Banking built for teams</h2>
    ${Array.from({ length: 60 }, (_, i) => `<div class="card"><h3>Feature ${i}</h3><p>${LOREM}</p><p>${LOREM}</p></div>`).join('')}
  </section>
  <article>${Array.from({ length: 40 }, () => `<p>${LOREM} ${LOREM}</p>`).join('')}</article>
  <main>
    <h1>Open a business account</h1>
    <form id="signup">
      <label for="company">Company name</label>
      <input type="text" id="company" name="company" placeholder="Acme Inc." />
      <label for="email">Work email</label>
      <input type="email" id="email" name="email" placeholder="you@company.com" />
      <label for="employees">Team size</label>
      <input type="text" id="employees" name="employees" placeholder="1-10" />
      <label for="notes">Anything else?</label>
      <textarea id="notes" name="notes" aria-label="Anything else"></textarea>
      <button type="submit" aria-label="Create account">Create account</button>
    </form>
  </main>
  <footer>${['Privacy', 'Terms', 'Security', 'Status', 'Contact', 'Careers'].map((t, i) => `<a href="/f${i}" class="foot">${t}</a>`).join('')}</footer>
</body></html>`

const dom = new JSDOM(html, { url: 'https://northwind.example/signup' })
const g = globalThis as any
g.window = dom.window
g.document = dom.window.document
for (const k of ['Node', 'NodeFilter', 'Element', 'HTMLElement', 'HTMLInputElement',
  'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLImageElement', 'MutationObserver', 'Event']) {
  g[k] = (dom.window as any)[k]
}
const kb = (s: string) => `${(Buffer.byteLength(s) / 1024).toFixed(1)}KB`

// ── live form rendering ──
let submitted = false
function renderForm(active?: string) {
  const fields: [string, string][] = [
    ['Company', (document.querySelector('#company') as HTMLInputElement).value],
    ['Email', (document.querySelector('#email') as HTMLInputElement).value],
    ['Team', (document.querySelector('#employees') as HTMLInputElement).value],
    ['Notes', (document.querySelector('#notes') as HTMLTextAreaElement).value],
  ]
  console.log(C.dim('  ┌─ Northwind · Open a business account ───────────────┐'))
  for (const [k, v] of fields) {
    const on = active && k.toLowerCase().startsWith(active)
    const val = v ? C.green(v) : C.dim('—')
    const label = (on ? C.yellow('▸ ') : '  ') + k.padEnd(9)
    console.log(C.dim('  │ ') + label + ': ' + val)
  }
  const done = submitted ? C.green('  ✓ submitted') : C.dim('  ·')
  console.log(C.dim('  │ ') + C.bold('[ Create account ]') + done)
  console.log(C.dim('  └─────────────────────────────────────────────────────┘'))
}

// ── the brain: real Claude if a key is present ──
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
const mockLLM = async () => JSON.stringify([
  { action: 'type', params: { target: '#company', text: 'Acme Studio' }, reasoning: 'company name' },
  { action: 'type', params: { target: '#email', text: 'founder@acme.studio' }, reasoning: 'work email' },
  { action: 'type', params: { target: '#employees', text: '11-50' }, reasoning: 'team size' },
  { action: 'type', params: { target: '#notes', text: 'Migrating from a competitor — need API access.' }, reasoning: 'notes' },
  { action: 'click', params: { target: 'Create account' }, reasoning: 'submit' },
])
const useReal = !!process.env.ANTHROPIC_API_KEY
const brain = useReal ? `Claude (${process.env.MODEL || 'haiku-4.5'})` : 'mock — export ANTHROPIC_API_KEY for live Claude'

async function main() {
  console.clear()
  console.log(C.bold(C.cyan('\n  browser-agent-kit')) + C.dim('  ·  AI agents that run inside the browser'))
  console.log(C.dim('  github.com/nicolascine/browser-agent-kit\n'))
  await sleep(700)

  // scene 1: the problem
  await scene('1 · A real page is mostly noise')
  const rawDOM = document.body.outerHTML
  console.log(`  The signup page ships ${C.bold(kb(rawDOM))} of DOM — nav, hero cards,`)
  console.log(`  a cookie bar, a 40-link footer, inline scripts. An LLM can't read that cheaply.`)
  await sleep(1200)

  // scene 2: the trick
  await scene('2 · Give the model the accessibility tree instead')
  const context = serializePage({ interactiveOnly: true })
  const saved = (100 * (1 - Buffer.byteLength(context) / Buffer.byteLength(rawDOM))).toFixed(0)
  console.log(`  raw DOM       ${C.dim(kb(rawDOM).padStart(7))}`)
  console.log(`  LLM context   ${C.green(kb(context).padStart(7))}   ${C.bold(C.green(`${saved}% smaller`))}`)
  await sleep(900)
  console.log(C.dim('\n  ── the entire page, as the model sees it ──'))
  console.log(context.split('\n').map((l) => '  ' + C.dim(l)).join('\n'))
  await sleep(1500)

  // scene 3: plan
  await scene('3 · The model plans from that compact view')
  console.log(`  brain: ${useReal ? C.green(brain) : C.yellow(brain)}`)
  const goal = 'Open a business account for Acme Studio (work email founder@acme.studio, team 11-50), add a short note, then submit.'
  console.log(C.dim(`  goal:  ${goal}`))
  console.log(C.dim('\n  thinking...'))
  const registry = new ActionRegistry()
  ;[typeAction, clickAction, navigateAction].forEach((a) => registry.register(a))
  const planner = new ActionPlanner(registry, { llmCall: useReal ? claudeLLM : mockLLM, maxSteps: 10 })
  const plan = await planner.plan(goal)
  await sleep(600)
  plan.steps.forEach((s, i) =>
    console.log(`  ${C.cyan(`${i + 1}.`)} ${C.bold(s.action)} ${C.dim('→ ' + (s.params.target ?? s.params.url))}  ${C.dim(s.reasoning)}`))
  await sleep(1200)

  // scene 4: execute
  ;(document.querySelector('#signup') as HTMLFormElement).addEventListener('submit', (e) => { e.preventDefault(); submitted = true })
  await scene('4 · The agent acts on the real DOM')
  renderForm()
  for (const step of plan.steps) {
    await sleep(650)
    const tgt = (step.params.target ?? '') as string
    const activeKey = tgt.includes('company') ? 'company' : tgt.includes('email') ? 'email'
      : tgt.includes('employee') ? 'team' : tgt.includes('note') ? 'notes' : undefined
    const res = await registry.execute(step.action, step.params)
    console.log(`  ${res.success ? C.green('✓') : '✗'} ${C.bold(step.action)} ${C.dim(res.message)}`)
    await sleep(150)
    renderForm(activeKey)
    if (!res.success) break
  }

  // outro
  await scene('Done')
  console.log(`  Filled a 4-field form from one sentence, against a ${C.bold(kb(rawDOM))} page,`)
  console.log(`  on ${C.bold(C.green(kb(context)))} of context. No Puppeteer. Runs ${C.bold('inside')} the browser.`)
  line()
  console.log(C.dim('  github.com/nicolascine/browser-agent-kit  ·  MIT  ·  by Nicolás Silva\n'))
}

main()
