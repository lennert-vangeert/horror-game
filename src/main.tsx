import { createRoot } from 'react-dom/client'
import App from './App'
import './style.css'

// No StrictMode: several systems keep module-scope singletons and install global
// listeners; StrictMode's deliberate double-invoke in dev would run those twice.
createRoot(document.getElementById('root')!).render(<App />)
