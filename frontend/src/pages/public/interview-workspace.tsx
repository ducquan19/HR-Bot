import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import type { PublicInterviewSession } from '@/types'
import { CheckCircle2, Clock, Send, Video } from 'lucide-react'

export function PublicInterviewWorkspacePage() {
  const { token = '' } = useParams()
  const storageKey = `hrbot_interview_draft_${token}`
  const [session, setSession] = useState<PublicInterviewSession | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [startedAt, setStartedAt] = useState(Date.now())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.interviews.publicFind(token)
      .then((data) => {
        setSession(data)
        const saved = localStorage.getItem(storageKey)
        if (saved) setAnswers(JSON.parse(saved) as Record<string, string>)
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Interview link is invalid or expired'))
      .finally(() => setIsLoading(false))
  }, [storageKey, token])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(answers))
    const id = window.setInterval(() => localStorage.setItem(storageKey, JSON.stringify(answers)), 30000)
    return () => window.clearInterval(id)
  }, [answers, storageKey])

  const questions = session?.questions ?? []
  const question = questions[currentIndex]
  const candidateName = session ? `${session.application.candidateProfile.firstName} ${session.application.candidateProfile.lastName}` : ''
  const answeredCount = useMemo(() => questions.filter((item) => answers[item.id]?.trim()).length, [answers, questions])

  const submit = async () => {
    if (!session) return
    if (answeredCount < questions.length && !window.confirm('Some questions are unanswered. Submit anyway?')) return

    setIsSubmitting(true)
    try {
      const duration = Math.round((Date.now() - startedAt) / 1000)
      await api.interviews.publicSubmit(token, questions.map((item) => ({
        questionId: item.id,
        answer: answers[item.id] ?? '',
        duration,
      })))
      localStorage.removeItem(storageKey)
      setIsSubmitted(true)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit interview')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">Loading interview...</p>
      </main>
    )
  }

  if (isSubmitted || session?.status === 'completed') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Interview submitted</h1>
            <p className="text-muted-foreground">Thank you. Your responses have been sent to the recruitment team.</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Virtual Interview</h1>
              <p className="text-sm text-muted-foreground">{candidateName}</p>
            </div>
          </div>
          <Badge className="gap-1">
            <Clock className="w-3 h-3" />
            {answeredCount}/{questions.length} answered
          </Badge>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 py-8">
        {error && <Alert variant="error" className="mb-6">{error}</Alert>}
        {!session || !question ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">No interview questions are available.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {questions.map((item, index) => (
                  <Button
                    key={item.id}
                    variant={index === currentIndex ? 'primary' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => {
                      setCurrentIndex(index)
                      setStartedAt(Date.now())
                    }}
                  >
                    {item.order}. {answers[item.id]?.trim() ? 'Answered' : 'Question'}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Question {question.order}</CardTitle>
                  {question.category && <Badge variant="secondary">{question.category}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-lg leading-relaxed">{question.question}</p>
                <Textarea
                  rows={12}
                  value={answers[question.id] ?? ''}
                  onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}
                  placeholder="Type your answer here..."
                />
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}>
                    Previous
                  </Button>
                  <div className="flex gap-3">
                    {currentIndex < questions.length - 1 ? (
                      <Button onClick={() => setCurrentIndex((value) => Math.min(questions.length - 1, value + 1))}>
                        Next
                      </Button>
                    ) : (
                      <Button onClick={submit} isLoading={isSubmitting} className="gap-2">
                        <Send className="w-4 h-4" />
                        Submit Interview
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </main>
  )
}
