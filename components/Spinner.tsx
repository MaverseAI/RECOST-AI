import React from 'react';

export const Spinner: React.FC<{ label?: string; isDarkMode?: boolean }> = ({ label, isDarkMode = false }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 animate-fade-in-up">
      <div className="relative">
        <div className={`absolute inset-0 rounded-full blur-xl animate-pulse-slow ${isDarkMode ? 'bg-blue-500/40' : 'bg-blue-400/40'}`}></div>
        <div className={`relative w-16 h-16 rounded-full border-4 border-t-transparent animate-spin ${
          isDarkMode ? 'border-blue-500' : 'border-blue-600'
        }`}></div>
        {/* Logo Icon inside spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-white' : 'bg-blue-600'}`}></div>
        </div>
      </div>
      
      {label && (
        <p className={`mt-6 text-sm font-semibold tracking-wide uppercase animate-pulse ${
          isDarkMode ? 'text-blue-200' : 'text-blue-600'
        }`}>
          {label}
        </p>
      )}
    </div>
  );
};