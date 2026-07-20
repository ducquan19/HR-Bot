import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import Lottie from 'lottie-react'

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
  const [lottieData, setLottieData] = useState<any>(null)

  useEffect(() => {
    fetch('https://assets3.lottiefiles.com/packages/lf20_b85ux3q6.json')
      .then(res => res.json())
      .then(setLottieData)
      .catch(() => {}) // fallback to standard loader
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-mesh-gradient">
      <div className="text-center glass-panel p-8 rounded-3xl flex flex-col items-center">
        {lottieData ? (
          <Lottie animationData={lottieData} loop={true} style={{ height: 100, width: 100 }} />
        ) : (
          <Loader size="lg" className="mx-auto mb-4" />
        )}
        <p className="text-sm font-semibold text-gray-700 mt-2">Đang tải dữ liệu...</p>
      </div>
    </div>
  )
}
