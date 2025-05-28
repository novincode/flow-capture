import React from 'react'

type ButtonProps = {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' 
  className?: string
  disabled?: boolean
  onClick?: () => void
  fullWidth?: boolean
}

const Button = ({
  children,
  variant = 'primary',
  className = '',
  disabled = false,
  onClick,
  fullWidth = false
}: ButtonProps) => {
  return (
    <button
      className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export default Button
