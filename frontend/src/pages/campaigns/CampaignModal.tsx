import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Briefcase, Calendar, CheckCircle2, Copy, Edit2, ExternalLink, FileText, Plus, Trash2, Users, X } from 'lucide-react'
import type { CampaignMember, RecruitmentCampaign } from '@/types'

// Re-using the types and props needed
interface CampaignModalProps {
  selectedCampaignDetail: RecruitmentCampaign | null
  setSelectedCampaign: (id: string | null) => void
  activeTab: 'overview' | 'positions' | 'members'
  setActiveTab: (tab: 'overview' | 'positions' | 'members') => void
  isEditingCampaign: boolean
  setIsEditingCampaign: (val: boolean) => void
  campaignEditForm: { name: string; department: string; endDate: string }
  setCampaignEditForm: (val: { name: string; department: string; endDate: string }) => void
  handleSaveCampaign: () => Promise<void>
  isSavingCampaign: boolean
  isAdmin: boolean
  canEditPositions: boolean
  canManageMembers: boolean
  getCandidateCount: (id: string) => number
  publicApplicationLink: string | null
  startEditCampaign: () => void
  
  // Positions
  startAddPosition: () => void
  isAddingPosition: boolean
  positionEditForm: any
  updatePositionEditForm: (val: any) => void
  employmentTypeOptions: any[]
  cancelEditPosition: () => void
  handleAddPosition: () => void
  isSavingPosition: boolean
  editingPositionId: string | null
  startEditPosition: (pos: any) => void
  handleSavePosition: (id: string) => void

  // Members
  isMembersLoading: boolean
  members: CampaignMember[]
  getMemberUser: (member: CampaignMember) => any
  memberRoleOptions: any[]
  handleUpdateMemberRole: (id: string, role: string) => void
  handleRemoveMember: (id: string) => void
  newMemberUserId: string
  setNewMemberUserId: (val: string) => void
  availableMemberOptions: any[]
  newMemberRole: string
  setNewMemberRole: (val: string) => void
  handleAddMember: () => void
}

