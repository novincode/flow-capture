import React from 'react'

type SliderProps = {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  label: string
  showMinMax?: boolean
  unit?: string
}

const Slider = ({ 
  min, 
  max, 
  value, 
  onChange, 
  label, 
  showMinMax = true,
  unit = ''
}: SliderProps) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-300">
          {label}
        </label>
        <span className="text-sm font-medium text-indigo-400">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="h-2 w-full appearance-none rounded-lg bg-slate-700 accent-indigo-600"
      />
      {showMinMax && (
        <div className="flex justify-between text-xs text-slate-500">
          <span>{min}{unit}</span>
          <span>{max}{unit}</span>
        </div>
      )}
    </div>
  )
}

export default Slider
