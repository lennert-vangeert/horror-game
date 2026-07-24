import { useState } from 'react'
import { useGame } from '../stores/useGame'
import { initAudio, resumeAudio } from '../systems/audio/engine'

// Main / death / win screen, with a settings drawer and optional seed entry.
export default function Menu() {
  const phase = useGame((s) => s.phase)
  const seed = useGame((s) => s.seed)
  const startRun = useGame((s) => s.startRun)
  const toMenu = useGame((s) => s.toMenu)
  const settings = useGame((s) => s.settings)
  const updateSettings = useGame((s) => s.updateSettings)

  const [showSettings, setShowSettings] = useState(false)
  const [seedText, setSeedText] = useState('')

  const enter = () => {
    initAudio() // the click is the gesture the browser needs to start audio
    resumeAudio()
    const trimmed = seedText.trim()
    const parsed = trimmed ? Number(trimmed) >>> 0 : undefined
    startRun(Number.isFinite(parsed) ? parsed : undefined)
  }

  return (
    <div className="overlay menu">
      <div className="menu-panel">
        <h1 className="title">the building</h1>

        {phase === 'dead' && <p className="subtitle dead">it took you. seed {seed}</p>}
        {phase === 'escaped' && <p className="subtitle escaped">you got out. seed {seed}</p>}
        {phase === 'menu' && (
          <p className="tagline">
            collect five. it can't move while you watch it.
            <br />
            don't run out of blinks.
          </p>
        )}

        <button className="btn" onClick={enter}>
          {phase === 'menu' ? 'enter' : 'again'}
        </button>

        <button className="btn ghost" onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? 'close settings' : 'settings'}
        </button>

        {phase !== 'menu' && (
          <button className="btn ghost" onClick={() => toMenu()}>
            main menu
          </button>
        )}

        {showSettings && (
          <div className="settings">
            <label>
              <span>sfx</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.sfxVolume}
                onChange={(e) => updateSettings({ sfxVolume: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>look sensitivity</span>
              <input
                type="range"
                min={0.0008}
                max={0.006}
                step={0.0002}
                value={settings.sensitivity}
                onChange={(e) => updateSettings({ sensitivity: Number(e.target.value) })}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.invertY}
                onChange={(e) => updateSettings({ invertY: e.target.checked })}
              />
              <span>invert vertical look</span>
            </label>
            <label className="check">
              <input
                type="text"
                className="seed-input"
                placeholder="seed (blank = random)"
                value={seedText}
                onChange={(e) => setSeedText(e.target.value.replace(/[^0-9]/g, ''))}
              />
            </label>
          </div>
        )}

        <p className="hint">
          WASD move · mouse look · Space blink · Shift run · C crouch · E take · Esc pause
        </p>
      </div>
    </div>
  )
}