export function CampaignModal(props: CampaignModalProps) {
  const {
    selectedCampaignDetail, setSelectedCampaign, activeTab, setActiveTab,
    isEditingCampaign, setIsEditingCampaign, campaignEditForm, setCampaignEditForm,
    handleSaveCampaign, isSavingCampaign, isAdmin, canEditPositions, canManageMembers,
    getCandidateCount, publicApplicationLink, startEditCampaign,
    startAddPosition, isAddingPosition, positionEditForm, updatePositionEditForm,
    employmentTypeOptions, cancelEditPosition, handleAddPosition,
    isSavingPosition, editingPositionId, startEditPosition, handleSavePosition,
    isMembersLoading, members, getMemberUser, memberRoleOptions,
    handleUpdateMemberRole, handleRemoveMember, newMemberUserId, setNewMemberUserId,
    availableMemberOptions, newMemberRole, setNewMemberRole, handleAddMember
  } = props

  if (!selectedCampaignDetail) return null

  return (
    <Modal
      isOpen={!!selectedCampaignDetail}
      onClose={() => setSelectedCampaign(null)}
      title={undefined}
      hideHeader={true}
      contentClassName="p-0"
      className="max-w-4xl bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl p-0"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-8 relative overflow-hidden rounded-t-xl">
           <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none"><Briefcase className="w-32 h-32" /></div>
           <button onClick={() => setSelectedCampaign(null)} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-20">
             <X className="w-6 h-6" />
           </button>
           <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start gap-4">
             <div className="pr-12">
               <h2 className="text-3xl font-black mb-3">{selectedCampaignDetail.name}</h2>
               <div className="flex flex-wrap items-center gap-5 text-blue-100 text-sm font-medium">
                 <span className="flex items-center gap-1.5"><FileText className="w-4 h-4"/> {(selectedCampaignDetail as any).department || 'Chưa phân bổ'}</span>
                 <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4"/> Hạn: {formatDate(selectedCampaignDetail.endDate)}</span>
                 <span className="flex items-center gap-1.5"><Users className="w-4 h-4"/> {getCandidateCount(selectedCampaignDetail.id)} Ứng viên</span>
               </div>
             </div>
             <div className="flex items-center gap-2">
               <Badge className="bg-white/20 hover:bg-white/30 text-white border-none shadow-none text-xs px-3 py-1 uppercase tracking-wider">{selectedCampaignDetail.status}</Badge>
             </div>
           </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 px-8 pt-2 bg-gray-50/80 border-b border-gray-200">
          {[
            { id: 'overview', label: 'Tổng quan', icon: FileText },
            { id: 'positions', label: 'Vị trí', icon: Briefcase },
            { id: 'members', label: 'Thành viên', icon: Users }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 py-4 text-sm font-bold border-b-[3px] transition-all",
                activeTab === tab.id ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="p-8 overflow-y-auto max-h-[65vh]">
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Thông tin chung</h3>
                {(isAdmin || canEditPositions) && !isEditingCampaign && (
                  <button onClick={startEditCampaign} className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl transition-all shadow-sm">
                    <Edit2 className="w-4 h-4" />
                    Chỉnh sửa
                  </button>
                )}
              </div>

              {isEditingCampaign ? (
                <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 space-y-5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-2xl"></div>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Tên chiến dịch *</label>
                      <input className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all font-medium" value={campaignEditForm.name} onChange={(e) => setCampaignEditForm({...campaignEditForm, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Phòng ban</label>
                      <input className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all font-medium" value={campaignEditForm.department} onChange={(e) => setCampaignEditForm({...campaignEditForm, department: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Hạn nộp hồ sơ *</label>
                      <input type="date" className="w-full h-11 px-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all font-medium" value={campaignEditForm.endDate} onChange={(e) => setCampaignEditForm({...campaignEditForm, endDate: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <Button variant="outline" className="rounded-xl h-10 px-5" onClick={() => setIsEditingCampaign(false)}>Hủy bỏ</Button>
                    <Button className="rounded-xl h-10 px-5 bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200" onClick={handleSaveCampaign} isLoading={isSavingCampaign}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-y-8 gap-x-8">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Tên chiến dịch</p>
                    <p className="text-base font-bold text-gray-900">{selectedCampaignDetail.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Phòng ban</p>
                    <p className="text-base font-bold text-gray-900">{(selectedCampaignDetail as any).department || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Hạn nộp hồ sơ</p>
                    <p className="text-base font-bold text-gray-900">{formatDate(selectedCampaignDetail.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wider">Trạng thái</p>
                    <p className="text-base font-bold text-gray-900 capitalize">{selectedCampaignDetail.status}</p>
                  </div>
                </div>
              )}

              {publicApplicationLink && (
                <div className="pt-8 mt-4 border-t border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Liên kết ứng tuyển công khai</h3>
                  <div className="flex gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-200">
                    <Input readOnly value={publicApplicationLink} className="bg-transparent border-none focus-visible:ring-0 font-medium text-gray-600" />
                    <Button variant="outline" className="rounded-xl bg-white hover:bg-gray-100 shadow-sm border border-gray-200" onClick={() => navigator.clipboard.writeText(publicApplicationLink)} title="Sao chép liên kết">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" className="rounded-xl bg-white hover:bg-gray-100 shadow-sm border border-gray-200" onClick={() => window.open(publicApplicationLink, '_blank')} title="Mở liên kết">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'positions' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-gray-900">Các vị trí tuyển dụng</h3>
                {(isAdmin || canEditPositions) && (
                  <button onClick={startAddPosition} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm font-semibold rounded-xl transition-all shadow-sm">
                    <Plus className="w-4 h-4" />
                    Thêm vị trí
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {isAddingPosition && positionEditForm && (
                  <div className="rounded-md border border-border p-3">
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <Input
                          label="Tiêu đề"
                          value={positionEditForm.title}
                          onChange={(event) => updatePositionEditForm({ title: event.target.value })}
                        />
                        <Input
                          label="Phòng ban"
                          value={positionEditForm.department}
                          onChange={(event) => updatePositionEditForm({ department: event.target.value })}
                        />
                        <Select
                          label="Loại hình"
                          value={positionEditForm.employmentType}
                          options={employmentTypeOptions}
                          onChange={(event) => updatePositionEditForm({ employmentType: event.target.value })}
                        />
                        <Input
                          className="md:max-w-40"
                          label="Số vị trí"
                          type="number"
                          min={1}
                          value={positionEditForm.vacancies}
                          onChange={(event) => updatePositionEditForm({ vacancies: Number(event.target.value) || 1 })}
                        />
                      </div>
                      <Textarea
                        label="Tổng quan"
                        rows={3}
                        value={positionEditForm.overview}
                        onChange={(event) => updatePositionEditForm({ overview: event.target.value })}
                      />
                      <Textarea
                        label="Trách nhiệm"
                        rows={4}
                        value={positionEditForm.responsibilities}
                        onChange={(event) => updatePositionEditForm({ responsibilities: event.target.value })}
                      />
                      <Textarea
                        label="Yêu cầu"
                        rows={5}
                        value={positionEditForm.requirements}
                        onChange={(event) => updatePositionEditForm({ requirements: event.target.value })}
                      />
                      <Textarea
                        label="Phúc lợi"
                        rows={3}
                        value={positionEditForm.benefits}
                        onChange={(event) => updatePositionEditForm({ benefits: event.target.value })}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEditPosition}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleAddPosition} isLoading={isSavingPosition}>
                          Save Position
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {selectedCampaignDetail.positions?.map((position) => (
                  <div key={position.id} className="rounded-md border border-border p-3">
                    {editingPositionId === position.id && positionEditForm ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                          <Select
                            label="Employment Type"
                            value={positionEditForm.employmentType}
                            options={employmentTypeOptions}
                            onChange={(event) => updatePositionEditForm({ employmentType: event.target.value })}
                          />
                          <Input
                            className="md:max-w-40"
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
                        {position.overview && (
                          <div className="mt-3">
                            <p className="text-xs font-medium mb-1">Overview</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{position.overview}</p>
                          </div>
                        )}
                        {position.responsibilities && (
                          <div className="mt-3">
                            <p className="text-xs font-medium mb-1">Responsibilities</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{position.responsibilities}</p>
                          </div>
                        )}
                        {position.requirements && (
                          <div className="mt-3">
                            <p className="text-xs font-medium mb-1">Requirements</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{position.requirements}</p>
                          </div>
                        )}
                        {position.benefits && (
                          <div className="mt-3">
                            <p className="text-xs font-medium mb-1">Benefits</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{position.benefits}</p>
                          </div>
                        )}
                        {position.skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {position.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                {!selectedCampaignDetail.positions?.length && <p className="text-sm text-muted-foreground">No positions linked to this campaign.</p>}
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">Thành viên chiến dịch</h3>
                {isMembersLoading && <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-md animate-pulse">Đang tải...</span>}
              </div>
              <div className="space-y-3">
                {members.map((member) => {
                  const memberUser = getMemberUser(member)
                  const isCreator = member.userId === selectedCampaignDetail.createdBy
                  return (
                    <div key={member.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-border p-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{memberUser?.name || memberUser?.email || member.userId}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[memberUser?.email, isCreator ? 'Creator' : undefined].filter(Boolean).join(' - ')}
                        </p>
                      </div>
                      {canManageMembers && !isCreator ? (
                        <div className="w-32">
                          <Select
                            value={member.role}
                            options={memberRoleOptions}
                            onChange={(event) => handleUpdateMemberRole(member.id, event.target.value)}
                          />
                        </div>
                      ) : (
                        <Badge variant="secondary">{isCreator ? 'owner' : member.role}</Badge>
                      )}
                      {canManageMembers && !isCreator && (
                        <Button variant="outline" size="sm" onClick={() => handleRemoveMember(member.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )
                })}
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
                    onChange={(event) => setNewMemberRole(event.target.value as any)}
                  />
                  <Button onClick={handleAddMember} disabled={!newMemberUserId}>
                    Add
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
