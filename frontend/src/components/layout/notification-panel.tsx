import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, X, RefreshCw } from 'lucide-react'
import { useNotificationStore } from '@/stores/notification-store'
import type { AppNotification } from '@/lib/api'

// ── Icon & color per type ────────────────────────────────────────────────────
const TYPE_META: Record<
  AppNotification['type'],
  { emoji: string; borderColor: string; bgColor: string; dotColor: string }
> = {
  campaign_deadline_urgent: {
    emoji: '🔴',
    borderColor: 'border-red-200 dark:border-red-800/50',
    bgColor: 'bg-red-50 dark:bg-red-900/10',
    dotColor: 'bg-red-500',
  },
  campaign_deadline_soon: {
    emoji: '🟡',
    borderColor: 'border-yellow-200 dark:border-yellow-800/50',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
    dotColor: 'bg-yellow-500',
  },
  campaign_created: {
    emoji: '✅',
    borderColor: 'border-green-200 dark:border-green-800/50',
    bgColor: 'bg-green-50 dark:bg-green-900/10',
    dotColor: 'bg-green-500',
  },
  campaign_closed: {
    emoji: '🔒',
    borderColor: 'border-gray-200 dark:border-gray-700',
    bgColor: 'bg-gray-50 dark:bg-gray-800/30',
    dotColor: 'bg-gray-400',
  },
  new_candidates: {
    emoji: '👤',
    borderColor: 'border-blue-200 dark:border-blue-800/50',
    bgColor: 'bg-blue-50 dark:bg-blue-900/10',
    dotColor: 'bg-blue-500',
  },
  interview_upcoming: {
    emoji: '📅',
    borderColor: 'border-indigo-200 dark:border-indigo-800/50',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/10',
    dotColor: 'bg-indigo-500',
  },
  cv_processing_complete: {
    emoji: '🤖',
    borderColor: 'border-purple-200 dark:border-purple-800/50',
    bgColor: 'bg-purple-50 dark:bg-purple-900/10',
    dotColor: 'bg-purple-500',
  },
  high_score_candidate: {
    emoji: '⭐',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    bgColor: 'bg-amber-50 dark:bg-amber-900/10',
    dotColor: 'bg-amber-500',
  },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

// ── Single notification item ─────────────────────────────────────────────────
function NotificationItem({ n, isRead }: { n: AppNotification; isRead: boolean }) {
  const navigate = useNavigate()
  const { markRead } = useNotificationStore()
  const meta = TYPE_META[n.type] ?? TYPE_META.campaign_created

  const handleClick = () => {
    markRead(n.id)
    if (n.link) navigate(n.link)
  }

  return (
    <div
      onClick={handleClick}
      className={`relative flex gap-3 px-4 py-3 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-slate-800/60 border-b border-gray-100 dark:border-gray-800/50 last:border-0 ${
        isRead ? 'opacity-60' : ''
      }`}
    >
      {/* Unread dot */}
      {!isRead && (
        <span className={`absolute top-3.5 right-3 w-2 h-2 rounded-full flex-shrink-0 ${meta.dotColor}`} />
      )}

      {/* Icon chip */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border text-base ${meta.bgColor} ${meta.borderColor}`}>
        {meta.emoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-3">
        <p className={`text-xs font-bold leading-tight mb-0.5 ${isRead ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
          {n.title}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug line-clamp-2">
          {n.message}
        </p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
          {timeAgo(n.createdAt)}
        </p>
      </div>
    </div>
  )
}

// ── Main panel ───────────────────────────────────────────────────────────────
export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const {
    notifications,
    readIds,
    isLoading,
    fetch,
    markAllRead,
    unreadCount,
  } = useNotificationStore()

  // Fetch on mount + poll every 2 minutes
  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetch])

  // Close when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const count = unreadCount()

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell"
        onClick={() => {
          setOpen(o => !o)
          if (!open) fetch()
        }}
        className="relative p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Thông báo"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 mt-3 w-[360px] max-h-[520px] flex flex-col bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 origin-top-right overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm font-bold text-gray-900 dark:text-white">Thông báo</span>
              {count > 0 && (
                <span className="text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                  {count} mới
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetch()}
                disabled={isLoading}
                title="Làm mới"
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              {count > 0 && (
                <button
                  onClick={markAllRead}
                  title="Đánh dấu tất cả đã đọc"
                  className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-3" />
                <p className="text-sm">Đang tải thông báo...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <Bell className="w-7 h-7 text-gray-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Không có thông báo nào</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Mọi thứ đang diễn ra suôn sẻ</p>
              </div>
            ) : (
              <>
                {/* Unread first */}
                {notifications
                  .slice()
                  .sort((a, b) => {
                    const aRead = readIds.has(a.id) ? 1 : 0
                    const bRead = readIds.has(b.id) ? 1 : 0
                    if (aRead !== bRead) return aRead - bRead
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  })
                  .map(n => (
                    <NotificationItem
                      key={n.id}
                      n={n}
                      isRead={readIds.has(n.id)}
                    />
                  ))}
              </>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {notifications.length} thông báo
              </span>
              {count === 0 && (
                <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-medium">
                  <Check className="w-3 h-3" /> Đã đọc tất cả
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
