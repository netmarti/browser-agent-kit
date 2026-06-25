// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { findElement } from '../src/dom/selector'

// these tests exercise the library's own findElement(), not jsdom's querySelector

describe('findElement strategies', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav>
        <a href="/home" id="nav-home">Home</a>
        <a href="/about">About Us</a>
      </nav>
      <main>
        <h1>Welcome</h1>
        <form>
          <label for="email">Email</label>
          <input type="email" id="email" name="email" placeholder="you@example.com" />
          <button type="submit" aria-label="Send message">Submit</button>
        </form>
      </main>`
  })

  it('resolves a direct CSS selector with full confidence', () => {
    const r = findElement('#nav-home')
    expect(r).not.toBeNull()
    expect(r!.strategy).toBe('css')
    expect(r!.confidence).toBe(1)
    expect(r!.element.textContent).toBe('Home')
  })

  it('resolves by aria-label when the description is not valid CSS', () => {
    const r = findElement('Send message')
    expect(r).not.toBeNull()
    expect(r!.strategy).toBe('aria')
    expect(r!.element.tagName).toBe('BUTTON')
  })

  it('resolves by the name attribute', () => {
    const r = findElement('email')
    expect(r).not.toBeNull()
    expect(['aria', 'css']).toContain(r!.strategy)
    expect(r!.element.tagName).toBe('INPUT')
  })

  it('falls back to text matching for visible link text', () => {
    const r = findElement('About Us')
    expect(r).not.toBeNull()
    expect(r!.confidence).toBeGreaterThan(0.5)
  })

  it('returns null when nothing matches with enough confidence', () => {
    const r = findElement('a totally unrelated nonexistent phrase xyzzy')
    expect(r).toBeNull()
  })
})
