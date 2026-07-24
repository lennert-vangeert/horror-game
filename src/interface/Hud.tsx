import { useEffect, useRef } from 'react'
import { addEffect } from '@react-three/fiber'
import { isPointerLocked } from '../systems/input'
import Overlay from './Overlay'

// DOM HUD. Subscribes to the frame loop via addEffect and writes straight to refs —
// no React re-render during play. Hosts the diegetic blink overlay; the only other
// element is a faint dot to aim pickups by.
export default function Hud() {
  const hintRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return addEffect(() => {
      const el = hintRef.current
      if (el) el.style.opacity = isPointerLocked() ? '0' : '1'
    })
  }, [])

  return (
    <div className="hud">
      <Overlay />
      <div className="crosshair" />
      <div className="lock-hint" ref={hintRef}>
        click to look
      </div>
    </div>
  )
}
