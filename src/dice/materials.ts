/**
 * Every texture is generated at runtime on canvas — the repo ships zero
 * image binaries. Palette mirrors app.css: matte flight-deck surfaces,
 * blue Pilot dice and orange Co-Pilot dice with white pips.
 */
import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three'

export type DieColor = 'blue' | 'orange'

export const PALETTE = {
  shelf: '#0e141b',
  shelfLo: '#070a0e',
  rim: '#1c242e',
  rimHi: '#2a3542',
  blue: '#2f7bff',
  blueLo: '#1d4fb0',
  orange: '#ff8a1f',
  orangeLo: '#c25f0a',
  pip: '#f7f9fb',
  cup: '#161c24',
  steel: '#8a94a0',
}

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  return [c, c.getContext('2d')!]
}

/** Dark brushed shelf with a soft centre light. */
export function shelfTexture(size = 512): CanvasTexture {
  const [c, ctx] = canvas(size)
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.8)
  grad.addColorStop(0, PALETTE.shelf)
  grad.addColorStop(1, PALETTE.shelfLo)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const img = ctx.getImageData(0, 0, size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    const line = (Math.random() - 0.5) * 6
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const n = line + (Math.random() - 0.5) * 3
      d[i] += n
      d[i + 1] += n
      d[i + 2] += n
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
}

/** A coloured die face with white pips. */
export function faceTexture(value: number, color: DieColor, size = 256): CanvasTexture {
  const [c, ctx] = canvas(size)
  ctx.fillStyle = color === 'blue' ? PALETTE.blue : PALETTE.orange
  ctx.fillRect(0, 0, size, size)
  const grad = ctx.createRadialGradient(size * 0.4, size * 0.4, size * 0.2, size / 2, size / 2, size * 0.75)
  grad.addColorStop(0, 'rgba(255,255,255,0.10)')
  grad.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const r = size * 0.085
  ctx.fillStyle = PALETTE.pip
  for (const [x, y] of PIP_LAYOUTS[value]) {
    ctx.beginPath()
    ctx.arc(x * size, y * size, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  for (const [x, y] of PIP_LAYOUTS[value]) {
    ctx.beginPath()
    ctx.arc(x * size + r * 0.25, y * size + r * 0.25, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** Die materials in BoxGeometry group order [+X, -X, +Y, -Y, +Z, -Z] = faces 3, 4, 1, 6, 2, 5. */
export function dieMaterials(color: DieColor): MeshStandardMaterial[] {
  const faceOnAxis = [3, 4, 1, 6, 2, 5]
  return faceOnAxis.map(
    (v) =>
      new MeshStandardMaterial({
        map: faceTexture(v, color),
        roughness: 0.42,
        metalness: 0.05,
        emissive: new Color('#000000'),
      }),
  )
}

export function shelfMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ map: shelfTexture(), roughness: 0.6, metalness: 0.35 })
}

export function rimMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(PALETTE.rim), roughness: 0.45, metalness: 0.6 })
}

export function cupMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(PALETTE.cup), roughness: 0.55, metalness: 0.4 })
}

export function steelMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: new Color(PALETTE.steel), roughness: 0.3, metalness: 0.9 })
}
