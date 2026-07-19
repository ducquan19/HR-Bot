import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Alert } from '@/components/ui/alert'
import { Select } from '@/components/ui/select'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { useCandidatesStore } from '@/stores/candidates-store'
import { CampaignModal } from './CampaignModal'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Plus, Archive, Trash2, Eye, Calendar, Users, TrendingUp, RotateCcw } from 'lucide-react'
import type { CampaignMember, CampaignMemberRole, CampaignPositionSummary, User, JobPosition } from '@/types'

interface CampaignFormPosition {
  positionId?: string
  title: string
  department: string
  employmentType: string
  vacancies: number
}

interface PositionEditForm {
  title: string
  department: string
  employmentType: string
  vacancies: number
  overview: string
  responsibilities: string
  requirements: string
  benefits: string
}

const employmentTypeOptions = [
  { value: 'full_time', label: 'Toàn thời gian' },
  { value: 'part_time', label: 'Bán thời gian' },
  { value: 'contract', label: 'Hợp đồng' },
  { value: 'internship', label: 'Thực tập' },
]

const toBackendEmploymentType = (value: string) => value.toUpperCase()

const createEmptyPosition = (): CampaignFormPosition => ({ title: '', department: '', employmentType: 'full_time', vacancies: 1 })

const createEmptyPositionEditForm = (): PositionEditForm => ({
  title: '',
  department: '',
  employmentType: 'full_time',
  vacancies: 1,
  overview: '',
  responsibilities: '',
  requirements: '',
  benefits: '',
})

