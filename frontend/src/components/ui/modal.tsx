import React from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function Modal({ isOpen, onClose, title, children, footer, className }: ModalProps) {
  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className={cn(
            'relative bg-card text-card-foreground rounded-lg shadow-lg w-full mx-4 max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden',
            className ?? 'max-w-lg'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-shrink-0 items-center justify-between p-6 border-b border-border">
            {title && <h2 className="text-lg font-semibold truncate pr-4">{title}</h2>}
            <button
              onClick={onClose}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {children}
          </div>
          {footer && (
            <div className="flex flex-shrink-0 items-center justify-end gap-2 p-6 border-t border-border">
              {footer}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
