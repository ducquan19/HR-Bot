import { useEffect, useMemo, useState } from 'react'
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
import { formatDate, getInitials } from '@/lib/utils'
import { Filter, Search, Upload, Zap, Eye, Phone, Mail } from 'lucide-react'

export function CandidatesPage() {
  const {
    candidates,
    selectedCandidates,
    toggleCandidateSelection,
    setFilters,
    getFilteredCandidates,
    loadCandidates,
    uploadCandidate,
    scoreCandidates,
    updateCandidate,
    isLoading,
  } = useCandidatesStore()
  const { campaigns, loadCampaigns } = useCampaignsStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
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

  const filteredCandidates = useMemo(() => {
    return getFilteredCandidates().filter((candidate) => {
      const search = searchTerm.toLowerCase()
      if (
        search &&
        !candidate.firstName.toLowerCase().includes(search) &&
        !candidate.lastName.toLowerCase().includes(search) &&
        !candidate.email.toLowerCase().includes(search)
      ) {
        return false
      }
      if (selectedStage && candidate.stage !== selectedStage) return false
      if (selectedSkill && !candidate.skills.some((skill) => skill.toLowerCase().includes(selectedSkill.toLowerCase()))) return false
      return true
    })
  }, [getFilteredCandidates, searchTerm, selectedStage, selectedSkill])

  const handleMoveStage = async (candidateId: string, newStage: string) => {
    try {
      await updateCandidate(candidateId, { stage: newStage as any })
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update candidate stage')
    }
  }

  const handleScoreAll = async () => {
    try {
      const candidateIds = selectedCandidates.length > 0 ? selectedCandidates : filteredCandidates.map((candidate) => candidate.id)
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
    setSearchTerm('')
    setSelectedStage('')
    setSelectedSkill('')
    setFilters({})
  }

  const selectedDetail = candidates.find((candidate) => candidate.id === selectedCandidate)

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              options={[
                { value: '', label: 'All Stages' },
                ...Object.entries(CANDIDATE_STAGES).map(([key, value]) => ({ value: key, label: value })),
              ]}
              value={selectedStage}
              onChange={(event) => setSelectedStage(event.target.value)}
            />
            <Select
              options={[
                { value: '', label: 'All Skills' },
                ...COMMON_SKILLS.map((skill) => ({ value: skill, label: skill })),
              ]}
              value={selectedSkill}
              onChange={(event) => setSelectedSkill(event.target.value)}
            />
            <Button variant="outline" className="gap-2" onClick={() => setShowMoreFilters((value) => !value)}>
              <Filter className="w-4 h-4" />
              More Filters
            </Button>
          </div>
          {showMoreFilters && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredCandidates.length} of {candidates.length} candidates
          {selectedCandidates.length > 0 && ` • ${selectedCandidates.length} selected`}
        </p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Loading candidates...</p>
            </CardContent>
          </Card>
        ) : filteredCandidates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No candidates found matching your filters.</p>
            </CardContent>
          </Card>
        ) : (
          filteredCandidates.map((candidate) => (
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
                    <div className="flex gap-1 flex-wrap max-w-xs justify-end">
                      {candidate.skills.slice(0, 2).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                      {candidate.skills.length > 2 && (
                        <Badge variant="secondary" className="text-xs">
                          +{candidate.skills.length - 2}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCandidate(candidate.id)
                          setShowDetailModal(true)
                        }}
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
        onClose={() => setShowDetailModal(false)}
        title={selectedDetail ? `${selectedDetail.firstName} ${selectedDetail.lastName}` : 'Candidate Details'}
      >
        {selectedDetail && (
          <div className="space-y-4">
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
              <div className="flex flex-wrap gap-2">
                {selectedDetail.skills.map((skill) => <Badge key={skill}>{skill}</Badge>)}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Education</p>
              <div className="flex flex-wrap gap-2">
                {selectedDetail.education.map((education) => (
                  <Badge key={education} variant="secondary">{education}</Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Applied</p>
              <p className="text-sm">{formatDate(selectedDetail.appliedAt)}</p>
            </div>
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
          This will use AI to score {selectedCandidates.length || filteredCandidates.length} candidate(s) based on available CV and campaign data.
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
