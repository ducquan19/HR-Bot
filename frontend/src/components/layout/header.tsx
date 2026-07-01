import React, { useState } from 'react'
import { Menu, Moon, Sun, Bell, User } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { useAuthStore } from '@/stores/auth-store'
import { getInitials } from '@/lib/utils'

interface HeaderProps {
  onToggleSidebar: () => void
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)

  return (
    <header className="bg-card border-b border-border sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                {user ? getInitials(user.name, '') : <User className="w-4 h-4" />}
              </div>
              <span className="text-sm font-medium hidden md:inline">{user?.name || 'User'}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <button className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors">
                  Profile
                </button>
                <button className="w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors">
                  Settings
                </button>
                <div className="border-t border-border my-2" />
                <button className="w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
