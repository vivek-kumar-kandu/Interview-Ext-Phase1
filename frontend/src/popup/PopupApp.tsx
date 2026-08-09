import React, { useEffect, useState } from 'react';
import { ResumeUploadCard } from '../components/ResumeUploadCard';
import { JudgeDemoView } from '../components/JudgeDemoView';
import { CandidateProfileAnalysis } from '../types/profile';
import { getCandidateProfile } from '../services/firestore';
import { safeOpenSidePanel } from '../core/chrome';
import { Briefcase, AlertCircle, CheckCircle, ArrowRight, UserCheck, RefreshCw } from 'lucide-react';
import { interviewApi } from '../api/interview';
import { formatErrorMessage } from '../lib/errorUtils';

export const PopupApp: React.FC = () => {
  const [profileData, setProfileData] = useState<CandidateProfileAnalysis | null>(null);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [jobMatch, setJobMatch] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showJudgeDemo, setShowJudgeDemo] = useState<boolean>(false);

  // Load candidate profile from chrome storage or Firestore
  useEffect(() => {
    async function loadCandidate() {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['analyzedCandidate', 'isProfileAnalyzed'], async (res) => {
          if (res?.isProfileAnalyzed && res?.analyzedCandidate) {
            setProfileData(res.analyzedCandidate as CandidateProfileAnalysis);
          } else {
            const firestoreProf = await getCandidateProfile();
            if (firestoreProf) {
              setProfileData(firestoreProf);
            }
          }
        });
      } else {
        const firestoreProf = await getCandidateProfile();
        if (firestoreProf) {
          setProfileData(firestoreProf);
        }
      }
    }
    loadCandidate();
  }, []);

  // Inspect current active tab to detect job page
  useEffect(() => {
    if (!profileData) return;

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab || !activeTab.id) return;

        chrome.tabs.sendMessage(activeTab.id, { type: 'SCRAPE_JOB_NOW' }, async (res) => {
          if (chrome.runtime.lastError) {
            return;
          }
          if (res && res.data && res.data.jobTitle) {
            const extractedJob = res.data;
            setActiveJob(extractedJob);

            try {
              const matchRes = await interviewApi.compareCandidateToJob(profileData, extractedJob);
              if (matchRes) {
                setJobMatch(matchRes);
              }
            } catch (err: any) {
              console.error('Job match computation error:', err);
              setErrorMessage(formatErrorMessage(err, 'Could not compute job match score.'));
            }
          }
        });
      });
    }
  }, [profileData]);

  if (showJudgeDemo) {
    return (
      <div className="w-[380px] min-h-[480px] p-4 bg-obsidian-950 text-slate-100 font-sans border border-white/10 rounded-2xl flex flex-col justify-between select-none shadow-2xl relative overflow-hidden">
        <JudgeDemoView onBack={() => setShowJudgeDemo(false)} />
      </div>
    );
  }

  // STATE 1: No Candidate Profile Uploaded
  if (!profileData) {
    return (
      <div className="w-[380px] min-h-[480px] p-5 bg-obsidian-950 text-slate-100 font-sans border border-white/10 rounded-2xl flex flex-col justify-between select-none shadow-2xl relative overflow-hidden">
        {/* Ambient Glow background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="InterviewOS" className="w-8 h-8 rounded-xl object-cover shadow-lg shadow-indigo-500/25 border border-white/10" />
              <div>
                <h1 className="text-base font-bold text-white tracking-tight leading-tight">InterviewOS</h1>
                <p className="text-[10px] text-indigo-400 font-medium">AI Recruitment Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Ready
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <ResumeUploadCard
            onProfileAnalyzed={(prof) => {
              setProfileData(prof);
              setErrorMessage(null);
            }}
            onExploreJudgeFiles={() => setShowJudgeDemo(true)}
          />
        </div>

        <p className="text-[10px] text-center text-slate-500 font-mono mt-4 relative z-10">
          Powered by Gemini AI Intelligence
        </p>
      </div>
    );
  }

  const skillsCount = profileData.technicalSkills?.length || profileData.strongSkills?.length || 0;
  const experienceCount = profileData.experience?.length || 0;
  const educationCount = profileData.education?.length || 0;
  const isProfileIncomplete = profileData.analysisStatus === 'incomplete_evidence' || (skillsCount === 0 && experienceCount === 0 && educationCount === 0);
  const profileCompletenessScore = typeof profileData.profileCompleteness === 'number'
    ? profileData.profileCompleteness
    : (typeof profileData.profileReadinessScore === 'number' ? profileData.profileReadinessScore : null);

  // STATE 4: Job Detected on Active Tab
  if (activeJob) {
    const matchedSkills = jobMatch?.matchScore?.matchedSkills || jobMatch?.matchedSkills || [];
    const missingSkills = jobMatch?.matchScore?.missingSkills || jobMatch?.missingSkills || jobMatch?.skillGaps?.filter((g: any) => g.status === 'missing')?.map((g: any) => g.skill) || [];
    const matchScore = typeof jobMatch?.matchScore?.score === 'number' ? jobMatch.matchScore.score : (typeof jobMatch?.match?.overall === 'number' ? jobMatch.match.overall : null);

    return (
      <div className="w-[380px] min-h-[520px] p-5 bg-obsidian-950 text-slate-100 font-sans border border-white/10 rounded-2xl flex flex-col justify-between select-none shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-20 -right-20 w-44 h-44 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-4 relative z-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="InterviewOS" className="w-8 h-8 rounded-xl object-cover shadow-lg shadow-indigo-500/25 border border-white/10" />
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">InterviewOS</h1>
                <p className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Job Detected
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                  chrome.storage.local.remove(['analyzedCandidate', 'isProfileAnalyzed']);
                }
                setProfileData(null);
                setActiveJob(null);
              }}
              className="text-[11px] text-slate-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Change Resume
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-obsidian-900/80 border border-white/10 space-y-1">
            <h2 className="text-sm font-bold text-white leading-tight line-clamp-1">{activeJob.jobTitle}</h2>
            <p className="text-xs text-indigo-400 font-medium line-clamp-1">{activeJob.company}</p>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-obsidian-900 via-obsidian-800 to-indigo-950/40 border border-white/10 text-center space-y-1 shadow-inner">
            <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
              {matchScore !== null ? `${matchScore}% Match` : '—'}
            </div>
            <p className="text-[11px] text-slate-400">
              {matchScore !== null ? 'Based on verified resume evidence' : 'Match score calculation pending'}
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {matchedSkills.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-emerald-400">Verified Matching Skills:</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {matchedSkills.map((sk: string) => (
                    <span key={sk} className="badge-emerald">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {missingSkills.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-amber-400">Missing Requirements:</p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {missingSkills.map((sk: string) => (
                    <span key={sk} className="badge-amber">
                      • {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => safeOpenSidePanel()}
          className="btn-primary w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-4 relative z-10"
        >
          <span>Start Technical Interview</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // STATE 2 / STATE 3: Resume analyzed (Non-job page or default)
  return (
    <div className="w-[380px] min-h-[500px] p-5 bg-obsidian-950 text-slate-100 font-sans border border-white/10 rounded-2xl flex flex-col justify-between select-none shadow-2xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-20 -right-20 w-44 h-44 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="InterviewOS" className="w-8 h-8 rounded-xl object-cover shadow-lg shadow-indigo-500/25 border border-white/10" />
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">InterviewOS</h1>
              <p className="text-[10px] text-indigo-400 font-medium">Candidate Active</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.remove(['analyzedCandidate', 'isProfileAnalyzed']);
              }
              setProfileData(null);
            }}
            className="text-[11px] text-slate-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Change Resume
          </button>
        </div>

        {isProfileIncomplete ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>
                Limited Profile Evidence {profileCompletenessScore !== null ? `(${profileCompletenessScore}%)` : '—'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div className="p-2 rounded-lg bg-obsidian-900/80 border border-white/5">
                <p className="text-[10px] text-slate-400">Skills</p>
                <p className="font-bold text-amber-400">{skillsCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-obsidian-900/80 border border-white/5">
                <p className="text-[10px] text-slate-400">Experience</p>
                <p className="font-bold text-amber-400">{experienceCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-obsidian-900/80 border border-white/5">
                <p className="text-[10px] text-slate-400">Education</p>
                <p className="font-bold text-amber-400">{educationCount}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed pt-0.5">
              Not enough information was found in this resume to generate complete candidate metrics.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Profile Verified</span>
              </div>
              <span className="text-xs font-bold text-emerald-300 truncate max-w-[150px]">
                {profileData.candidateName || 'Candidate'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-obsidian-900/80 border border-white/5">
                <p className="text-[10px] text-slate-400">Skills</p>
                <p className="font-bold text-emerald-400">{skillsCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-obsidian-900/80 border border-white/5">
                <p className="text-[10px] text-slate-400">Experience</p>
                <p className="font-bold text-emerald-400">{experienceCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-obsidian-900/80 border border-white/5">
                <p className="text-[10px] text-slate-400">Education</p>
                <p className="font-bold text-emerald-400">{educationCount}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-obsidian-900/80 border border-white/10 text-center space-y-2">
          <Briefcase className="w-5 h-5 text-indigo-400 mx-auto" />
          <p className="text-xs font-medium text-slate-200 leading-relaxed">
            Open any job posting on LinkedIn or Indeed to analyze match score and launch AI interview.
          </p>
        </div>
      </div>

      <button
        onClick={() => safeOpenSidePanel()}
        className="btn-secondary w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 mt-4 relative z-10"
      >
        <span>Open Sidepanel Workspace</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

