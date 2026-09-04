/**
 * The view through the windshield: a runway at night with its lighting
 * system, a ground plane of scattered lights, weather, and traffic on the
 * approach corridor. The camera is the aircraft: it banks with the axis,
 * sinks with the altitude and closes on the threshold with the position.
 * No shadows, no postprocessing, DPR capped at 2.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Fog,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { TimeOfDay, Weather } from '../data/airports'
import type { ViewParams } from './view-params'

export interface Windshield {
  setParams(p: ViewParams): void
  frame(dt: number): void
  setSize(w: number, h: number): void
  dispose(): void
}

const APPROACH_LEN = 1150 // metres from the clouds to the threshold
const ALT_MAX = 230
const RUNWAY_LEN = 2400
const RUNWAY_W = 90

const SKY: Record<TimeOfDay, [string, string, string]> = {
  // [zenith, horizon, ground]
  night: ['#02050a', '#16233a', '#04070b'],
  dusk: ['#0a1030', '#8a4a3c', '#0a0c12'],
  dawn: ['#121b36', '#c07a48', '#0d0f16'],
  day: ['#3f78c8', '#c6d9ee', '#26343e'],
}

function skyTexture(t: TimeOfDay, below?: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 512
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 512)
  const [z, h, gr] = SKY[t]
  g.addColorStop(0, z)
  g.addColorStop(0.3, z)
  g.addColorStop(0.5, h)
  g.addColorStop(0.5005, below ?? gr)
  g.addColorStop(1, below ?? gr)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 512)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

let dotTex: CanvasTexture | null = null
/** Soft round sprite so lights render as glowing dots, not squares. */
function dotTexture(): CanvasTexture {
  if (dotTex) return dotTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.8)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  dotTex = new CanvasTexture(c)
  return dotTex
}

function pointCloud(positions: number[], color: string, size: number, opacity = 1): Points {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  const mat = new PointsMaterial({ color: new Color(color), size, sizeAttenuation: true, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, map: dotTexture() })
  return new Points(geo, mat)
}

