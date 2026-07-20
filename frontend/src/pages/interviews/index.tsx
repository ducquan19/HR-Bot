import { useEffect, useState, useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useCandidatesStore } from '@/stores/candidates-store'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { api } from '@/lib/api'
import type { VirtualInterview } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { Plus, Video, Clock, CheckCircle2, AlertCircle, Send, CheckSquare, Square, BrainCircuit, XCircle, Trash2 } from 'lucide-react'

export function InterviewsPage() {
  const { candidates, loadCandidates } = useCandidatesStore()
  const { campaigns, loadCampaigns } = useCampaignsStore()

  const [interviews, setInterviews] = useState<VirtualInterview[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Bulk Selection for Invites
  const [selectedInterviews, setSelectedInterviews] = useState<string[]>([])
  const [isSendingInvites, setIsSendingInvites] = useState(false)
  const [listCampaignFilter, setListCampaignFilter] = useState('')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')

  // Progress State
  const [isCreating, setIsCreating] = useState(false)
  const [creationProgress, setCreationProgress] = useState(0)

  const loadInterviews = async () => {
    setIsLoading(true)
    try {
      const data = await api.interviews.list()
      setInterviews(data)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load interviews')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadInterviews()
    loadCandidates().catch(() => undefined)
    loadCampaigns().catch(() => undefined)
  }, [loadCandidates, loadCampaigns])

  // Filter candidates who belong to the selected campaign and don't already have an active interview
  const availableCandidates = useMemo(() => {
    if (!selectedCampaignId) return []
    return candidates.filter(c => {
      // Must belong to campaign
      if (c.campaignId !== selectedCampaignId) return false
      // Must not already have a pending/scheduled interview
      const hasInterview = interviews.some(i =>
        (i.candidateId === c.id || i.candidateIds?.includes(c.id)) &&
        ['pending', 'sent', 'in_progress'].includes(i.status)
      )
      return !hasInterview
    })
  }, [candidates, selectedCampaignId, interviews])

  const toggleCandidateSelect = (id: string) => {
    setSelectedCandidateIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    )
  }

  const toggleSelectAllCandidates = () => {
    if (selectedCandidateIds.length === availableCandidates.length) {
      setSelectedCandidateIds([])
    } else {
      setSelectedCandidateIds(availableCandidates.map(c => c.id))
    }
  }

  const handleBulkCreateInterviews = async () => {
    if (selectedCandidateIds.length === 0) {
      alert('Vui lòng chọn ít nhất một ứng viên!')
      return
    }

    setIsCreating(true)
    setCreationProgress(0)

    let successCount = 0
    for (let i = 0; i < selectedCandidateIds.length; i++) {
      const candidateId = selectedCandidateIds[i]
      const candidate = candidates.find(c => c.id === candidateId)
      try {
        await api.interviews.create({
          candidateId,
          applicationId: candidate?.applicationId,
          scheduledAt: scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString() : undefined,
          notes,
        })
        successCount++
      } catch (err) {
        console.error('Failed to create interview for candidate', candidateId, err)
      }
      setCreationProgress(Math.round(((i + 1) / selectedCandidateIds.length) * 100))
    }

    setIsCreating(false)
    if (successCount > 0) {
      setIsModalOpen(false)
      setSelectedCandidateIds([])
      setScheduledDate('')
      setScheduledTime('')
      setNotes('')
      await loadInterviews()
      await loadCandidates()
    } else {
      alert('Đã có lỗi xảy ra, không thể tạo bất kỳ phiên phỏng vấn nào.')
    }
  }

  const toggleInterviewSelect = (id: string) => {
    setSelectedInterviews(prev =>
      prev.includes(id) ? prev.filter(iId => iId !== id) : [...prev, id]
    )
  }

  const handleBulkSendInvites = async () => {
    if (selectedInterviews.length === 0) return
    setIsSendingInvites(true)

    for (const interviewId of selectedInterviews) {
      try {
        await api.interviews.sendInvite(interviewId)
      } catch (err) {
        console.error('Failed to send invite for', interviewId, err)
      }
    }

    await loadInterviews()
    setSelectedInterviews([])
    setIsSendingInvites(false)
  }

  const handleCompleteInterview = async (interviewId: string) => {
    setIsLoading(true)
    try {
      await api.interviews.updateStatus(interviewId, 'completed')
      await loadInterviews()
      setSelectedInterviews(prev => prev.filter(id => id !== interviewId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete interview')
    } finally {
      setIsLoading(false)
    }
  }

  const getCandidateId = (interview: VirtualInterview) => interview.candidateId || interview.candidateIds[0]
  const getCandidate = (interview: VirtualInterview) => candidates.find((candidate) => candidate.id === getCandidateId(interview))
  const getCandidateName = (interview: VirtualInterview) => {
    const candidate = getCandidate(interview)
    return candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Không xác định'
  }
  const getCandidateEmail = (interview: VirtualInterview) => getCandidate(interview)?.email || ''

  const scheduledStatuses = ['pending', 'sent', 'in_progress']
  const scheduledInterviews = interviews.filter((interview) =>
    scheduledStatuses.includes(interview.status) &&
    (listCampaignFilter
      ? (listCampaignFilter === 'none' ? !interview.campaignId : interview.campaignId === listCampaignFilter)
      : true)
  )
  const completedInterviews = interviews.filter((interview) =>
    interview.status === 'completed' &&
    (listCampaignFilter
      ? (listCampaignFilter === 'none' ? !interview.campaignId : interview.campaignId === listCampaignFilter)
      : true)
  )



  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-2">Phỏng vấn ảo</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Quản lý các phòng phỏng vấn trực tuyến tích hợp AI & WebRTC.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <SearchableSelect
            value={listCampaignFilter}
            onChange={setListCampaignFilter}
            options={[
              { value: '', label: 'Tất cả chiến dịch' },
              { value: 'none', label: 'Không thuộc chiến dịch nào' },
              ...campaigns.map(c => ({ value: c.id, label: c.name }))
            ]}
            className="w-full sm:w-72"
          />
          <button
            onClick={() => {
              setSelectedCampaignId('')
              setIsModalOpen(true)
            }}
            className="flex items-center justify-center gap-2 px-5 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-200 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tạo phòng phỏng vấn
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Stats Row — compact pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { title: 'Sắp tới', value: scheduledInterviews.length, icon: Clock, bgColor: 'bg-orange-50 dark:bg-orange-900/20', borderColor: 'border-orange-100 dark:border-orange-800/40', iconColor: 'text-orange-500 dark:text-orange-400', valueColor: 'text-orange-600 dark:text-orange-300' },
          { title: 'Đã hoàn thành', value: completedInterviews.length, icon: CheckCircle2, bgColor: 'bg-emerald-50 dark:bg-emerald-900/20', borderColor: 'border-emerald-100 dark:border-emerald-800/40', iconColor: 'text-emerald-500 dark:text-emerald-400', valueColor: 'text-emerald-600 dark:text-emerald-300' },
          { title: 'Tổng cộng', value: interviews.length, icon: Video, bgColor: 'bg-blue-50 dark:bg-blue-900/20', borderColor: 'border-blue-100 dark:border-blue-800/40', iconColor: 'text-blue-500 dark:text-blue-400', valueColor: 'text-blue-600 dark:text-blue-300' },
        ].map((stat, idx) => {
          const Icon = stat.icon
          return (
            <div key={idx} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border ${stat.bgColor} ${stat.borderColor} transition-all hover:shadow-sm`}>
              <Icon className={`w-4 h-4 flex-shrink-0 ${stat.iconColor}`} />
              <span className={`text-xl font-black leading-none ${stat.valueColor}`}>{stat.value}</span>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</span>
            </div>
          )
        })}
      </div>

      {/* Bulk Action Bar */}
      {selectedInterviews.length > 0 && (
        <div className="bg-indigo-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg sticky top-6 z-10 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 font-bold text-sm">
              {selectedInterviews.length}
            </span>
            <span className="font-medium text-sm">phòng phỏng vấn đang được chọn</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedInterviews([])}
              className="px-4 py-2 text-sm font-medium text-indigo-200 hover:text-white transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={handleBulkSendInvites}
              disabled={isSendingInvites}
              className="flex items-center gap-2 bg-white text-indigo-900 px-5 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-indigo-50 transition-colors disabled:opacity-70"
            >
              {isSendingInvites ? <span className="w-4 h-4 border-2 border-indigo-900/30 border-t-indigo-900 rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              Gửi Email
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">Danh sách phỏng vấn sắp tới</h2>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto justify-end">
            {scheduledInterviews.length > 0 && (
              <button
                onClick={() => {
                  if (selectedInterviews.length === scheduledInterviews.length) setSelectedInterviews([])
                  else setSelectedInterviews(scheduledInterviews.map(i => i.id))
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                {selectedInterviews.length === scheduledInterviews.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </button>
            )}
          </div>
        </div>

        {isLoading && interviews.length === 0 ? (
          <div className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 p-12 text-center text-gray-400">Đang tải...</div>
        ) : scheduledInterviews.length === 0 ? (
          <div className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">Chưa có lịch phỏng vấn nào sắp tới.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {scheduledInterviews.map((interview) => {
              const isSelected = selectedInterviews.includes(interview.id)
              return (
                <div
                  key={interview.id}
                  className={`glass-panel rounded-2xl border-2 transition-all p-5 relative overflow-hidden group cursor-pointer ${
                    isSelected ? 'border-blue-500 shadow-md shadow-blue-100' : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                  }`}
                  onClick={() => toggleInterviewSelect(interview.id)}
                >
                  <div className="absolute top-4 right-4">
                    {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-gray-300 group-hover:text-gray-400" />}
                  </div>

                  <div className="flex items-center gap-3 mb-4 pr-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 rounded-xl flex items-center justify-center text-lg font-bold border border-blue-100">
                      {getCandidateName(interview).charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white truncate" title={getCandidateName(interview)}>{getCandidateName(interview)}</p>
                      <p className="text-xs text-gray-500 truncate mb-1">{getCandidateEmail(interview)}</p>
                      {interview.campaignId && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {campaigns.find(c => c.id === interview.campaignId)?.name || 'Chiến dịch'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-700">{formatDateTime(interview.scheduledAt)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className={`capitalize ${interview.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {interview.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                    <a href={interview.interviewLink} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-semibold rounded-xl transition-colors border border-gray-200 dark:border-gray-700">
                      <Video className="w-4 h-4 text-blue-600" />
                      Vào phòng phỏng vấn
                    </a>
                    {interview.status !== 'sent' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); api.interviews.sendInvite(interview.id).then(() => loadInterviews()) }}
                        className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-xl transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Gửi Email
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCompleteInterview(interview.id) }}
                      className="flex items-center justify-center gap-2 w-full py-2 text-gray-500 hover:bg-green-50 hover:text-green-600 text-sm font-semibold rounded-xl transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Đánh dấu Hoàn thành
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); api.interviews.cancel(interview.id).then(() => loadInterviews()) }}
                      className="flex items-center justify-center gap-2 w-full py-2 text-gray-500 hover:bg-orange-50 hover:text-orange-600 text-sm font-semibold rounded-xl transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Hủy phỏng vấn
                    </button>
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (confirm('Bạn có chắc chắn muốn xóa phòng phỏng vấn này?')) {
                          api.interviews.remove(interview.id).then(() => loadInterviews()) 
                        }
                      }}
                      className="flex items-center justify-center gap-2 w-full py-2 text-gray-500 hover:bg-red-50 hover:text-red-600 text-sm font-semibold rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Xóa
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {completedInterviews.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Đã hoàn thành</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {completedInterviews.map((interview) => (
              <div key={interview.id} className="bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-200 dark:border-gray-800 p-4 opacity-75">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{getCandidateName(interview)}</p>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500">{formatDateTime(interview.scheduledAt)}</p>
                  <Badge className="bg-gray-200 text-gray-600 border-none">Completed</Badge>
                </div>
                {interview.campaignId && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 mt-1">
                    {campaigns.find(c => c.id === interview.campaignId)?.name || 'Chiến dịch'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => !isCreating && setIsModalOpen(false)}
        title="Tạo phòng phỏng vấn ảo hàng loạt"
        footer={
          !isCreating && (
            <>
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Hủy</button>
              <button
                onClick={handleBulkCreateInterviews}
                disabled={selectedCandidateIds.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-200 disabled:opacity-50"
              >
                <BrainCircuit className="w-4 h-4" />
                Tạo link & AI Questions
              </button>
            </>
          )
        }
      >
        <div className="space-y-5">
          {isCreating ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <BrainCircuit className="w-8 h-8 text-blue-600 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Đang thiết lập phòng phỏng vấn...</h3>
              <p className="text-sm text-gray-500 mb-6">AI đang phân tích CV để sinh ra các câu hỏi chuyên sâu phù hợp với từng ứng viên.</p>

              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${creationProgress}%` }}
                />
              </div>
              <p className="text-xs font-bold text-blue-600 mt-2">{creationProgress}% Hoàn tất</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">1. Chọn Chiến dịch</label>
                <SearchableSelect
                  options={[{ value: '', label: '-- Chọn chiến dịch --' }, ...campaigns.map(c => ({ value: c.id, label: c.name }))]}
                  value={selectedCampaignId}
                  onChange={(value) => {
                    setSelectedCampaignId(value)
                    setSelectedCandidateIds([])
                  }}
                  className="w-full"
                />
              </div>

              {selectedCampaignId && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-700">2. Chọn Ứng viên</label>
                    <button
                      type="button"
                      onClick={toggleSelectAllCandidates}
                      className="text-xs font-medium text-blue-600"
                    >
                      {selectedCandidateIds.length === availableCandidates.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto bg-gray-50">
                    {availableCandidates.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500">
                        Không có ứng viên nào khả dụng hoặc tất cả đã được lên lịch.
                      </div>
                    ) : (
                      availableCandidates.map(c => (
                        <div
                          key={c.id}
                          onClick={() => toggleCandidateSelect(c.id)}
                          className="flex items-center gap-3 p-3 border-b border-gray-100 last:border-0 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          {selectedCandidateIds.includes(c.id) ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-gray-300" />
                          )}
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{c.firstName} {c.lastName}</p>
                            <p className="text-xs text-gray-500">{c.email}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày dự kiến (Tuỳ chọn)</label>
                  <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Giờ dự kiến (Tuỳ chọn)</label>
                  <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Ghi chú (Tùy chọn)</label>
                <Textarea placeholder="Thêm lời nhắn cho ứng viên..." rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" />
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
