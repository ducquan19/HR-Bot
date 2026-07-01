import { create } from 'zustand'
import { User } from '@/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user })
  },

  setIsLoading: (loading) => {
    set({ isLoading: loading })
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      // TODO: Implement Supabase login
      console.log('Login:', email, password)
      set({ isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: async () => {
    set({ isLoading: true })
    try {
      // TODO: Implement Supabase logout
      set({ user: null, isAuthenticated: false, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true })
    try {
      // TODO: Implement Supabase registration
      console.log('Register:', email, password, name)
      set({ isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },
}))
