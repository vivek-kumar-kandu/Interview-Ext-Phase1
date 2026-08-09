import React from 'react';
import { RecommendedJobProfile } from '../types/jobRecommendation';
import { Sparkles, CheckCircle2, AlertCircle, ArrowLeft, ArrowRight, BookOpen, Cpu, Target, Award } from 'lucide-react';

interface JobProfileDetailModalProps {
  job: RecommendedJobProfile;
  candidateName?: string;
  onClose: () => void;
  onStartInterview?: (jobTitle: string) => void;
}

export const JobProfileDetailModal: React.FC<JobProfileDetailModalProps> = ({
  job,
  candidateName = 'Candidate',
  onClose,
  onStartInterview,
}) => {
  if (!job) return null;

  const matchColor =
    job.matchPercentage >= 90
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : job.matchPercentage >= 80
      ? 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10'
      : 'text-amber-300 border-amber-500/40 bg-amber-500/10';

  const badgeBg =
    job.matchPercentage >= 90
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
      : job.matchPercentage >= 80
      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
      : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-xl animate-fadeIn">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-obsidian-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-6 text-slate-100 font-sans space-y-6">
        
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <button
            onClick={onClose}
            aria-label="Back to Recommendations"
            title="Return to Recommendations"
            className="btn-secondary py-1.5 px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Back to Recommendations</span>
          </button>
          <span className="text-[11px] font-mono text-indigo-400 font-bold uppercase tracking-wider">
            Detailed Job Profile
          </span>
        </div>

        {/* Header Title & Match Badge */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">
                RECOMMENDED ROLE FOR {candidateName.toUpperCase()}
              </span>
              <h1 className="text-xl font-extrabold text-white tracking-tight">{job.jobTitle}</h1>
            </div>
            <div className="text-right shrink-0">
              <div className={`px-3 py-1.5 rounded-xl border text-sm font-extrabold font-mono ${matchColor}`}>
                {job.matchPercentage !== undefined && job.matchPercentage !== null ? `${job.matchPercentage}% Match` : 'Not scored'}
              </div>
              <span className={`inline-block mt-1 text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${badgeBg}`}>
                {job.careerFit || 'Role Match'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed italic bg-obsidian-950/80 p-3 rounded-xl border border-white/5">
            "{job.description}"
          </p>
        </div>

        {/* Experience Alignment */}
        <div className="p-4 rounded-xl bg-obsidian-950/80 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
            <Target className="w-4 h-4 text-indigo-400" />
            <span>Experience Alignment</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-normal">
            {job.experienceAlignment}
          </p>
        </div>

        {/* Skills Grid: Verified Matching Skills & Skills to Strengthen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Matching Skills */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Matching Skills ({job.matchingSkills?.length || 0})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(job.matchingSkills || []).map((sk) => (
                <span key={sk} className="badge-emerald">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  {sk}
                </span>
              ))}
            </div>
          </div>

          {/* Missing / Weak Skills */}
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Skills to Strengthen ({job.missingSkills?.length || 0})</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(job.missingSkills || []).map((sk) => (
                <span key={sk} className="badge-amber">
                  • {sk}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Resume Strengths for this Role */}
        {job.resumeStrengths && job.resumeStrengths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase font-mono tracking-wider">
              <Award className="w-4 h-4 text-indigo-400" />
              <span>Resume Strengths for this Role</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-200">
              {job.resumeStrengths.map((str, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-obsidian-950/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>{str}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas to Improve */}
        {job.areasToImprove && job.areasToImprove.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase font-mono tracking-wider">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Areas to Improve</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-200">
              {job.areasToImprove.map((area, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-obsidian-950/60 p-2.5 rounded-xl border border-white/5">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Interview Preparation Topics & Suggested Technologies */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Interview Prep Topics */}
          {job.interviewPrepTopics && job.interviewPrepTopics.length > 0 && (
            <div className="p-4 rounded-xl bg-obsidian-950/80 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Interview Prep Topics</span>
              </div>
              <ul className="space-y-1 text-xs text-slate-300">
                {job.interviewPrepTopics.map((topic, idx) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="text-indigo-400 text-xs">⚡</span>
                    <span>{topic}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggested Technologies */}
          {job.suggestedTech && job.suggestedTech.length > 0 && (
            <div className="p-4 rounded-xl bg-obsidian-950/80 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Suggested Tech to Prepare</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {job.suggestedTech.map((tech) => (
                  <span key={tech} className="badge-cyan font-mono">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA Action Bar */}
        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onClose}
            className="btn-secondary w-full sm:w-auto py-2.5 px-4 rounded-xl text-xs text-center"
          >
            Close Detail
          </button>
          
          <button
            onClick={() => {
              if (onStartInterview) {
                onStartInterview(job.jobTitle);
              }
            }}
            className="btn-primary w-full sm:flex-1 py-3 px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Start Technical Interview for {job.jobTitle}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

