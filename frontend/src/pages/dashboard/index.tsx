import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCandidatesStore } from '@/stores/candidates-store'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { Users, Briefcase, CheckCircle2, AlertCircle } from 'lucide-react'

export function DashboardPage() {
  const candidates = useCandidatesStore((state) => state.candidates)
  const campaigns = useCampaignsStore((state) => state.campaigns)
  const activeCampaigns = campaigns.filter((c) => c.status === 'active')

  const stats = [
    {
      title: 'Active Campaigns',
      value: activeCampaigns.length,
      icon: Briefcase,
      color: 'text-blue-600',
    },
    {
      title: 'Total Candidates',
      value: candidates.length,
      icon: Users,
      color: 'text-purple-600',
    },
    {
      title: 'Screening Done',
      value: candidates.filter((c) => c.stage !== 'applied').length,
      icon: CheckCircle2,
      color: 'text-green-600',
    },
    {
      title: 'Pending Action',
      value: candidates.filter((c) => c.stage === 'applied').length,
      icon: AlertCircle,
      color: 'text-orange-600',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to HR Bot - Your AI-Powered Recruitment Assistant</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`w-4 h-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.title === 'Active Campaigns' && 'Ongoing recruitment drives'}
                  {stat.title === 'Total Candidates' && 'In your pipeline'}
                  {stat.title === 'Screening Done' && 'Moved past initial screening'}
                  {stat.title === 'Pending Action' && 'Waiting for first review'}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Candidates */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Candidates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {candidates.slice(0, 5).map((candidate) => (
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
