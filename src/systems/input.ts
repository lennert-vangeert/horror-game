// input.ts
// Module-scope keyboard + mouse state and pointer-lock handling. The one place the DOM
// talks to the sim. Keys are tracked by physical code; the `blur` clear-all stops
// alt-tab from leaving a key stuck down (keyup fires on the other window otherwise).

import { KEYBINDS, type Action } from '../config/controls'

const down = new Set<string>()
const pressedThisFrame = new Set<string>()
let mdx = 0
let mdy = 0
let locked = false
// "Armed" once we actually hold pointer lock; used to detect an UNEXPECTED loss (alt-tab /
// Esc) vs. the async gap while we're intentionally (re)acquiring it after a Resume.
let lockArmed = false
let canvasEl: HTMLElement | null = null

function onKeyDown(e: KeyboardEvent) {
  if (!e.repeat) pressedThisFrame.add(e.code)
  down.add(e.code)
  // Space would scroll / trigger buttons; swallow it while we own the page.
  if (e.code === 'Space' || e.code === 'Tab') e.preventDefault()
}

function onKeyUp(e: KeyboardEvent) {
  down.delete(e.code)
}

function onBlur() {
  down.clear()
  pressedThisFrame.clear()
}

function onMouseMove(e: MouseEvent) {
  if (!locked) return
  mdx += e.movementX
  mdy += e.movementY
}

function onPointerLockChange() {
  locked = document.pointerLockElement === canvasEl
  if (locked) lockArmed = true // we hold it now → arm the lost-lock watch
}

function onCanvasPointerDown() {
  if (canvasEl && !locked) canvasEl.requestPointerLock()
}

export function installInput(canvas: HTMLElement) {
  canvasEl = canvas
  locked = false
  lockArmed = false
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('pointerlockchange', onPointerLockChange)
  canvas.addEventListener('pointerdown', onCanvasPointerDown)
}

export function uninstallInput() {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onBlur)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('pointerlockchange', onPointerLockChange)
  canvasEl?.removeEventListener('pointerdown', onCanvasPointerDown)
  canvasEl = null
  down.clear()
  pressedThisFrame.clear()
  mdx = 0
  mdy = 0
}

/** True while any key bound to `action` is held. */
export function held(action: Action): boolean {
  for (const code of KEYBINDS[action]) if (down.has(code)) return true
  return false
}

/** True only on the frame a key bound to `action` went down (edge trigger). */
export function pressed(action: Action): boolean {
  for (const code of KEYBINDS[action]) if (pressedThisFrame.has(code)) return true
  return false
}

export function mouseDeltaX(): number {
  return mdx
}

export function mouseDeltaY(): number {
  return mdy
}

export function isPointerLocked(): boolean {
  return locked
}

/**
 * True only when we HELD pointer lock and then lost it unexpectedly (alt-tab / Esc). Stays
 * false during the async gap after a deliberate requestLock(), so Resume can't insta-repause.
 */
export function pointerLockLost(): boolean {
  return lockArmed && !locked
}

/** Re-sync the lost-lock watch to the current state — call at run start. */
export function resetLockWatch(): void {
  lockArmed = locked
}

/** Re-acquire pointer lock. Must be called from a user-gesture handler (e.g. Resume). */
export function requestLock(): void {
  if (canvasEl && !locked) {
    lockArmed = false // disarm: the async acquire gap is not a "loss"
    canvasEl.requestPointerLock()
  }
}

/** Release pointer lock so the cursor returns — call when the run ends and a menu takes over. */
export function exitLock(): void {
  lockArmed = false // an intentional release, not an unexpected loss
  if (document.pointerLockElement) document.exitPointerLock()
}

/** Clear per-frame edges and accumulated mouse delta. Call once at the end of every frame. */
export function endInputFrame() {
  pressedThisFrame.clear()
  mdx = 0
  mdy = 0
}
