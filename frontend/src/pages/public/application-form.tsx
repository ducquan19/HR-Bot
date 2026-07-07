import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import type { PublicApplicationForm } from '@/types'
import { Briefcase, CheckCircle2, Upload } from 'lucide-react'

export function PublicApplicationFormPage() {
  const { token = '' } = useParams()
  const [form, setForm] = useState<PublicApplicationForm | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
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
        setError('')
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Application form is not available'))
      .finally(() => setIsLoading(false))
  }, [token])

  const handleSubmit = async () => {
    if (!candidate.firstName || !candidate.lastName || !candidate.email || !candidate.file) {
      setError('Please fill in your name, email, and CV file.')
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
      setError(err instanceof Error ? err.message : 'Could not submit application')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <p className="text-muted-foreground">Loading application form...</p>
      </main>
    )
  }

  if (isSubmitted) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-lg w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Application submitted</h1>
            <p className="text-muted-foreground">Your CV has been received. The recruitment team will review it soon.</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold mb-2">{form?.campaign.title || 'Application Form'}</h1>
              <div className="flex flex-wrap gap-2 text-sm">
                {form?.campaign.department && <Badge variant="secondary">{form.campaign.department}</Badge>}
                {form?.positions.map((position) => <Badge key={position.id}>{position.title}</Badge>)}
              </div>
              {form?.campaign.description && <p className="text-muted-foreground mt-4 max-w-3xl">{form.campaign.description}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-6">
          {form?.positions.map((position) => (
            <Card key={position.id}>
              <CardHeader>
                <CardTitle>{position.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {position.overview && <p className="text-sm text-muted-foreground">{position.overview}</p>}
                {position.requirements && (
                  <div>
                    <h2 className="text-sm font-semibold mb-2">Requirements</h2>
                    <p className="text-sm whitespace-pre-wrap">{position.requirements}</p>
                  </div>
                )}
                {position.skills.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {position.skills.map((skill) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Apply Now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <Alert variant="error">{error}</Alert>}
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" value={candidate.firstName} onChange={(event) => setCandidate({ ...candidate, firstName: event.target.value })} />
              <Input label="Last Name" value={candidate.lastName} onChange={(event) => setCandidate({ ...candidate, lastName: event.target.value })} />
            </div>
            <Input label="Email" type="email" value={candidate.email} onChange={(event) => setCandidate({ ...candidate, email: event.target.value })} />
            <Input label="Phone" value={candidate.phone} onChange={(event) => setCandidate({ ...candidate, phone: event.target.value })} />
            {form && form.positions.length > 1 && (
              <Select
                label="Position"
                options={form.positions.map((position) => ({ value: position.id, label: position.title }))}
                value={candidate.campaignPositionId}
                onChange={(event) => setCandidate({ ...candidate, campaignPositionId: event.target.value })}
              />
            )}
            {form?.enabledFields.github && <Input label="GitHub" value={candidate.github} onChange={(event) => setCandidate({ ...candidate, github: event.target.value })} />}
            {form?.enabledFields.portfolio && <Input label="Portfolio" value={candidate.portfolio} onChange={(event) => setCandidate({ ...candidate, portfolio: event.target.value })} />}
            {form?.enabledFields.coverLetter && (
              <Textarea label="Cover Letter" rows={4} value={candidate.coverLetter} onChange={(event) => setCandidate({ ...candidate, coverLetter: event.target.value })} />
            )}
            <Input
              label="CV File"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setCandidate({ ...candidate, file: event.target.files?.[0] ?? null })}
            />
            <Button className="w-full gap-2" onClick={handleSubmit} isLoading={isSubmitting}>
              <Upload className="w-4 h-4" />
              Submit Application
            </Button>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
