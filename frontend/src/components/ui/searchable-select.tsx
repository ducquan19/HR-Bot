import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  placeholder?: string
  className?: string
}

export function SearchableSelect({ value, onChange, options, placeholder = 'Chọn...', className }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)
  const filteredOptions = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          setSearch('')
        }}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
      >
        <span className={cn("truncate", !selectedOption ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:text-gray-200")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full min-w-[200px] overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-800 shadow-lg animate-in fade-in zoom-in-95 right-0 sm:right-auto">
          <div className="flex items-center border-b border-gray-100 dark:border-gray-700 px-3 bg-gray-50/50 dark:bg-slate-900/50">
            <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
            <input
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 text-gray-900 dark:text-white"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1.5">
            {filteredOptions.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">Không tìm thấy.</p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={cn(
                    "relative flex w-full text-left items-center rounded-lg py-2 pl-8 pr-2 text-sm outline-none transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300",
                    value === option.value && "bg-blue-50/50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/40"
                  )}
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {value === option.value && <Check className="h-4 w-4 text-blue-600" />}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
