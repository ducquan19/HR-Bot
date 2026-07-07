import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Users,
  Briefcase,
  Video,
  Settings,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

interface SidebarProps {
  isOpen: boolean
}

const menuItems = [
  { icon: BarChart3, label: 'Dashboard', href: '/dashboard', badge: null },
  { icon: Briefcase, label: 'Campaigns', href: '/campaigns', badge: null },
  { icon: Users, label: 'Candidates', href: '/candidates', badge: null },
  { icon: Video, label: 'Interviews', href: '/interviews', badge: null },
  { icon: Settings, label: 'Settings', href: '/settings', badge: null },
]

export function Sidebar({ isOpen }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useAuthStore((state) => state.logout)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside
      className={cn(
        'bg-card border-r border-border transition-all duration-300 ease-in-out flex flex-col',
        isOpen ? 'w-64' : 'w-20',
      )}
    >
      {/* Logo */}
      <div className={cn('p-4 border-b border-border flex items-center gap-3')}>
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          H
        </div>
        {isOpen && <span className="font-bold text-lg truncate">HR Bot</span>}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href

          return (
            <Link
              key={item.href}
              to={item.href}
              title={isOpen ? undefined : item.label}
              className={cn(
                'flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors relative group',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {isOpen && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5 ml-2">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {!isOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
