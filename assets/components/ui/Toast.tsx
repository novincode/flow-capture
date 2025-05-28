import React from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onDismiss?: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onDismiss }) => {
  const bgColor = 
    type === 'success' ? 'bg-green-900/30 text-green-200' :
    type === 'error' ? 'bg-red-900/30 text-red-200' :
    'bg-indigo-900/30 text-indigo-200';
    
  return (
    <div className={`rounded-md p-3 text-sm flex justify-between items-center ${bgColor}`}>
      <div className="flex items-center gap-2">
        {type === 'success' && <span>✅</span>}
        {type === 'error' && <span>❌</span>}
        {type === 'info' && <span>ℹ️</span>}
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button 
          onClick={onDismiss}
          className="ml-2 text-xs opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </div>
  );
};

export default Toast;
