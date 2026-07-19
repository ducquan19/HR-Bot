import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { useCandidatesStore } from '@/stores/candidates-store'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { AlertCircle, Briefcase, CheckCircle2, MessageSquare, Users, Calendar, Clock, ChevronRight, TrendingUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface DashboardSummary {
  cards: {
    activeCampaigns: number
    totalCandidates: number
    screeningDone: number
    pendingAction: number
    interviews: number
  }
  funnel: {
    applied: number
    screeningDone: number
    interviews: number
    offers: number
    rejected: number
  }
  scoreBuckets: Array<{ range: string; count: number }>
  topSkills: Array<{ skill?: string; count: number }>
}

export function DashboardPage() {
  const candidates = useCandidatesStore((state) => state.candidates)
  const loadCandidates = useCandidatesStore((state) => state.loadCandidates)
  const { campaigns, loadCampaigns } = useCampaignsStore()
  
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      loadCandidates(),
      loadCampaigns(),
      api.dashboard.summary()
        .then((data) => setSummary(data as DashboardSummary))
    ])
    .catch((err) => setError(err instanceof Error ? err.message : 'Could not load dashboard summary'))
    .finally(() => setIsLoading(false))
  }, [loadCandidates, loadCampaigns])

  // Lọc các chiến dịch sắp đến hạn (trong vòng 7 ngày tới)
  const upcomingDeadlines = useMemo(() => {
    const now = new Date()
    const nextWeek = new Date()
    nextWeek.setDate(now.getDate() + 7)
    
    return campaigns
      .filter(c => c.status === 'active' && new Date(c.endDate) > now && new Date(c.endDate) <= nextWeek)
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
      .slice(0, 4)
  }, [campaigns])

  const stats = [
    {
      title: 'Chiến dịch đang chạy',
      value: summary?.cards.activeCampaigns ?? 0,
      icon: Briefcase,
      color: 'from-blue-500 to-indigo-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      title: 'Tổng ứng viên',
      value: summary?.cards.totalCandidates ?? 0,
      icon: Users,
      color: 'from-purple-500 to-fuchsia-500',
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      title: 'Đã qua vòng loại',
      value: summary?.cards.screeningDone ?? 0,
      icon: CheckCircle2,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600',
    },
    {
      title: 'Đang chờ xử lý',
      value: summary?.cards.pendingAction ?? 0,
      icon: AlertCircle,
      color: 'from-orange-400 to-amber-500',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600',
    },
    {
      title: 'Lịch phỏng vấn',
      value: summary?.cards.interviews ?? 0,
      icon: MessageSquare,
      color: 'from-pink-500 to-rose-500',
      bgColor: 'bg-pink-50',
      iconColor: 'text-pink-600',
    },
  ]

  const funnel = summary ? [
    { label: 'Ứng tuyển', value: summary.funnel.applied, color: 'bg-blue-500' },
    { label: 'Qua vòng loại', value: summary.funnel.screeningDone, color: 'bg-indigo-500' },
    { label: 'Phỏng vấn', value: summary.funnel.interviews, color: 'bg-purple-500' },
    { label: 'Đề nghị (Offer)', value: summary.funnel.offers, color: 'bg-green-500' },
    { label: 'Bị từ chối', value: summary.funnel.rejected, color: 'bg-red-400' },
  ] : []
  
  const maxFunnel = Math.max(...funnel.map((item) => item.value), 1)
  const maxScores = Math.max(...(summary?.scoreBuckets.map((item) => item.count) ?? [0]), 1)
  const maxSkills = Math.max(...(summary?.topSkills.map((item) => item.count) ?? [0]), 1)

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Tổng quan</h1>
          <p className="text-gray-500 text-sm">Chào mừng trở lại! Dưới đây là tình hình tuyển dụng của bạn.</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5">
        {stats.map((stat, idx) => {
          const Icon = stat.icon
          return (
            <div key={idx} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
              <div>
                <div className="text-3xl font-black text-gray-900 mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-gray-500">{stat.title}</div>
              </div>
              {/* Decorative gradient blur */}
              <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-gradient-to-br ${stat.color} opacity-[0.08] group-hover:opacity-[0.15] transition-opacity blur-2xl`}></div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phễu tuyển dụng */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
                Phễu tuyển dụng
              </h3>
              <div className="space-y-5">
                {funnel.map((item) => (
                  <div key={item.label} className="group">
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="text-gray-900">{item.value}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.color} rounded-full transition-all duration-1000 group-hover:opacity-80`} 
                        style={{ width: `${Math.max(5, (item.value / maxFunnel) * 100)}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Kỹ năng */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-500" />
                Top kỹ năng yêu cầu
              </h3>
              <div className="space-y-5">
                {(summary?.topSkills.length ? summary.topSkills : [{ skill: 'Chưa có dữ liệu', count: 0 }]).slice(0, 5).map((item, idx) => (
                  <div key={item.skill || idx}>
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-gray-600">{item.skill || 'Không xác định'}</span>
                      <span className="text-gray-900">{item.count}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-1000" 
                        style={{ width: `${Math.max(5, (item.count / maxSkills) * 100)}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Phân bố điểm số */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Phân bố điểm đánh giá AI
            </h3>
            <div className="flex items-end justify-between gap-2 h-48 mt-4 pt-4 border-t border-gray-50 border-dashed">
              {summary?.scoreBuckets.map((bucket) => (
                <div key={bucket.range} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="text-xs font-semibold text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity -mb-1">{bucket.count}</span>
                  <div className="w-full max-w-[40px] bg-gray-50 rounded-t-xl flex items-end h-32 overflow-hidden relative">
                    <div 
                      className="w-full bg-gradient-to-t from-emerald-500 to-green-400 rounded-t-xl transition-all duration-700" 
                      style={{ height: `${Math.max(8, (bucket.count / maxScores) * 100)}%` }} 
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{bucket.range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          {/* Upcoming Deadlines Widget */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-2xl p-1 relative overflow-hidden shadow-lg">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 opacity-20 blur-[50px] rounded-full"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-rose-500 opacity-20 blur-[40px] rounded-full"></div>
            
            <div className="bg-slate-900/40 backdrop-blur-xl rounded-xl p-5 relative z-10">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-400" />
                Sắp đến hạn
              </h3>
              
              <div className="space-y-3">
                {upcomingDeadlines.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Calendar className="w-5 h-5 text-white/40" />
                    </div>
                    <p className="text-sm text-white/60">Không có đợt tuyển dụng nào sắp đóng trong 7 ngày tới.</p>
                  </div>
                ) : (
                  upcomingDeadlines.map(campaign => {
                    const daysLeft = Math.ceil((new Date(campaign.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <div key={campaign.id} className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl p-3 flex items-center justify-between transition-colors cursor-pointer group">
                        <div className="min-w-0 pr-3">
                          <p className="text-sm font-semibold text-white truncate">{campaign.name}</p>
                          <p className="text-xs text-white/60 mt-1">{formatDate(campaign.endDate)}</p>
                        </div>
                        <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0 ${
                          daysLeft <= 2 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 
                          'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          Còn {daysLeft} ngày
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Recent Candidates */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Ứng viên gần đây</h3>
              <button className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1 group">
                Xem tất cả
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
            <div className="space-y-4">
              {candidates.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                  <p className="text-sm text-gray-400">Chưa có ứng viên nào.</p>
                </div>
              ) : (
                candidates.slice(0, 5).map((candidate) => {
                  const scoreVal = Math.round((candidate.score || 0) * 100)
                  return (
                    <div key={candidate.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group cursor-pointer border border-transparent hover:border-gray-100">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm border border-gray-200">
                          {candidate.firstName.charAt(0)}{candidate.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{candidate.firstName} {candidate.lastName}</p>
                          <p className="text-xs text-gray-500 truncate">{candidate.email}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-bold text-gray-900">{scoreVal}%</div>
                        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{candidate.stage.replace('_', ' ')}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

