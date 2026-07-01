import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import './styles/globals.css'
import { AppRoutes } from './routes'
import { ThemeProvider } from './contexts/theme-context'
import { useAuthStore } from './stores/auth-store'
import { mockUser } from './lib/mock-data'

function App() {
  const { setUser } = useAuthStore()

  useEffect(() => {
    // Set mock user on app load (in real app, this would be from auth session)
    setUser(mockUser)
  }, [setUser])

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
