import React, { useState } from 'react';
import { AiBotAvatar } from '../components/common/AiBotAvatar';
import { Settings, MoreVertical, Plus, ChevronRight, Home, Briefcase, FileText, Moon } from 'lucide-react';
import { safeOpenSidePanel } from '../core/chrome';

export const PopupApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'sessions' | 'reports' | 'settings'>('home');
  const [isDarkMode, setIsDarkMode] = useState(true);

  const recentSessions = [
    { id: 's1', role: 'Frontend Developer', date: 'May 10, 2025', duration: '45 min', status: 'Completed' },
    { id: 's2', role: 'Backend Engineer', date: 'May 8, 2025', duration: '38 min', status: 'Completed' },
    { id: 's3', role: 'System Design Round', date: 'May 6, 2025', duration: '52 min', status: 'In Progress' },
  ];

  return (
    <div className="w-[380px] h-[580px] flex flex-col bg-[#0B0C10] text-slate-100 font-sans border border-[#232636] rounded-2xl overflow-hidden select-none">
      {/* Header Bar */}
      <header className="px-4 py-3 bg-[#161822] border-b border-[#232636] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <AiBotAvatar size="sm" />
          <div>
            <h1 className="text-sm font-bold font-display tracking-tight text-white">InterviewOS</h1>
            <p className="text-[10px] text-slate-400">AI Interview Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition">
            <Settings className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/50 transition">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'home' && (
          <>
            {/* Hero AI Bot Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-[#161822] to-purple-950/40 border border-indigo-500/20 relative overflow-hidden flex items-center justify-between">
              <div className="space-y-3 z-10 max-w-[200px]">
                <h2 className="text-sm font-bold text-white leading-snug">
                  AI-Powered Interviews. Right where you work.
                </h2>
                <button
                  onClick={() => safeOpenSidePanel()}
                  className="target-btn-primary text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start Interview</span>
                </button>
              </div>
              <div className="z-10 pr-1">
                <AiBotAvatar size="xl" />
              </div>
              {/* Radial gradient background accent */}
              <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-600/30 rounded-full blur-2xl" />
            </div>

            {/* Recent Sessions List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-white">Recent Sessions</h3>
                <button className="text-[11px] text-indigo-400 hover:underline">View all</button>
              </div>

              <div className="space-y-2">
                {recentSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => safeOpenSidePanel()}
                    className="target-card-interactive p-3.5 flex items-center justify-between cursor-pointer"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-white">{session.role}</p>
                      <p className="text-[10px] text-slate-400">
                        {session.date} • {session.duration}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          session.status === 'Completed'
                            ? 'target-badge-completed'
                            : 'target-badge-inprogress'
                        }
                      >
                        {session.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dark Mode Toggle Section */}
            <div className="p-3 bg-[#161822] border border-[#232636] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-200">Dark mode</span>
              </div>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                  isDarkMode ? 'bg-indigo-600' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-[10px] text-center text-slate-500 font-mono pt-1">
              InterviewOS v1.0.0
            </p>
          </>
        )}

        {activeTab !== 'home' && (
          <div className="h-full flex items-center justify-center text-center text-xs text-slate-400 p-6">
            View active. Click Start Interview to launch full copilot workspace.
          </div>
        )}
      </main>

      {/* Bottom 4-Tab Navigation */}
      <footer className="bg-[#161822] border-t border-[#232636] grid grid-cols-4 px-2 py-1.5">
        {[
          { key: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
          { key: 'sessions', label: 'Sessions', icon: <Briefcase className="w-4 h-4" /> },
          { key: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
          { key: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex flex-col items-center justify-center py-1.5 text-[10px] font-medium transition-colors ${
              activeTab === tab.key ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            <span className="mt-1">{tab.label}</span>
          </button>
        ))}
      </footer>
    </div>
  );
};
