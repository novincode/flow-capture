import React from 'react'

type FormatSelectorProps = {
  formats: string[]
  selectedFormat: string
  onChange: (format: string) => void
  label: string
  isLoading?: boolean
  loadProgress?: number
}

const FormatSelector = ({
  formats,
  selectedFormat,
  onChange,
  label,
  isLoading = false,
  loadProgress = 0
}: FormatSelectorProps) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">
        {label}
      </label>
      <div className="flex rounded-lg bg-slate-800 p-1">
        {formats.map((format) => (
          <button
            key={format}
            className={`flex-1 rounded-md py-1.5 text-center text-sm font-medium transition-colors ${
              selectedFormat === format
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
            onClick={() => onChange(format)}
            disabled={isLoading && format !== 'webm'}
          >
            <div className="flex items-center justify-center gap-1">
              {format.toUpperCase()}
              
              {/* Show loading spinner for selected non-WebM formats when loading */}
              {isLoading && selectedFormat === format && format !== 'webm' && (
                <div className="ml-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              )}
            </div>
            
            {/* Show loading progress bar for selected non-WebM format */}
            {isLoading && selectedFormat === format && format !== 'webm' && loadProgress > 0 && (
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-700">
                <div 
                  className="h-full bg-white transition-all duration-300" 
                  style={{ width: `${loadProgress}%` }}
                ></div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default FormatSelector
