import React from 'react';

export const AiBotAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ size = 'md' }) => {
  const dimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20',
  }[size];

  return (
    <div className={`${dimensions} rounded-xl overflow-hidden shrink-0 shadow-lg shadow-indigo-500/20 border border-white/10 p-0.5 bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-500`}>
      <img
        src="/logo.png"
        alt="InterviewOS Logo"
        className="w-full h-full object-cover rounded-[10px]"
      />
    </div>
  );
};

