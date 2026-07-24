// audio/engine.ts
// A small synthesised-audio engine (Web Audio). No sample assets — heartbeat, breathing,
// drones, telegraphs and stings are all generated from oscillators and noise. The graph is
// master → { sfx, ambient, music }. The context is created and resumed only on a user
// gesture (browser autoplay policy). Every primitive no-ops when the context isn't up, so
// importing this in a headless test environment is safe.

let ctx: AudioContext | null = null
let master: GainNode
let sfxBus: GainNode
let ambientBus: GainNode
let noise: AudioBuffer

export function initAudio(): void {
  if (ctx) return
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return
  ctx = new AC()

  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)

  sfxBus = ctx.createGain()
  ambientBus = ctx.createGain()
  sfxBus.connect(master)
  ambientBus.connect(master)

  // One second of white noise, reused as a source for breath / impacts / drone texture.
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
}

export function resumeAudio(): void {
  void ctx?.resume()
}

export function audioReady(): boolean {
  return !!ctx
}

export function setBusVolumes(sfxV: number, ambientV: number): void {
  if (!ctx) return
  sfxBus.gain.value = sfxV
  ambientBus.gain.value = ambientV
}

function noiseSource(): AudioBufferSourceNode {
  const src = ctx!.createBufferSource()
  src.buffer = noise
  src.loop = true
  return src
}

// --- primitives ---

/** A low sine thump with a fast percussive envelope. Non-positional (heartbeat). */
export function thump(freq: number, peak: number, decay: number, bus: 'sfx' | 'ambient' = 'ambient'): void {
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq * 1.6, t)
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.05)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
  osc.connect(g).connect(bus === 'sfx' ? sfxBus : ambientBus)
  osc.start(t)
  osc.stop(t + decay + 0.05)
}

/** A filtered noise burst — breath, creak, impact. Optional stereo pan + lowpass (occlusion). */
export function noiseBurst(opts: {
  peak: number
  attack: number
  release: number
  lowpass?: number
  highpass?: number
  pan?: number
  bus?: 'sfx' | 'ambient'
}): void {
  if (!ctx) return
  const t = ctx.currentTime
  const src = noiseSource()
  let node: AudioNode = src

  if (opts.highpass) {
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = opts.highpass
    node.connect(hp)
    node = hp
  }
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = opts.lowpass ?? 8000
  node.connect(lp)
  node = lp

  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(opts.peak, t + opts.attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.attack + opts.release)
  node.connect(g)

  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0))
  g.connect(pan).connect(opts.bus === 'sfx' ? sfxBus : ambientBus)

  src.start(t)
  src.stop(t + opts.attack + opts.release + 0.05)
}

/** A short oscillator tone (stings). */
export function tone(opts: {
  type?: OscillatorType
  from: number
  to?: number
  peak: number
  dur: number
  bus?: 'sfx' | 'ambient'
}): void {
  if (!ctx) return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.from, t)
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opts.peak, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur)
  osc.connect(g).connect(opts.bus === 'sfx' ? sfxBus : ambientBus)
  osc.start(t)
  osc.stop(t + opts.dur + 0.05)
}

export interface DroneHandle {
  setParams(gain: number, pan: number, lowpass: number): void
  stop(): void
}

/** A persistent low drone + noise texture for the HUNT bed. */
export function startDrone(): DroneHandle | null {
  if (!ctx) return null
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.value = 54
  const sub = ctx.createOscillator()
  sub.type = 'sine'
  sub.frequency.value = 27
  const src = noiseSource()

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 700
  const g = ctx.createGain()
  g.gain.value = 0.0001
  const pan = ctx.createStereoPanner()

  osc.connect(lp)
  sub.connect(lp)
  src.connect(lp)
  lp.connect(g).connect(pan).connect(sfxBus)

  osc.start(t)
  sub.start(t)
  src.start(t)

  return {
    setParams(gain, panValue, lowpass) {
      if (!ctx) return
      g.gain.setTargetAtTime(gain, ctx.currentTime, 0.1)
      pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, panValue)), ctx.currentTime, 0.1)
      lp.frequency.setTargetAtTime(lowpass, ctx.currentTime, 0.1)
    },
    stop() {
      if (!ctx) return
      const now = ctx.currentTime
      g.gain.setTargetAtTime(0.0001, now, 0.15)
      osc.stop(now + 0.5)
      sub.stop(now + 0.5)
      src.stop(now + 0.5)
    },
  }
}
