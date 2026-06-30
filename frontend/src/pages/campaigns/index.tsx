import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { useCandidatesStore } from '@/stores/candidates-store'
import { useAuthStore } from '@/stores/auth-store'
import { formatDate, generateMockId } from '@/lib/utils'
import { Plus, Archive, Trash2, Eye, Calendar, Users, TrendingUp } from 'lucide-react'

export function CampaignsPage() {
  const { campaigns, addCampaign, updateCampaign, deleteCampaign } = useCampaignsStore()
  const { user } = useAuthStore()
  const candidates = useCandidatesStore((state) => state.candidates)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    jobPositionId: '1',
    endDate: '',
  })

  const handleCreateCampaign = () => {
    if (!formData.name || !formData.endDate) {
      alert('Please fill in all fields')
      return
    }

    const newCampaign = {
      id: generateMockId(),
      name: formData.name,
      jobPositionId: formData.jobPositionId,
      startDate: new Date().toISOString(),
      endDate: formData.endDate,
      status: 'active' as const,
      createdBy: user?.id || 'unknown',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    addCampaign(newCampaign)
    setFormData({ name: '', jobPositionId: '1', endDate: '' })
    setIsModalOpen(false)
  }

  const handleArchive = (id: string) => {
    updateCampaign(id, { status: 'archived' })
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this campaign?')) {
      deleteCampaign(id)
    }
  }

  const getCandidateCount = (campaignId: string) => {
    return candidates.filter((c) => c.campaignId === campaignId).length
  }

  const activeCampaigns = campaigns.filter((c) => c.status === 'active')
  const archivedCampaigns = campaigns.filter((c) => c.status !== 'active')

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

      {/* Stats */}
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

      {/* Active Campaigns */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Active Campaigns</h2>
        {activeCampaigns.length === 0 ? (
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
                    <Button variant="outline" size="sm" className="gap-1">
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(campaign.id)}
                      className="gap-1"
                    >
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

      {/* Archived Campaigns */}
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

      {/* Create Campaign Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Campaign"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign}>Create Campaign</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Campaign Name"
            placeholder="e.g., Senior React Developer - Q3 2024"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <Select
            label="Job Position"
            options={[
              { value: '1', label: 'Senior React Developer' },
              { value: '2', label: 'Full Stack Developer' },
              { value: '3', label: 'Junior Developer' },
            ]}
            value={formData.jobPositionId}
            onChange={(e) => setFormData({ ...formData, jobPositionId: e.target.value })}
          />
          <Input
            label="End Date"
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          />
        </div>
      </Modal>
    </div>
  )
}
