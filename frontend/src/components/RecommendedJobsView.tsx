import React, { useState } from 'react';
import { CandidateProfileAnalysis } from '../types/profile';
import { RecommendedJobProfile, JobRecommendationResponse } from '../types/jobRecommendation';
import { JobProfileDetailModal } from './JobProfileDetailModal';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
  Briefcase,
  Target,
  UserCheck,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';

interface RecommendedJobsViewProps {
  candidateProfile: CandidateProfileAnalysis | null;
  recommendationData: JobRecommendationResponse | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onBackToProfile: () => void;
  onStartJobInterview?: (jobTitle: string) => void;
  onUploadResumeClick?: () => void;
}

export const RecommendedJobsView: React.FC<RecommendedJobsViewProps> = ({
  candidateProfile,
  recommendationData,
  isLoading,
  errorMessage,
  onRetry,
  onBackToProfile,
  onStartJobInterview,
  onUploadResumeClick,
}) => {
  const [selectedJob, setSelectedJob] = useState<RecommendedJobProfile | null>(null);

  // STATE A: Candidate Analysis Unavailable
  if (!candidateProfile && !isLoading) {
    return (
      <div className="w-full max-w-xl mx-auto p-6 rounded-2xl bg-gradient-to-b from-[#141622] to-[#0B0C10] border border-amber-500/30 text-slate-100 shadow-2xl space-y-5 font-sans">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Analyze Your Resume First</h2>
            <p className="text-xs text-slate-400">No candidate profile intelligence found.</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Job recommendations are generated dynamically derived strictly from your uploaded resume attributes. Please upload and analyze your resume first to unlock personalized AI recommendations.
        </p>

        <div className="flex items-center gap-3 pt-2">
          {onUploadResumeClick && (
            <button
              onClick={onUploadResumeClick}
              className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Upload Resume Now</span>
            </button>
          )}
          <button
            onClick={onBackToProfile}
            className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const recommendations = recommendationData?.recommendations || [];
  const candidateName = recommendationData?.candidateName || candidateProfile?.candidateName || 'Candidate';
  const skillsCount = candidateProfile?.technicalSkills?.length || candidateProfile?.strongSkills?.length || 0;
  const expCount = candidateProfile?.experience?.length || 0;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 font-sans select-none pb-8">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <button
          onClick={onBackToProfile}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition py-1 px-3 rounded-lg bg-slate-900 border border-slate-800"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-400" />
          <span>Back to Profile</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold font-mono">
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{candidateName}</span>
        </div>
      </div>

      {/* Main Page Title Header */}
      <div className="space-y-1 text-left">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h1 className="text-xl font-extrabold text-white tracking-tight">Jobs Recommended For You</h1>
        </div>
        <p className="text-xs text-slate-400 font-normal">
          Based on your resume, skills, experience and career profile.
        </p>
      </div>

      {/* Candidate Profile Signals Summary Banner */}
      {candidateProfile && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 font-bold">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <span className="text-white font-bold block">{candidateProfile.headline || candidateName}</span>
              <span className="text-[11px] text-slate-400">
                {skillsCount} verified skill(s) • {expCount} experience entry(ies)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-slate-400">Profile Readiness:</span>
            <span className="text-emerald-400 font-extrabold text-xs">
              {candidateProfile.profileReadinessScore ?? candidateProfile.profileCompleteness ?? 85}%
            </span>
          </div>
        </div>
      )}

      {/* STATE B: Loading State */}
      {isLoading && (
        <div className="p-10 rounded-2xl bg-slate-900/90 border border-indigo-500/30 text-center space-y-4 shadow-2xl">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Finding the best roles for your profile...</h3>
            <p className="text-xs text-slate-400">
              Analyzing candidate skills, experience, and education signals via AI
            </p>
          </div>
          <div className="w-48 h-1.5 bg-slate-800 rounded-full mx-auto overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 animate-pulse"></div>
          </div>
        </div>
      )}

      {/* STATE C: Error State */}
      {!isLoading && errorMessage && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-rose-500/40 text-slate-100 shadow-xl space-y-4 text-center">
          <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Unable to generate job recommendations right now. Please try again.</h3>
            <p className="text-xs text-rose-300/80">{errorMessage}</p>
          </div>
          <button
            onClick={onRetry}
            className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* STATE D: Empty Recommendations State */}
      {!isLoading && !errorMessage && recommendations.length === 0 && (
        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <SlidersHorizontal className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">We couldn't find strong role matches from this resume.</h3>
            <p className="text-xs text-slate-400">
              Try adding more detailed skills or work experience to your resume to expand role recommendations.
            </p>
          </div>
          <button
            onClick={onBackToProfile}
            className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition"
          >
            Back to Candidate Profile
          </button>
        </div>
      )}

      {/* STATE E: Display 5 to 8 Job Recommendations ordered by Match Score */}
      {!isLoading && !errorMessage && recommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>RECOMMENDED ROLES ({recommendations.length})</span>
            <span>ORDERED BY MATCH SCORE</span>
          </div>

          <div className="space-y-4">
            {recommendations.map((job, idx) => {
              const matchPct = job.matchPercentage;
              const cardBorder =
                matchPct >= 90
                  ? 'border-emerald-500/40 hover:border-emerald-500/70 bg-gradient-to-b from-[#141824] to-[#0D0F18]'
                  : matchPct >= 80
                  ? 'border-indigo-500/30 hover:border-indigo-500/60 bg-gradient-to-b from-[#141624] to-[#0D0E17]'
                  : 'border-slate-800 hover:border-amber-500/40 bg-gradient-to-b from-[#12131C] to-[#0B0C10]';

              const matchBadgeBg =
                matchPct >= 90
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : matchPct >= 80
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40';

              const fitTagBg =
                matchPct >= 90
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : matchPct >= 80
                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30';

              return (
                <div
                  key={job.id || idx}
                  className={`p-5 rounded-2xl border ${cardBorder} shadow-xl space-y-4 transition duration-200`}
                >
                  {/* Card Header: Role Title & Match Score Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                          #{idx + 1}
                        </span>
                        <h2 className="text-base font-extrabold text-white tracking-tight">{job.jobTitle}</h2>
                      </div>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${fitTagBg}`}>
                        {job.careerFit || 'Strong Match'}
                      </span>
                    </div>

                    <div className={`px-3 py-1 rounded-xl border text-sm font-extrabold font-mono shrink-0 ${matchBadgeBg}`}>
                      {job.matchPercentage}% Match
                    </div>
                  </div>

                  {/* Why you're a strong match */}
                  <div className="space-y-1 text-xs">
                    <span className="text-[11px] font-bold text-indigo-300">Why you're a strong match:</span>
                    <p className="text-slate-300 leading-relaxed font-normal bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/60">
                      {job.whyMatch.replace(/^Why you're a strong match:\s*/i, '')}
                    </p>
                  </div>

                  {/* Matching & Missing Skills */}
                  <div className="space-y-2 text-xs">
                    {/* Matching Skills */}
                    {job.matchingSkills && job.matchingSkills.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">MATCHING SKILLS</span>
                        <div className="flex flex-wrap gap-1.5">
                          {job.matchingSkills.map((sk) => (
                            <span
                              key={sk}
                              className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skills to strengthen */}
                    {job.missingSkills && job.missingSkills.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] font-mono font-bold uppercase text-amber-400">SKILLS TO STRENGTHEN</span>
                        <div className="flex flex-wrap gap-1.5">
                          {job.missingSkills.map((sk) => (
                            <span
                              key={sk}
                              className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1"
                            >
                              • {sk}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Experience Alignment & Role Duties */}
                  {job.experienceAlignment && (
                    <div className="text-xs text-slate-400 flex items-start gap-1.5 pt-1 border-t border-slate-800/60">
                      <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{job.experienceAlignment}</span>
                    </div>
                  )}

                  {/* Card Action CTA */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Career Fit: <strong className="text-slate-200">{job.careerFit}</strong>
                    </span>

                    <button
                      onClick={() => setSelectedJob(job)}
                      className="py-2 px-3.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-200 font-bold text-xs transition flex items-center gap-1.5"
                    >
                      <span>View Role Intelligence</span>
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Job Profile Modal */}
      {selectedJob && (
        <JobProfileDetailModal
          job={selectedJob}
          candidateName={candidateName}
          onClose={() => setSelectedJob(null)}
          onStartInterview={(jobTitle) => {
            setSelectedJob(null);
            if (onStartJobInterview) {
              onStartJobInterview(jobTitle);
            }
          }}
        />
      )}
    </div>
  );
};
