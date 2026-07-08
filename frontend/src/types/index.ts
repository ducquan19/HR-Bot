// User & Auth Types
export type UserRole = 'admin' | 'recruiter' | 'hiring_manager'

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
  positions?: CampaignPositionSummary[]
  positionCount?: number
  candidateCount?: number
  startDate: string
  endDate: string
  status: 'draft' | 'active' | 'archived' | 'closed'
  createdBy: string
  createdAt: string
  updatedAt: string
  publicApplicationToken?: string
  publicApplicationUrl?: string
  memberRole?: CampaignMemberRole
  members?: CampaignMember[]
}

export interface CampaignPositionSummary {
  id: string
  positionId: string
  title: string
  department?: string
  seniority?: string
  employmentType?: string
  vacancies: number
  candidateCount: number
  overview?: string
  responsibilities?: string
  requirements?: string
  benefits?: string
  skills: string[]
}

export type CampaignMemberRole = 'owner' | 'editor' | 'viewer'

export interface CampaignMember {
  id: string
  userId: string
  role: CampaignMemberRole
  user?: {
    id: string
    email: string
    name: string
    role: UserRole
    isActive?: boolean
  }
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
  applicationId?: string
  appliedAt: string
  updatedAt: string
  extractedInfo?: {
    education?: string[]
    skills?: string[]
    experience?: string
    [key: string]: any
  }
  screeningResult?: {
    overallScore: number
    skillScore: number
    educationScore: number
    experienceScore: number
    recommendation: 'strong_recommend' | 'recommend' | 'consider' | 'reject'
    strengths: string[]
    weaknesses: string[]
    missingSkills: string[]
    explanation?: string
    updatedAt?: string
  }
}

// Virtual Interview Types
export interface VirtualInterview {
  id: string
  candidateIds: string[]
  candidateId?: string
  scheduledAt: string
  interviewLink: string
  status: 'pending' | 'sent' | 'scheduled' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
  campaignId?: string
  createdBy: string
  createdAt: string
}

export interface PublicApplicationForm {
  id: string
  publicToken: string
  enabledFields: Record<string, boolean>
  campaign: {
    id: string
    title: string
    description?: string
    department?: string
    deadline: string
  }
  positions: Array<{
    id: string
    vacancies: number
    title: string
    department?: string
    seniority?: string
    employmentType: string
    overview?: string
    responsibilities?: string
    requirements?: string
    benefits?: string
    skills: string[]
  }>
}

export interface PublicInterviewQuestion {
  id: string
  order: number
  category?: string
  question: string
}

export interface PublicInterviewSession {
  id: string
  publicToken: string
  meetingUrl: string
  status: 'pending' | 'sent' | 'in_progress' | 'completed' | 'expired' | 'cancelled'
  scheduledAt?: string
  expiresAt: string
  application: {
    candidateProfile: {
      firstName: string
      lastName: string
      email: string
    }
  }
  questions: PublicInterviewQuestion[]
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

export interface SemanticCandidateResult extends Candidate {
  similarity?: number | null
}

export type CandidateSearchMode = 'criteria' | 'semantic'

export interface CandidateSearchPayload {
  mode: CandidateSearchMode
  query?: string
  name?: string
  education?: string
  skill?: string
  skills?: string[]
  skillOperator?: 'and' | 'or'
  stage?: string
  experienceMin?: number
  experienceMax?: number
  scoreMin?: number
  scoreMax?: number
  limit?: number
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
