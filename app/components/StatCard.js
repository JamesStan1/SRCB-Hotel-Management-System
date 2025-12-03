"use client";

import { useState } from 'react';

export default function StatCard({ title, value, change, icon, onClick, className = '', iconBgClass = '' }) {
  const isPositive = typeof change === 'string' && change.startsWith('+');

  return (
    <button
      onClick={onClick}
      className={`bg-white rounded-lg shadow p-4 sm:p-6 text-left hover:shadow-md transition-shadow w-full overflow-hidden ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
            <div className={`ml-3 flex-shrink-0 p-2 rounded-full ${iconBgClass || 'bg-indigo-50'}`}>{icon}</div>
          </div>
          <p className="text-2xl font-semibold text-gray-900 mt-1 truncate">{value}</p>
        </div>
      </div>
      <div className={`mt-4 text-sm ${isPositive ? 'text-blue-600' : 'text-red-600'}`}>
        {change ? <span className="truncate block">{change} from last week</span> : <span className="text-gray-400">&nbsp;</span>}
      </div>
    </button>
  );
}
