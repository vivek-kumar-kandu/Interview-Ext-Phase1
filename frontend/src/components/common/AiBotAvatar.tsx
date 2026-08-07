import React from 'react';

export const AiBotAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg' | 'xl' }> = ({ size = 'md' }) => {
  const dimensions = {
    sm: 'w-6 h-6',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20',
  }[size];

  return (
    <div className={`${dimensions} rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 p-0.5 shadow-lg shadow-indigo-500/20 shrink-0 flex items-center justify-center`}>
      <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center relative overflow-hidden backdrop-blur-md">
        {/* Glowing Eye Accents */}
        <div className="flex items-center gap-1.5 z-10">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
        </div>
        {/* Antennas glow */}
        <div className="absolute top-1 w-3 h-0.5 bg-indigo-400 rounded-full opacity-60" />
      </div>
    </div>
  );
};
