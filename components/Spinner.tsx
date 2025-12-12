import React from 'react';

export const Spinner: React.FC<{ label?: string; isDarkMode?: boolean }> = ({ label, isDarkMode = false }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 animate-fade-in-up">
      <div className="relative">
        <div className={`absolute inset-0 rounded-full blur-xl animate-pulse-slow ${isDarkMode ? 'bg-[#5e13f6]/40' : 'bg-[#5e13f6]/40'}`}></div>
        <div className={`relative w-16 h-16 rounded-full border-4 border-t-transparent animate-spin ${
          isDarkMode ? 'border-[#5e13f6]' : 'border-[#5e13f6]'
        }`}></div>
        {/* Logo Icon inside spinner */}
        <div className="absolute inset-0 flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-white' : 'bg-[#5e13f6]'}`}></div>
        </div>
      </div>
      
      {label && (
        <p className={`mt-6 text-sm font-semibold tracking-wide uppercase animate-pulse ${
          isDarkMode ? 'text-blue-200' : 'text-[#5e13f6]'
        }`}>
          {label}
        </p>
      )}
    </div>
  );
};