import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Alert } from '@/components/ui/alert'
import { useCandidatesStore } from '@/stores/candidates-store'
import { useCampaignsStore } from '@/stores/campaigns-store'
import { CANDIDATE_STAGES, CANDIDATE_STAGE_COLORS, COMMON_SKILLS } from '@/constants'
import { api } from '@/lib/api'
import { formatDate, getInitials } from '@/lib/utils'
import { Check, Download, Search, Upload, Zap, Eye, Phone, Mail } from 'lucide-react'
import type { Candidate, CandidateSearchMode, SemanticCandidateResult } from '@/types'

export function CandidatesPage() {
  const {
    candidates,
    selectedCandidates,
    toggleCandidateSelection,
    loadCandidates,
    uploadCandidate,
    scoreCandidates,
    updateCandidate,
    isLoading,
  } = useCandidatesStore()
  const { campaigns, loadCampaigns } = useCampaignsStore()

  const [searchMode, setSearchMode] = useState<CandidateSearchMode>('criteria')
  const [searchResults, setSearchResults] = useState<SemanticCandidateResult[] | null>(null)
  const [semanticQuery, setSemanticQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isSkillDropdownOpen, setIsSkillDropdownOpen] = useState(false)
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
  })
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isReportDownloading, setIsReportDownloading] = useState(false)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [error, setError] = useState('')
  const [uploadForm, setUploadForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    campaignId: '',
    file: null as File | null,
  })

  useEffect(() => {
    loadCandidates().catch((err) => setError(err instanceof Error ? err.message : 'Could not load candidates'))
    loadCampaigns().catch(() => undefined)
  }, [loadCandidates, loadCampaigns])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!skillDropdownRef.current?.contains(event.target as Node)) {
        setIsSkillDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const displayedCandidates = searchResults ?? candidates

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

  const handleScoreAll = async () => {
    try {
      const candidateIds = selectedCandidates.length > 0 ? selectedCandidates : displayedCandidates.map((candidate) => candidate.id)
      await scoreCandidates(candidateIds)
      setShowScoreModal(false)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not score candidates')
    }
  }

  const handleUpload = async () => {
    if (!uploadForm.firstName || !uploadForm.lastName || !uploadForm.email || !uploadForm.file) {
      alert('Please fill in candidate information and choose a CV')
      return
    }

    const formData = new FormData()
    formData.set('firstName', uploadForm.firstName)
    formData.set('lastName', uploadForm.lastName)
    formData.set('email', uploadForm.email)
    formData.set('phone', uploadForm.phone)
    if (uploadForm.campaignId) formData.set('campaignId', uploadForm.campaignId)
    formData.set('cv', uploadForm.file)

    try {
      await uploadCandidate(formData)
      setUploadForm({ firstName: '', lastName: '', email: '', phone: '', campaignId: '', file: null })
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
    })
  }

  const toOptionalNumber = (value: string) => {
    const trimmed = value.trim()
    return trimmed ? Number(trimmed) : undefined
  }

  const handleCriteriaSearch = async () => {
    setIsSearching(true)
    try {
      const results = await api.candidates.search({
        mode: 'criteria',
        name: criteriaForm.name.trim() || undefined,
        education: criteriaForm.education.trim() || undefined,
        skills: criteriaForm.skills.length ? criteriaForm.skills : undefined,
        skillOperator: criteriaForm.skillOperator,
        stage: criteriaForm.stage ? criteriaForm.stage.toUpperCase() : undefined,
        experienceMin: toOptionalNumber(criteriaForm.experienceMin),
        experienceMax: toOptionalNumber(criteriaForm.experienceMax),
        scoreMin: toOptionalNumber(criteriaForm.scoreMin),
        scoreMax: toOptionalNumber(criteriaForm.scoreMax),
        limit: 100,
      })
      setSearchResults(results)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search candidates')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSemanticSearch = async () => {
    const query = semanticQuery.trim()
    if (!query) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    try {
      const results = await api.candidates.search({ mode: 'semantic', query, limit: 30 })
      setSearchResults(results)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search candidates')
    } finally {
      setIsSearching(false)
    }
  }

  const openCandidateDetail = async (candidateId: string) => {
    setSelectedCandidate(candidateId)
    setDetailCandidate(null)
    setShowDetailModal(true)
    setIsDetailLoading(true)
    try {
      const candidate = await api.candidates.get(candidateId)
      setDetailCandidate(candidate)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load candidate details')
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

  const selectedDetail = detailCandidate ?? candidates.find((candidate) => candidate.id === selectedCandidate)
    ?? searchResults?.find((candidate) => candidate.id === selectedCandidate)
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
  const renderDetailList = (items?: string[]) => (
    items?.length ? (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No data yet</p>
    )
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Candidates</h1>
          <p className="text-muted-foreground">Review and manage candidate profiles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowScoreModal(true)}>
            <Zap className="w-4 h-4" />
            Score All
          </Button>
          <Button className="gap-2" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4" />
            Upload CV
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Action failed" className="mb-6">
          {error}
        </Alert>
      )}

      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="mb-4 flex w-fit rounded-md border border-border p-1">
            {[
              { id: 'criteria', label: 'Criteria' },
              { id: 'semantic', label: 'Semantic' },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSearchMode(mode.id as CandidateSearchMode)}
                className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                  searchMode === mode.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {searchMode === 'criteria' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Input
                  label="Name or Email"
                  placeholder="Jane Nguyen"
                  value={criteriaForm.name}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, name: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleCriteriaSearch()
                  }}
                />
                <Input
                  label="Education"
                  placeholder="Computer Science"
                  value={criteriaForm.education}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, education: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleCriteriaSearch()
                  }}
                />
                <div className="relative w-full" ref={skillDropdownRef}>
                  <div className="mb-2 flex h-5 items-start justify-between gap-2">
                    <label className="text-sm font-medium text-foreground">Skill</label>
                    <div className="-mt-1 flex rounded-md border border-border p-0.5">
                      {[
                        { id: 'or', label: 'OR' },
                        { id: 'and', label: 'AND' },
                      ].map((operator) => (
                        <button
                          key={operator.id}
                          type="button"
                          onClick={() => setCriteriaForm({ ...criteriaForm, skillOperator: operator.id as 'and' | 'or' })}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                            criteriaForm.skillOperator === operator.id
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {operator.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSkillDropdownOpen((open) => !open)}
                    className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={`block w-full overflow-x-auto whitespace-nowrap ${criteriaForm.skills.length ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {criteriaForm.skills.length ? criteriaForm.skills.join(', ') : 'Any Skill'}
                    </span>
                  </button>
                  {isSkillDropdownOpen && (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-background p-1 shadow-lg">
                      {COMMON_SKILLS.map((skill) => {
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
                            className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm hover:bg-muted"
                          >
                            <span>{skill}</span>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <Select
                  label="Stage"
                  options={[
                    { value: '', label: 'Any Stage' },
                    ...Object.entries(CANDIDATE_STAGES).map(([key, value]) => ({ value: key, label: value })),
                  ]}
                  value={criteriaForm.stage}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, stage: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Input
                  label="Experience Min (Years)"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={criteriaForm.experienceMin}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, experienceMin: event.target.value })}
                />
                <Input
                  label="Experience Max (Years)"
                  type="number"
                  min="0"
                  placeholder="10"
                  value={criteriaForm.experienceMax}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, experienceMax: event.target.value })}
                />
                <Input
                  label="Score Min"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="70"
                  value={criteriaForm.scoreMin}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, scoreMin: event.target.value })}
                />
                <Input
                  label="Score Max"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="100"
                  value={criteriaForm.scoreMax}
                  onChange={(event) => setCriteriaForm({ ...criteriaForm, scoreMax: event.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={handleClearFilters}>
                  Clear
                </Button>
                <Button onClick={handleCriteriaSearch} isLoading={isSearching} className="gap-2">
                  <Search className="w-4 h-4" />
                  Search
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  placeholder="React intern with PostgreSQL experience"
                  value={semanticQuery}
                  onChange={(event) => setSemanticQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSemanticSearch()
                  }}
                />
                <Button onClick={handleSemanticSearch} isLoading={isSearching} className="gap-2 md:w-44">
                  <Search className="w-4 h-4" />
                  Search
                </Button>
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" onClick={handleClearFilters}>
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          {searchResults
            ? `Showing ${displayedCandidates.length} ${searchMode} result${displayedCandidates.length === 1 ? '' : 's'}`
            : `Showing ${displayedCandidates.length} candidates`}
          {selectedCandidates.length > 0 && ` - ${selectedCandidates.length} selected`}
          {searchResults && searchMode === 'semantic' && ` - ranked by semantic match`}
        </p>
      </div>

      <div className="space-y-3">
        {isLoading && !searchResults ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Loading candidates...</p>
            </CardContent>
          </Card>
        ) : displayedCandidates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchResults ? 'No candidates matched this search.' : 'No candidates available.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          displayedCandidates.map((candidate) => (
            <Card key={candidate.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-6">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={selectedCandidates.includes(candidate.id)}
                    onChange={() => toggleCandidateSelection(candidate.id)}
                    className="w-4 h-4 rounded"
                  />
                  <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {getInitials(candidate.firstName, candidate.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold truncate">
                        {candidate.firstName} {candidate.lastName}
                      </p>
                      <Badge className={CANDIDATE_STAGE_COLORS[candidate.stage]}>
                        {CANDIDATE_STAGES[candidate.stage]}
                      </Badge>
                      {searchResults && searchMode === 'semantic' && (
                        <Badge variant="secondary">
                          {semanticById.get(candidate.id)?.similarity != null
                            ? `${Math.round((semanticById.get(candidate.id)?.similarity ?? 0) * 100)}% match`
                            : 'keyword match'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <a href={`mailto:${candidate.email}`} className="flex items-center gap-1 hover:text-foreground">
                        <Mail className="w-3 h-3" />
                        {candidate.email}
                      </a>
                      {candidate.phone && (
                        <a href={`tel:${candidate.phone}`} className="flex items-center gap-1 hover:text-foreground">
                          <Phone className="w-3 h-3" />
                          {candidate.phone}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-semibold">{Math.round((candidate.score || 0) * 100)}%</div>
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-primary transition-all" style={{ width: `${(candidate.score || 0) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCandidateDetail(candidate.id)}
                        className="gap-1"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Select
                        options={Object.entries(CANDIDATE_STAGES).map(([key, value]) => ({ value: key, label: value }))}
                        value={candidate.stage}
                        onChange={(event) => handleMoveStage(candidate.id, event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setDetailCandidate(null)
        }}
        title={selectedDetail ? `${selectedDetail.firstName} ${selectedDetail.lastName}` : 'Candidate Details'}
        className="max-w-[50rem] max-h-[90vh] overflow-y-auto"
      >
        {isDetailLoading && (
          <p className="text-sm text-muted-foreground">Loading candidate details...</p>
        )}
        {!isDetailLoading && selectedDetail && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleDownloadReport} isLoading={isReportDownloading} className="gap-2">
                <Download className="w-4 h-4" />
                Export PDF
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">AI Score</p>
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
                <p className="font-medium">{selectedDetail.experience} years</p>
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
                <p className="text-sm font-medium mb-2">Extracted CV Profile</p>
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
                <p className="text-sm font-medium mb-3">AI Screening Report</p>
                <div className="grid gap-3 sm:grid-cols-3 mb-4">
                  {[
                    ['Skills', selectedDetail.screeningResult.skillScore],
                    ['Education', selectedDetail.screeningResult.educationScore],
                    ['Experience', selectedDetail.screeningResult.experienceScore],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-md bg-muted p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-semibold">{Math.round(Number(value))}%</p>
                    </div>
                  ))}
                </div>
                {selectedDetail.screeningResult.explanation && (
                  <p className="text-sm text-muted-foreground mb-4">{selectedDetail.screeningResult.explanation}</p>
                )}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Strengths</p>
                    {renderDetailList(selectedDetail.screeningResult.strengths)}
                  </div>
                  <div>
                    <p className="text-xs uppercase text-muted-foreground mb-2">Weaknesses</p>
                    {renderDetailList(selectedDetail.screeningResult.weaknesses)}
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
        isOpen={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        title="Score Candidates with AI"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowScoreModal(false)}>Cancel</Button>
            <Button onClick={handleScoreAll} isLoading={isLoading} className="gap-2">
              <Zap className="w-4 h-4" />
              Score Now
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This will use AI to score {selectedCandidates.length || displayedCandidates.length} candidate(s) based on available CV and campaign data.
        </p>
      </Modal>

      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload CV"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>Cancel</Button>
            <Button onClick={handleUpload} isLoading={isLoading}>Upload</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" value={uploadForm.firstName} onChange={(event) => setUploadForm({ ...uploadForm, firstName: event.target.value })} />
            <Input label="Last Name" value={uploadForm.lastName} onChange={(event) => setUploadForm({ ...uploadForm, lastName: event.target.value })} />
          </div>
          <Input label="Email" type="email" value={uploadForm.email} onChange={(event) => setUploadForm({ ...uploadForm, email: event.target.value })} />
          <Input label="Phone" value={uploadForm.phone} onChange={(event) => setUploadForm({ ...uploadForm, phone: event.target.value })} />
          <Select
            label="Campaign"
            options={[{ value: '', label: 'No campaign' }, ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))]}
            value={uploadForm.campaignId}
            onChange={(event) => setUploadForm({ ...uploadForm, campaignId: event.target.value })}
          />
          <Input
            label="CV File"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => setUploadForm({ ...uploadForm, file: event.target.files?.[0] ?? null })}
          />
        </div>
      </Modal>
    </div>
  )
}
