import React from 'react'
import { Header } from './header'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950/50">
        {children}
      </main>
    </div>
  )
}
