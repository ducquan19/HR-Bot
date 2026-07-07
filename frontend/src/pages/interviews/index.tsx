import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
import { useCandidatesStore } from '@/stores/candidates-store'
import { api } from '@/lib/api'
import type { VirtualInterview } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { Plus, Video, Clock, CheckCircle2, AlertCircle, Link2, Send } from 'lucide-react'

export function InterviewsPage() {
  const { candidates, loadCandidates } = useCandidatesStore()
  const [interviews, setInterviews] = useState<VirtualInterview[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')

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
  }, [loadCandidates])

  const handleScheduleInterview = async () => {
    if (!selectedCandidate || !scheduledDate || !scheduledTime) {
      alert('Please fill in all fields')
      return
    }

    setIsLoading(true)
    try {
      await api.interviews.create({
        candidateId: selectedCandidate,
        scheduledAt: new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString(),
        notes,
      })
      setSelectedCandidate('')
      setScheduledDate('')
      setScheduledTime('')
      setNotes('')
      setIsModalOpen(false)
      await loadInterviews()
      await loadCandidates()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule interview')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendInvite = async (interview: VirtualInterview) => {
    setIsLoading(true)
    try {
      await api.interviews.sendInvite(interview.id)
      await loadInterviews()
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invitation')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteInterview = async (interviewId: string) => {
    setIsLoading(true)
    try {
      await api.interviews.updateStatus(interviewId, 'completed')
      await loadInterviews()
      setError('')
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
    return candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown'
  }
  const getCandidateEmail = (interview: VirtualInterview) => getCandidate(interview)?.email || ''

  const scheduledStatuses = ['pending', 'sent', 'scheduled', 'in_progress']
  const scheduledInterviews = interviews.filter((interview) => scheduledStatuses.includes(interview.status))
  const completedInterviews = interviews.filter((interview) => interview.status === 'completed')

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />
      case 'in_progress':
        return <Video className="w-4 h-4 text-blue-600" />
      default:
        return <Clock className="w-4 h-4 text-orange-600" />
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

      {error && (
        <Alert variant="error" title="Action failed" className="mb-6">
          {error}
        </Alert>
      )}

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

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Upcoming Interviews</h2>
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Loading interviews...</CardContent>
          </Card>
        ) : scheduledInterviews.length === 0 ? (
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
                          {getCandidateName(interview).split(' ').map((name) => name[0]).join('')}
                        </div>
                        <div>
                          <p className="font-semibold">{getCandidateName(interview)}</p>
                          <p className="text-sm text-muted-foreground">{getCandidateEmail(interview)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Scheduled For</p>
                          <p className="font-medium">{formatDateTime(interview.scheduledAt)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Interview Link</p>
                          <a href={interview.interviewLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            Join Interview
                          </a>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge className="flex items-center justify-center gap-1 bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200 capitalize">
                        {statusIcon(interview.status)}
                        {interview.status.replace('_', ' ')}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => handleSendInvite(interview)} isLoading={isLoading} className="gap-1">
                        <Send className="w-4 h-4" />
                        Send Invite
                      </Button>
                      <Button size="sm" onClick={() => handleCompleteInterview(interview.id)} isLoading={isLoading} className="gap-1">
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

      {completedInterviews.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">Completed Interviews</h2>
          <div className="space-y-4">
            {completedInterviews.map((interview) => (
              <Card key={interview.id} className="opacity-75">
                <CardContent className="py-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{getCandidateName(interview)}</p>
                      <p className="text-sm text-muted-foreground">{getCandidateEmail(interview)}</p>
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Virtual Interview"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleScheduleInterview} isLoading={isLoading}>Schedule Interview</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Select Candidate"
            options={candidates.map((candidate) => ({ value: candidate.id, label: `${candidate.firstName} ${candidate.lastName}` }))}
            value={selectedCandidate}
            onChange={(event) => setSelectedCandidate(event.target.value)}
          />
          <Input label="Interview Date" type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
          <Input label="Interview Time" type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} />
          <Textarea label="Notes (Optional)" placeholder="Add any notes about this interview..." rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
