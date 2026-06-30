import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { FullPageLoader } from '@/components/ui/loader'

// Auth Pages
const LoginPage = React.lazy(() => import('@/pages/auth/login').then(m => ({ default: m.LoginPage })))

// Dashboard Pages
const DashboardPage = React.lazy(() => import('@/pages/dashboard').then(m => ({ default: m.DashboardPage })))
const CampaignsPage = React.lazy(() => import('@/pages/campaigns').then(m => ({ default: m.CampaignsPage })))
const CandidatesPage = React.lazy(() => import('@/pages/candidates').then(m => ({ default: m.CandidatesPage })))
const InterviewsPage = React.lazy(() => import('@/pages/interviews').then(m => ({ default: m.InterviewsPage })))
const SettingsPage = React.lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })))

// Other Pages
const NotFoundPage = React.lazy(() => import('@/pages/not-found').then(m => ({ default: m.NotFoundPage })))

const ProtectedRoute = ({ element }: { element: React.ReactNode }) => (
  <MainLayout>
    <React.Suspense fallback={<FullPageLoader />}>
      {element}
    </React.Suspense>
  </MainLayout>
)

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/dashboard" element={<ProtectedRoute element={<DashboardPage />} />} />
      <Route path="/campaigns" element={<ProtectedRoute element={<CampaignsPage />} />} />
      <Route path="/candidates" element={<ProtectedRoute element={<CandidatesPage />} />} />
      <Route path="/interviews" element={<ProtectedRoute element={<InterviewsPage />} />} />
      <Route path="/settings" element={<ProtectedRoute element={<SettingsPage />} />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
