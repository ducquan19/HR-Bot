import { create } from 'zustand'
import { RecruitmentCampaign } from '@/types'
import { mockRecruitmentCampaigns } from '@/lib/mock-data'

interface CampaignsState {
  campaigns: RecruitmentCampaign[]
  isLoading: boolean

  setCampaigns: (campaigns: RecruitmentCampaign[]) => void
  addCampaign: (campaign: RecruitmentCampaign) => void
  updateCampaign: (id: string, campaign: Partial<RecruitmentCampaign>) => void
  deleteCampaign: (id: string) => void
  getCampaignById: (id: string) => RecruitmentCampaign | undefined
  getActiveCampaigns: () => RecruitmentCampaign[]
  
  setIsLoading: (loading: boolean) => void
}

export const useCampaignsStore = create<CampaignsState>((set, get) => ({
  campaigns: mockRecruitmentCampaigns,
  isLoading: false,

  setCampaigns: (campaigns) => {
    set({ campaigns })
  },

  addCampaign: (campaign) => {
    set((state) => ({ campaigns: [...state.campaigns, campaign] }))
  },

  updateCampaign: (id, updates) => {
    set((state) => ({
      campaigns: state.campaigns.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    }))
  },

  deleteCampaign: (id) => {
    set((state) => ({
      campaigns: state.campaigns.filter((c) => c.id !== id),
    }))
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
