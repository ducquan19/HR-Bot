import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Users,
  Briefcase,
  Video,
  Settings,
  Moon,
  Sun,
  Bell,
  User,
  LogOut,
  Menu
} from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { useAuthStore } from '@/stores/auth-store'
import { getInitials } from '@/lib/utils'

const menuItems = [
  { icon: BarChart3, label: 'Tổng quan', href: '/dashboard', badge: null },
  { icon: Briefcase, label: 'Chiến dịch', href: '/campaigns', badge: null },
  { icon: Users, label: 'Ứng viên', href: '/candidates', badge: null },
  { icon: Video, label: 'Phỏng vấn', href: '/interviews', badge: null },
]

export function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-30 shadow-sm">
      <div className="grid grid-cols-2 md:grid-cols-3 items-center px-6 h-16">
        
        {/* Left: Logo */}
        <div className="flex justify-start">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-black text-lg shadow-md shadow-primary/20">
              H
            </div>
            <span className="font-bold text-xl tracking-tight hidden lg:block">HR Bot</span>
          </Link>
        </div>

        {/* Center: Desktop Navigation */}
        <div className="hidden md:flex justify-center">
          <nav className="flex items-center gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-2 px-2 lg:px-4 py-2 rounded-xl transition-all font-medium text-sm whitespace-nowrap',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex justify-end items-center gap-3">
          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <button onClick={() => alert('Không có thông báo mới')} className="relative p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>

          <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 p-1.5 hover:bg-muted rounded-full transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                {user ? getInitials(user.name, '') : <User className="w-4 h-4" />}
              </div>
              <span className="text-sm font-bold hidden lg:block text-gray-700 dark:text-gray-200">{user?.name || 'User'}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-card border border-border rounded-xl shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-4">
                <div className="px-4 py-3 border-b border-border mb-1">
                  <p className="text-sm font-bold text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button onClick={() => { navigate('/settings'); setShowUserMenu(false) }} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-muted transition-colors">
                  <Settings className="w-4 h-4" />
                  Cài đặt
                </button>
                <div className="border-t border-border my-1" />
                <button onClick={handleLogout} className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <LogOut className="w-4 h-4" />
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden border-t border-border bg-card p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setShowMobileMenu(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </header>
  )
}
