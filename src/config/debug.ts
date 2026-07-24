// debug.ts
// Whether dev tooling (the leva panel, the top-down map) is shown. On automatically under the
// Vite dev server, and forceable in any build with VITE_ENVIRONMENT=DEV.

export const DEBUG = import.meta.env.DEV || import.meta.env.VITE_ENVIRONMENT === 'DEV'

// Small shared UI state the leva panel writes and DebugMap reads (module scope so leva can
// toggle the map without prop-drilling).
export const debugUI = {
  showMap: false,
  floodlight: false, // debug: flood the level with light (overrides the Act-3 blackout)
}
