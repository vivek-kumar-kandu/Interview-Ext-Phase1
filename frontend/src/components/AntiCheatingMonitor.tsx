import React, { useEffect, useState } from 'react';

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
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 text-xs shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-slate-200">Interview integrity monitoring is active.</span>
        </div>
        <button
          onClick={toggleFullscreen}
          className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        </button>
      </div>

      {warningMessage && (
        <div className="mb-2 p-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded text-[11px] flex items-center gap-1.5 animate-fadeIn">
          <span>⚠️</span>
          <span>{warningMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-slate-400 text-[11px]">
        <span>Total Integrity Alerts: <strong className={violations.length > 0 ? 'text-amber-400' : 'text-emerald-400'}>{violations.length}</strong></span>
        {violations.length > 0 && (
          <span className="text-[10px] text-slate-500">Latest: {violations[violations.length - 1].type} at {violations[violations.length - 1].timestamp}</span>
        )}
      </div>
    </div>
  );
};
