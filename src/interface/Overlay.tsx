import { useEffect, useRef } from 'react'
import { addEffect } from '@react-three/fiber'
import { blinkState } from '../systems/blink'
import { gameFlowState } from '../systems/gameFlow'

// Fully diegetic blink readout — zero HUD. Eyelid bands creep in from top and bottom as
// the meter drains, the world desaturates and blurs at the edges, and a full blink
// blacks the screen. The narrowing view is a real second cost, and it should be. Driven
// straight from module state via addEffect — no React re-render. The grab layer (a
// thrashing red vignette + escape bar) and the pickup ring live here too.
const CLOSE_START = 0.6 // meter fraction where the lids begin to close
const MAX_LID_VH = 34 // each lid covers up to this % of viewport height

export default function Overlay() {
  const topLid = useRef<HTMLDivElement>(null)
  const botLid = useRef<HTMLDivElement>(null)
  const blackout = useRef<HTMLDivElement>(null)
  const grade = useRef<HTMLDivElement>(null)
  const grab = useRef<HTMLDivElement>(null)
  const grabBar = useRef<HTMLDivElement>(null)
  const grabHint = useRef<HTMLDivElement>(null)
  const pickup = useRef<HTMLDivElement>(null)
  const pickupBar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return addEffect(() => {
      const meter = blinkState.meter
      const t = Math.min(Math.max((CLOSE_START - meter) / CLOSE_START, 0), 1) // 0 rested → 1 empty

      const lidH = `${t * MAX_LID_VH}vh`
      if (topLid.current) topLid.current.style.height = lidH
      if (botLid.current) botLid.current.style.height = lidH

      if (blackout.current) blackout.current.style.opacity = blinkState.blinking ? '1' : '0'

      if (grade.current) {
        grade.current.style.opacity = t > 0.01 ? '1' : '0'
        grade.current.style.backdropFilter = `grayscale(${0.65 * t}) blur(${1.6 * t}px)`
        grade.current.style.setProperty('-webkit-backdrop-filter', `grayscale(${0.65 * t}) blur(${1.6 * t}px)`)
      }

      // Grab / struggle.
      const grabbing = gameFlowState.grabbing
      if (grab.current) {
        grab.current.style.opacity = grabbing ? '1' : '0'
        if (grabbing) {
          // Jitter the whole layer — the thrash.
          const jx = (Math.random() - 0.5) * 14
          const jy = (Math.random() - 0.5) * 14
          grab.current.style.transform = `translate(${jx}px, ${jy}px)`
        }
      }
      if (grabBar.current) grabBar.current.style.width = `${Math.min(1, gameFlowState.struggleProgress) * 100}%`
      if (grabHint.current) grabHint.current.style.opacity = grabbing ? '1' : '0'

      // Pickup ring (hold-to-collect).
      const p = gameFlowState.interactProgress
      if (pickup.current) pickup.current.style.opacity = p > 0.001 && p < 1 ? '1' : '0'
      if (pickupBar.current) pickupBar.current.style.width = `${Math.min(1, p) * 100}%`
    })
  }, [])

  return (
    <div className="diegetic">
      <div className="grade" ref={grade} />
      <div className="eyelid top" ref={topLid} />
      <div className="eyelid bottom" ref={botLid} />

      <div className="pickup" ref={pickup}>
        <div className="pickup-track">
          <div className="pickup-fill" ref={pickupBar} />
        </div>
        <span>hold E</span>
      </div>

      <div className="grab-layer" ref={grab}>
        <div className="grab-vignette" />
        <div className="grab-hint" ref={grabHint}>
          MASH SPACE
          <div className="grab-track">
            <div className="grab-fill" ref={grabBar} />
          </div>
        </div>
      </div>

      <div className="blackout" ref={blackout} />
    </div>
  )
}
