import React from 'react'
import { cn } from '@/lib/utils'

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

export const Loader = React.forwardRef<HTMLDivElement, LoaderProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-8 h-8',
      lg: 'w-12 h-12',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex',
          className
        )}
        {...props}
      >
        <div
          className={cn(
            'animate-spin rounded-full border-2 border-muted border-t-primary',
            sizeClasses[size]
          )}
        />
      </div>
    )
  },
)

Loader.displayName = 'Loader'

export function FullPageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <Loader size="lg" className="mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  )
}
