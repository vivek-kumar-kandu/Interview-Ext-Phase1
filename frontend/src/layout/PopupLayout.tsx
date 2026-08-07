import React from 'react';
import { APP_NAME, APP_SLOGAN } from '../core/constants';
import { Sparkles, Settings, ExternalLink } from 'lucide-react';
import { safeOpenSidePanel } from '../core/chrome';

export const PopupLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="h-full w-full flex flex-col glass-container rounded-2xl overflow-hidden select-none relative">
      {/* Background Ambient Glow Orbs */}
      <div className="absolute -top-12 -left-12 w-36 h-36 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="px-4 py-3 glass-header flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide font-display text-white">{APP_NAME}</h1>
            <p className="text-[10px] text-slate-400 truncate max-w-[190px]">{APP_SLOGAN}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => safeOpenSidePanel()}
            title="Open Side Panel"
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            title="Settings"
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1 overflow-y-auto p-4 z-10 relative">{children}</main>

      {/* Footer */}
      <footer className="px-4 py-2 bg-slate-950/40 border-t border-white/5 text-[11px] text-slate-400 flex justify-between items-center z-10">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Status: Transparent Active</span>
        </span>
        <span className="font-mono text-[10px] opacity-75">v1.0.0</span>
      </footer>
    </div>
  );
};
