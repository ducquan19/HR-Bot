import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import './styles/globals.css'
import { AppRoutes } from './routes'
import { ThemeProvider } from './contexts/theme-context'
import { useAuthStore } from './stores/auth-store'

function App() {
  const { loadCurrentUser } = useAuthStore()

  useEffect(() => {
    void loadCurrentUser()
  }, [loadCurrentUser])

  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
