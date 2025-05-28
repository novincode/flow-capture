import React from 'react'

type FormatSelectorProps = {
  formats: string[]
  selectedFormat: string
  onChange: (format: string) => void
  label: string
}

const FormatSelector = ({
  formats,
  selectedFormat,
  onChange,
  label
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
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

export default FormatSelector
