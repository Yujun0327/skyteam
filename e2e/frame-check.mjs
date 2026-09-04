/**
 * Screenshots of the home, the solo cockpit (briefing / placing) and the phone
 * layout, plus a console-error sweep. Run: node e2e/frame-check.mjs (built dist/)
 */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4197
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((r) => setTimeout(r, 1500))

let failed = false
try {
  const browser = await chromium.launch()
  for (const [name, viewport] of [
    ['desktop', { width: 1280, height: 820 }],
    ['phone', { width: 430, height: 900 }],
  ]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`http://localhost:${PORT}/`)
    await page.waitForSelector('[data-action="solo"]')
    await page.screenshot({ path: `e2e/${name}-home.png` })
    await page.click('[data-action="solo"]')
    await page.waitForSelector('.cockpit', { timeout: 8000 })
    await page.waitForTimeout(800)
    await page.screenshot({ path: `e2e/${name}-briefing.png` })
    // brief -> roll twice via keyboard
    const brief = page.locator('[data-action="brief"]')
    if (await brief.count()) await brief.click()
    for (let k = 0; k < 2; k++) {
      await page.waitForSelector('.cup-grip', { timeout: 8000 })
      await page.keyboard.down('Space')
      for (let i = 0; i < 8; i++) await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
      await page.keyboard.up('Space')
      await page.waitForSelector('.cockpit[data-phase="placing"], .cup-grip', { timeout: 10000 })
      await page.waitForTimeout(400)
    }
    await page.waitForSelector('.cockpit[data-phase="placing"]', { timeout: 10000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: `e2e/${name}-placing.png`, fullPage: true })
    if (errors.length) {
      failed = true
      console.error(`[frame:${name}] errors:`, errors.slice(0, 5))
    } else console.log(`[frame:${name}] ok`)
    await page.close()
  }
  await browser.close()
} catch (e) {
  failed = true
  console.error('[frame] FAIL', e)
} finally {
  preview.kill()
}
process.exit(failed ? 1 : 0)