function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createWindshield(canvas: HTMLCanvasElement): Windshield {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  const scene = new Scene()
  const camera = new PerspectiveCamera(64, 1, 1, 90000)

  // sky: a camera-locked billboard far ahead; its middle is eye level, so the
  // painted horizon is flat and banks with the aircraft
  const SKY_DIST = 12000
  const sky = new Mesh(new PlaneGeometry(SKY_DIST * 14, SKY_DIST * 8), new MeshBasicMaterial({ map: skyTexture('night'), fog: false, depthWrite: false }))
  sky.renderOrder = -10
  scene.add(sky)

  // ground
  const ground = new Mesh(new PlaneGeometry(200000, 200000), new MeshBasicMaterial({ color: '#05080c' }))
  ground.rotation.x = -Math.PI / 2
  ground.position.z = -RUNWAY_LEN / 2
  scene.add(ground)

  // runway surface and markings
  const runway = new Group()
  const apron = new Mesh(new PlaneGeometry(RUNWAY_W * 5, RUNWAY_LEN + 600), new MeshBasicMaterial({ color: '#0c1015' }))
  apron.rotation.x = -Math.PI / 2
  apron.position.set(0, 0.03, -RUNWAY_LEN / 2 + 100)
  runway.add(apron)
  const surface = new Mesh(new PlaneGeometry(RUNWAY_W, RUNWAY_LEN), new MeshBasicMaterial({ color: '#1b2229' }))
  surface.rotation.x = -Math.PI / 2
  surface.position.set(0, 0.05, -RUNWAY_LEN / 2)
  runway.add(surface)
  const edge: number[] = []
  const centre: number[] = []
  for (let z = 0; z >= -RUNWAY_LEN; z -= 60) {
    edge.push(-RUNWAY_W / 2, 0.6, z, RUNWAY_W / 2, 0.6, z)
    if (z <= -30) centre.push(0, 0.4, z)
  }
  runway.add(pointCloud(edge, '#fff3d6', 15))
  runway.add(pointCloud(centre, '#f8fbff', 8))
  const thr: number[] = []
  const end: number[] = []
  for (let x = -RUNWAY_W / 2; x <= RUNWAY_W / 2; x += 4) {
    thr.push(x, 0.6, 0)
    end.push(x, 0.6, -RUNWAY_LEN)
  }
  runway.add(pointCloud(thr, '#37d67a', 16))
  runway.add(pointCloud(end, '#ff3b30', 14))
  // PAPI, left of the threshold, 300 m in
  const papi: number[] = []
  for (let i = 0; i < 4; i++) papi.push(-RUNWAY_W / 2 - 14 - i * 9, 0.8, -300)
  const papiPts = pointCloud(papi, '#ff4d4d', 18)
  runway.add(papiPts)
  // approach lighting: centreline bars toward the aircraft with a sequenced strobe
  const alsBars: number[] = []
  const strobes: Points[] = []
  for (let i = 1; i <= 14; i++) {
    const z = i * 60
    for (let x = -9; x <= 9; x += 3) alsBars.push(x, 0.8 + i * 0.4, z)
    if (i % 2 === 0) {
      for (let x = -RUNWAY_W / 2 - 10; x <= RUNWAY_W / 2 + 10; x += RUNWAY_W + 20) alsBars.push(x, 0.8, z)
    }
    const s = pointCloud([0, 1.2 + i * 0.4, z], '#ffffff', 28)
    strobes.push(s)
    runway.add(s)
  }
  runway.add(pointCloud(alsBars, '#ffe9c4', 12))
  scene.add(runway)

  // scattered ground lights (city / plain / water); regenerated per terrain
  let cityLights: Points | null = null
  function buildCity(terrain: ViewParams['terrain']): void {
    if (cityLights) {
      scene.remove(cityLights)
      cityLights.geometry.dispose()
    }
    const rnd = seeded(terrain.length * 977 + 13)
    const density = terrain === 'city' ? 5000 : terrain === 'plain' ? 1600 : terrain === 'water' ? 700 : terrain === 'mountain' ? 500 : 120
    const pos: number[] = []
    for (let i = 0; i < density; i++) {
      const x = (rnd() - 0.5) * 12000
      const z = -RUNWAY_LEN - 300 - rnd() * 7000 + (rnd() < 0.4 ? 9500 : 0)
      if (Math.abs(x) < 160 && z > -RUNWAY_LEN - 300 && z < APPROACH_LEN + 200) continue
      const y = terrain === 'mountain' ? rnd() * rnd() * 380 : 1 + rnd() * 3
      pos.push(x, y, z)
    }
    cityLights = pointCloud(pos, terrain === 'ice' ? '#bcd7ff' : '#ffc98a', 8, 0.8)
    scene.add(cityLights)
  }
  buildCity('city')

  // weather particles
  let precip: Points | null = null
  let precipKind: Weather = 'clear'
  function buildPrecip(w: Weather): void {
    if (precip) {
      scene.remove(precip)
      precip.geometry.dispose()
    }
    precip = null
    precipKind = w
    if (w !== 'rain' && w !== 'storm' && w !== 'snow') return
    const rnd = seeded(7)
    const pos: number[] = []
    const n = w === 'snow' ? 900 : 1400
    for (let i = 0; i < n; i++) pos.push((rnd() - 0.5) * 140, (rnd() - 0.5) * 90, (rnd() - 0.5) * 140)
    precip = pointCloud(pos, w === 'snow' ? '#e8f1ff' : '#9fb4cc', w === 'snow' ? 0.9 : 0.5, 0.55)
    scene.add(precip)
  }

  // traffic
  const trafficGroup = new Group()
  scene.add(trafficGroup)
  const trafficMeshes: { g: Group; strobe: Points; phase: number }[] = []
  function buildTraffic(list: ViewParams['traffic'], altitude: number): void {
    for (const t of trafficMeshes) trafficGroup.remove(t.g)
    trafficMeshes.length = 0
    const rnd = seeded(31)
    for (const dot of list) {
      for (let k = 0; k < dot.count; k++) {
        const g = new Group()
        const body = new Mesh(new PlaneGeometry(26, 4), new MeshBasicMaterial({ color: '#1a2129' }))
        body.rotation.x = -Math.PI / 2
        g.add(body)
        g.add(pointCloud([-13, 0, 0], '#ff3b30', 6))
        g.add(pointCloud([13, 0, 0], '#37d67a', 6))
        const strobe = pointCloud([0, 1.5, -2], '#ffffff', 12)
        g.add(strobe)
        const z = (1 - dot.dist) * APPROACH_LEN
        const lane = (k % 2 === 0 ? -1 : 1) * (60 + k * 45 + rnd() * 30)
        const y = 40 + dot.dist * 0 + (1 - dot.dist) * ALT_MAX * altitude * 0.9 + rnd() * 60
        g.position.set(lane, y, z)
        trafficGroup.add(g)
        trafficMeshes.push({ g, strobe, phase: rnd() * 6 })
      }
    }
  }

  // lightning
  let flash = 0
  let nextFlash = 4

  // camera state (smoothed)
  const cur = { distance: 0, altitude: 1, bank: 0, roll: 0, shake: 0, forward: 0 }
  let target: ViewParams = { distance: 0, altitude: 1, bank: 0, traffic: [], timeOfDay: 'night', weather: 'clear', terrain: 'city', status: 'flying', speed: null }
  let time = 0
  let lastTod: TimeOfDay | null = null
  let lastTerrain: ViewParams['terrain'] | null = null
  let lastTrafficKey = ''

  function applyStatic(p: ViewParams): void {
    lastTod = p.timeOfDay
    if (p.terrain !== lastTerrain) {
      lastTerrain = p.terrain
      buildCity(p.terrain)
    }
    if (p.weather !== precipKind) buildPrecip(p.weather)
    const fogColor = new Color(SKY[p.timeOfDay][2]).lerp(new Color(SKY[p.timeOfDay][1]), p.timeOfDay === 'day' ? 0.7 : 0.35)
    const density = p.weather === 'fog' ? 0.0011 : p.weather === 'snow' ? 0.0007 : p.weather === 'storm' ? 0.0006 : p.weather === 'haze' ? 0.00045 : p.weather === 'rain' ? 0.0005 : 0.00016
    scene.fog = new Fog(fogColor, 40, 1 / density)
    ;(ground.material as MeshBasicMaterial).color.set(SKY[p.timeOfDay][2])
    ;(sky.material as MeshBasicMaterial).map = skyTexture(p.timeOfDay, fogColor.getStyle())
    ;(sky.material as MeshBasicMaterial).needsUpdate = true
    const key = JSON.stringify(p.traffic) + p.altitude
    if (key !== lastTrafficKey) {
      lastTrafficKey = key
      buildTraffic(p.traffic, p.altitude)
    }
  }

  function setParams(p: ViewParams): void {
    const first = target.status === 'flying' && p.status !== 'flying'
    target = p
    applyStatic(p)
    if (first && p.status === 'crashed') cur.shake = 1.2
  }

  function frame(dt: number): void {
    time += dt
    const k = 1 - Math.exp(-dt / 0.55)
    cur.distance += (target.distance - cur.distance) * k
    cur.altitude += (target.altitude - cur.altitude) * k
    const bankTarget = target.status === 'crashed' ? (target.bank >= 0 ? 75 : -75) : target.bank
    cur.bank += (bankTarget - cur.bank) * (1 - Math.exp(-dt / 0.5))
    if (target.status === 'landed') cur.forward = Math.min(1, cur.forward + dt * 0.12)
    cur.shake = Math.max(0, cur.shake - dt * 0.6)

    const z = (1 - cur.distance) * APPROACH_LEN + 90 - cur.forward * 1100
    const y = 5 + cur.altitude * ALT_MAX
    camera.position.set(0, y, z)
    ground.position.set(camera.position.x, 0, camera.position.z)
    // sky billboard: straight ahead at eye level, facing the camera
    sky.position.set(camera.position.x, camera.position.y, camera.position.z - SKY_DIST)
    sky.rotation.set(0, 0, (cur.bank * Math.PI) / 180)
    const aim = new Vector3(0, Math.max(0, y * 0.45 - 6), z - 650)
    camera.lookAt(aim)
    camera.rotateZ((cur.bank * Math.PI) / 180)
    if (cur.shake > 0) {
      camera.position.x += (Math.sin(time * 47) + Math.sin(time * 31)) * cur.shake * 3
      camera.position.y += Math.sin(time * 39) * cur.shake * 2
    }
    if (target.weather === 'storm' || target.weather === 'rain') {
      camera.position.x += Math.sin(time * 1.7) * 1.5
      camera.position.y += Math.sin(time * 2.3) * 1.2
    }

    // sequenced strobe (the rabbit), 2 per second sweep
    const idx = Math.floor((time * 18) % (strobes.length + 6))
    strobes.forEach((s, i) => {
      ;(s.material as PointsMaterial).opacity = i === strobes.length - 1 - idx ? 1 : 0.06
    })
    // PAPI: reads red/white by glide slope
    const slope = cur.altitude / Math.max(0.05, 1 - cur.distance + 0.05)
    const whites = slope > 1.3 ? 4 : slope > 1.05 ? 3 : slope > 0.8 ? 2 : slope > 0.55 ? 1 : 0
    ;(papiPts.material as PointsMaterial).color.set(whites >= 2 ? '#ffe9e0' : '#ff4d4d')
    // traffic strobes
    for (const t of trafficMeshes) (t.strobe.material as PointsMaterial).opacity = Math.sin(time * 6 + t.phase) > 0.85 ? 1 : 0.05
    // precipitation follows the camera and falls
    if (precip) {
      precip.position.copy(camera.position)
      const speed = precipKind === 'snow' ? 6 : 60
      precip.position.y -= (time * speed) % 90
      precip.position.z -= 20
    }
    // lightning
    if (target.weather === 'storm') {
      nextFlash -= dt
      if (nextFlash <= 0) {
        flash = 1
        nextFlash = 3 + Math.random() * 6
      }
    }
    if (flash > 0) {
      flash = Math.max(0, flash - dt * 4)
      ;(sky.material as MeshBasicMaterial).color.setScalar(1 + flash * 2.5)
    } else (sky.material as MeshBasicMaterial).color.setScalar(1)

    renderer.render(scene, camera)
  }

  function setSize(w: number, h: number): void {
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  function dispose(): void {
    renderer.dispose()
    scene.traverse((o) => {
      const m = o as Mesh
      if (m.geometry) m.geometry.dispose()
    })
  }

  return { setParams, frame, setSize, dispose }
}
