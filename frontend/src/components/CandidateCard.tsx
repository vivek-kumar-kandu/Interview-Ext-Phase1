import React from 'react';
import { CandidateProfileAnalysis } from '../types/profile';
import { CheckCircle2, AlertCircle, RefreshCw, Award, Briefcase, GraduationCap } from 'lucide-react';
import { formatErrorMessage } from '../lib/errorUtils';

interface CandidateCardProps {
  analysis: CandidateProfileAnalysis;
  onRetry?: () => void;
}

export const CandidateCard: React.FC<CandidateCardProps> = ({ analysis, onRetry }) => {
  if (!analysis) return null;

  const isError = analysis.analysisStatus === 'error' || Boolean(analysis.errorMessage && analysis.technicalSkills?.length === 0 && !analysis.candidateSummary);

  if (isError) {
    return (
      <div className="w-full max-w-md mx-auto p-5 rounded-2xl bg-obsidian-900/90 backdrop-blur-xl border border-rose-500/30 text-slate-100 shadow-xl space-y-4 font-sans">
        <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Couldn't analyze resume</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {formatErrorMessage(analysis.errorMessage, "Resume analysis could not be completed.")}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-secondary w-full py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2"
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
      <div className="w-full max-w-md mx-auto p-5 rounded-2xl bg-obsidian-900/90 backdrop-blur-xl border border-amber-500/30 text-slate-100 shadow-xl space-y-4 font-sans">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Not enough profile evidence</span>
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">{analysis.candidateName || 'Candidate'}</h3>
          <p className="text-xs text-amber-200/90 leading-relaxed">
            {analysis.candidateSummary || analysis.summary || "Not enough information was found in this resume to generate reliable career recommendations."}
          </p>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-400">
          <span>PROFILE COMPLETENESS</span>
          <span className="text-amber-400 font-bold font-mono">
            {analysis.profileCompleteness !== undefined && analysis.profileCompleteness !== null ? `${analysis.profileCompleteness}%` : '—'}
          </span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn-secondary w-full py-2 px-3 rounded-xl text-xs text-center"
          >
            <span>Upload Updated Resume</span>
          </button>
        )}
      </div>
    );
  }

  const completeness = analysis.profileCompleteness ?? analysis.profileReadinessScore ?? null;
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
        fitScore: typeof r.fitScore === 'number' ? r.fitScore : (typeof r.confidence === 'number' ? Math.round(r.confidence * 100) : null),
        whyFit: r.whyFit || ''
      };
    }
    return { role: String(r), fitScore: null, whyFit: '' };
  });

  const skillsList = analysis.technicalSkills || [];
  const expCount = analysis.experience?.length ?? 0;
  const eduCount = analysis.education?.length ?? 0;

  return (
    <div className="w-full max-w-md mx-auto p-5 rounded-2xl bg-obsidian-900/90 backdrop-blur-xl border border-white/10 text-slate-100 shadow-2xl space-y-4 font-sans relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-indigo-400 font-mono text-[11px] font-bold uppercase tracking-wider">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>VERIFIED CANDIDATE PROFILE</span>
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
      <div className="p-3 rounded-xl bg-obsidian-950/80 border border-white/10 flex items-center justify-between shadow-inner">
        <span className="text-[11px] font-mono font-bold uppercase text-slate-400">PROFILE COMPLETENESS</span>
        <span className="text-base font-extrabold font-mono text-emerald-400">
          {completeness !== null ? `${completeness}%` : 'Not available'}
        </span>
      </div>

      {/* Strongest Areas */}
      {strongest.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1">
            <Award className="w-3 h-3 text-indigo-400" /> STRONGEST EVIDENCE AREAS
          </span>
          <div className="flex flex-wrap gap-1.5">
            {strongest.map((area, idx) => (
              <span key={idx} className="badge-indigo">
                {area}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Best-Fit Roles */}
      {targetRoles.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider">TARGET ROLES</span>
          <ul className="space-y-1.5 text-xs text-slate-200">
            {targetRoles.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between p-2 rounded-lg bg-obsidian-950/50 border border-white/5">
                <span className="font-semibold text-white truncate max-w-[240px]">{item.role}</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px] shrink-0">
                  {item.fitScore !== null ? `${item.fitScore}%` : '—'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Skills */}
      <div className="space-y-1">
        <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider">TECHNICAL SKILLS</span>
        {skillsList.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 pt-1">
            {skillsList.map((sk: string, i: number) => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-200 text-[11px]">
                {sk}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">Not available</p>
        )}
      </div>

      {/* Experience & Education Counters */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-obsidian-950/70 border border-white/10 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono font-bold uppercase">
            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
            <span>EXPERIENCE</span>
          </div>
          <p className="text-xs font-bold text-slate-100">
            {expCount > 0 ? `${expCount} ${expCount === 1 ? 'role' : 'roles'}` : 'Not available'}
          </p>
        </div>
        <div className="p-3 rounded-xl bg-obsidian-950/70 border border-white/10 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono font-bold uppercase">
            <GraduationCap className="w-3.5 h-3.5 text-cyan-400" />
            <span>EDUCATION</span>
          </div>
          <p className="text-xs font-bold text-slate-100">
            {eduCount > 0 ? `${eduCount} ${eduCount === 1 ? 'degree' : 'degrees'}` : 'Not available'}
          </p>
        </div>
      </div>

      {/* Development Areas */}
      {development.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-mono uppercase font-bold text-amber-400 tracking-wider">DEVELOPMENT AREAS</span>
          <div className="flex flex-wrap gap-1.5">
            {development.map((dev, idx) => (
              <span key={idx} className="badge-amber">
                {dev}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

