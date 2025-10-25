import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@shared/contexts/AuthContext'
import LoginPage from '@features/auth/pages/LoginPage'
import GerarShortsPage from '@features/shorts/pages/GerarShortsPage'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/gerar-shorts" element={<GerarShortsPage />} />
          <Route path="/" element={<Navigate to="/gerar-shorts" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
