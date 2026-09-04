/**
 * WebAudio flight-deck foley, all synthesized: an engine hum that follows the
 * speed, switch clicks, radio squelch, master warning, altitude callouts via
 * speechSynthesis (chime fallback), plus the dice foley the roll director
 * drives. Zero audio binaries.
 */
import type { SfxEvent } from '../app/session.svelte'

let ctx: AudioContext | null = null
let muted = typeof localStorage !== 'undefined' && localStorage.getItem('skyteam:muted') === '1'
let hum: { a: OscillatorNode; b: OscillatorNode; gain: GainNode; filter: BiquadFilterNode } | null = null

function ac(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlock(): void {
  try {
    ac()
  } catch {
    /* no audio */
  }
}

export function setMuted(m: boolean): void {
  muted = m
  localStorage.setItem('skyteam:muted', m ? '1' : '0')
  if (hum) hum.gain.gain.setTargetAtTime(m ? 0 : humLevel, ac().currentTime, 0.2)
}

export function isMuted(): boolean {
  return muted
}

function tone(freq: number, { t = 0, dur = 0.12, type = 'triangle' as OscillatorType, vol = 0.16, glide = 0 } = {}): void {
  if (muted) return
  const a = ac()
  const osc = a.createOscillator()
  const gain = a.createGain()
  const start = a.currentTime + t
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + glide), start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(a.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function noise({ t = 0, vol = 0.3, cutoff = 1200, dur = 0.05, type = 'lowpass' as BiquadFilterType } = {}): void {
  if (muted) return
  const a = ac()
  const buffer = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * dur)), a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = type
  filter.frequency.value = cutoff
  const gain = a.createGain()
  gain.gain.setValueAtTime(vol, a.currentTime + t)
  src.connect(filter).connect(gain).connect(a.destination)
  src.start(a.currentTime + t)
}

/* ---------------- engine hum ---------------- */

let humLevel = 0.05

/** Start (idempotently) the continuous engine drone. */
export function startHum(): void {
  if (hum) return
  try {
    const a = ac()
    const gain = a.createGain()
    gain.gain.value = muted ? 0 : humLevel
    const filter = a.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 220
    const mk = (f: number) => {
      const o = a.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.connect(filter)
      o.start()
      return o
    }
    filter.connect(gain).connect(a.destination)
    hum = { a: mk(55), b: mk(55.7), gain, filter }
  } catch {
    /* no audio */
  }
}

/** Follow the aircraft: speed 2..12 raises pitch and volume; distance tightens the filter. */
export function setHum(speed: number | null, altitudeFrac: number): void {
  if (!hum) return
  const a = ac()
  const s = speed ?? 6
  const f = 48 + (s - 2) * 3.2
  hum.a.frequency.setTargetAtTime(f, a.currentTime, 0.6)
  hum.b.frequency.setTargetAtTime(f * 1.012, a.currentTime, 0.6)
  hum.filter.frequency.setTargetAtTime(160 + (s - 2) * 26 + altitudeFrac * 60, a.currentTime, 0.6)
  humLevel = 0.035 + (s - 2) * 0.004
  if (!muted) hum.gain.gain.setTargetAtTime(humLevel, a.currentTime, 0.6)
}

export function stopHum(): void {
  if (!hum) return
  hum.a.stop()
  hum.b.stop()
  hum = null
}

/* ---------------- voices ---------------- */

export function switchClick(): void {
  noise({ vol: 0.5, cutoff: 2600, dur: 0.03, type: 'bandpass' })
  tone(180, { dur: 0.04, type: 'square', vol: 0.05 })
}

export function leverClunk(): void {
  noise({ vol: 0.5, cutoff: 500, dur: 0.07 })
  tone(90, { dur: 0.12, type: 'triangle', vol: 0.1, glide: -30 })
}

export function radioSquelch(): void {
  noise({ vol: 0.25, cutoff: 1800, dur: 0.18, type: 'bandpass' })
  tone(1200, { t: 0.05, dur: 0.05, type: 'sine', vol: 0.05 })
}

export function coffeeClink(): void {
  tone(2400, { dur: 0.09, type: 'sine', vol: 0.08 })
  tone(3600, { t: 0.02, dur: 0.06, type: 'sine', vol: 0.04 })
}

export function placeTick(): void {
  noise({ vol: 0.3, cutoff: 1500, dur: 0.03 })
}

export function chime(): void {
  tone(880, { dur: 0.25, type: 'sine', vol: 0.1 })
  tone(1320, { t: 0.18, dur: 0.3, type: 'sine', vol: 0.08 })
}

export function axisCreak(): void {
  tone(160, { dur: 0.35, type: 'sawtooth', vol: 0.04, glide: 40 })
}

export function advanceWhoosh(): void {
  noise({ vol: 0.2, cutoff: 900, dur: 0.5 })
}

export function bankWarning(): void {
  for (let i = 0; i < 2; i++) tone(520, { t: i * 0.35, dur: 0.22, type: 'square', vol: 0.07, glide: 160 })
}

export function masterWarning(): void {
  for (let i = 0; i < 6; i++) {
    tone(740, { t: i * 0.28, dur: 0.12, type: 'square', vol: 0.09 })
    tone(560, { t: i * 0.28 + 0.14, dur: 0.12, type: 'square', vol: 0.09 })
  }
}

export function landedFanfare(): void {
  noise({ vol: 0.3, cutoff: 700, dur: 0.9 })
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, { t: 0.2 + i * 0.12, dur: 0.5, type: 'sine', vol: 0.08 }))
}

export function rerollPing(): void {
  tone(1500, { dur: 0.1, type: 'sine', vol: 0.06 })
  tone(2000, { t: 0.1, dur: 0.12, type: 'sine', vol: 0.06 })
}

/** Altitude callout through the synthesizer; chime when speech is unavailable. */
export function callout(text: string): void {
  if (muted) return
  try {
    const synth = window.speechSynthesis
    if (!synth) return chime()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 0.95
    u.pitch = 0.8
    u.volume = 0.8
    const voice = synth.getVoices().find((v) => v.lang.startsWith('en'))
    if (voice) u.voice = voice
    synth.cancel()
    synth.speak(u)
  } catch {
    chime()
  }
}

/* ---------------- dice foley (driven by the roll director) ---------------- */

export function rattleTick(intensity: number): void {
  noise({ vol: 0.18 + intensity * 0.35, cutoff: 1800 + intensity * 1800, dur: 0.025 + intensity * 0.02 })
}

export function dieImpact(strength: number): void {
  noise({ vol: 0.2 + strength * 0.5, cutoff: 500 + strength * 900, dur: 0.04 + strength * 0.04 })
  tone(140 + strength * 90, { dur: 0.05, type: 'triangle', vol: 0.05 })
}

export function throwWhoosh(): void {
  noise({ vol: 0.3, cutoff: 1400, dur: 0.22, type: 'highpass' })
}

export function play(sfx: SfxEvent): void {
  switch (sfx) {
    case 'switch':
      return switchClick()
    case 'lever':
      return leverClunk()
    case 'radio':
      return radioSquelch()
    case 'coffee':
      return coffeeClink()
    case 'place':
      return placeTick()
    case 'axis':
      return axisCreak()
    case 'advance':
      return advanceWhoosh()
    case 'warning':
      return bankWarning()
    case 'crash':
      return masterWarning()
    case 'landed':
      return landedFanfare()
    case 'reroll':
      return rerollPing()
    case 'descend':
      return chime()
    case 'brake':
      return switchClick()
    case 'roll':
      return
  }
}
