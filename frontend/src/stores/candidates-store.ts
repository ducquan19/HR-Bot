import { create } from 'zustand'
import { Candidate, CandidateFilters } from '@/types'
import { mockCandidates } from '@/lib/mock-data'

interface CandidatesState {
  candidates: Candidate[]
  selectedCandidates: string[]
  filters: CandidateFilters
  isLoading: boolean

  setCandidates: (candidates: Candidate[]) => void
  addCandidate: (candidate: Candidate) => void
  updateCandidate: (id: string, candidate: Partial<Candidate>) => void
  deleteCandidate: (id: string) => void
  
  setSelectedCandidates: (ids: string[]) => void
  toggleCandidateSelection: (id: string) => void
  
  setFilters: (filters: CandidateFilters) => void
  getFilteredCandidates: () => Candidate[]
  
  setIsLoading: (loading: boolean) => void
}

export const useCandidatesStore = create<CandidatesState>((set, get) => ({
  candidates: mockCandidates,
  selectedCandidates: [],
  filters: {},
  isLoading: false,

  setCandidates: (candidates) => {
    set({ candidates })
  },

  addCandidate: (candidate) => {
    set((state) => ({ candidates: [...state.candidates, candidate] }))
  },

  updateCandidate: (id, updates) => {
    set((state) => ({
      candidates: state.candidates.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }))
  },

  deleteCandidate: (id) => {
    set((state) => ({
      candidates: state.candidates.filter((c) => c.id !== id),
    }))
  },

  setSelectedCandidates: (ids) => {
    set({ selectedCandidates: ids })
  },

  toggleCandidateSelection: (id) => {
    set((state) => ({
      selectedCandidates: state.selectedCandidates.includes(id)
        ? state.selectedCandidates.filter((cId) => cId !== id)
        : [...state.selectedCandidates, id],
    }))
  },

  setFilters: (filters) => {
    set({ filters })
  },

  getFilteredCandidates: () => {
    const { candidates, filters } = get()
    return candidates.filter((candidate) => {
      if (filters.search) {
        const search = filters.search.toLowerCase()
        if (
          !candidate.firstName.toLowerCase().includes(search) &&
          !candidate.lastName.toLowerCase().includes(search) &&
          !candidate.email.toLowerCase().includes(search)
        ) {
          return false
        }
      }

      if (filters.stage && candidate.stage !== filters.stage) {
        return false
      }

      if (filters.skills && filters.skills.length > 0) {
        const hasSkills = filters.skills.some((skill) =>
          candidate.skills.some((s) => s.toLowerCase().includes(skill.toLowerCase()))
        )
        if (!hasSkills) return false
      }

      if (filters.scoreMin !== undefined && (candidate.score ?? 0) < filters.scoreMin) {
        return false
      }

      if (filters.scoreMax !== undefined && (candidate.score ?? 0) > filters.scoreMax) {
        return false
      }

      return true
    })
  },

  setIsLoading: (loading) => {
    set({ isLoading: loading })
  },
}))
