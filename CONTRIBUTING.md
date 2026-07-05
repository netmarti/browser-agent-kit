# Contributing to Browser-Agent-Kit

Thank you for being interested in contributing to **browser-agent-kit**! We are building the next generation of autonomous agents running natively in the browser, and we need your help to make them robust, secure, and fast.

# How Can I Contribute?

### Reporting Bugs
Found a bug or an edge case where the agent behaves unexpectedly? Please open an issue with:
- Steps to reproduce.
- Expected vs. Actual behavior.
- Environment details (Browser version, OS).

# Suggesting Features
Have an idea for a new capability? Open an issue tagged `enhancement` and let's discuss the architecture impact.

# Submitting Code
We follow standard GitHub Flow:
1. Fork the repo and create your branch from `main`.
2. Write tests for your changes. (See **Testing** below).
3. Ensure all tests pass (`npm test`).
4. Update documentation if necessary.
5. Create a Pull Request describing the change.

# Testing Requirements
To ensure stability, **all new features must include corresponding unit tests**.
- Run the test suite: `npm test`
- Check coverage report: `npm run test:coverage` (if configured)
- Aim for high code coverage on modified modules.

# Development Setup
1. Clone the repo: `git clone https://github.com/netmarti/browser-agent-kit.git`
2. Install dependencies: `npm install`
3. Start dev server (if applicable): `npm run dev`

# Code Style
- Follow TypeScript strict mode guidelines.
- Use meaningful variable names.
- Document public APIs with JSDoc comments.
- Keep functions focused (Single Responsibility Principle).

# Community
This project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold its terms.

Let's build something amazing together!
