import React from 'react'

type ToggleProps = {
  checked: boolean
  onChange: () => void
  label: string
  id?: string
}

const Toggle = ({ checked, onChange, label, id }: ToggleProps) => {
  return (
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-sm text-slate-400">
        {label}
      </label>
      <button
        role="checkbox"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-slate-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  )
}

export default Toggle
