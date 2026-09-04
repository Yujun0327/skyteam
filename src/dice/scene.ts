/**
 * The dice shelf behind the player's screen: a dark brushed tray under a cool
 * overhead LED, four dice in the seat colour, and a dark shaker cup. No
 * shadows, DPR capped at 2, no postprocessing: it shares the GPU with the
 * windshield scene behind it.
 */
import {
  AmbientLight,
  CylinderGeometry,
  Group,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { MeshStandardMaterial } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { cupMaterial, dieMaterials, rimMaterial, shelfMaterial, steelMaterial } from './materials'
import type { DieColor } from './materials'
import { CUP, DICE_COUNT, DIE_SIZE, PAD } from './physics'

export interface Stage {
  renderer: WebGLRenderer
  scene: Scene
  camera: PerspectiveCamera
  dice: Mesh[]
  cup: Group
  camShake: Vector3
  camPush: { value: number }
  setDiceColor(color: DieColor): void
  render(): void
  setSize(w: number, h: number): void
  dispose(): void
}

const CAM_POS = new Vector3(0, 10.5, 9.5)
const CAM_LOOK = new Vector3(0, 0, -0.6)
const CAM_DIR = CAM_POS.clone().sub(CAM_LOOK).normalize()

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const camera = new PerspectiveCamera(38, 1, 0.5, 100)
  camera.position.copy(CAM_POS)
  camera.lookAt(CAM_LOOK)

  const key = new PointLight('#dfe8ff', 420, 60, 1.6)
  key.position.set(0, 12, 3)
  scene.add(key)
  scene.add(new AmbientLight('#7a8696', 1.6))
  const fillL = new PointLight('#2f7bff', 60, 30, 1.8)
  fillL.position.set(-8, 5, 2)
  const fillR = new PointLight('#ff8a1f', 60, 30, 1.8)
  fillR.position.set(8, 5, 2)
  scene.add(fillL, fillR)

  const shelf = new Mesh(new PlaneGeometry(PAD.halfW * 2 + 2, PAD.halfD * 2 + 2), shelfMaterial())
  shelf.rotation.x = -Math.PI / 2
  scene.add(shelf)

  const rimMat = rimMaterial()
  const rimH = 0.55
  const rimT = 0.5
  const bars: Array<[number, number, number, number]> = [
    [0, -PAD.halfD - rimT / 2, PAD.halfW * 2 + rimT * 2, rimT],
    [0, PAD.halfD + rimT / 2, PAD.halfW * 2 + rimT * 2, rimT],
    [-PAD.halfW - rimT / 2, 0, rimT, PAD.halfD * 2],
    [PAD.halfW + rimT / 2, 0, rimT, PAD.halfD * 2],
  ]
  for (const [cx, cz, w, d] of bars) {
    const bar = new Mesh(new RoundedBoxGeometry(w, rimH, d, 2, 0.1), rimMat)
    bar.position.set(cx, rimH / 2 - 0.05, cz)
    scene.add(bar)
  }
  const studGeo = new CylinderGeometry(0.14, 0.14, rimH + 0.05, 10)
  const studMat = steelMaterial()
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const stud = new Mesh(studGeo, studMat)
    stud.position.set(sx * (PAD.halfW + rimT / 2), rimH / 2, sz * (PAD.halfD + rimT / 2))
    scene.add(stud)
  }

  const blueMats = dieMaterials('blue')
  const orangeMats = dieMaterials('orange')
  const dice: Mesh[] = []
  for (let i = 0; i < DICE_COUNT; i++) {
    const die = new Mesh(new RoundedBoxGeometry(DIE_SIZE, DIE_SIZE, DIE_SIZE, 4, DIE_SIZE * 0.12), blueMats)
    die.position.set(0, DIE_SIZE / 2, 0)
    scene.add(die)
    dice.push(die)
  }

  const cup = new Group()
  const cupWall = new Mesh(new CylinderGeometry(CUP.radius * 1.02, CUP.radius * 0.88, CUP.height, 24, 1, true), cupMaterial())
  cupWall.material.side = 2
  const cupBottom = new Mesh(new CylinderGeometry(CUP.radius * 0.88, CUP.radius * 0.88, 0.18, 24), cupMaterial())
  cupBottom.position.y = -CUP.height / 2
  const cupBand = new Mesh(new CylinderGeometry(CUP.radius * 1.05, CUP.radius * 1.05, 0.2, 24, 1, true), studMat)
  cupBand.material.side = 2
  cupBand.position.y = CUP.height / 2 - 0.3
  cup.add(cupWall, cupBottom, cupBand)
  cup.visible = false
  scene.add(cup)

  const camShake = new Vector3()
  const camPush = { value: 0 }
  const basePos = CAM_POS.clone()

  function setDiceColor(color: DieColor): void {
    const mats = color === 'blue' ? blueMats : orangeMats
    for (const die of dice) die.material = mats
  }

  function render(): void {
    camera.position.copy(basePos).addScaledVector(CAM_DIR, -camPush.value * 2.4)
    camera.position.add(camShake)
    camera.lookAt(CAM_LOOK)
    renderer.render(scene, camera)
  }

  function setSize(w: number, h: number): void {
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const vfov = (camera.fov * Math.PI) / 180
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const needW = PAD.halfW + 1.4
    const needD = PAD.halfD + 2.2
    const dist = Math.max(needW / Math.tan(hfov / 2), needD / Math.tan(vfov / 2), 9)
    basePos.copy(CAM_LOOK).addScaledVector(CAM_DIR, dist)
  }

  function dispose(): void {
    renderer.dispose()
    scene.traverse((obj) => {
      const mesh = obj as Mesh
      if (mesh.geometry) mesh.geometry.dispose()
    })
    for (const m of [...blueMats, ...orangeMats]) (m as MeshStandardMaterial).dispose()
  }

  return { renderer, scene, camera, dice, cup, camShake, camPush, setDiceColor, render, setSize, dispose }
}
