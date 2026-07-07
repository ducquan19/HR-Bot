import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { useCandidatesStore } from '@/stores/candidates-store'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { AlertCircle, Briefcase, CheckCircle2, MessageSquare, Users } from 'lucide-react'

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
  const loadCampaigns = useCampaignsStore((state) => state.loadCampaigns)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCandidates().catch(() => undefined)
    loadCampaigns().catch(() => undefined)
    api.dashboard.summary()
      .then((data) => {
        setSummary(data as DashboardSummary)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load dashboard summary'))
  }, [loadCandidates, loadCampaigns])

  const cards = [
    {
      title: 'Active Campaigns',
      value: summary?.cards.activeCampaigns ?? 0,
      icon: Briefcase,
      color: 'text-blue-600',
      subtitle: 'Ongoing recruitment drives',
    },
    {
      title: 'Total Candidates',
      value: summary?.cards.totalCandidates ?? 0,
      icon: Users,
      color: 'text-purple-600',
      subtitle: 'In your pipeline',
    },
    {
      title: 'Screening Done',
      value: summary?.cards.screeningDone ?? 0,
      icon: CheckCircle2,
      color: 'text-green-600',
      subtitle: 'Moved past initial screening',
    },
    {
      title: 'Pending Action',
      value: summary?.cards.pendingAction ?? 0,
      icon: AlertCircle,
      color: 'text-orange-600',
      subtitle: 'Waiting for first review',
    },
    {
      title: 'Interviews',
      value: summary?.cards.interviews ?? 0,
      icon: MessageSquare,
      color: 'text-indigo-600',
      subtitle: 'Virtual interview sessions',
    },
  ]

  const funnel = summary ? [
    { label: 'Applied', value: summary.funnel.applied },
    { label: 'Screening+', value: summary.funnel.screeningDone },
    { label: 'Interviews', value: summary.funnel.interviews },
    { label: 'Offers', value: summary.funnel.offers },
    { label: 'Rejected', value: summary.funnel.rejected },
  ] : []
  const maxFunnel = Math.max(...funnel.map((item) => item.value), 1)
  const maxScores = Math.max(...(summary?.scoreBuckets.map((item) => item.count) ?? [0]), 1)
  const maxSkills = Math.max(...(summary?.topSkills.map((item) => item.count) ?? [0]), 1)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to HR Bot - Your AI-Powered Recruitment Assistant</p>
      </div>

      {error && (
        <Alert variant="error" title="Dashboard unavailable" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
        {cards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Recruitment Funnel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {funnel.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-2">
                  <span>{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(item.value / maxFunnel) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Score Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-3 h-56">
            {summary?.scoreBuckets.map((bucket) => (
              <div key={bucket.range} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-muted rounded-t-md flex items-end h-36 overflow-hidden">
                  <div className="w-full bg-green-600" style={{ height: `${Math.max(4, (bucket.count / maxScores) * 100)}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{bucket.range}</span>
                <span className="text-sm font-medium">{bucket.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Skills</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(summary?.topSkills.length ? summary.topSkills : [{ skill: 'No skill data', count: 0 }]).map((item) => (
              <div key={item.skill || 'unknown'}>
                <div className="flex justify-between text-sm mb-2">
                  <span>{item.skill || 'Unknown'}</span>
                  <span className="font-medium">{item.count}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600" style={{ width: `${(item.count / maxSkills) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {candidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No candidates yet.</p>
            ) : candidates.slice(0, 5).map((candidate) => (
              <div key={candidate.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                    {candidate.firstName.charAt(0)}{candidate.lastName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{candidate.firstName} {candidate.lastName}</p>
                    <p className="text-xs text-muted-foreground">{candidate.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{Math.round((candidate.score || 0) * 100)}%</p>
                  <p className="text-xs text-muted-foreground capitalize">{candidate.stage.replace('_', ' ')}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
