"use client";

export default function ActivityItem({ title, time, icon, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="flex items-start w-full text-left hover:bg-gray-50 p-2 rounded"
    >
      <div className="flex-shrink-0 mt-1 mr-3">{icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-sm text-gray-500">{time}</p>
      </div>
    </button>
  );
}
