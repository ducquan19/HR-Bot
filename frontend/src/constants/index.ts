import { CandidateStage } from '@/types'

export const CANDIDATE_STAGES: Record<CandidateStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  virtual_interview: 'Virtual Interview',
  hr_review: 'HR Review',
  test: 'Test',
  real_interview: 'Real Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

export const CANDIDATE_STAGE_COLORS: Record<CandidateStage, string> = {
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  screening: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  virtual_interview: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  hr_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  test: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  real_interview: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  offer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export const SENIORITY_LEVELS = ['junior', 'mid', 'senior', 'lead'] as const

export const COMMON_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Vue.js',
  'Angular',
  'Node.js',
  'Python',
  'Java',
  'C++',
  'Go',
  'Rust',
  'SQL',
  'MongoDB',
  'PostgreSQL',
  'AWS',
  'Docker',
  'Kubernetes',
  'Git',
  'CI/CD',
  'REST API',
]

export const EDUCATION_LEVELS = [
  'High School',
  'Associate Degree',
  'Bachelor',
  'Master',
  'PhD',
]

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const PAGINATION_LIMIT = 10
