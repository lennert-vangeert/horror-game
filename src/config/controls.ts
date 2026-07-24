// controls.ts
// Keybind map, keyed by physical key (KeyboardEvent.code) so WASD works regardless of
// keyboard layout. Actions are consumed by systems/input.ts.

export const KEYBINDS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  crouch: ['KeyC', 'ControlLeft', 'ControlRight'],
  blink: ['Space'],
  interact: ['KeyE'],
  pause: ['Escape'],
  debugMap: ['Backquote'],
} as const

export type Action = keyof typeof KEYBINDS
