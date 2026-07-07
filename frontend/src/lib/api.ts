import { API_BASE_URL } from '@/constants'
import type { ApiResponse, Candidate, CandidateFilters, RecruitmentCampaign, User, VirtualInterview } from '@/types'

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
    throw new Error(payload.error || `Request failed with status ${response.status}`)
  }
  return (payload.data ?? payload) as T
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
    upload: (formData: FormData) => request<Candidate>('/candidates/upload', { method: 'POST', body: formData }),
    updateStage: (id: string, stage: string) => request<Candidate>(`/candidates/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage: toBackendEnum(stage) }) }),
    score: (candidateIds?: string[], campaignId?: string) => request('/candidates/score', { method: 'POST', body: JSON.stringify({ candidateIds, campaignId }) }),
  },
  interviews: {
    list: () => request<VirtualInterview[]>('/interviews'),
    create: (payload: unknown) => request<VirtualInterview>('/interviews', { method: 'POST', body: JSON.stringify(payload) }),
    sendInvite: (id: string) => request(`/interviews/${id}/send-invite`, { method: 'POST' }),
    updateStatus: (id: string, status: string) => request(`/interviews/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: toBackendEnum(status) }) }),
  },
  dashboard: {
    summary: () => request('/dashboard/summary'),
  },
}
