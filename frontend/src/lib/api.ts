import { API_BASE_URL } from '@/constants'
import type { ApiResponse, Candidate, CandidateFilters, PublicApplicationForm, PublicInterviewSession, RecruitmentCampaign, SemanticCandidateResult, User, VirtualInterview } from '@/types'

function toBackendEnum(value?: string) {
  return value?.toUpperCase()
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('hrbot_access_token')
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>
  if (!response.ok || payload.success === false) {
    const message = Array.isArray((payload as any).message) ? (payload as any).message.join(', ') : (payload as any).message
    throw new Error(message || payload.error || `Request failed with status ${response.status}`)
  }
  return (payload.data ?? payload) as T
}

async function download(path: string, filename: string) {
  const token = localStorage.getItem('hrbot_access_token')
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE_URL}${path}`, { headers, credentials: 'include' })
  if (!response.ok) throw new Error(`Download failed with status ${response.status}`)

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const api = {
  auth: {
    async login(email: string, password: string) {
      const result = await request<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('hrbot_access_token', result.accessToken)
      return result
    },
    register(email: string, password: string, name: string) {
      return request<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      })
    },
    me() {
      return request<User>('/auth/me')
    },
    logout() {
      localStorage.removeItem('hrbot_access_token')
      return request('/auth/logout', { method: 'POST' })
    },
  },
  campaigns: {
    list: () => request<RecruitmentCampaign[]>('/campaigns'),
    create: (payload: unknown) => request<RecruitmentCampaign>('/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<RecruitmentCampaign>) => {
      const body = {
        title: payload.name,
        deadline: payload.endDate,
        status: toBackendEnum(payload.status),
      }
      return request<RecruitmentCampaign>(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
    },
    remove: (id: string) => request<{ id: string }>(`/campaigns/${id}`, { method: 'DELETE' }),
  },
  candidates: {
    list: (filters: CandidateFilters = {}) => {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.stage) params.set('stage', filters.stage.toUpperCase())
      if (filters.skills?.[0]) params.set('skill', filters.skills[0])
      if (filters.scoreMin !== undefined) params.set('scoreMin', String(filters.scoreMin))
      if (filters.scoreMax !== undefined) params.set('scoreMax', String(filters.scoreMax))
      return request<Candidate[]>(`/candidates?${params}`)
    },
    get: (id: string) => request<Candidate>(`/candidates/${id}`),
    downloadReport: (id: string, filename = 'candidate-evaluation-report.pdf') => download(`/candidates/${id}/report.pdf`, filename),
    upload: (formData: FormData) => request<Candidate>('/candidates/upload', { method: 'POST', body: formData }),
    updateStage: (id: string, stage: string) => request<Candidate>(`/candidates/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: toBackendEnum(stage) }) }),
    score: (candidateIds?: string[], campaignId?: string) => request('/candidates/score', { method: 'POST', body: JSON.stringify({ candidateIds, campaignId }) }),
    publicUpload: (formData: FormData) => request<Candidate>('/candidates/public/upload', { method: 'POST', body: formData }),
  },
  interviews: {
    list: () => request<VirtualInterview[]>('/interviews'),
    create: (payload: unknown) => request<VirtualInterview>('/interviews', { method: 'POST', body: JSON.stringify(payload) }),
    sendInvite: (id: string) => request(`/interviews/${id}/send-invite`, { method: 'POST' }),
    updateStatus: (id: string, status: string) => request(`/interviews/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: toBackendEnum(status) }) }),
    publicFind: (token: string) => request<PublicInterviewSession>(`/interviews/public/${token}`),
    publicSubmit: (token: string, answers: Array<{ questionId: string; answer: string; duration?: number }>) =>
      request(`/interviews/public/${token}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  },
  dashboard: {
    summary: () => request('/dashboard/summary'),
  },
  search: {
    candidates: (query: string, limit = 20) => request<SemanticCandidateResult[]>(`/search/candidates?q=${encodeURIComponent(query)}&limit=${limit}`),
  },
  applicationForms: {
    publicFind: (token: string) => request<PublicApplicationForm>(`/application-forms/public/${token}`),
  },
}
