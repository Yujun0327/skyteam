/** Probe the deployed GitHub Pages build: home renders, solo cockpit opens, no page errors. */
import { chromium } from 'playwright'

const URL = process.env.LIVE_URL ?? 'https://yujun0327.github.io/skyteam/'
let failed = false
try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-action="solo"]', { timeout: 20000 })
  await page.click('[data-action="solo"]')
  await page.waitForSelector('.cockpit', { timeout: 20000 })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'e2e/live.png' })
  console.log(`[live] ${URL} ok, errors: ${errors.length}`)
  if (errors.length) {
    failed = true
    console.error(errors.slice(0, 5))
  }
  await browser.close()
} catch (e) {
  failed = true
  console.error('[live] FAIL', e)
}
process.exit(failed ? 1 : 0)
