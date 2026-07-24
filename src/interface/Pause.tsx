import { useGame } from '../stores/useGame'
import { requestLock } from '../systems/input'

// Shown while a run is paused (Esc, or pointer lock lost). Resume re-acquires pointer
// lock from within the click gesture the browser requires.
export default function Pause() {
  const setPaused = useGame((s) => s.setPaused)
  const toMenu = useGame((s) => s.toMenu)
  const artifacts = useGame((s) => s.artifactsHeld)

  const resume = () => {
    setPaused(false)
    requestLock()
  }

  return (
    <div className="overlay pause">
      <div className="menu-panel">
        <h2 className="title small">paused</h2>
        <p className="hint">{artifacts} / 5 recovered</p>
        <button className="btn" onClick={resume}>
          resume
        </button>
        <button className="btn ghost" onClick={() => toMenu()}>
          abandon run
        </button>
      </div>
    </div>
  )
}
