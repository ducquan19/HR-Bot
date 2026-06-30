import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { useCandidatesStore } from '@/stores/candidates-store'
import { formatDateTime, generateMockId, getInitials } from '@/lib/utils'
import {
  Plus,
  Video,
  Clock,
  CheckCircle2,
  AlertCircle,
  Link2,
  Send,
  Download,
} from 'lucide-react'

interface Interview {
  id: string
  candidateId: string
  scheduledAt: string
  interviewLink: string
  status: 'scheduled' | 'in_progress' | 'completed'
  notes?: string
}

export function InterviewsPage() {
  const candidates = useCandidatesStore((state) => state.candidates)
  const updateCandidate = useCandidatesStore((state) => state.updateCandidate)

  const [interviews, setInterviews] = useState<Interview[]>([
    {
      id: generateMockId(),
      candidateId: '1',
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      interviewLink: 'https://meet.example.com/interview-001',
      status: 'scheduled',
    },
    {
      id: generateMockId(),
      candidateId: '3',
      scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      interviewLink: 'https://meet.example.com/interview-002',
      status: 'scheduled',
    },
  ])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

  const handleScheduleInterview = () => {
    if (!selectedCandidate || !scheduledDate || !scheduledTime) {
      alert('Please fill in all fields')
      return
    }

    const newInterview: Interview = {
      id: generateMockId(),
      candidateId: selectedCandidate,
      scheduledAt: `${scheduledDate}T${scheduledTime}:00`,
      interviewLink: `https://meet.example.com/interview-${generateMockId()}`,
      status: 'scheduled',
    }

    setInterviews([...interviews, newInterview])
    setSelectedCandidate('')
    setScheduledDate('')
    setScheduledTime('')
    setIsModalOpen(false)

    // Move candidate to virtual_interview stage
    updateCandidate(selectedCandidate, { stage: 'virtual_interview' })
  }

  const handleSendInvite = (interview: Interview) => {
    const candidate = candidates.find((c) => c.id === interview.candidateId)
    if (candidate) {
      // In a real app, this would send an email
      alert(`Interview invitation sent to ${candidate.email}`)
    }
  }

  const handleCompleteInterview = (interviewId: string) => {
    setInterviews(
      interviews.map((i) =>
        i.id === interviewId ? { ...i, status: 'completed' } : i
      )
    )

    const interview = interviews.find((i) => i.id === interviewId)
    if (interview) {
      updateCandidate(interview.candidateId, { stage: 'hr_review' })
    }
  }

  const getCandidateName = (candidateId: string) => {
    const candidate = candidates.find((c) => c.id === candidateId)
    return candidate
      ? `${candidate.firstName} ${candidate.lastName}`
      : 'Unknown'
  }

  const getCandidateEmail = (candidateId: string) => {
    const candidate = candidates.find((c) => c.id === candidateId)
    return candidate?.email || ''
  }

  const scheduledInterviews = interviews.filter((i) => i.status === 'scheduled')
  const completedInterviews = interviews.filter((i) => i.status === 'completed')

  const statusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="w-4 h-4 text-orange-600" />
      case 'in_progress':
        return <Video className="w-4 h-4 text-blue-600" />
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      default:
        return null
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Virtual Interviews</h1>
          <p className="text-muted-foreground">Schedule and manage virtual interviews</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Schedule Interview
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledInterviews.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Upcoming interviews</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedInterviews.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Finished interviews</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Video className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{interviews.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All interviews</p>
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Interviews */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Upcoming Interviews</h2>
        {scheduledInterviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No upcoming interviews scheduled</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {scheduledInterviews.map((interview) => (
              <Card key={interview.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                          {getCandidateName(interview.candidateId)
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div>
                          <p className="font-semibold">{getCandidateName(interview.candidateId)}</p>
                          <p className="text-sm text-muted-foreground">{getCandidateEmail(interview.candidateId)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Scheduled For</p>
                          <p className="font-medium">{formatDateTime(interview.scheduledAt)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Interview Link</p>
                          <a
                            href={interview.interviewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Link2 className="w-3 h-3" />
                            Join Interview
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Badge className="flex items-center justify-center gap-1 bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200">
                        {statusIcon(interview.status)}
                        Scheduled
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendInvite(interview)}
                        className="gap-1"
                      >
                        <Send className="w-4 h-4" />
                        Send Invite
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleCompleteInterview(interview.id)}
                        className="gap-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Interviews */}
      {completedInterviews.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Completed Interviews</h2>
          <div className="space-y-4">
            {completedInterviews.map((interview) => (
              <Card key={interview.id} className="opacity-75">
                <CardContent className="py-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">
                          {getCandidateName(interview.candidateId)
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </div>
                        <div>
                          <p className="font-semibold">{getCandidateName(interview.candidateId)}</p>
                          <p className="text-sm text-muted-foreground">{getCandidateEmail(interview.candidateId)}</p>
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Completed
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Interview Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Virtual Interview"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleInterview}>Schedule Interview</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Select Candidate"
            options={candidates.map((c) => ({
              value: c.id,
              label: `${c.firstName} ${c.lastName}`,
            }))}
            value={selectedCandidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
          />

          <Input
            label="Interview Date"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />

          <Input
            label="Interview Time"
            type="time"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
          />

          <Textarea
            label="Notes (Optional)"
            placeholder="Add any notes about this interview..."
            rows={3}
          />
        </div>
      </Modal>
    </div>
  )
}
