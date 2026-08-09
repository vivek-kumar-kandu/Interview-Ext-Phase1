import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, Maximize, Minimize, CheckCircle2 } from 'lucide-react';

export interface IntegrityViolation {
  type: 'TAB_SWITCH' | 'FOCUS_LOSS' | 'FULLSCREEN_EXIT' | 'COPY_ATTEMPT' | 'PASTE_ATTEMPT' | 'DEVTOOLS_ATTEMPT';
  timestamp: string;
  count: number;
}

interface AntiCheatingMonitorProps {
  onViolation?: (violation: IntegrityViolation) => void;
  active?: boolean;
}

export const AntiCheatingMonitor: React.FC<AntiCheatingMonitorProps> = ({ onViolation, active = true }) => {
  const [violations, setViolations] = useState<IntegrityViolation[]>([]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(!!document.fullscreenElement);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  const addViolation = (type: IntegrityViolation['type']) => {
    const timestamp = new Date().toLocaleTimeString();
    setViolations((prev) => {
      const typeCount = prev.filter((v) => v.type === type).length + 1;
      const newV: IntegrityViolation = { type, timestamp, count: typeCount };
      if (onViolation) onViolation(newV);
      return [...prev, newV];
    });

    let msg = '';
    switch (type) {
      case 'TAB_SWITCH':
        msg = 'Warning: Tab switch detected during interview session!';
        break;
      case 'FOCUS_LOSS':
        msg = 'Warning: Window focus lost!';
        break;
      case 'FULLSCREEN_EXIT':
        msg = 'Warning: Exited full-screen mode!';
        break;
      case 'COPY_ATTEMPT':
        msg = 'Warning: Text copy operation detected!';
        break;
      case 'PASTE_ATTEMPT':
        msg = 'Notice: Paste event logged.';
        break;
      case 'DEVTOOLS_ATTEMPT':
        msg = 'Warning: Developer tools / inspection shortcut detected!';
        break;
    }
    setWarningMessage(msg);
    setTimeout(() => setWarningMessage(null), 4000);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    if (!active) return;

    // 1. Tab Visibility Change Listener
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addViolation('TAB_SWITCH');
      }
    };

    // 2. Window Blur Listener
    const handleWindowBlur = () => {
      addViolation('FOCUS_LOSS');
    };

    // 3. Fullscreen Change Listener
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        addViolation('FULLSCREEN_EXIT');
      }
    };

    // 4. Copy & Paste Prevention & Logging
    const handleCopy = (_e: ClipboardEvent) => {
      addViolation('COPY_ATTEMPT');
    };
    const handlePaste = (_e: ClipboardEvent) => {
      addViolation('PASTE_ATTEMPT');
    };

    // 5. DevTools Shortcut Prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) ||
        (e.ctrlKey && e.key === 'u')
      ) {
        addViolation('DEVTOOLS_ATTEMPT');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div className="bg-obsidian-900/90 border border-white/10 rounded-2xl p-3.5 text-xs shadow-xl backdrop-blur-xl space-y-3 font-sans">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-100 block text-xs">Interview Integrity Active</span>
            <span className="text-[10px] text-slate-400">Session Security Monitoring</span>
          </div>
        </div>
        <button
          onClick={toggleFullscreen}
          className="btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1.5"
        >
          {isFullscreen ? (
            <>
              <Minimize className="w-3 h-3 text-indigo-400" />
              <span>Exit Fullscreen</span>
            </>
          ) : (
            <>
              <Maximize className="w-3 h-3 text-indigo-400" />
              <span>Enter Fullscreen</span>
            </>
          )}
        </button>
      </div>

      {/* Monitor Status Badges */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="p-2 rounded-xl bg-obsidian-950/70 border border-white/5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-medium">Tab Focus</span>
        </div>
        <div className="p-2 rounded-xl bg-obsidian-950/70 border border-white/5 flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${isFullscreen ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-slate-300 font-medium">{isFullscreen ? 'Fullscreen' : 'Windowed'}</span>
        </div>
        <div className="p-2 rounded-xl bg-obsidian-950/70 border border-white/5 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span className="text-slate-300 font-medium">Environment</span>
        </div>
      </div>

      {warningMessage && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-xl text-[11px] flex items-center gap-2 animate-fadeIn">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{warningMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-slate-400 text-[11px] pt-0.5">
        <span>Integrity Alerts: <strong className={violations.length > 0 ? 'text-amber-400' : 'text-emerald-400'}>{violations.length}</strong></span>
        {violations.length > 0 && (
          <span className="text-[10px] text-slate-400 font-mono">
            Latest: {violations[violations.length - 1].type} ({violations[violations.length - 1].timestamp})
          </span>
        )}
      </div>
    </div>
  );
};

