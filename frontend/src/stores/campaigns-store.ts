import { create } from 'zustand'
import { RecruitmentCampaign } from '@/types'
import { api } from '@/lib/api'

interface CampaignsState {
  campaigns: RecruitmentCampaign[]
  isLoading: boolean

  setCampaigns: (campaigns: RecruitmentCampaign[]) => void
  loadCampaigns: () => Promise<void>
  addCampaign: (campaign: RecruitmentCampaign) => void
  createCampaign: (payload: unknown) => Promise<RecruitmentCampaign>
  updateCampaign: (id: string, campaign: Partial<RecruitmentCampaign>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  getCampaignById: (id: string) => RecruitmentCampaign | undefined
  getActiveCampaigns: () => RecruitmentCampaign[]
  
  setIsLoading: (loading: boolean) => void
}

export const useCampaignsStore = create<CampaignsState>((set, get) => ({
  campaigns: [],
  isLoading: false,

  setCampaigns: (campaigns) => {
    set({ campaigns })
  },

  addCampaign: (campaign) => {
    set((state) => ({ campaigns: [...state.campaigns, campaign] }))
  },

  loadCampaigns: async () => {
    set({ isLoading: true })
    try {
      const campaigns = await api.campaigns.list()
      set({ campaigns, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  createCampaign: async (payload) => {
    set({ isLoading: true })
    try {
      const campaign = await api.campaigns.create(payload)
      set((state) => ({ campaigns: [campaign, ...state.campaigns], isLoading: false }))
      return campaign
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  updateCampaign: async (id, updates) => {
    const previous = get().campaigns
    set((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }))
    try {
      const campaign = await api.campaigns.update(id, updates)
      set((state) => ({
        campaigns: state.campaigns.map((c) => (c.id === id ? campaign : c)),
      }))
    } catch (error) {
      set({ campaigns: previous })
      throw error
    }
  },

  deleteCampaign: async (id) => {
    const previous = get().campaigns
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
    }))
    try {
      await api.campaigns.remove(id)
    } catch (error) {
      set({ campaigns: previous })
      throw error
    }
  },

  getCampaignById: (id) => {
    return get().campaigns.find((c) => c.id === id)
  },

  getActiveCampaigns: () => {
    return get().campaigns.filter((c) => c.status === 'active')
  },

  setIsLoading: (loading) => {
    set({ isLoading: loading })
  },
}))