const positionToEditForm = (position: CampaignPositionSummary): PositionEditForm => ({
  title: position.title,
  department: position.department ?? '',
  employmentType: position.employmentType ?? 'full_time',
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
  const [isAddingPosition, setIsAddingPosition] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    endDate: '',
    positions: [createEmptyPosition()],
  })
  const [allJobPositions, setAllJobPositions] = useState<JobPosition[]>([])

  // Edit Campaign State
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'members'>('overview')
  const [isEditingCampaign, setIsEditingCampaign] = useState(false)
  const [isSavingCampaign, setIsSavingCampaign] = useState(false)
  const [campaignEditForm, setCampaignEditForm] = useState({ name: '', department: '', endDate: '' })

  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    loadCampaigns().catch((err) => setError(err instanceof Error ? err.message : 'Could not load campaigns'))
    api.campaigns.jobPositions().then(setAllJobPositions).catch(console.error)
  }, [loadCampaigns])

  useEffect(() => {
    if (!selectedCampaign) {
      setMembers([])
      cancelEditPosition()
      setIsEditingCampaign(false)
      setActiveTab('overview')
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
          positionId: position.positionId || undefined,
          title: position.title.trim(),
          department: position.department.trim() || formData.department || undefined,
          employmentType: toBackendEmploymentType(position.employmentType),
          vacancies: Number(position.vacancies) || 1,
          jd: position.positionId ? undefined : {
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

  const handleActivate = async (id: string) => {
    try {
      await updateCampaign(id, { status: 'active' })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not activate campaign')
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

  const filteredActiveCampaigns = activeCampaigns.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.department?.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
    .filter((user) => user.id !== currentUser?.id && !members.some((member) => member.userId === user.id))
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

  const getMemberUser = (member: CampaignMember) => {
    const fallbackUser = assignableUsers.find((user) => user.id === member.userId)
    return member.user ?? fallbackUser
  }

  const startEditPosition = (position: CampaignPositionSummary) => {
    setEditingPositionId(position.id)
    setPositionEditForm(positionToEditForm(position))
  }

  const cancelEditPosition = () => {
    setEditingPositionId(null)
    setPositionEditForm(null)
    setIsAddingPosition(false)
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
        employmentType: toBackendEmploymentType(positionEditForm.employmentType),
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

  const startAddPosition = () => {
    setEditingPositionId(null)
    setPositionEditForm(createEmptyPositionEditForm())
    setIsAddingPosition(true)
  }

  const handleAddPosition = async () => {
    if (!selectedCampaign || !positionEditForm || !positionEditForm.title.trim()) return
    setIsSavingPosition(true)
    try {
      await api.campaigns.addPosition(selectedCampaign, {
        title: positionEditForm.title.trim(),
        department: positionEditForm.department.trim() || undefined,
        employmentType: toBackendEmploymentType(positionEditForm.employmentType),
        vacancies: Number(positionEditForm.vacancies) || 1,
        jd: {
          overview: positionEditForm.overview,
          responsibilities: positionEditForm.responsibilities,
          requirements: positionEditForm.requirements,
          benefits: positionEditForm.benefits || undefined,
        },
        skills: [],
      })
      await loadCampaigns()
      cancelEditPosition()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add position')
    } finally {
      setIsSavingPosition(false)
    }
  }

  const startEditCampaign = () => {
    if (!selectedCampaignDetail) return
    setCampaignEditForm({
      name: selectedCampaignDetail.name,
      department: (selectedCampaignDetail as any).department || '',
      endDate: selectedCampaignDetail.endDate.split('T')[0],
    })
    setIsEditingCampaign(true)
  }

  const handleSaveCampaign = async () => {
    if (!selectedCampaign || !campaignEditForm.name.trim() || !campaignEditForm.endDate) return
    setIsSavingCampaign(true)
    try {
      await updateCampaign(selectedCampaign, {
        name: campaignEditForm.name.trim(),
        department: campaignEditForm.department.trim() || undefined,
        endDate: new Date(`${campaignEditForm.endDate}T23:59:59`).toISOString(),
      })
      await loadCampaigns()
      setIsEditingCampaign(false)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update campaign')
    } finally {
      setIsSavingCampaign(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quản lý chiến dịch</h1>
          <p className="text-muted-foreground">Quản lý các chiến dịch tuyển dụng và vị trí công việc</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Tạo chiến dịch
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Action failed" className="mb-6">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Đang hoạt động</p>
            <div className="text-3xl font-black text-gray-900">{activeCampaigns.length}</div>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">Chiến dịch đang mở</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Tổng ứng viên</p>
            <div className="text-3xl font-black text-gray-900">{candidates.length}</div>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">Trong tất cả chiến dịch</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center border border-purple-100">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-5 flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-sm font-semibold text-gray-500 mb-1">Đã đóng</p>
            <div className="text-3xl font-black text-gray-900">{archivedCampaigns.length}</div>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">Chiến dịch lưu trữ</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center border border-orange-100">
            <Archive className="w-6 h-6 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-center mb-6 gap-6 relative">
          <h2 className="text-xl font-bold whitespace-nowrap">Chiến dịch đang hoạt động</h2>
          <div className="w-full sm:w-[400px] sm:absolute sm:left-1/2 sm:-translate-x-1/2">
            <Input
              placeholder="Tìm kiếm theo tên chiến dịch hoặc phòng ban..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 text-sm bg-white shadow-sm"
            />
          </div>
        </div>
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Đang tải dữ liệu...</CardContent>
          </Card>
        ) : filteredActiveCampaigns.length === 0 ? (
          <Alert variant="info" title="Không tìm thấy chiến dịch">
            {searchQuery ? 'Không có chiến dịch nào phù hợp với tìm kiếm của bạn.' : 'Hãy tạo một chiến dịch tuyển dụng mới để bắt đầu.'}
          </Alert>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredActiveCampaigns.map((campaign) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="mb-2">{campaign.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mb-2">
                        {campaign.positionCount ?? campaign.positions?.length ?? 0} vị trí
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {getCandidateCount(campaign.id)} ứng viên
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Kết thúc {formatDate(campaign.endDate)}
                        </div>
                      </div>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedCampaign(campaign.id)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Chi tiết
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleArchive(campaign.id)} className="gap-1">
                      <Archive className="w-4 h-4" />
                      Lưu trữ
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(campaign.id)}
                      className="gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa
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
          <h2 className="text-xl font-bold mb-4">Chiến dịch Lưu trữ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedCampaigns.map((campaign) => (
              <Card key={campaign.id} className="opacity-75 bg-gray-50 border-dashed">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="mb-2 text-gray-700">{campaign.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mb-2">
                        {campaign.positionCount ?? campaign.positions?.length ?? 0} vị trí
                      </p>
                    </div>
                    <Badge variant="secondary">Đã đóng</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedCampaign(campaign.id)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Chi tiết
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleActivate(campaign.id)} className="gap-1">
                      <RotateCcw className="w-4 h-4" />
                      Mở lại
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(campaign.id)}
                      className="gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Tạo chiến dịch mới"
        className="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateCampaign} isLoading={isLoading}>
              Tạo mới
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Tên chiến dịch"
            placeholder="VD: Tuyển dụng lập trình viên React - Quý 3 2026"
            value={formData.name}
            onChange={(event) => setFormData({ ...formData, name: event.target.value })}
          />
          <Input
            label="Phòng ban"
            placeholder="VD: Kỹ thuật"
            value={formData.department}
            onChange={(event) => setFormData({ ...formData, department: event.target.value })}
          />
          <Input
            label="Ngày kết thúc"
            type="date"
            value={formData.endDate}
            onChange={(event) => setFormData({ ...formData, endDate: event.target.value })}
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Vị trí tuyển dụng</label>
              <Button type="button" variant="outline" size="sm" onClick={addFormPosition} className="gap-1">
                <Plus className="w-4 h-4" />
                Thêm
              </Button>
            </div>
            {formData.positions.map((position, index) => (
              <div key={index} className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Select
                    value={position.positionId || ''}
                    options={[
                      { value: '', label: '-- Tạo vị trí mới --' },
                      ...allJobPositions.map(p => ({ value: p.id, label: `${p.title}${p.department ? ` (${p.department})` : ''}` }))
                    ]}
                    onChange={(event) => {
                      const posId = event.target.value
                      if (!posId) {
                        updateFormPosition(index, { positionId: '', title: '', department: '' })
                      } else {
                        const jobPos = allJobPositions.find(p => p.id === posId)
                        if (jobPos) {
                          updateFormPosition(index, {
                            positionId: jobPos.id,
                            title: jobPos.title,
                            department: jobPos.department || '',
                            employmentType: jobPos.employmentType?.toLowerCase() || 'full_time',
                          })
                        }
                      }
                    }}
                  />
                </div>
                <Input
                  placeholder="Tên vị trí"
                  value={position.title}
                  onChange={(event) => updateFormPosition(index, { title: event.target.value, positionId: '' })}
                />
                <Input
                  placeholder="Phòng ban"
                  value={position.department}
                  onChange={(event) => updateFormPosition(index, { department: event.target.value, positionId: '' })}
                />
                <Select
                  value={position.employmentType}
                  options={employmentTypeOptions}
                  onChange={(event) => updateFormPosition(index, { employmentType: event.target.value, positionId: '' })}
                />
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:col-span-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Số lượng tuyển"
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
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <CampaignModal
        selectedCampaignDetail={selectedCampaignDetail || null}
        setSelectedCampaign={setSelectedCampaign}
        activeTab={activeTab}
        setActiveTab={setActiveTab as any}
        isEditingCampaign={isEditingCampaign}
        setIsEditingCampaign={setIsEditingCampaign}
        campaignEditForm={campaignEditForm}
        setCampaignEditForm={setCampaignEditForm}
        handleSaveCampaign={handleSaveCampaign}
        isSavingCampaign={isSavingCampaign}
        isAdmin={isAdmin}
        canEditPositions={canEditPositions}
        canManageMembers={canManageMembers}
        getCandidateCount={getCandidateCount}
        publicApplicationLink={publicApplicationLink}
        startEditCampaign={startEditCampaign}
        startAddPosition={startAddPosition}
        isAddingPosition={isAddingPosition}
        positionEditForm={positionEditForm}
        updatePositionEditForm={updatePositionEditForm}
        employmentTypeOptions={employmentTypeOptions}
        cancelEditPosition={cancelEditPosition}
        handleAddPosition={handleAddPosition}
        isSavingPosition={isSavingPosition}
        editingPositionId={editingPositionId}
        startEditPosition={startEditPosition}
        handleSavePosition={handleSavePosition}
        isMembersLoading={isMembersLoading}
        members={members}
        getMemberUser={getMemberUser}
        memberRoleOptions={memberRoleOptions}
        handleUpdateMemberRole={handleUpdateMemberRole}
        handleRemoveMember={handleRemoveMember}
        newMemberUserId={newMemberUserId}
        setNewMemberUserId={setNewMemberUserId}
        availableMemberOptions={availableMemberOptions}
        newMemberRole={newMemberRole}
        setNewMemberRole={setNewMemberRole as any}
        handleAddMember={handleAddMember}
      />
    </div>
  )
}
