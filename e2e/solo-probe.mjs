/**
 * Solo game probe: Home -> solo YUL -> drive whole rounds through the DOM
 * (keyboard roll ritual, chip + lit-well clicks, reroll handshake) until the
 * debrief appears. Run: node e2e/solo-probe.mjs (built dist/)
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4198
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((r) => setTimeout(r, 1500))

let failed = false
try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`http://localhost:${PORT}/`)
  await page.click('[data-action="solo"]')
  await page.waitForSelector('.cockpit', { timeout: 8000 })

  async function roll() {
    await page.waitForSelector('.cup-grip', { timeout: 8000 })
    await page.keyboard.down('Space')
    for (let i = 0; i < 8; i++) await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
    await page.keyboard.up('Space')
    await page.waitForTimeout(250)
  }

  let steps = 0
  while (steps++ < 400) {
    const phase = await page.locator('.cockpit').getAttribute('data-phase')
    const result = await page.locator('.cockpit').getAttribute('data-result')
    if (result) break
    if (phase === 'briefing') {
      await page.click('[data-action="brief"]')
    } else if (phase === 'rolling') {
      await roll()
    } else if (phase === 'awaitReroll') {
      await page.click('[data-action="confirm-reroll"]')
    } else if (phase === 'placing') {
      const chip = page.locator('.chip.ok').first()
      if (!(await chip.count())) {
        await page.waitForTimeout(100)
        continue
      }
      await chip.click()
      const well = page.locator('.well.legal').first()
      if (await well.count()) await well.click()
      else {
        const discard = page.locator('.discard')
        if (await discard.count()) await discard.click()
        else {
          console.error('[solo] FAIL: selected die has neither slot nor discard')
          failed = true
          break
        }
      }
    }
    await page.waitForTimeout(40)
  }
  const round = await page.locator('.cockpit').getAttribute('data-round')
  const result = await page.locator('.cockpit').getAttribute('data-result')
  await page.waitForSelector('.debrief', { timeout: 5000 })
  console.log(`[solo] finished: ${result} in round ${round}, ${steps} steps`)
  await page.screenshot({ path: 'e2e/desktop-debrief.png' })
  if (!result) failed = true
  if (errors.length) {
    failed = true
    console.error('[solo] errors:', errors.slice(0, 5))
  }
  await browser.close()
} catch (e) {
  failed = true
  console.error('[solo] FAIL', e)
} finally {
  preview.kill()
}
process.exit(failed ? 1 : 0)
