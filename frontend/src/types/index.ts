// User & Auth Types
export type UserRole = 'admin' | 'recruiter'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar?: string
  createdAt: string
}

// Recruitment Campaign Types
export interface RecruitmentCampaign {
  id: string
  name: string
  jobPositionId: string
  startDate: string
  endDate: string
  status: 'active' | 'archived' | 'closed'
  createdBy: string
  createdAt: string
  updatedAt: string
}

// Job Position Types
export interface JobPosition {
  id: string
  title: string
  description: string
  requirements: string[]
  skills: string[]
  seniority: 'junior' | 'mid' | 'senior' | 'lead'
  department: string
  salary?: {
    min: number
    max: number
    currency: string
  }
  createdBy: string
  createdAt: string
}

// Candidate Types
export type CandidateStage = 'applied' | 'screening' | 'virtual_interview' | 'hr_review' | 'test' | 'real_interview' | 'offer' | 'rejected'

export interface Candidate {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  cvUrl: string
  stage: CandidateStage
  score?: number
  skills: string[]
  education: string[]
  gpa?: number
  experience: number // years
  campaignId?: string
  appliedAt: string
  updatedAt: string
  extractedInfo?: {
    education?: string[]
    skills?: string[]
    experience?: string
    [key: string]: any
  }
}

// Virtual Interview Types
export interface VirtualInterview {
  id: string
  candidateIds: string[]
  scheduledAt: string
  interviewLink: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  campaignId?: string
  createdBy: string
  createdAt: string
}

// Filter Types
export interface CandidateFilters {
  skills?: string[]
  education?: string[]
  gpaMin?: number
  gpaMax?: number
  stage?: CandidateStage
  scoreMin?: number
  scoreMax?: number
  search?: string
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}
