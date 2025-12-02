import { useEffect } from 'react';

export default function Toast({ id, type = 'info', message = '', onClose }) {
  useEffect(() => {
    const t = setTimeout(() => onClose && onClose(id), 4000);
    return () => clearTimeout(t);
  }, [id, onClose]);

  const colors = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    warn: 'bg-yellow-100 text-yellow-800',
  };

  const icon = {
    success: '✓',
    error: '⚠',
    info: 'ℹ',
    warn: '!',
  };

  return (
    <div className={`max-w-sm w-full shadow-md rounded p-3 flex items-start gap-3 ${colors[type] || colors.info}`}>
      <div className="text-xl font-bold">{icon[type] || icon.info}</div>
      <div className="flex-1 text-sm">
        <div className="font-medium">{type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info'}</div>
        <div>{message}</div>
      </div>
      <button onClick={() => onClose && onClose(id)} className="text-sm font-semibold">Close</button>
    </div>
  );
}
