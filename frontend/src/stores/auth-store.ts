import { create } from 'zustand'
import { User } from '@/types'
import { api } from '@/lib/api'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  loadCurrentUser: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user })
  },

  setIsLoading: (loading) => {
    set({ isLoading: loading })
  },

  loadCurrentUser: async () => {
    if (!localStorage.getItem('hrbot_access_token')) {
      set({ user: null, isAuthenticated: false, isLoading: false })
      return
    }
    set({ isLoading: true })
    try {
      const user = await api.auth.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      localStorage.removeItem('hrbot_access_token')
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const result = await api.auth.login(email, password)
      set({ user: result.user, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      await api.auth.logout()
      set({ user: null, isAuthenticated: false, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true })
    try {
      const result = await api.auth.register(email, password, name)
      set({ user: result.user, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },
}))
