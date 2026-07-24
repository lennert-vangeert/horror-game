import { lazy, Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGame } from './stores/useGame'
import { exitLock } from './systems/input'
import { DEBUG } from './config/debug'
import Game from './Game'
import Menu from './interface/Menu'
import Hud from './interface/Hud'
import Pause from './interface/Pause'
import DebugMap from './interface/DebugMap'

// Lazy so leva is code-split out of the production bundle (only loaded when DEBUG is on).
const DebugPanel = lazy(() => import('./interface/DebugPanel'))

// Top level: the R3F <Canvas> is mounted whenever we're not on the main menu (so the
// death / win screens show the frozen world behind them). The DOM HUD and menus are
// siblings of the canvas, never children of it.
export default function App() {
  const phase = useGame((s) => s.phase)
  const paused = useGame((s) => s.paused)
  const inGame = phase !== 'menu'

  // Free the mouse when the run ends so the death / win menu is immediately clickable
  // (the canvas stays mounted behind it, so pointer lock would otherwise persist).
  useEffect(() => {
    if (phase === 'dead' || phase === 'escaped') exitLock()
  }, [phase])

  return (
    <>
      {inGame && (
        <Canvas
          gl={{ antialias: false, powerPreference: 'high-performance' }}
          camera={{ fov: 72, near: 0.05, far: 200, position: [0, 1.6, 0] }}
          shadows
        >
          <Game />
        </Canvas>
      )}
      {inGame && <Hud />}
      {DEBUG && inGame && <DebugMap />}
      {DEBUG && (
        <Suspense fallback={null}>
          <DebugPanel />
        </Suspense>
      )}
      {phase === 'playing' && paused && <Pause />}
      {(phase === 'menu' || phase === 'dead' || phase === 'escaped') && <Menu />}
    </>
  )
}
