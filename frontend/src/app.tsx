import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import './styles/globals.css'
import { AppRoutes } from './routes'
import { ThemeProvider } from './contexts/theme-context'
import { useAuthStore } from './stores/auth-store'
import { Toaster } from 'sonner'
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core'
import { ApolloProvider } from '@apollo/client/react'
import { setContext } from '@apollo/client/link/context'
import { API_BASE_URL } from './constants'

const httpLink = createHttpLink({
  uri: API_BASE_URL.replace('/api', '/graphql'),
})

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
})

function App() {
  const { loadCurrentUser } = useAuthStore()

  useEffect(() => {
    void loadCurrentUser()
  }, [loadCurrentUser])

  return (
    <ApolloProvider client={client}>
      <ThemeProvider>
        <BrowserRouter>
          <Toaster position="top-right" richColors />
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </ApolloProvider>
  )
}

export default App
