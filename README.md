# browser-agent-kit

Build AI agents that run **inside** the browser — same page, same DOM, real context.

> Most agent frameworks control a browser from the outside (Puppeteer, Playwright). This toolkit lets you build agents that operate from within. Different tradeoffs, different use cases.

![demo](examples/demo-cl-pro.gif)

*Left: the agent's view — the rendered DOM (hundreds of nodes) collapsing into the accessibility tree it actually reads. Right: the real [mercadopublico.cl](https://www.mercadopublico.cl) (Chile's public-procurement portal, a SPA) with the kit injected into it. A `curl` returns an empty 166-byte shell; the agent runs **after** render, reads the page as a ~4KB tree (≈90% smaller than the DOM), and types into the real search box — no Puppeteer, no external driver. Reproduce it: `npm run record:pro`.*

## How it works

```
                    ┌──────────────────────┐
                    │     BrowserAgent      │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                 │
     ┌────────▼──────┐ ┌──────▼──────┐ ┌───────▼───────┐
     │  DOM Analysis  │ │   Actions    │ │    Planner    │
     │  - snapshot    │ │  - click     │ │  - strategies │
     │  - a11y tree   │ │  - type      │ │  - LLM-based  │
     │  - mutations   │ │  - navigate  │ │  - replanning │
     │  - selector    │ │  - (custom)  │ │               │
     └───────────────┘ └─────────────┘ └───────────────┘
```

The key insight: LLMs don't need the full DOM. They need a **semantic** view — like what a screen reader sees. We extract the accessibility tree, filter to interactive elements, and serialize it as structured text. A 50KB DOM becomes ~2-4KB of context.

## Install

```bash
npm install browser-agent-kit
```

## Usage

```typescript
import { BrowserAgent } from 'browser-agent-kit'

const agent = new BrowserAgent({
  llmCall: async (prompt) => {
    // bring your own LLM (OpenAI, Anthropic, local, whatever)
    return await callYourLLM(prompt)
  },
})

await agent.run('Fill the contact form with name "Nico" and email "hi@nico.cl", then submit')
```

The agent will:
1. Capture the page's accessibility tree
2. Identify interactive elements (inputs, buttons, links)
3. Ask the LLM to plan a sequence of actions
4. Execute each action, monitoring DOM changes between steps

## Demo

See the whole loop in your terminal — DOM compression, planning, and a form filling itself:

```bash
npm install
npm run demo:cl    # real DOM of mercadopublico.cl (Chile) — agent drives the search box
npm run demo       # a synthetic signup page — full fill + submit loop

ANTHROPIC_API_KEY=sk-... npm run demo:cl   # let a real Claude model do the planning
```

`demo:cl` runs against a captured snapshot of the *rendered* DOM of a real Chilean
government site (it's a SPA — scrapers see an empty shell). `demo` uses a heavier
synthetic page to show the full type → click → submit loop. Both compress the page to
a ~1–4KB accessibility view (90%+ smaller), plan from it, and act step by step.

## Custom actions

The built-in actions (click, type, navigate) cover basics. Register your own:

```typescript
agent.registerAction({
  name: 'scroll_down',
  description: 'Scroll the page down by one viewport',
  parameters: [],
  execute: async () => {
    window.scrollBy(0, window.innerHeight)
    return { success: true, message: 'Scrolled' }
  }
})
```

The action registry generates descriptions for the LLM automatically, so the planner knows what's available.

## Smart element selection

Finding elements by CSS selectors is fragile. The selector module tries multiple strategies in order:

1. **CSS** — direct selector match
2. **ARIA** — search by aria-label, role, name
3. **Text** — match by visible text content
4. **Fuzzy** — word-level matching with confidence scoring

Each result includes a confidence score. The agent uses the highest-confidence match.

## Status

This is actively being developed. Core DOM analysis and action execution work well. The planner is functional but basic — it doesn't re-plan on failure yet (it just stops). The smart selector handles most cases but struggles with highly dynamic SPAs.

The end-to-end loop is covered by an integration test (`tests/agent.integration.test.ts`) that runs the **real** library — serialize → plan → type → click → submit — against a live DOM with a mock LLM. Run it with `npm test`.

What's working:
- [x] DOM snapshot and serialization
- [x] Accessibility tree extraction
- [x] Action registry and execution
- [x] LLM-based planning
- [x] Mutation tracking
- [x] End-to-end form fill (verified in CI against a real DOM)

What's next:
- [ ] Re-planning on action failure
- [ ] Screenshot support (for vision models)
- [ ] iframe handling
- [ ] Session recording/replay

## Why not Puppeteer?

Puppeteer/Playwright control a browser from outside. browser-agent-kit runs inside. Use this when:
- Building a browser extension with AI
- Adding an AI assistant to your web app
- Running agents in existing browser sessions
- Need same-origin access without proxying

## License

MIT
