import React from 'react';
import { APP_NAME } from '../core/constants';
import { Sparkles, MessageSquare, BarChart2, Settings } from 'lucide-react';
import { useUIStore } from '../store/ui.store';
import { RouteKey } from '../config/routes';

export const SidePanelLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentRoute, setRoute } = useUIStore();

  const navItems: Array<{ key: RouteKey; label: string; icon: React.ReactNode }> = [
    { key: 'dashboard', label: 'Dashboard', icon: <BarChart2 className="w-4 h-4" /> },
    { key: 'interview', label: 'Copilot', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'feedback', label: 'Reports', icon: <Sparkles className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col glass-container text-slate-100 font-sans relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="px-4 py-3 glass-header flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <span className="font-bold text-sm font-display tracking-tight text-white">{APP_NAME}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          Transparent Copilot
        </span>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex border-b border-white/10 bg-slate-950/40 px-2 pt-2 gap-1 overflow-x-auto z-10">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setRoute(item.key)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t-xl transition-all border-b-2 ${
              currentRoute === item.key
                ? 'border-indigo-400 text-indigo-300 bg-white/10 shadow-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Viewport Content */}
      <main className="flex-1 p-4 overflow-y-auto z-10 relative">{children}</main>
    </div>
  );
};
