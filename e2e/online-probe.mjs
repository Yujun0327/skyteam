/**
 * Two-browser pairing smoke over the REAL public MQTT brokers: host creates a
 * room, guest joins by code, host starts, both cockpits drive one full round
 * through the DOM, states must match. Needs network. Run: node e2e/online-probe.mjs
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4194
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((r) => setTimeout(r, 1500))
let failed = false
const t0 = Date.now()
const log = (m) => console.log(`[online +${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`)
try {
  const browser = await chromium.launch()
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  const ctxB = await browser.newContext({ viewport: { width: 1200, height: 900 } })
  const a = await ctxA.newPage()
  const b = await ctxB.newPage()
  const errors = []
  for (const p of [a, b]) {
    p.on('pageerror', (e) => errors.push(String(e)))
    await p.emulateMedia({ reducedMotion: 'reduce' })
  }
  await a.goto(`http://localhost:${PORT}/`)
  await a.fill('input[placeholder="Captain"]', 'Alpha')
  await a.click('[data-action="create"]')
  await a.waitForURL(/#room=/)
  const code = a.url().match(/room=([A-Z0-9]+)/)[1]
  log(`room ${code}`)
  await b.goto(`http://localhost:${PORT}/`)
  await b.fill('input[placeholder="Captain"]', 'Bravo')
  await b.fill('input[aria-label="room code"]', code)
  await b.click('[data-action="join"]')
  await a.waitForSelector('[data-action="start"]:not([disabled])', { timeout: 60000 })
  log('paired')
  await a.click('[data-action="start"]')
  await a.waitForSelector('.cockpit', { timeout: 20000 })
  await b.waitForSelector('.cockpit', { timeout: 20000 })
  log('both in the cockpit')

  const state = (p) => p.evaluate(() => JSON.stringify(window.__skyteam.state))
  async function stepOne() {
    for (const p of [a, b]) {
      const phase = await p.locator('.cockpit').getAttribute('data-phase')
      if (await p.locator('[data-action="brief"]').count()) {
        await p.click('[data-action="brief"]')
        return true
      }
      if (phase === 'rolling' && (await p.locator('.cup-grip').count())) {
        await p.keyboard.down('Space')
        for (let i = 0; i < 8; i++) await p.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
        await p.keyboard.up('Space')
        await p.waitForTimeout(300)
        return true
      }
      if (phase === 'placing' && (await p.locator('.chip.ok').count())) {
        await p.locator('.chip.ok').first().click()
        const well = p.locator('.well.legal').first()
        if (await well.count()) await well.click()
        else await p.locator('.discard').click()
        return true
      }
      if (phase === 'awaitReroll' && (await p.locator('[data-action="confirm-reroll"]').count())) {
        await p.click('[data-action="confirm-reroll"]')
        return true
      }
    }
    return false
  }
  let moves = 0
  const startRound = await a.locator('.cockpit').getAttribute('data-round')
  while (moves < 40) {
    const round = await a.locator('.cockpit').getAttribute('data-round')
    const result = await a.locator('.cockpit').getAttribute('data-result')
    if (round !== startRound || result) break
    if (await stepOne()) moves++
    await a.waitForTimeout(700)
  }
  await a.waitForTimeout(3000)
  const sa = await state(a)
  const sb = await state(b)
  const same = sa === sb
  log(`${moves} moves driven, states ${same ? 'match' : 'DIFFER'}, round ${await a.locator('.cockpit').getAttribute('data-round')}`)
  if (!same || moves < 8) failed = true
  if (errors.length) {
    failed = true
    console.error('[online] errors', errors.slice(0, 5))
  }
  await a.screenshot({ path: 'e2e/online-a.png' })
  await b.screenshot({ path: 'e2e/online-b.png' })
  await browser.close()
} catch (e) {
  failed = true
  console.error('[online] FAIL', e)
} finally {
  preview.kill()
}
process.exit(failed ? 1 : 0)
