import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { useCandidatesStore } from '@/stores/candidates-store'
import { formatDate } from '@/lib/utils'
import { Plus, Archive, Trash2, Eye, Calendar, Users, TrendingUp } from 'lucide-react'

export function CampaignsPage() {
  const { campaigns, isLoading, loadCampaigns, createCampaign, updateCampaign, deleteCampaign } = useCampaignsStore()
  const candidates = useCandidatesStore((state) => state.candidates)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    positionTitle: '',
    department: '',
    endDate: '',
  })

  useEffect(() => {
    loadCampaigns().catch((err) => setError(err instanceof Error ? err.message : 'Could not load campaigns'))
  }, [loadCampaigns])

  const handleCreateCampaign = async () => {
    if (!formData.name || !formData.endDate) {
      alert('Please fill in all fields')
      return
    }

    const positionTitle = formData.positionTitle || formData.name
    try {
      await createCampaign({
        title: formData.name,
        deadline: new Date(`${formData.endDate}T23:59:59`).toISOString(),
        department: formData.department || undefined,
        positionTitle,
        jd: {
          overview: `Recruitment campaign for ${positionTitle}.`,
          responsibilities: 'Review applications, screen candidates, and coordinate interviews.',
          requirements: 'Requirements will be refined by the recruiting team.',
        },
        skills: [],
        vacancies: 1,
      })
      setFormData({ name: '', positionTitle: '', department: '', endDate: '' })
      setIsModalOpen(false)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create campaign')
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await updateCampaign(id, { status: 'archived' })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not archive campaign')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return
    try {
      await deleteCampaign(id)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete campaign')
    }
  }

  const getCandidateCount = (campaignId: string) =>
    candidates.filter((candidate) => candidate.campaignId === campaignId).length

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active')
  const archivedCampaigns = campaigns.filter((campaign) => campaign.status !== 'active')
  const selectedCampaignDetail = campaigns.find((campaign) => campaign.id === selectedCampaign)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Recruitment Campaigns</h1>
          <p className="text-muted-foreground">Manage your recruitment campaigns and job postings</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Action failed" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <TrendingUp className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently recruiting</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Candidates</CardTitle>
            <Users className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{candidates.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all campaigns</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Archived</CardTitle>
            <Archive className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{archivedCampaigns.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Closed campaigns</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Active Campaigns</h2>
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Loading campaigns...</CardContent>
          </Card>
        ) : activeCampaigns.length === 0 ? (
          <Alert variant="info" title="No Active Campaigns">
            Create a new recruitment campaign to get started.
          </Alert>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {activeCampaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="mb-2">{campaign.name}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {getCandidateCount(campaign.id)} candidates
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Ends {formatDate(campaign.endDate)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedCampaign(campaign.id)} className="gap-1">
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleArchive(campaign.id)} className="gap-1">
                      <Archive className="w-4 h-4" />
                      Archive
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(campaign.id)}
                      className="gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {archivedCampaigns.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Archived Campaigns</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {archivedCampaigns.map((campaign) => (
              <Card key={campaign.id} className="opacity-75">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="mb-2">{campaign.name}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {getCandidateCount(campaign.id)} candidates
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary">Archived</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(campaign.id)}
                    className="gap-1 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Campaign"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign} isLoading={isLoading}>
              Create Campaign
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Campaign Name"
            placeholder="e.g., Senior React Developer - Q3 2026"
            value={formData.name}
            onChange={(event) => setFormData({ ...formData, name: event.target.value })}
          />
          <Input
            label="Job Position"
            placeholder="e.g., Senior React Developer"
            value={formData.positionTitle}
            onChange={(event) => setFormData({ ...formData, positionTitle: event.target.value })}
          />
          <Input
            label="Department"
            placeholder="e.g., Engineering"
            value={formData.department}
            onChange={(event) => setFormData({ ...formData, department: event.target.value })}
          />
          <Input
            label="End Date"
            type="date"
            value={formData.endDate}
            onChange={(event) => setFormData({ ...formData, endDate: event.target.value })}
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedCampaignDetail}
        onClose={() => setSelectedCampaign(null)}
        title={selectedCampaignDetail?.name || 'Campaign'}
      >
        {selectedCampaignDetail && (
          <div className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Status:</span> {selectedCampaignDetail.status}</div>
            <div><span className="text-muted-foreground">Deadline:</span> {formatDate(selectedCampaignDetail.endDate)}</div>
            <div><span className="text-muted-foreground">Candidates:</span> {getCandidateCount(selectedCampaignDetail.id)}</div>
          </div>
        )}
      </Modal>
    </div>
  )
}
