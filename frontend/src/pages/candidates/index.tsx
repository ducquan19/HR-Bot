import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { useCandidatesStore } from '@/stores/candidates-store'
import { CANDIDATE_STAGES, CANDIDATE_STAGE_COLORS, COMMON_SKILLS } from '@/constants'
import { formatDate, getInitials } from '@/lib/utils'
import { Filter, Search, Upload, Zap, Eye, Phone, Mail } from 'lucide-react'

export function CandidatesPage() {
  const {
    candidates,
    filters,
    setFilters,
    getFilteredCandidates,
    selectedCandidates,
    toggleCandidateSelection,
    updateCandidate,
  } = useCandidatesStore()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStage, setSelectedStage] = useState('')
  const [selectedSkill, setSelectedSkill] = useState('')
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [showScoreModal, setShowScoreModal] = useState(false)

  const filteredCandidates = useMemo(() => {
    return getFilteredCandidates().filter((c) => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        if (
          !c.firstName.toLowerCase().includes(search) &&
          !c.lastName.toLowerCase().includes(search) &&
          !c.email.toLowerCase().includes(search)
        ) {
          return false
        }
      }

      if (selectedStage && c.stage !== selectedStage) return false
      if (selectedSkill && !c.skills.some((s) => s.toLowerCase().includes(selectedSkill.toLowerCase()))) {
        return false
      }

      return true
    })
  }, [getFilteredCandidates, searchTerm, selectedStage, selectedSkill])

  const handleMoveStage = (candidateId: string, newStage: string) => {
    updateCandidate(candidateId, { stage: newStage as any })
  }

  const handleScoreAll = () => {
    filteredCandidates.forEach((candidate) => {
      const score = Math.random() * 0.4 + 0.6 // Random score between 0.6 and 1.0
      updateCandidate(candidate.id, { score })
    })
    setShowScoreModal(false)
  }

  const selectedDetail = candidates.find((c) => c.id === selectedCandidate)

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
          <Button className="gap-2">
            <Upload className="w-4 h-4" />
            Upload CV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              options={[
                { value: '', label: 'All Stages' },
                ...Object.entries(CANDIDATE_STAGES).map(([key, value]) => ({
                  value: key,
                  label: value,
                })),
              ]}
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
            />
            <Select
              options={[
                { value: '', label: 'All Skills' },
                ...COMMON_SKILLS.map((skill) => ({ value: skill, label: skill })),
              ]}
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
            />
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              More Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Candidates Count */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Showing {filteredCandidates.length} of {candidates.length} candidates
          {selectedCandidates.length > 0 && ` • ${selectedCandidates.length} selected`}
        </p>
      </div>

      {/* Candidates List */}
      <div className="space-y-3">
        {filteredCandidates.length === 0 ? (
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
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedCandidates.includes(candidate.id)}
                    onChange={() => toggleCandidateSelection(candidate.id)}
                    className="w-4 h-4 rounded"
                  />

                  {/* Avatar & Name */}
                  <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {getInitials(candidate.firstName, candidate.lastName)}
                  </div>

                  {/* Info */}
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
                      <a href={`tel:${candidate.phone}`} className="flex items-center gap-1 hover:text-foreground">
                        <Phone className="w-3 h-3" />
                        {candidate.phone}
                      </a>
                    </div>
                  </div>

                  {/* Score & Skills */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-semibold">{Math.round((candidate.score || 0) * 100)}%</div>
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${(candidate.score || 0) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Skills */}
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

                    {/* Actions */}
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
                        options={Object.entries(CANDIDATE_STAGES).map(([key, value]) => ({
                          value: key,
                          label: value,
                        }))}
                        value={candidate.stage}
                        onChange={(e) => handleMoveStage(candidate.id, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Detail Modal */}
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
                  {selectedDetail.phone}
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
                {selectedDetail.skills.map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-2">Education</p>
              <div className="flex flex-wrap gap-2">
                {selectedDetail.education.map((edu) => (
                  <Badge key={edu} variant="secondary">
                    {edu}
                  </Badge>
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

      {/* Score All Modal */}
      <Modal
        isOpen={showScoreModal}
        onClose={() => setShowScoreModal(false)}
        title="Score Candidates with AI"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowScoreModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleScoreAll} className="gap-2">
              <Zap className="w-4 h-4" />
              Score Now
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will use AI to score {filteredCandidates.length} candidate(s) based on the job description. Scoring typically takes 2-3 minutes.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              The scoring will evaluate: skills match, experience level, education, and overall fit for the position.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
