import React, { useState } from 'react';
import { PopupApp } from '../popup/PopupApp';
import { SidePanelApp } from '../sidepanel/SidePanelApp';
import { FloatingWidget } from '../components/widget/FloatingWidget';
import { Sparkles, Layout, Smartphone, Sidebar, CheckCircle, Eye } from 'lucide-react';
import { ThemeProvider } from '../providers/ThemeProvider';
import { ToastProvider } from '../providers/ToastProvider';

export const DevWorkbench: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'split' | 'popup' | 'sidepanel' | 'widget'>('split');
  const [showInPageWidget, setShowInPageWidget] = useState(true);

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex flex-col font-sans select-none antialiased relative overflow-x-hidden">
          {/* Top Bar Navigation */}
          <header className="px-6 py-3 bg-[#161822] border-b border-[#232636] flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold font-display text-white">InterviewOS</h1>
                <p className="text-[10px] text-slate-400">Target Design System Dev Workbench</p>
              </div>
            </div>

            {/* Viewport View Switchers */}
            <div className="flex items-center bg-[#0B0C10] p-1 rounded-xl border border-[#232636] gap-1">
              <button
                onClick={() => setActiveTab('split')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'split' ? 'bg-[#5B46F6] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>Split Workbench</span>
              </button>
              <button
                onClick={() => setActiveTab('popup')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'popup' ? 'bg-[#5B46F6] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Popup (380px)</span>
              </button>
              <button
                onClick={() => setActiveTab('sidepanel')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'sidepanel' ? 'bg-[#5B46F6] text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sidebar className="w-3.5 h-3.5" />
                <span>Side Panel (800px)</span>
              </button>
              <button
                onClick={() => setShowInPageWidget(!showInPageWidget)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  showInPageWidget ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/40' : 'text-slate-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Widget: {showInPageWidget ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Target Design Active</span>
            </div>
          </header>

          {/* Workbench Canvas */}
          <main className="flex-1 p-8 flex items-start justify-center overflow-auto bg-[#0B0C10]">
            {activeTab === 'split' && (
              <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* 1. Extension Popup Container (380px) */}
                <div className="md:col-span-4 flex flex-col items-center space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Smartphone className="w-4 h-4 text-indigo-400" />
                    <span>1. Extension Popup (380px)</span>
                  </div>
                  <div className="shadow-2xl rounded-2xl overflow-hidden border border-[#232636]">
                    <PopupApp />
                  </div>
                </div>

                {/* 2. Side Panel Container (800px) */}
                <div className="md:col-span-8 flex flex-col space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Sidebar className="w-4 h-4 text-cyan-400" />
                    <span>2. Side Panel (800px Experience)</span>
                  </div>
                  <div className="w-full min-h-[580px] shadow-2xl rounded-2xl overflow-hidden border border-[#232636]">
                    <SidePanelApp />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'popup' && (
              <div className="flex flex-col items-center space-y-4">
                <div className="shadow-2xl rounded-2xl overflow-hidden border border-[#232636]">
                  <PopupApp />
                </div>
              </div>
            )}

            {activeTab === 'sidepanel' && (
              <div className="w-full max-w-5xl shadow-2xl rounded-2xl overflow-hidden border border-[#232636]">
                <SidePanelApp />
              </div>
            )}
          </main>

          {/* In-Page Floating Widget Simulation Overlay */}
          {showInPageWidget && <FloatingWidget />}
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
};

export default DevWorkbench;
