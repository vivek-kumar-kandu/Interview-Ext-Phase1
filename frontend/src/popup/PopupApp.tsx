import React, { useEffect, useState } from 'react';
import { ResumeUploadCard } from '../components/ResumeUploadCard';
import { CandidateProfileAnalysis } from '../types/profile';
import { getCandidateProfile } from '../services/firestore';
import { safeOpenSidePanel } from '../core/chrome';
import { Sparkles, Briefcase, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { interviewApi } from '../api/interview';

export const PopupApp: React.FC = () => {
  const [profileData, setProfileData] = useState<CandidateProfileAnalysis | null>(null);
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [jobMatch, setJobMatch] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
            }
          }
        });
      });
    }
  }, [profileData]);

  // STATE 1: No Candidate Profile Uploaded
  if (!profileData) {
    return (
      <div className="w-[380px] min-h-[480px] p-6 bg-[#0B0C10] text-slate-100 font-sans border border-[#232636] rounded-2xl flex flex-col justify-between select-none">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">InterviewOS</h1>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <ResumeUploadCard
            onProfileAnalyzed={(prof) => {
              setProfileData(prof);
              setErrorMessage(null);
            }}
          />
        </div>

        <p className="text-[11px] text-center text-slate-500 font-mono mt-4">
          Your resume will be analyzed by AI. No fake data.
        </p>
      </div>
    );
  }

  const skillsCount = profileData.technicalSkills?.length || profileData.strongSkills?.length || 0;
  const experienceCount = profileData.experience?.length || 0;
  const educationCount = profileData.education?.length || 0;
  const isProfileIncomplete = profileData.analysisStatus === 'incomplete_evidence' || (skillsCount === 0 && experienceCount === 0 && educationCount === 0);

  // STATE 4: Job Detected on Active Tab
  if (activeJob) {
    const matchedSkills = jobMatch?.matchScore?.matchedSkills || [];
    const missingSkills = jobMatch?.matchScore?.missingSkills || jobMatch?.skillGaps?.filter((g: any) => g.status === 'missing')?.map((g: any) => g.skill) || [];
    const matchScore = typeof jobMatch?.matchScore?.score === 'number' ? jobMatch.matchScore.score : (typeof jobMatch?.match?.overall === 'number' ? jobMatch.match.overall : null);


    return (
      <div className="w-[380px] min-h-[520px] p-5 bg-[#0B0C10] text-slate-100 font-sans border border-[#232636] rounded-2xl flex flex-col justify-between select-none">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h1 className="text-sm font-bold text-white tracking-tight">InterviewOS</h1>
            </div>
            <button
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                  chrome.storage.local.remove(['analyzedCandidate', 'isProfileAnalyzed']);
                }
                setProfileData(null);
                setActiveJob(null);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-300 underline"
            >
              Change Resume
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-white leading-tight">{activeJob.jobTitle}</h2>
            <p className="text-xs text-indigo-400 font-medium">{activeJob.company}</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
            <div className="text-2xl font-extrabold text-emerald-400">{matchScore}% Match</div>
            <p className="text-[11px] text-slate-400">Based on your candidate profile evidence</p>
          </div>

          <div className="space-y-3 text-xs">
            {matchedSkills.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-emerald-400">Verified Matching Skills:</p>
                <div className="flex flex-wrap gap-1.5">
                  {matchedSkills.map((sk: string) => (
                    <span key={sk} className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {missingSkills.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-amber-400">Missing Requirements:</p>
                <div className="flex flex-wrap gap-1.5">
                  {missingSkills.map((sk: string) => (
                    <span key={sk} className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-1">
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
          className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 mt-4"
        >
          <span>Start Technical Interview</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // STATE 2 / STATE 3: Resume analyzed (Job page or Non-job page)
  return (
    <div className="w-[380px] min-h-[500px] p-5 bg-[#0B0C10] text-slate-100 font-sans border border-[#232636] rounded-2xl flex flex-col justify-between select-none">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h1 className="text-sm font-bold text-white tracking-tight">InterviewOS</h1>
          </div>
          <button
            onClick={() => {
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.remove(['analyzedCandidate', 'isProfileAnalyzed']);
              }
              setProfileData(null);
            }}
            className="text-[11px] text-slate-500 hover:text-slate-300 underline"
          >
            Change Resume
          </button>
        </div>

        {isProfileIncomplete ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>Limited profile data (18% Completeness)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <p className="text-[10px] text-slate-400">Skills</p>
                <p className="font-bold text-amber-400">0 detected</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <p className="text-[10px] text-slate-400">Experience</p>
                <p className="font-bold text-amber-400">0 detected</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <p className="text-[10px] text-slate-400">Education</p>
                <p className="font-bold text-amber-400">0 detected</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
              Not enough information was found in this resume to generate reliable career recommendations.
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <CheckCircle className="w-4 h-4" />
                <span>Profile Ready</span>
              </div>
              <span className="text-xs font-bold text-emerald-300">{profileData.candidateName}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <p className="text-[10px] text-slate-400">Skills</p>
                <p className="font-bold text-emerald-400">{skillsCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <p className="text-[10px] text-slate-400">Experience</p>
                <p className="font-bold text-emerald-400">{experienceCount}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <p className="text-[10px] text-slate-400">Education</p>
                <p className="font-bold text-emerald-400">{educationCount}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <Briefcase className="w-6 h-6 text-indigo-400 mx-auto" />
          <p className="text-xs font-medium text-slate-200">
            Open any job posting to analyze your profile match and start a technical interview.
          </p>
        </div>
      </div>

      <button
        onClick={() => safeOpenSidePanel()}
        className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-2 mt-4"
      >
        <span>Open Sidepanel Workspace</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};
