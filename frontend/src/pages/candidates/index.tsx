import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Alert } from '@/components/ui/alert'
import { useCandidatesStore } from '@/stores/candidates-store'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { useAuth } from '@/hooks/use-auth'
import { CANDIDATE_STAGES, CANDIDATE_STAGE_COLORS, COMMON_SKILLS } from '@/constants'
import { api } from '@/lib/api'
import { formatDate, formatExperienceDuration, getInitials } from '@/lib/utils'
import { Check, ChevronDown, Download, Search, Upload, Eye, Mail, Trash2 } from 'lucide-react'
import { RadarChart } from '@/components/ui/radar-chart'
import type { Candidate, CandidateSearchMode, SemanticCandidateResult } from '@/types'

const CustomFilterDropdown = ({ 
  value, 
  onChange, 
  options, 
  placeholder,
  className 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { label: string; value: string }[]; 
  placeholder: string;
  className?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full h-10 px-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900/60 hover:bg-gray-50 dark:hover:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all shadow-sm"
      >
        <span className="truncate pr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full max-h-60 overflow-y-auto rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-800 shadow-xl py-1.5 animate-in fade-in zoom-in-95 origin-top">
          <button
            type="button"
            className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${!value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}

            onClick={() => { onChange(''); setIsOpen(false); }}
          >
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${value === opt.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


export function CandidatesPage() {
  const {
    candidates,
    loadCandidates,
    uploadCandidate,
    updateCandidate,
    deleteCandidate,
    isLoading,
  } = useCandidatesStore()
  const { campaigns, loadCampaigns } = useCampaignsStore()
  const { isAdmin } = useAuth()

  const [searchMode, setSearchMode] = useState<CandidateSearchMode>('criteria')
  const [searchResults, setSearchResults] = useState<SemanticCandidateResult[] | null>(null)
  const [semanticQuery, setSemanticQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false)
  const [skillSearch, setSkillSearch] = useState('')
  const skillDropdownRef = useRef<HTMLDivElement>(null)
  const [criteriaForm, setCriteriaForm] = useState({
    name: '',
    education: '',
    skills: [] as string[],
    skillOperator: 'or' as 'and' | 'or',
    stage: '',
    experienceMin: '',
    experienceMax: '',
    scoreMin: '',
    scoreMax: '',
    campaignId: '',
  })
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isReportDownloading, setIsReportDownloading] = useState(false)
  const [isCvDownloading, setIsCvDownloading] = useState(false)
  const [stageMoveId, setStageMoveId] = useState<string | null>(null)
  const stageMoveRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [uploadForm, setUploadForm] = useState({
    campaignId: '',
    file: null as File | null,
  })
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'name_asc' | 'date_desc'>('score_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    setCurrentPage(1)
  }, [searchMode, searchResults, criteriaForm, sortBy])

  useEffect(() => {
    loadCandidates().catch((err) => setError(err instanceof Error ? err.message : 'Could not load candidates'))
    loadCampaigns().catch(() => undefined)
  }, [loadCandidates, loadCampaigns])

  useEffect(() => {
    const hasProcessingCandidates = candidates.some((candidate) => isCandidateProcessing(candidate))
    if (!hasProcessingCandidates) return

    const interval = window.setInterval(() => {
      loadCandidates().catch(() => undefined)
    }, 3000)
    return () => window.clearInterval(interval)
  }, [candidates, loadCandidates])

  // Close skill dropdown
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!skillDropdownRef.current?.contains(event.target as Node)) {
        setIsSkillDropdownOpen(false)
      }
      if (!stageMoveRef.current?.contains(event.target as Node)) {
        setStageMoveId(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const rawCandidates = searchResults ?? candidates
  const displayedCandidates = useMemo(() => {
    // In semantic mode with results, preserve AI ranking order
    if (searchMode === 'semantic' && searchResults) return rawCandidates
    return [...rawCandidates].sort((a, b) => {
      if (sortBy === 'score_desc') return (b.score ?? -1) - (a.score ?? -1)
      if (sortBy === 'score_asc') return (a.score ?? -1) - (b.score ?? -1)
      if (sortBy === 'name_asc') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
      // date_desc: newest first (default from API)
      return 0
    })
  }, [rawCandidates, sortBy, searchMode, searchResults])
  const uploadableCampaigns = campaigns.filter((campaign) => campaign.status === 'active')

  const semanticById = useMemo(() => {
    if (searchMode !== 'semantic') return new Map()
    return new Map((searchResults ?? []).map((result) => [result.id, result]))
  }, [searchMode, searchResults])

  const handleMoveStage = async (candidateId: string, newStage: string) => {
    try {
      await updateCandidate(candidateId, { stage: newStage as any })
      setSearchResults((results) => results?.map((candidate) => (
        candidate.id === candidateId ? { ...candidate, stage: newStage as any } : candidate
      )) ?? null)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update candidate stage')
    }
  }

  const handleUpload = async () => {
    if (!uploadForm.campaignId || !uploadForm.file) {
      alert('Please choose a campaign and CV file')
      return
    }

    const formData = new FormData()
    formData.set('campaignId', uploadForm.campaignId)
    formData.set('cv', uploadForm.file)

    try {
      await uploadCandidate(formData)
      setUploadForm({ campaignId: '', file: null })
      setShowUploadModal(false)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload CV')
    }
  }

  const handleClearFilters = () => {
    setSemanticQuery('')
    setSearchResults(null)
    setCriteriaForm({
      name: '',
      education: '',
      skills: [],
      skillOperator: 'or',
      stage: '',
      experienceMin: '',
      experienceMax: '',
      scoreMin: '',
      scoreMax: '',
      campaignId: '',
    })
  }

  const toOptionalNumber = (value: string) => {
    const trimmed = value.trim()
    return trimmed ? Number(trimmed) : undefined
  }

  const handleCriteriaSearch = useCallback(async (formOverride?: typeof criteriaForm) => {
    const form = formOverride || criteriaForm
    // If all fields are empty, reset to show full candidate list
    const isEmpty = !form.name.trim() && !form.education.trim() && !form.skills.length &&
      !form.stage && !form.experienceMin && !form.experienceMax &&
      !form.scoreMin && !form.scoreMax && !form.campaignId
    if (isEmpty) {
      setSearchResults(null)
      setError('')
      return
    }
    setIsSearching(true)
    try {
      const results = await api.candidates.search({
        mode: 'criteria',
        name: form.name.trim() || undefined,
        education: form.education.trim() || undefined,
        skills: form.skills.length ? form.skills : undefined,
        skillOperator: form.skillOperator,
        stage: form.stage ? form.stage.toUpperCase() : undefined,
        experienceMin: toOptionalNumber(form.experienceMin),
        experienceMax: toOptionalNumber(form.experienceMax),
        scoreMin: toOptionalNumber(form.scoreMin),
        scoreMax: toOptionalNumber(form.scoreMax),
        campaignId: form.campaignId || undefined,
        limit: 100,
      })
      setSearchResults(results)
      if (results.length === 0) {
        setError('Không tìm thấy ứng viên nào phù hợp với tiêu chí của bạn.')
      } else {
        setError('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search candidates')
    } finally {
      setIsSearching(false)
    }
  }, [criteriaForm])

  // Debounced realtime search triggered by name field changes
  const triggerDebouncedSearch = useCallback((newForm: typeof criteriaForm) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      handleCriteriaSearch(newForm)
    }, 400)
  }, [handleCriteriaSearch])

  const handleSemanticSearch = async (formOverride?: typeof criteriaForm) => {
    const form = formOverride || criteriaForm
    const query = semanticQuery.trim()
    if (!query) {
      setError('Vui lòng nhập mô tả ứng viên (ít nhất 1 từ khóa) để AI có thể tìm kiếm.')
      return
    }

    setIsSearching(true)
    try {
      const results = await api.candidates.search({
        mode: 'semantic',
        query,
        stage: form.stage ? form.stage.toUpperCase() : undefined,
        campaignId: form.campaignId || undefined,
        limit: 30
      })
      setSearchResults(results)
      if (results.length === 0) {
        setError('Không tìm thấy ứng viên nào phù hợp với yêu cầu của bạn.')
      } else {
        setError('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search candidates')
    } finally {
      setIsSearching(false)
    }
  }

  const handleGlobalFilterChange = (field: 'stage' | 'campaignId', value: string) => {
    const newForm = { ...criteriaForm, [field]: value }
    setCriteriaForm(newForm)
    if (searchMode === 'criteria') {
      handleCriteriaSearch(newForm)
    } else {
      if (semanticQuery.trim()) {
        handleSemanticSearch(newForm)
      } else {
        // If semantic query is empty, we probably shouldn't search, just filter local?
        // Wait, the semantic search requires a query. If there's no query, maybe we just clear results or do nothing.
        // If they haven't searched semantic yet, let's just do nothing.
        if (searchResults) {
           setError('Vui lòng nhập mô tả ứng viên (ít nhất 1 từ khóa) để AI có thể tìm kiếm.')
        }
      }
    }
  }

  const openCandidateDetail = async (candidateId: string) => {
    setSelectedCandidate(candidateId)
    setDetailCandidate(null)
    setDetailError('')
    setShowDetailModal(true)
    setIsDetailLoading(true)
    try {
      const candidate = await api.candidates.get(candidateId)
      setDetailCandidate(candidate)
      setError('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load candidate details'
      setDetailError(msg)
      setError(msg)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!selectedDetail) return
    setIsReportDownloading(true)
    try {
      const name = `${selectedDetail.firstName}-${selectedDetail.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      await api.candidates.downloadReport(selectedDetail.id, `${name || 'candidate'}-evaluation-report.pdf`)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download candidate report')
    } finally {
      setIsReportDownloading(false)
    }
  }

  const handleDownloadCv = async () => {
    if (!selectedDetail) return
    setIsCvDownloading(true)
    try {
      const name = `${selectedDetail.firstName}-${selectedDetail.lastName}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      await api.candidates.downloadCv(selectedDetail.id, `${name || 'candidate'}-cv`)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download candidate CV')
    } finally {
      setIsCvDownloading(false)
    }
  }

  const handleDeleteCandidate = async () => {
    if (!deleteTargetId) return
    setIsDeleting(true)
    try {
      await deleteCandidate(deleteTargetId)
      setSearchResults((results) => results?.filter((candidate) => candidate.id !== deleteTargetId) ?? null)
      if (selectedCandidate === deleteTargetId) {
        setSelectedCandidate(null)
        setDetailCandidate(null)
        setShowDetailModal(false)
      }
      setDeleteTargetId(null)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete candidate')
    } finally {
      setIsDeleting(false)
    }
  }

  const selectedDetail = detailCandidate ?? candidates.find((candidate) => candidate.id === selectedCandidate)
    ?? searchResults?.find((candidate) => candidate.id === selectedCandidate)
  const deleteTarget = candidates.find((candidate) => candidate.id === deleteTargetId)
    ?? searchResults?.find((candidate) => candidate.id === deleteTargetId)
    ?? (selectedDetail?.id === deleteTargetId ? selectedDetail : undefined)
  const extractedInfo = selectedDetail?.extractedInfo ?? {}
  const extractedSummary = typeof extractedInfo.summary === 'string' ? extractedInfo.summary : ''
  const extractedProjects = Array.isArray(extractedInfo.projects) ? extractedInfo.projects : []
  const getProjectTitle = (project: any, index: number) => {
    if (typeof project === 'string') return project
    if (typeof project?.name === 'string' && project.name.trim()) return project.name
    return `Project ${index + 1}`
  }
  const getProjectDescription = (project: any) => {
    if (typeof project === 'string') return ''
    return typeof project?.description === 'string' ? project.description : ''
  }
  const aiScore = selectedDetail?.screeningResult?.overallScore ?? (selectedDetail?.score !== undefined ? selectedDetail.score * 100 : undefined)
  const isPlaceholderEmail = (email?: string) => email?.endsWith('@upload.hrbot.local') ?? false
  const isCandidateProcessing = (candidate: Candidate) => (
    candidate.cvProcessingStatus === 'uploaded' ||
    candidate.cvProcessingStatus === 'queued' ||
    candidate.cvProcessingStatus === 'parsing' ||
    candidate.cvProcessingStatus === 'screening'
  )
  const getProcessingLabel = (candidate: Candidate) => {
    if (candidate.cvProcessingStatus === 'queued' || candidate.cvProcessingStatus === 'uploaded') return 'Waiting to process CV'
    if (candidate.cvProcessingStatus === 'parsing') return 'Parsing CV with AI'
    if (candidate.cvProcessingStatus === 'screening') return 'Scoring with AI'
    if (candidate.cvProcessingStatus === 'failed') return 'CV processing failed'
    return 'Processing CV'
  }
  const renderCandidateContact = (candidate: Candidate) => {
    if (isCandidateProcessing(candidate)) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>{getProcessingLabel(candidate)}</span>
        </div>
      )
    }

    if (candidate.cvProcessingStatus === 'failed') {
      return <span className="text-red-600">{getProcessingLabel(candidate)}</span>
    }

    if (isPlaceholderEmail(candidate.email)) {
      return <span className="text-muted-foreground">Email not found in CV</span>
    }

    return (
      <a href={`mailto:${candidate.email}`} className="flex items-center gap-1 hover:text-foreground">
        <Mail className="w-3 h-3" />
        {candidate.email}
      </a>
    )
  }
  const renderDetailList = (items?: string[]) => (
    items?.length ? (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No data yet</p>
    )
  )
  const renderInsightList = (items?: string[]) => (
    items?.length ? (
      <div className="space-y-2">
        {items.map((item) => {
          const isLong = item.length > 48
          return (
            <div
              key={item}
              className={`break-words bg-muted px-3 py-2 text-sm text-muted-foreground ${
                isLong ? 'rounded-md leading-relaxed' : 'inline-block rounded-full'
              }`}
            >
              {item}
            </div>
          )
        })}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No data yet</p>
    )
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-1">Ứng viên</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Xem và quản lý hồ sơ ứng viên của bạn</p>
        </div>
        {(isAdmin || campaigns.some(c => c.memberRole === 'owner' || c.memberRole === 'editor')) && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-200"
          >
            <Upload className="w-4 h-4" />
            Tải lên CV
          </button>
        )}
      </div>

      {error && (
        <Alert 
          variant={error.includes('Không tìm thấy') || error.includes('Vui lòng') ? 'warning' : 'error'} 
          title={error.includes('Không tìm thấy') || error.includes('Vui lòng') ? 'Thông báo' : 'Đã có lỗi xảy ra'} 
          className="mb-6"
        >
          {error}
        </Alert>
      )}

      {/* ── Filter Panel ── */}
      <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border-gray-100 dark:border-gray-800 border shadow-sm mb-6 overflow-visible relative z-30">
        {/* Mode Switcher */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {([
              { id: 'criteria', label: '🔍 Tìm theo tiêu chí' },
              { id: 'semantic', label: '✨ Tìm thông minh' },
            ] as const).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSearchMode(mode.id as CandidateSearchMode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  searchMode === mode.id
                    ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-400 shadow-sm font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {/* Active filter chips */}
          <div className="flex items-center flex-wrap gap-1.5">
            {criteriaForm.campaignId && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                📁 {campaigns.find(c => c.id === criteriaForm.campaignId)?.name ?? 'Campaign'}
                <button onClick={() => setCriteriaForm({...criteriaForm, campaignId: ''})} className="hover:text-blue-900">×</button>
              </span>
            )}
            {criteriaForm.stage && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full text-xs font-medium">
                {(CANDIDATE_STAGES as Record<string, string>)[criteriaForm.stage] ?? criteriaForm.stage}
                <button onClick={() => setCriteriaForm({...criteriaForm, stage: ''})} className="hover:text-purple-900">×</button>
              </span>
            )}
            {criteriaForm.skills.map(skill => (
              <span key={skill} className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                {skill}
                <button onClick={() => setCriteriaForm({...criteriaForm, skills: criteriaForm.skills.filter(s => s !== skill)})} className="hover:text-green-900">×</button>
              </span>
            ))}
          </div>
        </div>

        {searchMode === 'criteria' ? (
          <div className="p-5 overflow-visible">
            <div className="flex flex-col md:flex-row gap-3 overflow-visible">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 h-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-900/60 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  placeholder="Tên hoặc Email ứng viên"
                  value={criteriaForm.name}
                  onChange={(event) => {
                    const newForm = { ...criteriaForm, name: event.target.value }
                    setCriteriaForm(newForm)
                    triggerDebouncedSearch(newForm)
                  }}
                  onKeyDown={(event) => { if (event.key === 'Enter') handleCriteriaSearch() }}
                />
              </div>
              <input
                className="w-full flex-1 px-3 h-10 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-900/60 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-900 transition-all"
                placeholder="Trình độ học vấn"
                value={criteriaForm.education}
                onChange={(event) => setCriteriaForm({ ...criteriaForm, education: event.target.value })}
                onKeyDown={(event) => { if (event.key === 'Enter') handleCriteriaSearch() }}
              />
              <div className="relative flex-1" ref={skillDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsSkillDropdownOpen((open) => !open)}
                  className="flex h-10 w-full items-center justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-900/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all"
                >
                  <span className={criteriaForm.skills.length ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'}>
                    {criteriaForm.skills.length ? `${criteriaForm.skills.length} skill${criteriaForm.skills.length > 1 ? 's' : ''} chọn` : 'Chọn kỹ năng'}
                  </span>
                  <div className="flex items-center gap-1">
                    <div className="flex gap-0.5 rounded-lg border border-gray-200 p-0.5">
                      {(['or', 'and'] as const).map((op) => (
                        <button
                          key={op}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCriteriaForm({ ...criteriaForm, skillOperator: op }) }}
                          className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
                            criteriaForm.skillOperator === op ? 'bg-blue-600 text-white' : 'text-gray-500'
                          }`}
                        >{op.toUpperCase()}</button>
                      ))}
                    </div>
                    <Check className={`w-3 h-3 ml-1 ${criteriaForm.skills.length ? 'text-blue-600' : 'text-gray-300'}`} />
                  </div>
                </button>
                {isSkillDropdownOpen && (
                  <div className="absolute z-50 mt-1.5 max-h-60 w-full overflow-hidden flex flex-col rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-slate-800 shadow-xl">
                    <div className="flex items-center border-b border-gray-100 dark:border-gray-700 px-3 bg-gray-50/50 dark:bg-slate-900/50">
                      <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
                      <input
                        className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400"
                        placeholder="Tìm kiếm kỹ năng..."
                        value={skillSearch}
                        onChange={(e) => setSkillSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5">
                      {COMMON_SKILLS.filter(skill => skill.toLowerCase().includes(skillSearch.toLowerCase())).length === 0 ? (
                        <p className="py-6 text-center text-sm text-gray-500">Không tìm thấy.</p>
                      ) : (
                        COMMON_SKILLS.filter(skill => skill.toLowerCase().includes(skillSearch.toLowerCase())).map((skill) => {
                          const isSelected = criteriaForm.skills.includes(skill)
                          return (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => {
                                const skills = isSelected
                                  ? criteriaForm.skills.filter((item) => item !== skill)
                                  : [...criteriaForm.skills, skill]
                                setCriteriaForm({ ...criteriaForm, skills })
                              }}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                                isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <span>{skill}</span>
                              {isSelected && <Check className="h-4 w-4 text-blue-600" />}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  Xóa bộ lọc
                </button>
                <button
                  type="button"
                  onClick={() => handleCriteriaSearch()}
                  disabled={isSearching}
                  className="flex items-center gap-2 px-5 py-2 h-10 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-60"
                >
                  {isSearching ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                  Tìm kiếm
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">✨</span>
                <input
                  placeholder="VD: Lập trình viên React intern có kinh nghiệm PostgreSQL..."
                  value={semanticQuery}
                  onChange={(event) => setSemanticQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') handleSemanticSearch() }}
                  className="w-full pl-10 pr-4 h-11 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-900/60 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => handleSemanticSearch()}
                disabled={isSearching}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-200 disabled:opacity-60"
              >
                {isSearching ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
                Tìm AI
              </button>
              {semanticQuery && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-all"
                >
                  ×
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 ml-1">Mô tả ứng viên bạn đang tìm bằng ngôn ngữ tự nhiên. AI sẽ tìm những người phù hợp nhất.</p>
          </div>
        )}

      </div>

      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          {searchResults
            ? `Hiển thị ${displayedCandidates.length} kết quả ${searchMode === 'semantic' ? '· Sắp xếp theo mức độ phù hợp AI' : ''}`
            : `${displayedCandidates.length} ứng viên`}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort control */}
          {!(searchMode === 'semantic' && searchResults) && (
            <CustomFilterDropdown
              className="w-[200px]"
              value={sortBy}
              onChange={(val) => setSortBy(val as typeof sortBy)}
              placeholder="Sắp xếp"
              options={[
                { value: 'score_desc', label: '⬇ Điểm cao nhất' },
                { value: 'score_asc',  label: '⬆ Điểm thấp nhất' },
                { value: 'name_asc',   label: '🔤 Tên A→Z' },
                { value: 'date_desc',  label: '🕐 Mới nhất' },
              ]}
            />
          )}
          <CustomFilterDropdown
            className="w-[180px]"
            value={criteriaForm.stage}
            onChange={(val) => handleGlobalFilterChange('stage', val)}
            placeholder="Tất cả giai đoạn"
            options={Object.entries(CANDIDATE_STAGES).map(([value, label]) => ({ value, label }))}
          />
          <CustomFilterDropdown
            className="w-[200px]"
            value={criteriaForm.campaignId}
            onChange={(val) => handleGlobalFilterChange('campaignId', val)}
            placeholder="Tất cả chiến dịch"
            options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        {isLoading && !searchResults ? (
          <div className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 p-12 text-center">
            <p className="text-gray-400 text-sm">Đang tải ứng viên...</p>
          </div>
        ) : displayedCandidates.length === 0 ? (
          <div className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 p-12 text-center">
            <p className="text-gray-400 text-sm">
              {searchResults ? 'Không tìm thấy ứng viên phù hợp.' : 'Chưa có ứng viên nào.'}
            </p>
          </div>
        ) : (
          (() => {
            const paginatedCandidates = displayedCandidates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
            return (
              <>
                {paginatedCandidates.map((candidate) => {
                  // candidate.score is 0-1 (backend divides overallScore/100)
                  const scoreVal = (candidate.score ?? 0) * 100
                  const scoreColor = scoreVal >= 80 ? 'bg-green-500' : scoreVal >= 60 ? 'bg-blue-500' : 'bg-yellow-500'
                  return (
                    <div key={candidate.id} className="glass-panel rounded-2xl border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-500/50 hover:shadow-md transition-all">
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm">
                    {getInitials(candidate.firstName, candidate.lastName)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {candidate.firstName} {candidate.lastName}
                      </p>
                      {candidate.campaignName && (
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full truncate max-w-[150px]" title={`${candidate.campaignName} - ${candidate.positionName}`}>
                          📁 {candidate.campaignName}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CANDIDATE_STAGE_COLORS[candidate.stage]}`}>
                        {CANDIDATE_STAGES[candidate.stage]}
                      </span>
                      {searchResults && searchMode === 'semantic' && (
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                          {semanticById.get(candidate.id)?.similarity != null
                            ? `${Math.round((semanticById.get(candidate.id)?.similarity ?? 0) * 100)}% match`
                            : 'keyword match'}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {renderCandidateContact(candidate)}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-800 dark:text-gray-100">{Math.round(scoreVal)}%</div>
                    <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mt-1">
                      <div className={`h-full ${scoreColor} rounded-full transition-all`} style={{ width: `${scoreVal}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Độ phù hợp</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openCandidateDetail(candidate.id)}
                      className="w-8 h-8 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center transition-all"
                    >
                      <Eye className="w-4 h-4 text-gray-600" />
                    </button>
                    {(isAdmin || campaigns.find(c => c.id === candidate.campaignId)?.memberRole === 'owner' || campaigns.find(c => c.id === candidate.campaignId)?.memberRole === 'editor') && (
                      <button
                        onClick={() => setDeleteTargetId(candidate.id)}
                        className="w-8 h-8 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 flex items-center justify-center transition-all"
                      >
                        <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600" />
                      </button>
                    )}

                    {/* Stage picker */}
                    <div className="relative" ref={stageMoveId === candidate.id ? stageMoveRef : undefined}>
                      <button
                        onClick={() => setStageMoveId(stageMoveId === candidate.id ? null : candidate.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${CANDIDATE_STAGE_COLORS[candidate.stage]}`}
                      >
                        {CANDIDATE_STAGES[candidate.stage]}
                        <ChevronDown className={`w-3 h-3 transition-transform ${stageMoveId === candidate.id ? 'rotate-180' : ''}`} />
                      </button>

                      {stageMoveId === candidate.id && (
                        <div className="absolute right-0 top-full mt-1.5 z-30 w-52 bg-white rounded-2xl border border-gray-100 shadow-2xl shadow-gray-200 overflow-hidden">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider px-3 pt-3 pb-1.5">Chuyển giai đoạn</p>
                          {(Object.entries(CANDIDATE_STAGES) as [string, string][]).map(([key, label]) => {
                            const isCurrentStage = candidate.stage === key
                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={isCurrentStage}
                                onClick={() => {
                                  handleMoveStage(candidate.id, key)
                                  setStageMoveId(null)
                                }}
                                className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors ${
                                  isCurrentStage
                                    ? 'opacity-50 cursor-default'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(CANDIDATE_STAGE_COLORS as Record<string, string>)[key]}`}>
                                  {label}
                                </span>
                                {isCurrentStage && <Check className="w-3.5 h-3.5 text-gray-400" />}
                              </button>
                            )
                          })}
                          <div className="h-2" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
          }
          {displayedCandidates.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6 px-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, displayedCandidates.length)} trên tổng số {displayedCandidates.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 h-9 px-4"
                >
                  Trước
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(displayedCandidates.length / itemsPerPage) }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === Math.ceil(displayedCandidates.length / itemsPerPage) || Math.abs(p - currentPage) <= 1)
                    .map((p, i, arr) => {
                      if (i > 0 && arr[i] - arr[i - 1] > 1) {
                        return <span key={`ellipsis-${p}`} className="px-2 text-gray-400">...</span>
                      }
                      return (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          className={`w-9 h-9 rounded-xl text-sm font-medium transition-all flex items-center justify-center ${
                            currentPage === p 
                              ? 'bg-blue-600 text-white shadow-sm' 
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(displayedCandidates.length / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil(displayedCandidates.length / itemsPerPage)}
                  className="rounded-xl border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-800 h-9 px-4"
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
          </>
            )
          })()
        )}
      </div>

      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setDetailCandidate(null)
          setDetailError('')
        }}
        title={selectedDetail ? `${selectedDetail.firstName} ${selectedDetail.lastName}` : 'Chi tiết ứng viên'}
        className="w-[min(50rem,calc(100vw-2rem))] max-w-[50rem]"
      >
        {isDetailLoading && (
          <div className="flex items-center justify-center py-16">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
          </div>
        )}
        {!isDetailLoading && detailError && (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.539-1.333-3.309 0L3.172 15c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Không thể tải thông tin</p>
            <p className="text-xs text-gray-400">{detailError}</p>
          </div>
        )}
        {!isDetailLoading && !detailError && selectedDetail && (
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteTargetId(selectedDetail.id)} className="gap-2 text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCv} isLoading={isCvDownloading} className="gap-2">
                <Download className="w-4 h-4" />
                Download CV
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadReport} isLoading={isReportDownloading} className="gap-2">
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Độ phù hợp</p>
                <p className="text-xl font-semibold">{aiScore !== undefined ? `${Math.round(aiScore)}%` : 'N/A'}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Stage</p>
                <Badge className={CANDIDATE_STAGE_COLORS[selectedDetail.stage]}>{CANDIDATE_STAGES[selectedDetail.stage]}</Badge>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Recommendation</p>
                <p className="text-sm font-medium capitalize">
                  {selectedDetail.screeningResult?.recommendation.replace(/_/g, ' ') || 'Not scored'}
                </p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">Applied</p>
                <p className="text-sm font-medium">{formatDate(selectedDetail.appliedAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a href={`mailto:${selectedDetail.email}`} className="text-primary hover:underline">
                  {selectedDetail.email}
                </a>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <a href={`tel:${selectedDetail.phone}`} className="text-primary hover:underline">
                  {selectedDetail.phone || 'N/A'}
                </a>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Experience</p>
                <p className="font-medium">{formatExperienceDuration(selectedDetail.experience)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">GPA</p>
                <p className="font-medium">{selectedDetail.gpa || 'N/A'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Skills</p>
              {renderDetailList(selectedDetail.skills)}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Education</p>
              {renderDetailList(selectedDetail.education)}
            </div>
            {(extractedSummary || extractedProjects.length > 0) && (
              <div className="rounded-md border border-border p-4">
                <p className="text-sm font-medium mb-2">Overview</p>
                {extractedSummary && <p className="text-sm text-muted-foreground mb-3">{extractedSummary}</p>}
                {extractedProjects.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs uppercase text-muted-foreground">Projects</p>
                    {extractedProjects.slice(0, 6).map((project: any, index: number) => {
                      const title = getProjectTitle(project, index)
                      const description = getProjectDescription(project)
                      return (
                        <div key={`${title}-${index}`} className="rounded-md bg-muted p-3">
                          <p className="text-sm font-medium">{title}</p>
                          {description && <p className="text-sm text-muted-foreground">{description}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
            {selectedDetail.screeningResult && (
              <div className="rounded-md border border-border p-4">
                <p className="text-sm font-medium mb-3">Phân tích mức độ phù hợp</p>
                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  {[
                    ['Skills', selectedDetail.screeningResult.skillScore / 100],
                    ['Education', selectedDetail.screeningResult.educationScore / 100],
                    ['Experience', selectedDetail.screeningResult.experienceScore / 100],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-muted p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-semibold">{Math.round(Number(value))}%</p>
                    </div>
                  ))}
                </div>
                
                <div className="mb-4">
                  <RadarChart data={[
                    { subject: 'Skills', A: selectedDetail.screeningResult.skillScore / 100, fullMark: 100 },
                    { subject: 'Education', A: selectedDetail.screeningResult.educationScore / 100, fullMark: 100 },
                    { subject: 'Experience', A: selectedDetail.screeningResult.experienceScore / 100, fullMark: 100 },
                    { subject: 'Overall', A: selectedDetail.screeningResult.overallScore / 100, fullMark: 100 },
                  ]} />
                </div>

                {selectedDetail.screeningResult.explanation && (
                  <p className="text-sm text-muted-foreground mb-4">{selectedDetail.screeningResult.explanation}</p>
                )}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Strengths</p>
                    {renderInsightList(selectedDetail.screeningResult.strengths)}
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Weaknesses</p>
                    {renderInsightList(selectedDetail.screeningResult.weaknesses)}
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Missing Skills</p>
                    {renderDetailList(selectedDetail.screeningResult.missingSkills)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>


      <Modal
        isOpen={Boolean(deleteTargetId)}
        onClose={() => {
          if (!isDeleting) setDeleteTargetId(null)
        }}
        title="Delete Candidate"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)} disabled={isDeleting}>Cancel</Button>
            <Button variant="danger" onClick={handleDeleteCandidate} isLoading={isDeleting} className="gap-2">
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete {deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : 'this candidate'} and all related CV, application, screening, and interview data?
        </p>
      </Modal>

      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Tải lên CV ứng viên"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>Hủy bỏ</Button>
            <Button onClick={handleUpload} isLoading={isLoading}>Tải lên</Button>
          </>
        }
      >
        <div className="space-y-6 py-2">
          <Select
            label="Chiến dịch tuyển dụng"
            options={[{ value: '', label: 'Chọn chiến dịch' }, ...uploadableCampaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))]}
            value={uploadForm.campaignId}
            onChange={(event) => setUploadForm({ ...uploadForm, campaignId: event.target.value })}
          />
          
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Tệp CV (PDF, DOCX)
            </label>
            <div className={`relative flex flex-col items-center justify-center w-full h-44 border-2 border-dashed rounded-xl transition-all duration-200 group ${uploadForm.file ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/30'}`}>
              <input
                id="cv-upload"
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => setUploadForm({ ...uploadForm, file: event.target.files?.[0] ?? null })}
              />
              <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none px-4 text-center">
                {uploadForm.file ? (
                  <>
                    <div className="w-12 h-12 mb-3 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                      <Check className="w-6 h-6" />
                    </div>
                    <p className="mb-1 text-sm font-semibold text-blue-700 truncate max-w-full">
                      {uploadForm.file.name}
                    </p>
                    <p className="text-xs text-blue-500 font-medium mt-1">Nhấn hoặc kéo thả để thay đổi tệp</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 mb-4 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center text-gray-500 group-hover:text-blue-600 transition-colors shadow-sm">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="mb-2 text-sm text-gray-600">
                      <span className="font-semibold text-blue-600">Nhấn để chọn tệp</span> hoặc kéo thả vào khung này
                    </p>
                    <p className="text-xs text-gray-400 font-medium">Hỗ trợ định dạng PDF, DOCX (Tối đa 10MB)</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
