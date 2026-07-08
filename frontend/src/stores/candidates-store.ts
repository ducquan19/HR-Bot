import { create } from 'zustand'
import { Candidate, CandidateFilters } from '@/types'
import { api } from '@/lib/api'

interface CandidatesState {
  candidates: Candidate[]
  selectedCandidates: string[]
  filters: CandidateFilters
  isLoading: boolean

  setCandidates: (candidates: Candidate[]) => void
  addCandidate: (candidate: Candidate) => void
  loadCandidates: () => Promise<void>
  uploadCandidate: (formData: FormData) => Promise<Candidate>
  scoreCandidates: (candidateIds?: string[], campaignId?: string) => Promise<void>
  updateCandidate: (id: string, candidate: Partial<Candidate>) => Promise<void>
  deleteCandidate: (id: string) => void
  
  setSelectedCandidates: (ids: string[]) => void
  toggleCandidateSelection: (id: string) => void
  
  setFilters: (filters: CandidateFilters) => void
  getFilteredCandidates: () => Candidate[]
  
  setIsLoading: (loading: boolean) => void
}

export const useCandidatesStore = create<CandidatesState>((set, get) => ({
  candidates: [],
  selectedCandidates: [],
  filters: {},
  isLoading: false,

  setCandidates: (candidates) => {
    set({ candidates })
  },

  addCandidate: (candidate) => {
    set((state) => ({ candidates: [...state.candidates, candidate] }))
  },

  loadCandidates: async () => {
    set({ isLoading: true })
    try {
      const candidates = await api.candidates.list(get().filters)
      set({ candidates, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  uploadCandidate: async (formData) => {
    set({ isLoading: true })
    try {
      const candidate = await api.candidates.upload(formData)
      const candidates = await api.candidates.list(get().filters)
      set({ candidates, isLoading: false })
      return candidate
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  scoreCandidates: async (candidateIds, campaignId) => {
    set({ isLoading: true })
    try {
      await api.candidates.score(candidateIds, campaignId)
      const candidates = await api.candidates.list(get().filters)
      set({ candidates, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  updateCandidate: async (id, updates) => {
    const previous = get().candidates
    set((state) => ({
      candidates: state.candidates.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }))
    if (!updates.stage) return
    try {
      const candidate = await api.candidates.updateStage(id, updates.stage)
      set((state) => ({
        candidates: state.candidates.map((c) => (c.id === id ? candidate : c)),
      }))
    } catch (error) {
      set({ candidates: previous })
      throw error
    }
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
