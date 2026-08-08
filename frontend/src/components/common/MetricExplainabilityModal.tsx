import React from 'react';
import {
  Info,
  X,
  CheckCircle2,
  XCircle,
  Sparkles,
  Calculator,
  ShieldCheck,
  Layers
} from 'lucide-react';
import { MetricScore } from '../../types/feedback';

interface MetricExplainabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  metric?: MetricScore | null;
  fallbackScore?: number;
  fallbackLabel?: string;
}

export const MetricExplainabilityModal: React.FC<MetricExplainabilityModalProps> = ({
  isOpen,
  onClose,
  title,
  metric,
  fallbackScore,
  fallbackLabel
}) => {
  if (!isOpen) return null;

  const score = typeof metric?.score === 'number' ? metric.score : fallbackScore;
  const label = metric?.label || fallbackLabel || 'Fit Analysis';



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200 select-none">
      <div
        className="w-full max-w-lg bg-gradient-to-b from-[#161822] via-[#11131C] to-[#0B0C10] border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#232636] flex items-center justify-between bg-[#161822]/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white font-display">{title} Explainability</h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold border border-indigo-500/30">
                  ⓘ Derived Evidence
                </span>
              </div>
              <p className="text-xs text-slate-400">Verifiable backend calculation & signal weights</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Main Score Hero Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900 border border-indigo-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 block font-semibold">
                COMPOSITE SCORE
              </span>
              <div className="text-2xl font-extrabold text-white font-display flex items-baseline gap-2">
                <span>{score}%</span>
                <span className="text-xs font-semibold text-emerald-400 font-sans">
                  • {label}
                </span>
              </div>
            </div>

            {metric?.confidence && (
              <div className="text-right">
                <div className="flex items-center gap-1 text-[11px] font-mono text-indigo-300 font-bold justify-end">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{Math.round(metric.confidence * 100)}% Confidence</span>
                </div>
                <span className="text-[10px] text-slate-400">LLM Semantic & Deterministic Engine</span>
              </div>
            )}
          </div>

          {/* Formula String Section */}
          {metric?.calculation && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-400">
                <Calculator className="w-3.5 h-3.5" />
                <span>HOW IS THIS CALCULATED?</span>
              </div>
              <div className="p-3 rounded-xl bg-[#0B0C10] border border-[#232636] text-[11px] font-mono text-slate-300 leading-relaxed">
                {metric.calculation}
              </div>
            </div>
          )}

          {/* Sub-Metric Weight Breakdown Table */}
          {metric?.breakdown && metric.breakdown.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-400">
                <Layers className="w-3.5 h-3.5" />
                <span>WEIGHTED SCORE BREAKDOWN</span>
              </div>
              <div className="rounded-xl border border-[#232636] overflow-hidden bg-[#0B0C10]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#232636] bg-[#161822]/60 text-[10px] font-mono uppercase text-slate-400">
                      <th className="py-2 px-3 font-semibold">Component Metric</th>
                      <th className="py-2 px-2 text-center font-semibold">Score</th>
                      <th className="py-2 px-2 text-center font-semibold">Weight</th>
                      <th className="py-2 px-3 text-right font-semibold">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D202E]">
                    {metric.breakdown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-indigo-500/5 transition">
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-200 block">{item.metric}</span>
                          <span className="text-[10px] text-slate-400 block">{item.evidence}</span>
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-300">
                          {item.score}%
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono text-indigo-400">
                          × {Math.round(item.weight * 100)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-400">
                          +{item.weightedScore}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Matched vs Missing Skills Evidence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Matched Skills */}
            <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>VERIFIED EVIDENCE ({metric?.matchedSkills?.length || 0})</span>
              </div>
              {metric?.matchedSkills && metric.matchedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {metric.matchedSkills.map((sk) => (
                    <span key={sk} className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[11px] font-medium border border-emerald-500/30">
                      ✓ {sk}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-slate-500 italic">No direct matched skills verified</span>
              )}
            </div>

            {/* Missing Skills */}
            <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-rose-400">
                <XCircle className="w-4 h-4" />
                <span>IDENTIFIED GAPS ({metric?.missingSkills?.length || 0})</span>
              </div>
              {metric?.missingSkills && metric.missingSkills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {metric.missingSkills.map((sk) => (
                    <span key={sk} className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-[11px] font-medium border border-rose-500/30">
                      ✕ {sk}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-emerald-400 font-medium">✓ No critical skills missing</span>
              )}
            </div>
          </div>

          {/* Evidence Details List */}
          {metric?.evidence && metric.evidence.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-400">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>VERIFIABLE EVIDENCE ITEMS ({metric.evidence.length})</span>
              </div>
              <div className="space-y-2">
                {metric.evidence.map((ev, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#0B0C10] border border-[#232636] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">{ev.title}</span>
                      {ev.sourcePlatform && (
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                          {ev.sourcePlatform}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-[11px]">{ev.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#232636] bg-[#161822]/80 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
