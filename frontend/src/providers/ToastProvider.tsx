import React from 'react';
import { useUIStore } from '../store/ui.store';

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toastMessage, setToast } = useUIStore();

  return (
    <>
      {children}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center gap-2 ${
              toastMessage.type === 'error'
                ? 'bg-rose-900/90 text-rose-100 border border-rose-700'
                : toastMessage.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-700'
                : 'bg-slate-800 text-slate-100 border border-slate-700'
            }`}
          >
            <span>{toastMessage.message}</span>
            <button
              onClick={() => setToast(undefined)}
              className="ml-2 text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};
