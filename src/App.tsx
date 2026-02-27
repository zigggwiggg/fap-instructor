/* ── App Shell ── */

import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import GamePage from './pages/GamePage'
import StatsPage from './pages/StatsPage'
import AgeGate from './components/AgeGate'

export default function App() {
  return (
    <AgeGate>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<GamePage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </AgeGate>
  )
}
