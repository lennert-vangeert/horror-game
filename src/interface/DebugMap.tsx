import { useEffect, useRef } from 'react'
import { addEffect } from '@react-three/fiber'
import { currentLevel } from '../systems/level'
import { playerState } from '../systems/player'
import { entityState } from '../systems/entity/state'
import { setDebugAggression } from '../systems/entity/ai'
import { debugCollectAll } from '../systems/gameFlow'
import { debugUI } from '../config/debug'
import { CELL, isFloor } from '../systems/nav/grid'

// Dev-only top-down viewer. Visibility is driven by debugUI.showMap (the leva "debug" folder),
// with the backtick key as a fallback toggle. Keys 0–4 force aggression, U collects all, T
// turns without pointer lock.
const SCALE = 6 // px per cell

export default function DebugMap() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote') debugUI.showMap = !debugUI.showMap
      if (e.code === 'KeyU') debugCollectAll()
      if (e.code === 'KeyT') playerState.yaw += Math.PI / 4
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5))
        if (n >= 0 && n <= 4) setDebugAggression(n)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    return addEffect(() => {
      const wrap = wrapRef.current
      if (wrap) wrap.style.display = debugUI.showMap ? 'block' : 'none'
      if (!debugUI.showMap) return

      const canvas = canvasRef.current
      const level = currentLevel
      if (!canvas || !level) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const { grid } = level

      if (canvas.width !== grid.w * SCALE) canvas.width = grid.w * SCALE
      if (canvas.height !== grid.h * SCALE) canvas.height = grid.h * SCALE

      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.fillStyle = '#333'
      for (let z = 0; z < grid.h; z++) {
        for (let x = 0; x < grid.w; x++) {
          if (isFloor(grid, x, z)) ctx.fillRect(x * SCALE, z * SCALE, SCALE - 1, SCALE - 1)
        }
      }

      const dot = (x: number, z: number, color: string, r = SCALE) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x * SCALE + SCALE / 2, z * SCALE + SCALE / 2, r, 0, Math.PI * 2)
        ctx.fill()
      }

      dot(level.spawn.x, level.spawn.z, '#5f5')
      dot(level.exit.x, level.exit.z, '#59f')
      for (const a of level.artifacts) dot(a.x, a.z, '#fd4', SCALE * 0.7)
      dot(entityState.pos.x / CELL, entityState.pos.z / CELL, entityState.frozen ? '#4ff' : '#f44', SCALE * 0.9)

      const pcx = (playerState.pos.x / CELL) * SCALE
      const pcz = (playerState.pos.z / CELL) * SCALE
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(pcx, pcz)
      ctx.lineTo(pcx - Math.sin(playerState.yaw) * 10, pcz - Math.cos(playerState.yaw) * 10)
      ctx.stroke()
      dot(playerState.pos.x / CELL, playerState.pos.z / CELL, '#fff', 3)

      if (labelRef.current) labelRef.current.textContent = `seed ${level.seed} · 0–4 aggro · U collect · \` hide`
    })
  }, [])

  return (
    <div className="debug-map" ref={wrapRef} style={{ display: 'none' }}>
      <canvas ref={canvasRef} />
      <span className="debug-map-label" ref={labelRef}>
        map
      </span>
    </div>
  )
}
