// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { BrowserAgent } from '../src/agent'
import { serializePage } from '../src/utils/serializer'
import { findElement } from '../src/dom/selector'

function buildContactPage() {
  document.title = 'Contact'
  document.body.innerHTML = `
    <main>
      <h1>Contact us</h1>
      <form>
        <label for="name">Full name</label>
        <input type="text" id="name" name="name" placeholder="Your name" />
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" />
        <label for="msg">Message</label>
        <textarea id="msg" name="message" aria-label="Message"></textarea>
        <button type="submit" aria-label="Send message">Send</button>
      </form>
    </main>`
}

describe('end-to-end agent loop (real library code)', () => {
  it('serializes the page into a compact semantic view', () => {
    buildContactPage()
    const text = serializePage({ interactiveOnly: true })
    console.log('\n--- serialized page context ---\n' + text + '\n')
    expect(text).toContain('Email')
    expect(text.length).toBeLessThan(4000)
  })

  it('finds elements by aria-label and by name', () => {
    buildContactPage()
    const byAria = findElement('Send message')
    const byName = findElement('email')
    console.log('byAria:', byAria?.strategy, byAria?.confidence)
    console.log('byName:', byName?.strategy, byName?.confidence)
    expect(byAria).not.toBeNull()
    expect(byName).not.toBeNull()
  })

  it('runs a full plan -> execute loop and fills the form', async () => {
    buildContactPage()

    // Mock LLM: returns a plan the way a real model would, given the serialized page
    const mockLLM = async (_prompt: string) => JSON.stringify([
      { action: 'type', params: { target: '#name', text: 'Nico Silva' }, reasoning: 'fill name' },
      { action: 'type', params: { target: '#email', text: 'hi@nico.cl' }, reasoning: 'fill email' },
      { action: 'type', params: { target: '#msg', text: 'Interested in your services' }, reasoning: 'fill message' },
      { action: 'click', params: { target: 'Send message' }, reasoning: 'submit' },
    ])

    let submitted = false
    document.querySelector('form')!.addEventListener('submit', (e) => { e.preventDefault(); submitted = true })

    const agent = new BrowserAgent({ llmCall: mockLLM, verbose: true })
    const result = await agent.run('Fill the contact form and submit')

    const name = document.querySelector<HTMLInputElement>('#name')!.value
    const email = document.querySelector<HTMLInputElement>('#email')!.value
    console.log('\nfinal form -> name:', name, '| email:', email, '| submitted:', submitted)

    expect(result.success).toBe(true)
    expect(name).toBe('Nico Silva')
    expect(email).toBe('hi@nico.cl')
  })
})
