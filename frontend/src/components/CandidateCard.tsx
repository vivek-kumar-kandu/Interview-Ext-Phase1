import React from 'react';
import { CandidateProfileAnalysis } from '../types/profile';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface CandidateCardProps {
  analysis: CandidateProfileAnalysis;
  onRetry?: () => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ analysis, onRetry }) => {
  if (!analysis) return null;

  const isError = analysis.analysisStatus === 'error' || Boolean(analysis.errorMessage && analysis.technicalSkills?.length === 0 && !analysis.candidateSummary);

  if (isError) {
    return (
      <div className="w-full max-w-md mx-auto p-5 rounded-2xl bg-slate-900 border border-rose-500/40 text-slate-100 shadow-xl space-y-4 font-sans">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Couldn't analyze resume</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {analysis.errorMessage || "Resume analysis could not be completed."}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Analysis</span>
          </button>
        )}
      </div>
    );
  }

  const isIncomplete =
    analysis.analysisStatus === 'incomplete_evidence' ||
    analysis.analysisStatus === 'insufficient_evidence' ||
    ((analysis.technicalSkills?.length || 0) === 0 &&
      (analysis.experience?.length || 0) === 0 &&
      (analysis.projects?.length || 0) === 0);

  if (isIncomplete) {
    return (
      <div className="w-full max-w-md mx-auto p-5 rounded-2xl bg-slate-900 border border-amber-500/40 text-slate-100 shadow-xl space-y-4 font-sans">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Not enough profile information</span>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">{analysis.candidateName || 'Candidate'}</h3>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            {analysis.candidateSummary || analysis.summary || "Not enough information was found in this resume to generate reliable career recommendations."}
          </p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span>PROFILE COMPLETENESS</span>
          <span className="text-amber-400 font-bold font-mono">{analysis.profileCompleteness ?? 0}%</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition text-center"
          >
            <span>Upload Updated Resume</span>
          </button>
        )}
      </div>
    );
  }

  const completeness = analysis.profileCompleteness ?? analysis.profileReadinessScore ?? 0;
  const summaryText = analysis.candidateSummary || analysis.summary || '';
  
  const strongest = (analysis.strongestAreas && analysis.strongestAreas.length > 0)
    ? analysis.strongestAreas
    : (analysis.strongSkills && analysis.strongSkills.length > 0)
      ? analysis.strongSkills.slice(0, 4)
      : (analysis.technicalSkills || []).slice(0, 4);

  const development = (analysis.developmentAreas && analysis.developmentAreas.length > 0)
    ? analysis.developmentAreas
    : (analysis.developingSkills && analysis.developingSkills.length > 0)
      ? analysis.developingSkills.slice(0, 3)
      : (analysis.skillGaps || []).slice(0, 3);

  const rawTargetRoles = analysis.targetRoles || [];
  const targetRoles = rawTargetRoles.map((r: any) => {
    if (typeof r === 'object' && r !== null) {
      return {
        role: r.role || 'Software Role',
        fitScore: r.fitScore ?? (r.confidence ? Math.round(r.confidence * 100) : 85),
        whyFit: r.whyFit || ''
      };
    }
    return { role: String(r), fitScore: 85, whyFit: '' };
  });

  const skillsList = analysis.technicalSkills || [];
  const expCount = analysis.experience?.length ?? 0;
  const eduCount = analysis.education?.length ?? 0;

  return (
    <div className="w-full max-w-md mx-auto p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 text-slate-100 shadow-2xl space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-indigo-400 font-mono text-[11px] font-bold uppercase tracking-wider">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>PROFILE ANALYZED</span>
        </div>
      </div>

      {/* Candidate Name & Summary */}
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-white tracking-tight">{analysis.candidateName || 'Candidate'}</h2>
        {summaryText && (
          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            {summaryText}
          </p>
        )}
      </div>

      {/* Profile Completeness */}
      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] font-mono font-bold uppercase text-slate-400">PROFILE COMPLETENESS</span>
        <span className="text-base font-extrabold font-mono text-emerald-400">{completeness}%</span>
      </div>

      {/* Strongest Areas */}
      {strongest.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase font-bold text-indigo-300 tracking-wider">STRONGEST AREAS</span>
          <ul className="space-y-1 text-xs text-slate-200">
            {strongest.map((area, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-indigo-400">•</span>
                <span>{area}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Best-Fit Roles */}
      {targetRoles.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase font-bold text-indigo-300 tracking-wider">BEST-FIT ROLES</span>
          <ul className="space-y-1 text-xs text-slate-200">
            {targetRoles.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate max-w-[240px]">
                  <span className="text-indigo-400">•</span>
                  <span className="font-semibold text-white truncate">{item.role}</span>
                </div>
                <span className="text-emerald-400 font-mono font-bold text-[11px] shrink-0">— {item.fitScore}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skills */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase font-bold text-indigo-300 tracking-wider">SKILLS</span>
        <p className="text-xs text-slate-300 leading-relaxed">
          {skillsList.length > 0 ? skillsList.join(' • ') : 'Not provided'}
        </p>
      </div>

      {/* Experience & Education Counters (Strictly Dynamic) */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-0.5">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">EXPERIENCE</span>
          <p className="text-xs font-semibold text-slate-100">
            {expCount > 0 ? `${expCount} ${expCount === 1 ? 'position' : 'positions'}` : '0'}
          </p>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-0.5">
          <span className="text-[10px] font-mono uppercase font-bold text-slate-400">EDUCATION</span>
          <p className="text-xs font-semibold text-slate-100">
            {eduCount > 0 ? `${eduCount} ${eduCount === 1 ? 'qualification' : 'qualifications'}` : '0'}
          </p>
        </div>
      </div>

      {/* Development Areas */}
      {development.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">DEVELOPMENT AREAS</span>
          <ul className="space-y-1 text-xs text-slate-300">
            {development.map((dev, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-400">•</span>
                <span>{dev}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
