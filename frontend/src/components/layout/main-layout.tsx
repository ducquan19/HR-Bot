import React from 'react'
import { Header } from './header'
import { useNotifications } from '@/hooks/use-notifications'

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  useNotifications()

  return (
    <div className="flex flex-col h-screen overflow-auto bg-mesh-gradient text-foreground transition-colors duration-500">
      <Header />
      <main className="flex-1 bg-white/20 dark:bg-black/20 backdrop-blur-[2px]">
        {children}
      </main>
    </div>
  )
}
