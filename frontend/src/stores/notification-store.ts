import { create } from 'zustand'
import { api, type AppNotification } from '@/lib/api'

const READ_KEY = 'hrbot_read_notifications'

function getReadIds(): Set<string> {
  try {
    const stored = localStorage.getItem(READ_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

interface NotificationStore {
  notifications: AppNotification[]
  readIds: Set<string>
  isLoading: boolean
  lastFetched: number | null

  // computed
  unreadCount: () => number

  // actions
  fetch: () => Promise<void>
  markRead: (id: string) => void
  markAllRead: () => void
  clearRead: (id: string) => void
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  readIds: getReadIds(),
  isLoading: false,
  lastFetched: null,

  unreadCount: () => {
    const { notifications, readIds } = get()
    return notifications.filter(n => !readIds.has(n.id)).length
  },

  fetch: async () => {
    // Throttle: don't re-fetch if fetched in last 60s
    const { lastFetched, isLoading } = get()
    if (isLoading) return
    if (lastFetched && Date.now() - lastFetched < 60_000) return

    set({ isLoading: true })
    try {
      const notifications = await api.notifications.list()
      set({ notifications, lastFetched: Date.now() })
    } catch {
      // silently fail — notifications are non-critical
    } finally {
      set({ isLoading: false })
    }
  },

  markRead: (id: string) => {
    const readIds = new Set(get().readIds)
    readIds.add(id)
    saveReadIds(readIds)
    set({ readIds })
  },

  markAllRead: () => {
    const { notifications } = get()
    const readIds = new Set(get().readIds)
    notifications.forEach(n => readIds.add(n.id))
    saveReadIds(readIds)
    set({ readIds })
  },

  clearRead: (id: string) => {
    const readIds = new Set(get().readIds)
    readIds.delete(id)
    saveReadIds(readIds)
    set({ readIds })
  },
}))
