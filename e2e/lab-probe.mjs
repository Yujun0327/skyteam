/** Lab probe: forced faces must be the faces visually on top after a keyboard throw. */
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 4196
const preview = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' })
await new Promise((r) => setTimeout(r, 1500))
let failed = false
try {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://localhost:${PORT}/#lab=3,1,4,6`)
  await page.waitForSelector('.cup-grip', { timeout: 8000 })
  await page.keyboard.down('Space')
  for (let i = 0; i < 8; i++) await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight')
  await page.keyboard.up('Space')
  await page.waitForSelector('.lab[data-rolling="false"][data-faces="3,1,4,6"]', { timeout: 20000 })
  await page.waitForTimeout(600)
  const visual = await page.evaluate(() => window.__lab.visualFaces())
  const ok = JSON.stringify(visual) === JSON.stringify([3, 1, 4, 6])
  console.log(`[lab] visual faces ${visual.join(',')} ${ok ? 'ok' : 'MISMATCH'}`)
  if (!ok || errors.length) failed = true
  if (errors.length) console.error('[lab] errors', errors)
  await page.screenshot({ path: 'e2e/lab.png' })
  await browser.close()
} catch (e) {
  failed = true
  console.error('[lab] FAIL', e)
} finally {
  preview.kill()
}
process.exit(failed ? 1 : 0)
