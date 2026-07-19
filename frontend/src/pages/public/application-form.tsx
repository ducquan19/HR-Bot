import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { PublicApplicationForm } from '@/types'
import { Briefcase, CheckCircle2, ChevronDown, ChevronRight, Upload, User, FileText, X } from 'lucide-react'

function ProgressStep({ current }: { step?: number; current: number }) {
  const steps = ['Thông tin', 'Vị trí & CV', 'Hoàn tất']
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const idx = i + 1
        const isActive = idx === current
        const isDone = idx < current
        return (
          <div key={idx} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 ${idx > current ? 'opacity-40' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                isDone ? 'bg-green-500 text-white' : isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-gray-200 text-gray-500'
              }`}>
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx}
              </div>
              <span className={`text-sm ${isActive ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-gray-300" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function PublicApplicationFormPage() {
  const { token = '' } = useParams()
  const [form, setForm] = useState<PublicApplicationForm | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [step, setStep] = useState(1)
  const [expandedPositions, setExpandedPositions] = useState<Record<string, boolean>>({})
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [candidate, setCandidate] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    campaignPositionId: '',
    github: '',
    portfolio: '',
    coverLetter: '',
    file: null as File | null,
  })

  useEffect(() => {
    api.applicationForms.publicFind(token)
      .then((data) => {
        setForm(data)
        setCandidate((current) => ({ ...current, campaignPositionId: data.positions[0]?.id ?? '' }))
        setExpandedPositions(data.positions.reduce((acc, position, index) => ({ ...acc, [position.id]: index === 0 }), {}))
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không thể tải form ứng tuyển'))
      .finally(() => setIsLoading(false))
  }, [token])

  const handleSubmit = async () => {
    if (!candidate.firstName || !candidate.lastName || !candidate.email || !candidate.file) {
      setError('Vui lòng điền đầy đủ thông tin và đính kèm CV.')
      return
    }
    const body = new FormData()
    body.set('firstName', candidate.firstName)
    body.set('lastName', candidate.lastName)
    body.set('email', candidate.email)
    body.set('phone', candidate.phone)
    body.set('github', candidate.github)
    body.set('portfolio', candidate.portfolio)
    if (form?.campaign.id) body.set('campaignId', form.campaign.id)
    if (candidate.campaignPositionId) body.set('campaignPositionId', candidate.campaignPositionId)
    body.set('cv', candidate.file)

    setIsSubmitting(true)
    try {
      await api.candidates.publicUpload(body)
      setIsSubmitted(true)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể nộp đơn ứng tuyển')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setCandidate({ ...candidate, file })
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderWidth: '3px' }} />
          <p className="text-gray-500 text-sm">Đang tải thông tin...</p>
        </div>
      </main>
    )
  }

  if (error && !form) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-xl">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <X className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Không thể tải form</h2>
          <p className="text-gray-500 text-sm">{error}</p>
        </div>
      </main>
    )
  }

  if (isSubmitted) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-10 max-w-lg w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-3">Nộp đơn thành công! 🎉</h1>
          <p className="text-gray-500">CV của bạn đã được ghi nhận. Đội tuyển dụng sẽ liên hệ sớm nhất.</p>
          <div className="mt-6 p-4 bg-blue-50 rounded-2xl text-sm text-blue-700">
            AI đang phân tích hồ sơ của bạn — kết quả sẽ được thông báo qua email.
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header Banner */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-gray-900">{form?.campaign.title || 'Ứng tuyển'}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {form?.campaign.department && (
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">{form.campaign.department}</span>
                )}
                {form?.positions.map((position) => (
                  <span key={position.id} className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">{position.title}</span>
                ))}
              </div>
              {form?.campaign.description && (
                <p className="text-gray-500 text-sm mt-2 max-w-2xl">{form.campaign.description}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
        {/* Left: Job descriptions */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Vị trí tuyển dụng</h2>
          {form?.positions.map((position) => (
            <div key={position.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedPositions((current) => ({ ...current, [position.id]: !current[position.id] }))}
              >
                <div>
                  <p className="font-bold text-gray-900">{position.title}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {position.department && <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{position.department}</span>}
                    {position.seniority && <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{position.seniority}</span>}
                    {position.employmentType && <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{position.employmentType}</span>}
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">{position.vacancies} vị trí</span>
                  </div>
                </div>
                <ChevronDown className={`h-5 w-5 text-gray-400 flex-shrink-0 transition-transform ${expandedPositions[position.id] ? 'rotate-180' : ''}`} />
              </button>
              {expandedPositions[position.id] && (
                <div className="px-5 pb-5 pt-2 border-t border-gray-50 space-y-4">
                  {position.overview && (
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Tổng quan</h3>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{position.overview}</p>
                    </div>
                  )}
                  {position.responsibilities && (
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Trách nhiệm</h3>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{position.responsibilities}</p>
                    </div>
                  )}
                  {position.requirements && (
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Yêu cầu</h3>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{position.requirements}</p>
                    </div>
                  )}
                  {position.benefits && (
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Phúc lợi</h3>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{position.benefits}</p>
                    </div>
                  )}
                  {position.skills.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase text-gray-400 mb-2 tracking-wider">Kỹ năng</h3>
                      <div className="flex flex-wrap gap-2">
                        {position.skills.map((skill) => (
                          <span key={skill} className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right: Application form */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Progress */}
            <div className="p-5 border-b border-gray-50 bg-gray-50">
              <ProgressStep step={3} current={step} />
            </div>

            {/* Form body */}
            <div className="p-5">
              {error && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl p-3">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="font-bold text-gray-900">Thông tin cá nhân</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Họ *</label>
                      <input
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                        placeholder="Nguyễn"
                        value={candidate.firstName}
                        onChange={(e) => setCandidate({ ...candidate, firstName: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tên *</label>
                      <input
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                        placeholder="Văn An"
                        value={candidate.lastName}
                        onChange={(e) => setCandidate({ ...candidate, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Email *</label>
                    <input
                      type="email"
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                      placeholder="ten@example.com"
                      value={candidate.email}
                      onChange={(e) => setCandidate({ ...candidate, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">Số điện thoại</label>
                    <input
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                      placeholder="0901 234 567"
                      value={candidate.phone}
                      onChange={(e) => setCandidate({ ...candidate, phone: e.target.value })}
                    />
                  </div>
                  {form?.enabledFields.github && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">GitHub</label>
                      <input
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                        placeholder="github.com/username"
                        value={candidate.github}
                        onChange={(e) => setCandidate({ ...candidate, github: e.target.value })}
                      />
                    </div>
                  )}
                  {form?.enabledFields.portfolio && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Portfolio</label>
                      <input
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                        placeholder="portfolio.io"
                        value={candidate.portfolio}
                        onChange={(e) => setCandidate({ ...candidate, portfolio: e.target.value })}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (!candidate.firstName || !candidate.lastName || !candidate.email) {
                        setError('Vui lòng điền đầy đủ thông tin bắt buộc.')
                        return
                      }
                      setError('')
                      setStep(2)
                    }}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all mt-1"
                  >
                    Tiếp tục →
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-purple-600" />
                    </div>
                    <p className="font-bold text-gray-900">Vị trí & CV</p>
                  </div>

                  {/* Position selector */}
                  {form && form.positions.length > 1 && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-2">Chọn vị trí ứng tuyển *</label>
                      <div className="space-y-2">
                        {form.positions.map((position) => (
                          <button
                            key={position.id}
                            type="button"
                            onClick={() => setCandidate({ ...candidate, campaignPositionId: position.id })}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all ${
                              candidate.campaignPositionId === position.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-200'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{position.title}</p>
                              {position.department && <p className="text-xs text-gray-500">{position.department}</p>}
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                              candidate.campaignPositionId === position.id ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                            }`}>
                              {candidate.campaignPositionId === position.id && (
                                <div className="w-2 h-2 bg-white rounded-full" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CV Drag-Drop Upload */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2">Tải lên CV (PDF/DOCX) *</label>
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                        dragOver ? 'border-blue-500 bg-blue-50' : candidate.file ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="hidden"
                        onChange={(e) => setCandidate({ ...candidate, file: e.target.files?.[0] ?? null })}
                      />
                      {candidate.file ? (
                        <div>
                          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-green-700">{candidate.file.name}</p>
                          <p className="text-xs text-green-600">({(candidate.file.size / 1024).toFixed(0)} KB) — Nhấn để đổi file</p>
                        </div>
                      ) : (
                        <div>
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm font-medium text-gray-600">Kéo thả file vào đây</p>
                          <p className="text-xs text-gray-400 mt-1">hoặc nhấn để chọn file · PDF, DOCX tối đa 10MB</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {form?.enabledFields.coverLetter && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5">Thư xin việc</label>
                      <textarea
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all resize-none"
                        placeholder="Giới thiệu ngắn về bản thân và lý do ứng tuyển..."
                        value={candidate.coverLetter}
                        onChange={(e) => setCandidate({ ...candidate, coverLetter: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setStep(1); setError('') }}
                      className="flex-1 h-11 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl transition-all"
                    >
                      ← Quay lại
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex-[2] h-11 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-blue-200"
                    >
                      {isSubmitting ? (
                        <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang nộp...</>
                      ) : (
                        <><Upload className="w-4 h-4" />Nộp đơn ứng tuyển</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* AI badge */}
            <div className="px-5 pb-5">
              <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2.5">
                <span className="text-base">🤖</span>
                <span>AI sẽ phân tích và chấm điểm CV của bạn ngay sau khi nộp</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
