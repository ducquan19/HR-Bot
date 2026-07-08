import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { useCandidatesStore } from '@/stores/candidates-store'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Plus, Archive, Trash2, Eye, Calendar, Users, TrendingUp, Copy, ExternalLink } from 'lucide-react'
import type { CampaignMember, CampaignMemberRole, CampaignPositionSummary, User } from '@/types'

interface CampaignFormPosition {
  title: string
  department: string
  vacancies: number
}

interface PositionEditForm {
  title: string
  department: string
  vacancies: number
  overview: string
  responsibilities: string
  requirements: string
  benefits: string
}

const createEmptyPosition = (): CampaignFormPosition => ({ title: '', department: '', vacancies: 1 })

const positionToEditForm = (position: CampaignPositionSummary): PositionEditForm => ({
  title: position.title,
  department: position.department ?? '',
  vacancies: position.vacancies,
  overview: position.overview ?? '',
  responsibilities: position.responsibilities ?? '',
  requirements: position.requirements ?? '',
  benefits: position.benefits ?? '',
})

export function CampaignsPage() {
  const { campaigns, isLoading, loadCampaigns, createCampaign, updateCampaign, deleteCampaign } = useCampaignsStore()
  const currentUser = useAuthStore((state) => state.user)
  const candidates = useCandidatesStore((state) => state.candidates)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [members, setMembers] = useState<CampaignMember[]>([])
  const [assignableUsers, setAssignableUsers] = useState<User[]>([])
  const [newMemberUserId, setNewMemberUserId] = useState('')
  const [newMemberRole, setNewMemberRole] = useState<CampaignMemberRole>('viewer')
  const [isMembersLoading, setIsMembersLoading] = useState(false)
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null)
  const [positionEditForm, setPositionEditForm] = useState<PositionEditForm | null>(null)
  const [isSavingPosition, setIsSavingPosition] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    endDate: '',
    positions: [createEmptyPosition()],
  })

  useEffect(() => {
    loadCampaigns().catch((err) => setError(err instanceof Error ? err.message : 'Could not load campaigns'))
  }, [loadCampaigns])

  useEffect(() => {
    if (!selectedCampaign) {
      setMembers([])
      cancelEditPosition()
      return
    }
    setIsMembersLoading(true)
    Promise.all([api.campaigns.members(selectedCampaign), api.users.assignable()])
      .then(([campaignMembers, users]) => {
        setMembers(campaignMembers)
        setAssignableUsers(users)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load campaign members'))
      .finally(() => setIsMembersLoading(false))
  }, [selectedCampaign])

  const handleCreateCampaign = async () => {
    const positions = formData.positions.filter((position) => position.title.trim())
    if (!formData.name || !formData.endDate || positions.length === 0) {
      alert('Please fill in all fields')
      return
    }

    try {
      await createCampaign({
        title: formData.name,
        deadline: new Date(`${formData.endDate}T23:59:59`).toISOString(),
        department: formData.department || undefined,
        positions: positions.map((position) => ({
          title: position.title.trim(),
          department: position.department.trim() || formData.department || undefined,
          vacancies: Number(position.vacancies) || 1,
          jd: {
            overview: `Recruitment campaign for ${position.title.trim()}.`,
            responsibilities: 'Review applications, screen candidates, and coordinate interviews.',
            requirements: 'Requirements will be refined by the recruiting team.',
          },
          skills: [],
        })),
      })
      setFormData({ name: '', department: '', endDate: '', positions: [createEmptyPosition()] })
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
  const publicApplicationLink = selectedCampaignDetail?.publicApplicationUrl
    ? `${window.location.origin}${selectedCampaignDetail.publicApplicationUrl}`
    : ''
  const selectedMemberRole = members.find((member) => member.userId === currentUser?.id)?.role
  const canManageMembers = currentUser?.role === 'admin' || selectedCampaignDetail?.createdBy === currentUser?.id || selectedMemberRole === 'owner'
  const canEditPositions =
    currentUser?.role === 'admin' ||
    selectedCampaignDetail?.createdBy === currentUser?.id ||
    selectedMemberRole === 'owner' ||
    selectedMemberRole === 'editor'
  const availableMemberOptions = assignableUsers
    .filter((user) => !members.some((member) => member.userId === user.id))
    .map((user) => ({ value: user.id, label: `${user.name} (${user.email})` }))
  const memberRoleOptions = [
    { value: 'viewer', label: 'Viewer' },
    { value: 'editor', label: 'Editor' },
    { value: 'owner', label: 'Owner' },
  ]

  const updateFormPosition = (index: number, updates: Partial<CampaignFormPosition>) => {
    setFormData((current) => ({
      ...current,
      positions: current.positions.map((position, positionIndex) => (positionIndex === index ? { ...position, ...updates } : position)),
    }))
  }

  const addFormPosition = () => {
    setFormData((current) => ({ ...current, positions: [...current.positions, createEmptyPosition()] }))
  }

  const removeFormPosition = (index: number) => {
    setFormData((current) => ({
      ...current,
      positions: current.positions.length === 1 ? current.positions : current.positions.filter((_, positionIndex) => positionIndex !== index),
    }))
  }

  const handleAddMember = async () => {
    if (!selectedCampaign || !newMemberUserId) return
    try {
      const member = await api.campaigns.addMember(selectedCampaign, newMemberUserId, newMemberRole)
      setMembers((current) => [...current.filter((item) => item.id !== member.id), member])
      setNewMemberUserId('')
      setNewMemberRole('viewer')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add campaign member')
    }
  }

  const handleUpdateMemberRole = async (memberId: string, role: string) => {
    if (!selectedCampaign) return
    try {
      const member = await api.campaigns.updateMember(selectedCampaign, memberId, role)
      setMembers((current) => current.map((item) => (item.id === member.id ? member : item)))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update member role')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedCampaign) return
    try {
      await api.campaigns.removeMember(selectedCampaign, memberId)
      setMembers((current) => current.filter((item) => item.id !== memberId))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove campaign member')
    }
  }

  const startEditPosition = (position: CampaignPositionSummary) => {
    setEditingPositionId(position.id)
    setPositionEditForm(positionToEditForm(position))
  }

  const cancelEditPosition = () => {
    setEditingPositionId(null)
    setPositionEditForm(null)
  }

  const updatePositionEditForm = (updates: Partial<PositionEditForm>) => {
    setPositionEditForm((current) => (current ? { ...current, ...updates } : current))
  }

  const handleSavePosition = async (positionId: string) => {
    if (!selectedCampaign || !positionEditForm || !positionEditForm.title.trim()) return
    setIsSavingPosition(true)
    try {
      await api.campaigns.updatePosition(selectedCampaign, positionId, {
        title: positionEditForm.title.trim(),
        department: positionEditForm.department.trim() || undefined,
        vacancies: Number(positionEditForm.vacancies) || 1,
        overview: positionEditForm.overview,
        responsibilities: positionEditForm.responsibilities,
        requirements: positionEditForm.requirements,
        benefits: positionEditForm.benefits || undefined,
      })
      await loadCampaigns()
      cancelEditPosition()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update position')
    } finally {
      setIsSavingPosition(false)
    }
  }

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
                      <p className="text-sm text-muted-foreground mb-2">
                        {campaign.positionCount ?? campaign.positions?.length ?? 0} positions
                      </p>
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
                      <p className="text-sm text-muted-foreground mb-2">
                        {campaign.positionCount ?? campaign.positions?.length ?? 0} positions
                      </p>
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
        className="max-w-3xl"
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Job Positions</label>
              <Button type="button" variant="outline" size="sm" onClick={addFormPosition} className="gap-1">
                <Plus className="w-4 h-4" />
                Add
              </Button>
            </div>
            {formData.positions.map((position, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_96px_auto]">
                <Input
                  placeholder="Position title"
                  value={position.title}
                  onChange={(event) => updateFormPosition(index, { title: event.target.value })}
                />
                <Input
                  placeholder="Department"
                  value={position.department}
                  onChange={(event) => updateFormPosition(index, { department: event.target.value })}
                />
                <Input
                  type="number"
                  min={1}
                  value={position.vacancies}
                  onChange={(event) => updateFormPosition(index, { vacancies: Number(event.target.value) || 1 })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeFormPosition(index)}
                  disabled={formData.positions.length === 1}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!selectedCampaignDetail}
        onClose={() => setSelectedCampaign(null)}
        title={selectedCampaignDetail?.name || 'Campaign'}
        className="max-w-4xl"
      >
        {selectedCampaignDetail && (
          <div className="space-y-4 text-sm">
            <div><span className="text-muted-foreground">Status:</span> {selectedCampaignDetail.status}</div>
            <div><span className="text-muted-foreground">Deadline:</span> {formatDate(selectedCampaignDetail.endDate)}</div>
            <div><span className="text-muted-foreground">Candidates:</span> {getCandidateCount(selectedCampaignDetail.id)}</div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">Positions</p>
                {canEditPositions && <span className="text-xs text-muted-foreground">Owner and editor can update requirements</span>}
              </div>
              <div className="space-y-2">
                {selectedCampaignDetail.positions?.map((position) => (
                  <div key={position.id} className="rounded-md border border-border p-3">
                    {editingPositionId === position.id && positionEditForm ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_110px]">
                          <Input
                            label="Title"
                            value={positionEditForm.title}
                            onChange={(event) => updatePositionEditForm({ title: event.target.value })}
                          />
                          <Input
                            label="Department"
                            value={positionEditForm.department}
                            onChange={(event) => updatePositionEditForm({ department: event.target.value })}
                          />
                          <Input
                            label="Vacancies"
                            type="number"
                            min={1}
                            value={positionEditForm.vacancies}
                            onChange={(event) => updatePositionEditForm({ vacancies: Number(event.target.value) || 1 })}
                          />
                        </div>
                        <Textarea
                          label="Overview"
                          rows={3}
                          value={positionEditForm.overview}
                          onChange={(event) => updatePositionEditForm({ overview: event.target.value })}
                        />
                        <Textarea
                          label="Responsibilities"
                          rows={4}
                          value={positionEditForm.responsibilities}
                          onChange={(event) => updatePositionEditForm({ responsibilities: event.target.value })}
                        />
                        <Textarea
                          label="Requirements"
                          rows={5}
                          value={positionEditForm.requirements}
                          onChange={(event) => updatePositionEditForm({ requirements: event.target.value })}
                        />
                        <Textarea
                          label="Benefits"
                          rows={3}
                          value={positionEditForm.benefits}
                          onChange={(event) => updatePositionEditForm({ benefits: event.target.value })}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEditPosition}>
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleSavePosition(position.id)} isLoading={isSavingPosition}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{position.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {[position.department, position.seniority, position.employmentType].filter(Boolean).join(' - ') || 'No department'}
                            </p>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <Badge variant="secondary">{position.candidateCount} candidates</Badge>
                            {canEditPositions && (
                              <Button variant="outline" size="sm" onClick={() => startEditPosition(position)}>
                                Edit
                              </Button>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Vacancies: {position.vacancies}</p>
                        {position.requirements && (
                          <div className="mt-3">
                            <p className="text-xs font-medium mb-1">Requirements</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{position.requirements}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {!selectedCampaignDetail.positions?.length && <p className="text-sm text-muted-foreground">No positions linked to this campaign.</p>}
              </div>
            </div>
            {publicApplicationLink && (
              <div>
                <p className="text-muted-foreground mb-2">Public application link</p>
                <div className="flex gap-2">
                  <Input readOnly value={publicApplicationLink} />
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(publicApplicationLink)} title="Copy link">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" onClick={() => window.open(publicApplicationLink, '_blank')} title="Open link">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">Campaign Team</p>
                {isMembersLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
              </div>
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{member.user?.name || member.user?.email || member.userId}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.user?.email}</p>
                    </div>
                    {canManageMembers ? (
                      <Select
                        value={member.role}
                        options={memberRoleOptions}
                        onChange={(event) => handleUpdateMemberRole(member.id, event.target.value)}
                        className="w-28"
                      />
                    ) : (
                      <Badge variant="secondary">{member.role}</Badge>
                    )}
                    {canManageMembers && member.userId !== selectedCampaignDetail.createdBy && (
                      <Button variant="outline" size="sm" onClick={() => handleRemoveMember(member.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {members.length === 0 && <p className="text-sm text-muted-foreground">No campaign members yet.</p>}
              </div>
              {canManageMembers && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
                  <Select
                    value={newMemberUserId}
                    options={[{ value: '', label: 'Select user' }, ...availableMemberOptions]}
                    onChange={(event) => setNewMemberUserId(event.target.value)}
                  />
                  <Select
                    value={newMemberRole}
                    options={memberRoleOptions}
                    onChange={(event) => setNewMemberRole(event.target.value as CampaignMemberRole)}
                  />
                  <Button onClick={handleAddMember} disabled={!newMemberUserId}>
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
