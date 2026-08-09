import React, { useState } from 'react';
import { AiBotAvatar } from '../common/AiBotAvatar';
import { Minus, X, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { safeOpenSidePanel } from '../../core/chrome';
import { useInterviewStore } from '../../store/interview.store';

export const FloatingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const { messages, isLoading, isDone, matchScore, readinessScore, startInterview } = useInterviewStore();

  const interviewerMsgs = messages.filter((m) => m.sender === 'interviewer');
  const turnCount = interviewerMsgs.length || 1;
  const progressPercent = Math.min(Math.round((turnCount / 8) * 100), 100);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open Floating Widget"
        title="Open Interview Copilot"
        className="fixed bottom-6 right-6 z-[99999] hover:scale-105 transition transform shadow-2xl p-1 bg-obsidian-900 rounded-2xl border border-white/10"
      >
        <AiBotAvatar size="lg" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[99999] w-80 bg-obsidian-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100 select-none">
      {/* Widget Header */}
      <header className="px-4 py-3 bg-obsidian-950/90 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AiBotAvatar size="sm" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-display text-white">InterviewOS</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
              isDone ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25'
            }`}>
              {isDone ? 'Completed' : 'Live'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            aria-label="Minimize Widget"
            title="Minimize"
            className="p-1 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close Widget"
            title="Close"
            className="p-1 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Widget Body */}
      {!isMinimized && (
        <div className="p-4 space-y-3.5">
          {/* Priority 1: Match Score & Readiness Badges */}
          <div className="flex items-center justify-between gap-2 text-[10px] font-semibold font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">
              🎯 Match: {matchScore !== undefined && matchScore !== null ? `${matchScore}%` : '—'}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
              ⚡ Readiness: {readinessScore !== undefined && readinessScore !== null ? `${readinessScore}%` : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>{isDone ? 'Interview complete' : 'Interview in progress'}</span>
            <div className="flex items-center gap-1 text-indigo-400 font-mono font-semibold">
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              <span>{isLoading ? 'AI Thinking' : 'Live'}</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => safeOpenSidePanel()}
              className="btn-primary w-full text-xs py-2.5 flex items-center justify-center gap-2"
            >
              <span>Open Copilot Workspace</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => startInterview()}
              className="btn-danger w-full py-2 text-xs font-semibold"
            >
              Restart Interview
            </button>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Question {turnCount} of 8</span>
              <span className="font-semibold text-indigo-400">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-obsidian-950 overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

