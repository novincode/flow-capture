import React from 'react'

const ProgressBar = ({ progress }: { progress: number }) => (
  <div className="w-full h-2 bg-slate-800 rounded overflow-hidden">
    <div
      className="h-full bg-indigo-500 transition-all duration-200"
      style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
    />
  </div>
)

export default ProgressBar
