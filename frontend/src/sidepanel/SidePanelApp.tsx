import React, { useState, useEffect } from 'react';
import { AiBotAvatar } from '../components/common/AiBotAvatar';
import {
  Clock,
  Sun,
  Moon,
  LayoutDashboard,
  ListOrdered,
  FileBarChart,
  Settings,
  Send,
  Download,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Zap,
  Target,
  Copy,
  Check,
  Award,
  ChevronRight,
  ChevronLeft,
  LogOut,

  UserPlus,
  AlertTriangle,
  FileText,
  RotateCw,
} from 'lucide-react';

import { useInterviewStore, extractSkillsFromJob } from '../store/interview.store';
import { downloadReportPDF, copyRecruiterSummary } from '../lib/reportExporter';

import { CandidateProfileAnalysis, normalizeProfileIdentity, detectPageCategory, ProfileComparisonResult } from '../types/profile';
import { MetricScore } from '../types/feedback';
import { LPAInterviewView } from '../components/interview/LPAInterviewView';




import { getProfileAnalysis, saveProfileAnalysis, getAllAnalyzedProfiles } from '../lib/profileStorage';
import { interviewApi } from '../api/interview';
import { ResumeUploadCard } from '../components/ResumeUploadCard';
import { CandidateCard } from '../components/CandidateCard';
import { DevVerificationPanel } from '../components/DevVerificationPanel';
import { ProfileSelectorModal } from '../components/common/ProfileSelectorModal';
import { MetricExplainabilityModal } from '../components/common/MetricExplainabilityModal';
import { AntiCheatingMonitor } from '../components/AntiCheatingMonitor';
import { RecommendedJobsView } from '../components/RecommendedJobsView';
import { JobRecommendationResponse } from '../types/jobRecommendation';
import { saveJobRecommendations, getJobRecommendations } from '../services/firestore';

export interface CanonicalJobMatchResult {
  success: boolean;
  jobId: string;
  matchScore: {
    score: number;
    label: string;
    breakdown?: any;
  };
  match: {
    overall: number;
    technical: number;
    experience: number;
    education: number;
    role: number;
  };
  matchedSkills: string[];
  missingSkills: string[];
  strongMatches: string[];
  skillGaps: Array<{ skill: string; status: string; evidence?: string }>;
  reasoning: string;
  recommendation: string;
}

export function normalizeJobMatchResponse(res: any): CanonicalJobMatchResult | null {
  if (!res || typeof res !== 'object') return null;

  const rawMatch = res.match || {};
  const rawMatchScore = res.matchScore || {};

  const overall = typeof rawMatch.overall === 'number'
    ? rawMatch.overall
    : typeof rawMatchScore.score === 'number'
    ? rawMatchScore.score
    : typeof res.score === 'number'
    ? res.score
    : null;

  if (overall === null) return null;

  const label = res.recommendation || rawMatchScore.label || (
    overall >= 80 ? 'Strong Match' : overall >= 60 ? 'Good Match' : 'Potential Match'
  );

  const matchScoreObj = {
    score: overall,
    label,
    breakdown: rawMatch.breakdown || rawMatchScore.breakdown || rawMatch
  };

  const matchScores = {
    overall,
    technical: typeof rawMatch.technical === 'number' ? rawMatch.technical : overall,
    experience: typeof rawMatch.experience === 'number' ? rawMatch.experience : overall,
    education: typeof rawMatch.education === 'number' ? rawMatch.education : overall,
    role: typeof rawMatch.role === 'number' ? rawMatch.role : overall,
  };

  const matchedSkills = Array.isArray(res.matchedSkills)
    ? res.matchedSkills
    : Array.isArray(rawMatchScore.matchedSkills)
    ? rawMatchScore.matchedSkills
    : [];

  const missingSkills = Array.isArray(res.missingSkills)
    ? res.missingSkills
    : Array.isArray(rawMatchScore.missingSkills)
    ? rawMatchScore.missingSkills
    : [];

  return {
    success: res.success !== false,
    jobId: res.jobId || '',
    matchScore: matchScoreObj,
    match: matchScores,
    matchedSkills,
    missingSkills,
    strongMatches: Array.isArray(res.strongMatches) ? res.strongMatches : matchedSkills,
    skillGaps: Array.isArray(res.skillGaps) ? res.skillGaps : [],
    reasoning: res.reasoning || res.explanationText || '',
    recommendation: label
  };
}


export type ExtensionView = 'profile_not_analyzed' | 'logged_out' | 'job_confirmation' | 'interview_dashboard' | 'recommended_jobs' | 'job_compare' | 'navigate_to_job' | 'onboarding' | 'lpa_interview';




export const SidePanelApp: React.FC = () => {
  const [extensionView, setExtensionView] = useState<ExtensionView>('job_confirmation');
  const [detectedJobDetails, setDetectedJobDetails] = useState<{
    url?: string;
    jobTitle?: string;
    company?: string;
    location?: string;
    platform?: string;
    description?: string;
    skills?: string[];
    requirements?: string[];
    employmentType?: string;
    experienceRequirement?: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [jobMatchStatus, setJobMatchStatus] = useState<'idle' | 'detecting_job' | 'extracting_job' | 'analyzing_match' | 'success' | 'error'>('idle');
  const [jobMatchError, setJobMatchError] = useState<string | null>(null);
  const jobMatchCacheRef = React.useRef<Map<string, any>>(new Map());


  const [navKey, setNavKey] = useState<'session' | 'chat' | 'reports' | 'settings'>('session');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [answerText, setAnswerText] = useState('');
  const [expandedWhyAsked, setExpandedWhyAsked] = useState<Record<string, boolean>>({});
  const [copiedSummaryToast, setCopiedSummaryToast] = useState(false);
  const [extractedContext, setExtractedContext] = useState<any>(null);
  const [profileAnalysis, setProfileAnalysis] = useState<CandidateProfileAnalysis | null>(null);
  const [profileState, setProfileState] = useState<'no_analysis' | 'analyzing' | 'analysis_complete' | 'already_analyzed' | 'profile_updated' | 'analysis_error' | 'insufficient_evidence'>('no_analysis');
  const [analysisErrorMsg, setAnalysisErrorMsg] = useState<string>('');
  const [profileStageIndex, setProfileStageIndex] = useState(0);
  const [allProfiles, setAllProfiles] = useState<CandidateProfileAnalysis[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ProfileComparisonResult | null>(null);
  const [dynamicComparison, setDynamicComparison] = useState<CanonicalJobMatchResult | any | null>(null);

  const [showComparison, setShowComparison] = useState(false);
  const [isMultiProfileActive, setIsMultiProfileActive] = useState(false);
  const [detectedJobList, setDetectedJobList] = useState<any[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalInitialTab, setProfileModalInitialTab] = useState<'list' | 'add'>('list');
  const [explainabilityModal, setExplainabilityModal] = useState<{
    isOpen: boolean;
    title: string;
    metric?: MetricScore | null;
    fallbackScore?: number;
    fallbackLabel?: string;
  }>({
    isOpen: false,
    title: 'Metric Score',
    metric: null
  });

  const [recommendationData, setRecommendationData] = useState<JobRecommendationResponse | null>(null);
  const [isRecsLoading, setIsRecsLoading] = useState(false);
  const [recsErrorMsg, setRecsErrorMsg] = useState<string | null>(null);
  const [isJobCompareLoading, setIsJobCompareLoading] = useState(false);
  const [prevView, setPrevView] = useState<ExtensionView>('profile_not_analyzed');

  const fetchJobRecommendations = async (profToUse?: CandidateProfileAnalysis | null) => {
    const targetProf = profToUse || profileAnalysis;
    if (!targetProf) {
      setRecsErrorMsg("Analyze your resume first before generating job recommendations.");
      return;
    }

    setIsRecsLoading(true);
    setRecsErrorMsg(null);

    const profId = targetProf.profileId || targetProf.profileHash || 'cand_1';

    // 1. Check in-memory state if already matches
    if (recommendationData && (recommendationData as any)._profId === profId) {
      setIsRecsLoading(false);
      return;
    }

    try {
      // Check local storage
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const storedRecsKey = `recs_${profId}`;
        const cached = await new Promise<any>((res) => chrome.storage.local.get([storedRecsKey], (r) => res(r[storedRecsKey])));
        if (cached && cached.recommendations && cached.recommendations.length > 0) {
          (cached as any)._profId = profId;
          setRecommendationData(cached);
          setIsRecsLoading(false);
          return;
        }
      }

      // Check Firestore
      const firestoreRecs = await getJobRecommendations(profId);
      if (firestoreRecs && firestoreRecs.recommendations && firestoreRecs.recommendations.length > 0) {
        firestoreRecs._profId = profId;
        setRecommendationData(firestoreRecs);
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ [`recs_${profId}`]: firestoreRecs });
        }
        setIsRecsLoading(false);
        return;
      }
    } catch (cacheErr) {
      console.warn('[InterviewOS] Cache lookup notice for recommendations:', cacheErr);
    }

    // 2. Fetch fresh recommendations from Backend API
    try {
      const res = await interviewApi.getJobRecommendations(targetProf);
      if (res && res.recommendations) {
        (res as any)._profId = profId;
        setRecommendationData(res);
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.set({ [`recs_${profId}`]: res });
        }
        saveJobRecommendations(profId, res);
      } else {
        setRecsErrorMsg("We couldn't find strong role matches from this resume.");
      }
    } catch (err: any) {
      console.error('[InterviewOS] Error fetching job recommendations:', err);
      setRecsErrorMsg(err.message || "Unable to generate job recommendations right now. Please try again.");
    } finally {
      setIsRecsLoading(false);
    }
  };

  const handleExploreJobs = (profToUse?: CandidateProfileAnalysis) => {
    const target = profToUse || profileAnalysis;
    // If a job listing is already detected on the current page, go straight to comparison.
    // The canonical comparison useEffect will handle the API call automatically.
    if (detectedJobDetails?.jobTitle) {
      setPrevView('profile_not_analyzed');
      setExtensionView('job_compare');
    } else {
      // No job detected — guide user to navigate to a job listing page
      setExtensionView('navigate_to_job');
    }
    // Pre-fetch AI recommendations in background for the recommended_jobs fallback view
    fetchJobRecommendations(target);
  };

  const {
    messages,
    isLoading,
    isDone,
    feedback,
    candidateProfile,
    isProfileAnalyzed: _isProfileAnalyzed,
    isLoggedOut,
    matchScore,
    readinessScore,
    requiredSkills,
    candidateSkills,
    missingSkills,
    jobSummary,
    progress,
    thinkingStage,
    startInterview,
    sendCandidateResponse,
    setJobContext,
    setCandidateProfile,
  } = useInterviewStore();

  const handleScrapeActiveTab = (forceSyncTabProfile = false) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (!activeTab?.id) {
          setIsScanning(false);
          return;
        }

        // 1. Check if active tab is a Candidate Profile Page across all supported platforms
        if (activeTab.url) {
          const pageDet = detectPageCategory(activeTab.url);
          if (pageDet.category === 'candidate_profile' && pageDet.profileId) {
            setDetectedJobDetails(null);
            setDetectedJobList([]);

            const currentCandId = candidateProfile?.id || profileAnalysis?.profileId;
            const isSameCandidate = currentCandId === pageDet.profileId;

            // If active profile is set to a different candidate, do NOT overwrite it unless explicitly requested (forceSyncTabProfile)
            if (!forceSyncTabProfile && currentCandId && !isSameCandidate) {
              setIsScanning(false);
              return;
            }

            setExtensionView((prev) =>
              (prev === 'interview_dashboard' || prev === 'recommended_jobs' || prev === 'navigate_to_job' || prev === 'job_compare') ? prev : 'profile_not_analyzed'
            );
            getProfileAnalysis(pageDet.profileId).then((existing) => {
              if (existing && (existing.profileReadinessScore ?? 0) > 0 && existing.analysisStatus === 'complete') {
                setProfileAnalysis(existing);
                const currentHash = candidateProfile?.profileHash;
                if (isSameCandidate && currentHash && existing.profileHash && currentHash !== existing.profileHash) {
                  setProfileState('profile_updated');
                } else {
                  setProfileState((prev) => (prev === 'analysis_complete' ? 'analysis_complete' : 'already_analyzed'));
                }
                setIsScanning(false);
              } else {
                if (forceSyncTabProfile && !profileAnalysis) {
                  setProfileAnalysis(null);
                  setProfileState('no_analysis');
                }
                setIsScanning(false);
              }
            });
            return;
          }
        }

        chrome.tabs.sendMessage(activeTab.id, { type: 'SCRAPE_JOB_NOW' }, (response) => {
          if (chrome.runtime.lastError || !response) {
            // Auto-inject content script if not present on this tab
            if (chrome.scripting && activeTab.id) {
              chrome.scripting.executeScript(
                { target: { tabId: activeTab.id }, files: ['content.js'] },
                () => {
                  if (!chrome.runtime.lastError) {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(activeTab.id!, { type: 'SCRAPE_JOB_NOW' }, (retryRes) => {
                        setIsScanning(false);
                        if (retryRes && retryRes.data && retryRes.data.jobTitle) {
                          const jobData = {
                            url: retryRes.data.url || activeTab.url || '',
                            jobTitle: retryRes.data.jobTitle,
                            company: retryRes.data.company || 'Target Company',
                            location: retryRes.data.location || 'Remote',
                            platform: retryRes.data.platform || 'Job Board',
                            description: retryRes.data.description || '',
                            skills: retryRes.data.skills || [],
                            requirements: retryRes.data.requirements || [],
                            employmentType: retryRes.data.employmentType || '',
                            experienceRequirement: retryRes.data.experienceRequirement || '',
                          };
                          setDetectedJobDetails(jobData);
                          setJobContext(jobData);
                        } else {
                          setDetectedJobDetails((prev) =>
                            (extensionView === 'navigate_to_job' || extensionView === 'job_compare') ? prev : null
                          );
                        }
                      });
                    }, 300);
                  } else {
                    setIsScanning(false);
                    setDetectedJobDetails((prev) =>
                      (extensionView === 'navigate_to_job' || extensionView === 'job_compare') ? prev : null
                    );
                  }
                }
              );
            } else {
              setIsScanning(false);
              setDetectedJobDetails((prev) =>
                (extensionView === 'navigate_to_job' || extensionView === 'job_compare') ? prev : null
              );
            }
          } else {
            setIsScanning(false);
            if (response.data && response.data.jobTitle) {
              const jobData = {
                url: response.data.url || activeTab.url || '',
                jobTitle: response.data.jobTitle,
                company: response.data.company || 'Target Company',
                location: response.data.location || 'Remote',
                platform: response.data.platform || 'Job Board',
                description: response.data.description || '',
                skills: response.data.skills || [],
                requirements: response.data.requirements || [],
                employmentType: response.data.employmentType || '',
                experienceRequirement: response.data.experienceRequirement || '',
              };
              setDetectedJobDetails(jobData);
              setJobContext(jobData);
            } else {
              setDetectedJobDetails((prev) =>
                (extensionView === 'navigate_to_job' || extensionView === 'job_compare') ? prev : null
              );
            }
          }
        });

      });
    } else {
      setIsScanning(false);
    }
  };


  const getActiveTabUrl = async (): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs[0];
          resolve(activeTab?.url || 'https://www.linkedin.com/in/me/');
        });
      } else {
        resolve(typeof window !== 'undefined' ? window.location.href : 'https://www.linkedin.com/in/me/');
      }
    });
  };

  const handleRunProfileAnalysis = async (customUrl?: string, customContext?: any) => {
    if (profileState === 'analyzing') return;
    setProfileAnalysis(null);
    setAnalysisErrorMsg('');
    setProfileState('analyzing');
    setProfileStageIndex(0);

    let contextToUse = customContext || null;

    if (!contextToUse && typeof chrome !== 'undefined' && chrome.tabs) {
      contextToUse = await new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const activeTab = tabs[0];
          if (activeTab?.id) {
            setProfileStageIndex(1);

            const activeTabUrl = activeTab.url || '';
            const isMatchingUrl = customUrl
              ? normalizeProfileIdentity(activeTabUrl).canonicalUrl === normalizeProfileIdentity(customUrl).canonicalUrl
              : true;

            if (!customUrl || isMatchingUrl) {
              chrome.tabs.sendMessage(activeTab.id, { type: 'SCRAPE_CANDIDATE_PROFILE_NOW' }, (response) => {
                if (chrome.runtime.lastError || !response || !response.data) {
                  // Auto-inject content script if not present on this tab
                  if (chrome.scripting && activeTab.id) {
                    chrome.scripting.executeScript(
                      { target: { tabId: activeTab.id }, files: ['content.js'] },
                      () => {
                        if (!chrome.runtime.lastError) {
                          setTimeout(() => {
                            chrome.tabs.sendMessage(activeTab.id!, { type: 'SCRAPE_CANDIDATE_PROFILE_NOW' }, (retryRes) => {
                              resolve(retryRes?.data || null);
                            });
                          }, 300);
                        } else {
                          resolve(null);
                        }
                      }
                    );
                  } else {
                    resolve(null);
                  }
                } else {
                  resolve(response.data);
                }
              });
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });
    }

    setProfileStageIndex(2);
    const activeUrl = customUrl || (await getActiveTabUrl());
    const { profileId, canonicalUrl, platform } = normalizeProfileIdentity(activeUrl);

    setProfileStageIndex(3);
    if (contextToUse) {
      setExtractedContext(contextToUse);
    }

    if (!contextToUse || !contextToUse.name || contextToUse.name.trim().toLowerCase() === 'candidate') {
      if (customUrl) {
        const urlParts = customUrl.split('/').filter(Boolean);
        const handle = urlParts[urlParts.length - 1] || '';
        const nameFromUrl = handle.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
        if (nameFromUrl && nameFromUrl.length >= 2) {
          const extractedFromSlug = extractSkillsFromJob(nameFromUrl, customUrl);
          contextToUse = {
            name: nameFromUrl,
            headline: `${nameFromUrl} Professional Profile`,
            keySkills: extractedFromSlug,
            profileUrl: customUrl,
          };
        }
      }
    }

    if (!contextToUse || !contextToUse.name || contextToUse.name.trim().toLowerCase() === 'candidate' || contextToUse.name.length < 2) {
      console.warn('[InterviewOS] No valid candidate profile context extracted from active tab.');
      setProfileAnalysis(null);
      setProfileState('analysis_error');
      setAnalysisErrorMsg('Could not extract enough information from this profile. Please ensure the profile page is fully loaded.');
      return;
    }

    setProfileStageIndex(4);
    try {
      const res = await interviewApi.analyzeCandidateProfile(profileId, platform, canonicalUrl, contextToUse);
      await saveProfileAnalysis(res);
      setProfileAnalysis(res);
      const topRole = (res.targetRoles && res.targetRoles[0]) || (res.recommendedRoles && res.recommendedRoles[0]) || '';
      setCandidateProfile({
        id: profileId,
        name: res.candidateName || contextToUse.name || 'Candidate',
        targetRole: topRole,
        keySkills: res.technicalSkills || contextToUse.keySkills || [],
        profileHash: res.profileHash || contextToUse.profileHash,
      });

      if (res.analysisStatus === 'insufficient_evidence') {
        setProfileState('insufficient_evidence');
      } else {
        setProfileState('analysis_complete');
      }
    } catch (err: any) {
      console.error('[InterviewOS] Profile Analysis Error:', err);
      setProfileAnalysis(null);
      setProfileState('analysis_error');
      const errText = err?.message || err?.toString() || '';
      if (errText.includes('429') || errText.includes('quota')) {
        setAnalysisErrorMsg('Gemini API daily quota limit reached. Serving evidence-based profile intelligence.');
      } else if (errText.includes('Failed to fetch') || errText.includes('NetworkError')) {
        setAnalysisErrorMsg('Backend service unavailable. Please verify FastAPI server is running on http://127.0.0.1:8000.');
      } else {
        setAnalysisErrorMsg(errText || 'Failed to generate profile analysis from backend API.');
      }
    }
  };

  const handleTriggerComparison = async (customProfiles?: CandidateProfileAnalysis[]) => {
    const isArray = Array.isArray(customProfiles);
    const profiles = isArray && customProfiles.length > 0 ? customProfiles : (await getAllAnalyzedProfiles());
    setAllProfiles(profiles);
    const res = await interviewApi.compareCandidateProfiles(profiles);
    setComparisonResult(res);
    setShowComparison(true);
  };

  const handleExploreJobsWithSelectedProfiles = async (selectedProfiles: CandidateProfileAnalysis[]) => {
    if (!selectedProfiles || selectedProfiles.length === 0) return;
    setAllProfiles(selectedProfiles);

    let targetProf: CandidateProfileAnalysis;

    if (selectedProfiles.length === 1) {
      targetProf = selectedProfiles[0];
      setProfileAnalysis(targetProf);
      setCandidateProfile({
        id: targetProf.profileId,
        name: targetProf.candidateName,
        targetRole: targetProf.targetRoles?.[0] || targetProf.headline || '',
        keySkills: targetProf.technicalSkills || [],
        profileHash: targetProf.profileHash,
      });
      setIsMultiProfileActive(false);
    } else {
      let compRes = comparisonResult;
      if (!compRes) {
        compRes = await interviewApi.compareCandidateProfiles(selectedProfiles);
        setComparisonResult(compRes);
      }

      const combinedNames = Array.from(new Set(selectedProfiles.map((p) => p.candidateName).filter(Boolean))).join(' & ');
      const combinedSkills = Array.from(
        new Set(
          selectedProfiles.flatMap((p) => [
            ...(p.technicalSkills || []),
            ...(p.strongSkills || []),
            ...((p as any).keySkills || []),
          ])
        )
      );
      const combinedRoles = Array.from(
        new Set(selectedProfiles.flatMap((p) => p.targetRoles || p.recommendedRoles || []))
      );

      targetProf = {
        ...selectedProfiles[0],
        profileId: `multi_${selectedProfiles.map((p) => p.profileId).join('_')}`,
        candidateName: combinedNames || 'Selected Candidate Profiles',
        headline: combinedRoles.slice(0, 2).join(' / ') || '',
        technicalSkills: combinedSkills,
        profileHash: `hash_multi_${Date.now()}`,
      };

      setCandidateProfile({
        id: targetProf.profileId,
        name: targetProf.candidateName,
        targetRole: targetProf.headline || '',
        keySkills: combinedSkills,
        profileHash: targetProf.profileHash,
      });

      setIsMultiProfileActive(true);
      setProfileAnalysis(targetProf);
    }

    setShowComparison(false);
    handleExploreJobs(targetProf);
  };

  const INVALID_FEED_TITLES = ['jobs', 'search', 'linkedin', 'careers', 'job', 'my jobs', 'preferences', 'feed', 'notifications', 'home', 'messages', 'profile', 'job tracker', 'my career insights'];

  const isValidJobTitle = (title?: string | null): boolean => {
    if (!title || title.trim().length < 2) return false;
    const lower = title.trim().toLowerCase();
    if (INVALID_FEED_TITLES.includes(lower) || lower.startsWith('jobs |') || lower.startsWith('jobs -')) return false;
    return true;
  };


  const lastComparedKeyRef = React.useRef<string>('');
  const inFlightJobIdRef = React.useRef<string>('');

  useEffect(() => {
    if (!isValidJobTitle(detectedJobDetails?.jobTitle) || !candidateProfile?.id) {
      setDynamicComparison(null);
      setJobMatchStatus('idle');
      lastComparedKeyRef.current = '';
      inFlightJobIdRef.current = '';
      return;
    }

    const jobUrl = (detectedJobDetails?.url || '').trim();
    const jobTitle = (detectedJobDetails?.jobTitle || '').trim();
    const jobCompany = (detectedJobDetails?.company || '').trim();
    const candId = candidateProfile.id;

    // Stable jobId key for Client-Side Caching (Requirement 8 & Requirement 13)
    const jobIdKey = jobUrl ? jobUrl.toLowerCase() : `${jobTitle.toLowerCase()}|${jobCompany.toLowerCase()}`;
    const fullKey = `${jobIdKey}__${candId}`;

    if (fullKey === lastComparedKeyRef.current || inFlightJobIdRef.current === fullKey) return;

    // PART 6 Validation: Validate title AND description before calling backend
    if (!jobTitle && !detectedJobDetails?.description) {
      setJobMatchStatus('error');
      setJobMatchError("JOB_CONTENT_UNAVAILABLE: Unable to read the job details from this page. Please open the full job posting and try again.");
      setIsJobCompareLoading(false);
      return;
    }

    inFlightJobIdRef.current = fullKey;
    lastComparedKeyRef.current = fullKey;

    // REQUIREMENT 7: Immediately clear/invalidate previous job metrics when new job detected!
    setDynamicComparison(null);
    setJobMatchError(null);

    // REQUIREMENT 8: Check Client-side Job ID/URL Based Cache
    const cached = jobMatchCacheRef.current.get(jobIdKey);
    if (cached) {
      console.log(`[JOB_MATCH] Using cached result for jobIdKey=${jobIdKey}`);
      setDynamicComparison(cached);
      setJobMatchStatus('success');
      setIsJobCompareLoading(false);
      inFlightJobIdRef.current = '';
      return;
    }

    // Lifecycle state transition (Requirement 7)
    setJobMatchStatus('analyzing_match');
    setIsJobCompareLoading(true);

    console.log('[JOB_MATCH_REQUEST]', {
      job_present: !!detectedJobDetails,
      title_present: !!detectedJobDetails?.jobTitle,
      description_chars: (detectedJobDetails?.description || '').length,
      company: detectedJobDetails?.company,
      url: detectedJobDetails?.url
    });

    interviewApi.analyzeJobMatch(candidateProfile, detectedJobDetails)
      .then((res) => {
        inFlightJobIdRef.current = '';
        console.log('[JOB_MATCH_CONTRACT]', {
          request: {
            titlePresent: !!detectedJobDetails?.jobTitle,
            descriptionPresent: !!detectedJobDetails?.description
          },
          response: {
            success: res?.success,
            analysisPresent: !!res,
            matchMetricDetailsPresent: !!(res?.match || res?.matchScore),
            matchScoreType: typeof (res?.match?.overall ?? res?.matchScore?.score)
          }
        });

        const normalized = normalizeJobMatchResponse(res);
        if (normalized) {
          jobMatchCacheRef.current.set(jobIdKey, normalized);
          setDynamicComparison(normalized);
          setJobMatchStatus('success');
          setJobMatchError(null);
        } else if (res && res.errorMessage) {
          setJobMatchStatus('error');
          setJobMatchError(res.errorMessage);
        } else {
          interviewApi.compareCandidateToJob(candidateProfile, detectedJobDetails)
            .then((legacyRes) => {
              const legacyNorm = normalizeJobMatchResponse(legacyRes);
              if (legacyNorm) {
                jobMatchCacheRef.current.set(jobIdKey, legacyNorm);
                setDynamicComparison(legacyNorm);
                setJobMatchStatus('success');
              } else {
                setJobMatchStatus('error');
                setJobMatchError('Job analysis returned an incomplete result. Please retry.');
              }
            })
            .catch(() => {
              setJobMatchStatus('error');
              setJobMatchError('Unable to analyze this job right now.');
            });
        }
        setIsJobCompareLoading(false);
      })
      .catch((err: any) => {
        inFlightJobIdRef.current = '';
        console.error('[InterviewOS] analyzeJobMatch error:', err);
        const errDetail = err?.message || err?.response?.data?.detail || 'Unable to analyze this job right now.';
        setJobMatchStatus('error');
        setJobMatchError(errDetail);
        setIsJobCompareLoading(false);
      });



  }, [detectedJobDetails?.url, detectedJobDetails?.jobTitle, detectedJobDetails?.company, candidateProfile?.id]);


  // Auto-scan immediately when entering navigate_to_job view, and check storage
  useEffect(() => {
    if (extensionView === 'navigate_to_job') {
      handleScrapeActiveTab();
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['activeJobPosting'], (res) => {
          if (res.activeJobPosting?.jobTitle) {
            setDetectedJobDetails({
              jobTitle: res.activeJobPosting.jobTitle,
              company: res.activeJobPosting.company || '',
              location: res.activeJobPosting.location || 'Remote',
              platform: res.activeJobPosting.platform || 'Job Board',
              description: res.activeJobPosting.description || '',
            });
          }
        });
      }
    }
  }, [extensionView]);

  // Auto-transition: navigate_to_job → job_compare when job detected.
  // Comparison is handled by the canonical useEffect above (no extra API call here).
  useEffect(() => {
    if (extensionView === 'navigate_to_job' && detectedJobDetails?.jobTitle && candidateProfile) {
      const timer = setTimeout(() => {
        setPrevView('navigate_to_job');
        setExtensionView('job_compare');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [detectedJobDetails?.jobTitle, detectedJobDetails?.company, extensionView, candidateProfile?.id]);

  useEffect(() => {
    handleScrapeActiveTab();

    // Check active tab profile identity across platforms
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.url) {
          const pageDet = detectPageCategory(activeTab.url);
          if (pageDet.category === 'candidate_profile' && pageDet.profileId) {
            const existing = await getProfileAnalysis(pageDet.profileId);
            if (existing && existing.analysisStatus === 'complete') {
              setProfileAnalysis(existing);
              setProfileState((prev) => (prev === 'analysis_complete' ? 'analysis_complete' : 'already_analyzed'));
            }
          }
        }
      });
    }

    // 1. Storage listener for real-time chrome.storage updates & candidate profile context
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['activeJobPosting', 'analyzedCandidate', 'isProfileAnalyzed', 'hasOnboarded'], (res) => {
        if (res.analyzedCandidate && res.analyzedCandidate.candidateName) {
          setProfileAnalysis(res.analyzedCandidate);
          setProfileState('analysis_complete');
          setCandidateProfile({
            id: res.analyzedCandidate.profileId || `cand_resume_${Date.now()}`,
            name: res.analyzedCandidate.candidateName,
            targetRole: (res.analyzedCandidate.targetRoles && res.analyzedCandidate.targetRoles[0]) || res.analyzedCandidate.headline || '',
            keySkills: res.analyzedCandidate.technicalSkills || [],
            profileHash: res.analyzedCandidate.profileHash,
          });
        } else if (!res.hasOnboarded) {
          // First time: no resume analyzed yet → show onboarding
          setExtensionView('onboarding');
        }

        if (res.activeJobPosting && res.activeJobPosting.jobTitle) {
          const jobData = {
            jobTitle: res.activeJobPosting.jobTitle,
            company: res.activeJobPosting.company || 'Target Company',
            location: res.activeJobPosting.location || 'Remote',
            platform: res.activeJobPosting.platform || 'LinkedIn',
            description: res.activeJobPosting.description || '',
          };
          setDetectedJobDetails(jobData);
          setJobContext(jobData);
          setIsScanning(false);
        }

      });

      const storageListener = (changes: Record<string, any>, areaName: string) => {
        if (areaName === 'local' && changes.activeJobPosting?.newValue) {
          const newJob = changes.activeJobPosting.newValue;
          if (newJob && newJob.jobTitle) {
            const jobData = {
              url: newJob.url || '',
              jobTitle: newJob.jobTitle,
              company: newJob.company || 'Target Company',
              location: newJob.location || 'Remote',
              platform: newJob.platform || 'LinkedIn',
              description: newJob.description || '',
              skills: newJob.skills || [],
              requirements: newJob.requirements || []
            };
            setDetectedJobDetails(jobData);
            setJobContext(jobData);
            setIsScanning(false);
          }
        }
      };
      chrome.storage.onChanged.addListener(storageListener);

      const messageListener = (msg: any) => {
        if (msg && msg.type === 'CANDIDATE_PROFILE_DETECTED' && msg.payload?.name) {
          const candData = msg.payload;
          setExtractedContext(candData);
          const { profileId } = normalizeProfileIdentity(candData.profileUrl || window.location.href);

          getProfileAnalysis(profileId, candData.profileHash).then((exactMatch) => {
            if (exactMatch && (exactMatch.profileReadinessScore ?? 0) > 0 && exactMatch.analysisStatus === 'complete') {
              setProfileAnalysis(exactMatch);
              setProfileState('already_analyzed');
            } else {
              getProfileAnalysis(profileId).then((previousAnalysis) => {
                if (previousAnalysis && previousAnalysis.profileHash && candData.profileHash && previousAnalysis.profileHash !== candData.profileHash) {
                  setProfileAnalysis(previousAnalysis);
                  setProfileState('profile_updated');
                }
              });
            }
          });

          setCandidateProfile({
            id: candData.id || profileId,
            name: candData.name,
            targetRole: candData.targetRole || candData.headline || '',
            keySkills: candData.keySkills || candData.skills || [],
            profileHash: candData.profileHash,
          });
          setExtensionView((prev) =>
            (prev === 'interview_dashboard' || prev === 'recommended_jobs' || prev === 'navigate_to_job' || prev === 'job_compare') ? prev : 'profile_not_analyzed'
          );
          setIsScanning(false);

        } else if (msg && msg.type === 'CANDIDATE_PROFILE_CLEARED') {
          // Do not wipe out stored candidate profile analysis when navigating non-profile tabs
          setExtractedContext(null);
        } else if (msg && msg.type === 'USER_LOGGED_OUT') {
          setExtensionView('logged_out');
          setIsScanning(false);
        } else if (msg && msg.type === 'JOB_PROFILE_DETECTED' && msg.payload?.jobTitle) {
          const newJob = msg.payload;
          const jobData = {
            url: newJob.url || '',
            jobTitle: newJob.jobTitle,
            company: newJob.company || 'Target Company',
            location: newJob.location || 'Remote',
            platform: newJob.platform || 'LinkedIn',
            description: newJob.description || '',
            skills: newJob.skills || [],
            requirements: newJob.requirements || []
          };
          setDetectedJobDetails(jobData);
          setJobContext(jobData);
          setIsScanning(false);
          // Auto-transition: if user is on navigate_to_job waiting for a job, jump to comparison.
          // isJobCompareLoading will be cleared by the deduplicated comparison useEffect.
          setExtensionView((prev) => {
            if (prev === 'navigate_to_job') {
              setPrevView('profile_not_analyzed');
              return 'job_compare';
            }
            return prev;
          });

        }
      };
      chrome.runtime.onMessage.addListener(messageListener);

      // 3. Periodic tab polling (every 1.5s) for instant real-time SPA profile & job switching
      const intervalId = setInterval(() => {
        handleScrapeActiveTab();
      }, 1500);

      // 4. Tab switch listeners
      if (chrome.tabs) {
        const onTabActivated = () => handleScrapeActiveTab();
        const onTabUpdated = (_tabId: number, changeInfo: any) => {
          if (changeInfo.status === 'complete' || changeInfo.url) {
            handleScrapeActiveTab();
          }
        };
        chrome.tabs.onActivated.addListener(onTabActivated);
        chrome.tabs.onUpdated.addListener(onTabUpdated);

        return () => {
          chrome.storage.onChanged.removeListener(storageListener);
          chrome.runtime.onMessage.removeListener(messageListener);
          chrome.tabs.onActivated.removeListener(onTabActivated);
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
          clearInterval(intervalId);
        };
      }

      return () => {
        chrome.storage.onChanged.removeListener(storageListener);
        chrome.runtime.onMessage.removeListener(messageListener);
        clearInterval(intervalId);
      };
    }
  }, []);

  // ─── ONBOARDING VIEW ──────────────────────────────────────────────────────
  if (extensionView === 'onboarding') {
    return (
      <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex flex-col select-none font-sans overflow-y-auto">
        {/* Hero */}
        <div className="relative overflow-hidden px-6 pt-10 pb-8 text-center bg-gradient-to-b from-indigo-950/60 to-[#0B0C10]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.15),transparent_70%)]" />
          <div className="relative z-10 space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl shadow-indigo-900/60">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Welcome to InterviewOS</h1>
              <p className="text-xs text-indigo-300 font-medium mt-1">AI-Powered Interview & Job Match Layer</p>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[260px] mx-auto">
              Upload your resume once and InterviewOS will compare it with any job listing you browse — in real time.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="px-5 py-4 space-y-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest text-center">How it works</p>
          {[
            {
              icon: <FileText className="w-5 h-5 text-indigo-400" />,
              color: 'bg-indigo-900/30 border-indigo-500/25',
              num: '01',
              title: 'Upload Your Resume',
              desc: 'Share your PDF or paste your resume for AI analysis'
            },
            {
              icon: <Zap className="w-5 h-5 text-violet-400" />,
              color: 'bg-violet-900/30 border-violet-500/25',
              num: '02',
              title: 'AI Builds Your Profile',
              desc: 'Skills, experience, and strengths extracted automatically'
            },
            {
              icon: <Target className="w-5 h-5 text-emerald-400" />,
              color: 'bg-emerald-900/30 border-emerald-500/25',
              num: '03',
              title: 'Compare with Any Job',
              desc: 'Browse LinkedIn, Naukri, Indeed — we match in real time'
            },
          ].map(({ icon, color, num, title, desc }) => (
            <div key={num} className={`flex items-start gap-3.5 p-3.5 rounded-xl border ${color}`}>
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-slate-800/60 flex items-center justify-center">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500">{num}</span>
                  <span className="text-sm font-semibold text-white">{title}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-8 mt-2 space-y-3">
          <button
            onClick={() => {
              // Mark onboarded so we don't show this screen again
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.set({ hasOnboarded: true });
              }
              setExtensionView('profile_not_analyzed');
            }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-indigo-900/50 active:scale-[0.98]"
          >
            <FileText className="w-4.5 h-4.5" />
            Get Started — Upload Resume
          </button>
          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Your resume is analyzed locally. Only job comparison data is sent to our AI.
          </p>
        </div>

        <div className="text-[11px] text-slate-600 font-mono text-center pb-3">
          InterviewOS • v1.0
        </div>
      </div>
    );
  }

  if (extensionView === 'logged_out' || isLoggedOut) {

    return (
      <div className="min-h-screen bg-[#0B0C10] text-slate-100 p-6 flex flex-col justify-between items-center select-none font-sans">
        <div className="w-full max-w-sm text-center pt-4 space-y-2">
          <div className="flex justify-center mb-2">
            <AiBotAvatar size="lg" />
          </div>
          <h1 className="text-xl font-bold font-display tracking-tight text-white">InterviewOS</h1>
          <p className="text-xs text-indigo-400 font-medium">AI Interview Layer for Hiring</p>
        </div>

        <div className="w-full max-w-sm my-auto">
          <div className="target-card p-6 border-amber-500/30 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-5 text-center shadow-2xl">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-base font-bold text-white">Please log in to LinkedIn</h2>
              <p className="text-xs text-slate-400 leading-relaxed px-1">
                Log in to your LinkedIn account before analyzing your candidate profile or scanning job postings.
              </p>
            </div>

            <button
              onClick={() => {
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                  chrome.tabs.create({ url: 'https://www.linkedin.com/login' });
                }
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <span>Log in to LinkedIn</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono text-center pb-2">
          InterviewOS • Authentication Required
        </div>
      </div>
    );
  }

  // Reusable Job Detected Banner — shown when user browses a job page while resume is analyzed
  const JobDetectedBanner = () => {
    if (!detectedJobDetails?.jobTitle || !profileAnalysis) return null;
    const quickMatch = dynamicComparison?.matchScore?.score ?? null;
    return (
      <div className="w-full mb-3 rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 to-violet-950/60 backdrop-blur-sm p-3 flex items-center gap-3 shadow-lg">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Target className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wide">Job Detected on this page</p>
          <p className="text-xs text-white font-medium truncate">
            {detectedJobDetails.jobTitle}{detectedJobDetails.company ? ` · ${detectedJobDetails.company}` : ''}
          </p>
          {quickMatch != null && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="h-1 w-16 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-700"
                  style={{ width: `${quickMatch}%` }}
                />
              </div>
              <span className="text-[10px] text-indigo-300 font-mono font-bold">{quickMatch}% match</span>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setPrevView(extensionView);
            setExtensionView('job_compare');
            // Canonical comparison useEffect handles the API call
          }}
          className="flex-shrink-0 text-[10px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
        >
          Compare <ChevronRight className="w-3 h-3" />
        </button>

      </div>
    );
  };

  if (extensionView === 'job_compare') {
    const jd = detectedJobDetails;
    const cmp: any = dynamicComparison;

    if (!isValidJobTitle(jd?.jobTitle)) {
      return (
        <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex flex-col select-none font-sans">
          <div className="sticky top-0 z-10 bg-[#0B0C10]/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setExtensionView('profile_not_analyzed')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              <ChevronDown className="w-4 h-4 rotate-90" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold text-white">Compare Resume with Job</h2>
              <p className="text-[10px] text-slate-400">Click or open any job posting to compare</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Scanning
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-indigo-950/60 border border-indigo-500/25 flex items-center justify-center shadow-xl shadow-indigo-950">
              <Target className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <h3 className="text-base font-bold text-white">No Specific Job Selected</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Click any job card on LinkedIn, Naukri, Indeed, or Glassdoor to automatically compare your resume in real time.
              </p>
            </div>
            <button
              onClick={() => handleScrapeActiveTab()}
              className="mt-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-xs flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/40 active:scale-95"
            >
              <RotateCw className="w-3.5 h-3.5" /> Scan Current Page Now
            </button>
          </div>
        </div>
      );
    }

    const matchScores = cmp?.match;
    const matchPct = matchScores?.overall ?? cmp?.matchScore?.score ?? 0;
    const labelText = cmp?.recommendation ?? cmp?.matchScore?.label ?? 'Fit Analysis';
    const matchedSkills = cmp?.matchedSkills ?? cmp?.matchScore?.matchedSkills ?? [];
    const missingSkills = cmp?.missingSkills ?? cmp?.matchScore?.missingSkills ?? [];
    const summaryText = cmp?.reasoning ?? cmp?.explanationText ?? '';
    const missingFromGaps = cmp?.skillGaps?.filter((g: any) => g.status === 'missing').map((g: any) => g.skill) ?? [];
    const allMissing = missingSkills.length > 0 ? missingSkills : missingFromGaps;

    return (

      <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex flex-col select-none font-sans">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0B0C10]/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setExtensionView(prevView)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">Job vs Resume Comparison</h2>
            <p className="text-[10px] text-slate-400 truncate">{jd?.jobTitle}{jd?.company ? ` · ${jd.company}` : ''}</p>
          </div>
          {cmp && matchPct > 0 && (
            <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
              matchPct >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              matchPct >= 60 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>{matchPct}% Match</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(isJobCompareLoading || jobMatchStatus === 'analyzing_match' || jobMatchStatus === 'detecting_job' || jobMatchStatus === 'extracting_job') && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm font-semibold text-white">Analyzing Job Match...</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Comparing {jd?.jobTitle || 'job posting'} at {jd?.company || 'target company'} with your analyzed resume profile...
              </p>
            </div>
          )}

          {jobMatchStatus === 'error' || (!isJobCompareLoading && jobMatchStatus !== 'analyzing_match' && !cmp) ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-sm text-slate-300 font-semibold">Unable to analyze this job right now.</p>
              <p className="text-xs text-slate-500 max-w-xs">{jobMatchError || "Ensure a resume is analyzed and a valid job page is open."}</p>
              <button
                onClick={() => {
                  if (detectedJobDetails && candidateProfile) {
                    setJobMatchStatus('analyzing_match');
                    setIsJobCompareLoading(true);
                    setJobMatchError(null);
                    interviewApi.analyzeJobMatch(candidateProfile, detectedJobDetails)
                      .then(res => {
                        if (res && res.success) {
                          setDynamicComparison(res);
                          setJobMatchStatus('success');
                        } else {
                          setJobMatchStatus('error');
                          setJobMatchError(res?.errorMessage || 'Unable to analyze this job right now.');
                        }
                      })
                      .catch(() => {
                        setJobMatchStatus('error');
                        setJobMatchError('Unable to analyze this job right now.');
                      })
                      .finally(() => setIsJobCompareLoading(false));
                  }
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-md"
              >
                <RotateCw className="w-3.5 h-3.5" /> Retry Analysis
              </button>
            </div>
          ) : null}

          {!isJobCompareLoading && cmp && (
            <>
              {/* Overall match bar */}
              <div className="rounded-xl border border-slate-700/60 bg-[#161822] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Estimated Match Fit</p>
                  <span className="text-xs font-semibold text-indigo-400 font-mono">{labelText}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        matchPct >= 80 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                        matchPct >= 60 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                        'bg-gradient-to-r from-red-500 to-rose-400'
                      }`}
                      style={{ width: `${matchPct}%` }}
                    />
                  </div>
                  <span className="text-lg font-black text-white font-mono">{matchPct}%</span>
                </div>
              </div>

              {/* Sub-scores breakdown */}
              {matchScores && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-[#161822] p-3 space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium">Technical Match</span>
                    <p className="text-sm font-bold text-indigo-400 font-mono">{matchScores.technical}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#161822] p-3 space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium">Experience Fit</span>
                    <p className="text-sm font-bold text-violet-400 font-mono">{matchScores.experience}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#161822] p-3 space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium">Role Alignment</span>
                    <p className="text-sm font-bold text-emerald-400 font-mono">{matchScores.role}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-[#161822] p-3 space-y-1">
                    <span className="text-[10px] text-slate-400 font-medium">Education Fit</span>
                    <p className="text-sm font-bold text-amber-400 font-mono">{matchScores.education}%</p>
                  </div>
                </div>
              )}

              {/* Matching skills */}
              {matchedSkills.length > 0 && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 space-y-2">
                  <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Matching Skills ({matchedSkills.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {matchedSkills.map((sk: string, i: number) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/40 font-medium">{sk}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing / strengthen skills */}
              {allMissing.length > 0 && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-4 space-y-2">
                  <p className="text-xs font-semibold text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Skills to Strengthen ({allMissing.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {allMissing.map((sk: string, i: number) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-900/40 text-rose-300 border border-rose-700/40 font-medium">{sk}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison explanation text */}
              {summaryText && (
                <div className="rounded-xl border border-slate-700/60 bg-[#161822] p-4 space-y-1">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Analysis Summary</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{summaryText}</p>
                </div>
              )}

              {/* CTA: Start Interview for this job */}
              <button
                onClick={() => {
                  if (jd) {
                    setExtensionView('lpa_interview');
                  }
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/40 active:scale-95"
              >
                <Zap className="w-4 h-4" /> Start Interview for this Role
              </button>
            </>
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-mono text-center py-2">
          InterviewOS • Live Job vs Resume Intelligence
        </div>
      </div>
    );
  }

  if (extensionView === 'lpa_interview') {
    return (
      <LPAInterviewView
        candidateProfile={profileAnalysis || candidateProfile}
        jobProfile={detectedJobDetails}
        matchAnalysis={dynamicComparison}
        onBackToCompare={() => setExtensionView('job_compare')}
      />
    );
  }



  if (extensionView === 'navigate_to_job') {
    const hasJob = !!detectedJobDetails?.jobTitle;
    return (
      <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex flex-col select-none font-sans">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0B0C10]/95 backdrop-blur-sm border-b border-slate-800 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setExtensionView('profile_not_analyzed')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-white">Compare Resume with Job</h2>
            <p className="text-[10px] text-slate-400">Navigate to a job listing page to compare</p>
          </div>
          {/* Live scanning indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Scanning
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Main state: no job detected */}
          {!hasJob && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              {/* Icon */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-900/60 to-violet-900/40 border border-indigo-500/20 flex items-center justify-center">
                  <Target className="w-9 h-9 text-indigo-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">No Job Listing Detected</h3>
                <p className="text-xs text-slate-400 leading-relaxed max-w-[240px]">
                  Navigate to any job listing page and InterviewOS will instantly compare it with your resume.
                </p>
              </div>

              {/* Step instructions */}
              <div className="w-full rounded-xl border border-slate-700/50 bg-[#161822] p-4 space-y-3 text-left">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">How it works</p>
                <div className="space-y-2.5">
                  {[
                    { num: '1', text: 'Open any job listing on a job board below', color: 'text-indigo-400' },
                    { num: '2', text: 'InterviewOS detects the job automatically', color: 'text-violet-400' },
                    { num: '3', text: 'Your resume is instantly compared with the role', color: 'text-emerald-400' },
                  ].map(({ num, text, color }) => (
                    <div key={num} className="flex items-start gap-2.5">
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full border border-current ${color} flex items-center justify-center text-[10px] font-bold mt-0.5`}>
                        {num}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Job board quick links */}
              <div className="w-full space-y-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide text-left">Open a job board</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', emoji: '💼' },
                    { name: 'Naukri', url: 'https://www.naukri.com/', emoji: '🔍' },
                    { name: 'Indeed', url: 'https://in.indeed.com/', emoji: '📋' },
                    { name: 'Glassdoor', url: 'https://www.glassdoor.co.in/Job/index.htm', emoji: '🪟' },
                    { name: 'Internshala', url: 'https://internshala.com/jobs/', emoji: '🎓' },
                    { name: 'Wellfound', url: 'https://wellfound.com/jobs', emoji: '🚀' },
                  ].map(({ name, url, emoji }) => (
                    <button
                      key={name}
                      onClick={() => {
                        if (typeof chrome !== 'undefined' && chrome.tabs) {
                          chrome.tabs.create({ url });
                        } else {
                          window.open(url, '_blank');
                        }
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-700/50 bg-slate-800/40 hover:bg-slate-700/60 hover:border-indigo-500/40 transition-all text-left group"
                    >
                      <span className="text-base">{emoji}</span>
                      <span className="text-xs text-slate-300 font-medium group-hover:text-white transition-colors">{name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="w-full flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[11px] text-slate-500">or</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              {/* Primary CTA: Manual scan */}
              <button
                onClick={() => handleScrapeActiveTab()}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <Loader2 className="w-4 h-4" />
                Scan Current Page Now
              </button>

              {/* Fallback: AI recommendations */}
              <button
                onClick={() => setExtensionView('recommended_jobs')}
                className="w-full py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-300 hover:text-indigo-200 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                View AI-Recommended Roles Instead
              </button>
            </div>
          )}


          {/* Job just detected while on this view — show it before auto-transition */}
          {hasJob && (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="w-16 h-16 rounded-2xl bg-emerald-900/30 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Job Listing Detected!</h3>
                <p className="text-sm text-emerald-400 font-semibold">{detectedJobDetails!.jobTitle}</p>
                {detectedJobDetails!.company && (
                  <p className="text-xs text-slate-400">{detectedJobDetails!.company}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setPrevView('navigate_to_job');
                  setExtensionView('job_compare');
                  // Canonical comparison useEffect handles the API call
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
              >

                <Zap className="w-4 h-4" /> Compare Resume with this Job
              </button>
            </div>
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-mono text-center py-2">
          InterviewOS • Live Job Detection
        </div>
      </div>
    );
  }

  if (extensionView === 'recommended_jobs') {

    return (
      <div className="min-h-screen bg-[#0B0C10] text-slate-100 flex flex-col select-none font-sans">
        {/* Job Detected Banner on Recommended Jobs view */}
        {detectedJobDetails?.jobTitle && profileAnalysis && (
          <div className="px-4 pt-4">
            <JobDetectedBanner />
          </div>
        )}
        <div className="flex-1 p-4">
          <RecommendedJobsView
            candidateProfile={profileAnalysis}
            recommendationData={recommendationData}
            isLoading={isRecsLoading}
            errorMessage={recsErrorMsg}
            onRetry={() => fetchJobRecommendations(profileAnalysis)}
            onBackToProfile={() => setExtensionView('profile_not_analyzed')}
            onUploadResumeClick={() => setExtensionView('profile_not_analyzed')}
            onStartJobInterview={(jobTitle) => {
              const syntheticJob = {
                jobTitle: jobTitle,
                company: 'Target Opportunity',
                description: `Candidate applying for ${jobTitle} role derived from candidate profile analysis recommendations.`
              };
              setDetectedJobDetails(syntheticJob);
              setExtensionView('interview_dashboard');
              startInterview(candidateProfile || undefined, syntheticJob);
            }}
          />
        </div>
        <div className="text-[11px] text-slate-500 font-mono text-center pb-2">
          InterviewOS • Dynamic AI Job Recommendations
        </div>
      </div>
    );
  }

  if (extensionView !== 'job_confirmation' && extensionView !== 'interview_dashboard') {

    const profileAnalysisSteps = [
      'Reading profile information',
      'Extracting technical skills & experience',
      'Identifying career positioning',
      'Evaluating target role compatibility',
      'Building candidate intelligence with Gemini AI',
    ];

    return (
      <div className="min-h-screen bg-[#0B0C10] text-slate-100 p-6 flex flex-col justify-between items-center select-none font-sans">
        {/* Top Back / Navigation Bar */}
        <div className="w-full max-w-sm flex items-center justify-between pt-1 pb-2">
          <button
            onClick={() => setExtensionView('onboarding')}
            className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1 transition shadow-sm"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-300" />
            <span>Upload New Resume</span>
          </button>
          <div className="text-[10px] text-indigo-400 font-mono font-semibold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
            InterviewOS
          </div>
        </div>

        {/* Header */}
        <div className="w-full max-w-sm text-center pt-2 space-y-2">
          <div className="flex justify-center mb-2">
            <AiBotAvatar size="lg" />
          </div>
          <h1 className="text-xl font-bold font-display tracking-tight text-white flex items-center justify-center gap-2">
            <span>👤 InterviewOS</span>
          </h1>
          <p className="text-xs text-indigo-400 font-medium">Persistent Candidate Profile Intelligence</p>
        </div>


        {/* Development Verification & Diagnostics Panel */}
        <div className="w-full max-w-sm font-sans">
          <DevVerificationPanel
            extractedContext={extractedContext}
            profileState={profileState}
            profileAnalysis={profileAnalysis}
            errorMessage={analysisErrorMsg}
          />
        </div>

        {/* Job Detected Banner — shown when user browses a job page while viewing their profile */}
        {detectedJobDetails?.jobTitle && profileAnalysis && (
          <div className="w-full max-w-sm mb-2">
            <JobDetectedBanner />
          </div>
        )}

        {/* Dynamic State Card Section */}
        <div className="w-full max-w-sm my-auto">
          {/* STATE 2: ANALYZING */}
          {profileState === 'analyzing' && (

            <div className="target-card p-6 border-indigo-500/40 bg-[#161822] space-y-5 text-center shadow-2xl">
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-indigo-400 font-bold text-sm">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing your profile...</span>
                </div>
                <p className="text-xs text-slate-400">Extracting candidate signals & building intelligence</p>
              </div>

              <div className="space-y-2 text-left text-xs font-mono pl-4 pt-2">
                {profileAnalysisSteps.map((stepText, idx) => {
                  const isDoneStep = idx < profileStageIndex;
                  const isCurrentStep = idx === profileStageIndex;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      {isDoneStep ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isCurrentStep ? (
                        <span className="text-indigo-400 font-bold text-sm shrink-0">→</span>
                      ) : (
                        <span className="text-slate-600 shrink-0">○</span>
                      )}
                      <span className={isDoneStep ? 'text-emerald-300 font-medium' : isCurrentStep ? 'text-indigo-200 font-bold' : 'text-slate-500'}>
                        {stepText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STATE 3: ANALYSIS COMPLETE / CAREER INTELLIGENCE */}
          { (profileState === 'insufficient_evidence' || (profileAnalysis && profileAnalysis.analysisStatus === 'insufficient_evidence')) && (
            <div className="target-card p-6 border-amber-500/40 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold w-fit">
                <XCircle className="w-3.5 h-3.5" />
                <span>⚠️ Profile Information Incomplete</span>
              </div>

              <div className="space-y-2">
                <h2 className="text-base font-bold text-white">Insufficient Profile Evidence</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {profileAnalysis?.summary || "Not enough profile information is available for a reliable career analysis."}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0B0C10] border border-slate-800 space-y-2 text-xs font-mono">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Detected Signals Breakdown</div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Name:</span>
                  <span className={extractedContext?.name ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {extractedContext?.name ? '✓ Extracted' : '✕ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Headline:</span>
                  <span className={extractedContext?.headline ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {extractedContext?.headline ? '✓ Extracted' : '✕ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Skills:</span>
                  <span className={(extractedContext?.keySkills?.length || extractedContext?.skills?.length || 0) > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {(extractedContext?.keySkills?.length || extractedContext?.skills?.length || 0) > 0 ? `✓ ${(extractedContext?.keySkills?.length || extractedContext?.skills?.length)} Skills` : '✕ 0 Skills'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Experience:</span>
                  <span className={(extractedContext?.experience?.length || 0) > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {(extractedContext?.experience?.length || 0) > 0 ? `✓ ${(extractedContext?.experience?.length)} Items` : '✕ 0 Entries'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Education:</span>
                  <span className={(extractedContext?.education?.length || 0) > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {(extractedContext?.education?.length || 0) > 0 ? `✓ ${(extractedContext?.education?.length)} Items` : '✕ 0 Entries'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed font-medium">
                💡 <strong>Action Required:</strong> Add skills, work experience, or education to your profile to unlock personalized target roles, fit scores, and career intelligence.
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => handleScrapeActiveTab()}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition text-center"
                >
                  <span>Refresh Profile</span>
                </button>
                <button
                  onClick={() => handleRunProfileAnalysis()}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition text-center"
                >
                  <span>Retry Analysis</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 3B: AI ANALYSIS ERROR */}
          {(profileState === 'analysis_error' || profileAnalysis?.analysisStatus === 'error') && (
            <div className="target-card p-6 border-rose-500/40 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold w-fit">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>AI Analysis Unavailable</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-base font-bold text-white">AI Analysis Failed</h2>
                <p className="text-xs text-rose-300 leading-relaxed font-semibold">
                  AI analysis unavailable. Please check your AI provider/API configuration.
                </p>
              </div>
              <button
                onClick={() => handleRunProfileAnalysis()}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition text-center"
              >
                <span>Retry Analysis</span>
              </button>
            </div>
          )}

          {profileState === 'analysis_complete' && profileAnalysis && (
            <div className="space-y-4">
              <CandidateCard analysis={profileAnalysis} onRetry={() => setProfileState('no_analysis')} />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => handleTriggerComparison()}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-300 font-semibold text-xs transition text-center flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Compare Profiles</span>
                </button>
                <button
                  onClick={() => handleExploreJobs()}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1 transition"
                >
                  <span>Explore Jobs</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STATE G: CROSS-PLATFORM PROFILE COMPARISON */}
          {showComparison && comparisonResult && (
            <div className="target-card p-6 border-indigo-500/40 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>🔄 Cross-Platform Comparison</span>
                </div>
                <span className="text-xs font-mono text-emerald-400 font-bold">
                  {comparisonResult.profileConsistencyScore}% Consistency
                </span>
              </div>

              <div className="space-y-1">
                <h2 className="text-base font-bold text-white">Your Cross-Platform Profiles ({allProfiles.length || 2})</h2>
                <p className="text-xs text-slate-400">Comparing technical positioning across hiring platforms</p>
              </div>

              {/* Consistency Breakdown */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[#0B0C10] border border-[#232636] flex items-center justify-between">
                  <span className="text-slate-400">Identity Consistency</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0C10] border border-[#232636] flex items-center justify-between">
                  <span className="text-slate-400">Experience Match</span>
                  <span className="text-emerald-400 font-bold">✓</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0C10] border border-[#232636] flex items-center justify-between">
                  <span className="text-slate-400">Skills Consistency</span>
                  <span className="text-indigo-300 font-bold">{comparisonResult.breakdown?.skillsConsistencyScore || 72}%</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0C10] border border-[#232636] flex items-center justify-between">
                  <span className="text-slate-400">Career Positioning</span>
                  <span className="text-indigo-300 font-bold">{comparisonResult.breakdown?.careerPositioningScore || 80}%</span>
                </div>
              </div>

              {/* Shared Strengths */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] uppercase font-mono font-bold text-emerald-400">Shared Strengths</span>
                <div className="flex flex-wrap gap-1.5">
                  {comparisonResult.sharedStrengths.map((s: any) => (
                    <span key={s} className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[11px]">✓ {s}</span>
                  ))}
                </div>
              </div>

              {/* Platform Unique Strengths */}
              <div className="space-y-2 text-xs">
                {Object.entries(comparisonResult.platformUniqueStrengths).map(([plat, sks]: [string, any]) => (
                  <div key={plat} className="space-y-1">
                    <span className="text-[10px] uppercase font-mono font-bold text-indigo-400">{plat} Strengths</span>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.isArray(sks) && sks.map((s: any) => (
                        <span key={s} className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 text-[11px]">+ {s}</span>
                      ))}

                    </div>
                  </div>
                ))}
              </div>

              {/* Profile Gap Notice */}
              {comparisonResult.profileGapNotice && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <p><strong>⚠ Profile Gap:</strong> {comparisonResult.profileGapNotice}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => handleExploreJobsWithSelectedProfiles(allProfiles)}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 transition text-center"
                >
                  <span>Explore Jobs for Both</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowComparison(false)}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition text-center"
                >
                  Back to Intelligence
                </button>
              </div>
            </div>
          )}

          {/* STATE 4: ALREADY ANALYZED */}
          {profileState === 'already_analyzed' && profileAnalysis && (
            <div className="target-card p-6 border-indigo-500/40 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>✓ Profile Already Analyzed</span>
                </div>
                <span className="text-[10px] font-mono text-indigo-400 font-bold">{profileAnalysis.profilePlatform}</span>
              </div>

              <div className="space-y-1">
                <h2 className="text-base font-bold text-white">{profileAnalysis.candidateName}</h2>
                <p className="text-xs text-slate-400">Last analyzed: <span className="text-slate-200">{profileAnalysis.analyzedAt || 'Today'}</span></p>
                <div className="flex items-center gap-2 text-xs pt-1">
                  <span className="text-slate-400 font-medium">Profile Readiness:</span>
                  <span className="text-emerald-400 font-extrabold text-sm">{profileAnalysis.profileReadinessScore}%</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#0B0C10] border border-[#232636] space-y-1 text-xs">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Best Target</span>
                <p className="text-indigo-300 font-bold text-sm">{profileAnalysis.targetRoles[0] || profileAnalysis.headline || ''}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setProfileState('analysis_complete')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition text-center"
                >
                  View Profile Intelligence
                </button>
                <button
                  onClick={() => handleRunProfileAnalysis(profileAnalysis.profileUrl)}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600/30 border border-indigo-500/50 hover:bg-indigo-600/50 text-indigo-300 font-semibold text-xs transition text-center"
                >
                  Refresh Analysis
                </button>
              </div>

              <button
                onClick={() => {
                  setProfileModalInitialTab('add');
                  setIsProfileModalOpen(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/40 text-indigo-200 font-bold text-xs transition text-center flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <span>+ Add / Switch Candidate Profile</span>
              </button>

              <div className="pt-3 border-t border-[#232636] space-y-2 text-center">
                <p className="text-xs text-slate-400">Ready to find your next opportunity?</p>
                <button
                  onClick={() => handleExploreJobs()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition"
                >
                  <span>Explore Jobs</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STATE: PROFILE UPDATED */}
          {profileState === 'profile_updated' && profileAnalysis && (
            <div className="target-card p-6 border-amber-500/40 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>Profile Updated</span>
                </div>
                <span className="text-[10px] font-mono text-amber-400 font-bold">{profileAnalysis.profilePlatform}</span>
              </div>

              <div className="space-y-2">
                <h2 className="text-base font-bold text-white">Your profile has changed</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  InterviewOS detected updates on your <strong>{profileAnalysis.profilePlatform}</strong> profile since your last analysis on {profileAnalysis.analyzedAt || 'recently'}.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0B0C10] border border-[#232636] space-y-1 text-xs">
                <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Previous Target Role</span>
                <p className="text-indigo-300 font-bold text-sm">{profileAnalysis.targetRoles[0] || profileAnalysis.headline || ''}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleRunProfileAnalysis(profileAnalysis.profileUrl)}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition text-center"
                >
                  Re-Analyze Profile
                </button>
                <button
                  onClick={() => setProfileState('already_analyzed')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition text-center"
                >
                  Keep Existing
                </button>
              </div>
            </div>
          )}

          {/* STATE 5: ANALYSIS ERROR */}
          {profileState === 'analysis_error' && (
            <div className="target-card p-6 border-rose-500/40 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-5 text-center shadow-2xl">
              <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <XCircle className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h2 className="text-base font-bold text-white">⚠ Profile Analysis Unavailable</h2>
                <p className="text-xs text-rose-300 leading-relaxed px-1">
                  {analysisErrorMsg || "We couldn't extract enough profile information or backend API call failed."}
                </p>
              </div>

              <button
                onClick={() => handleRunProfileAnalysis()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 flex items-center justify-center gap-2 transition"
              >
                <span>Retry Analysis</span>
              </button>
            </div>
          )}

          {/* STATE 1: RESUME UPLOAD ONLY */}
          {profileState === 'no_analysis' && (
            <div className="w-full">
              <ResumeUploadCard
                onProfileAnalyzed={(prof) => {
                  setProfileAnalysis(prof);
                  setProfileState('analysis_complete');
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-[11px] text-slate-500 font-mono text-center pb-2">
          InterviewOS • Persistent Profile Intelligence
        </div>
      </div>
    );
  }

  if (extensionView === 'job_confirmation') {
    return (
      <div className="min-h-screen bg-[#0B0C10] text-slate-100 p-6 flex flex-col justify-between items-center select-none font-sans">
        {/* Header */}
        <div className="w-full max-w-sm text-center pt-4 space-y-2">
          <div className="flex justify-center mb-2">
            <AiBotAvatar size="lg" />
          </div>
          <h1 className="text-xl font-bold font-display tracking-tight text-white">InterviewOS</h1>
          <p className="text-xs text-indigo-400 font-medium">AI Interview Layer for Hiring</p>
        </div>

        {/* Main Card Section */}
        <div className="w-full max-w-sm my-auto">
          {isScanning ? (
            <div className="target-card p-8 border-indigo-500/30 bg-[#161822] space-y-4 text-center">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-medium">Scanning active page for job posting...</p>
            </div>
          ) : detectedJobDetails ? (
            <div className="target-card p-6 border-indigo-500/30 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-5 shadow-2xl relative overflow-hidden">
              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Job posting detected</span>
                </div>
                {detectedJobDetails.platform && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                    {detectedJobDetails.platform}
                  </span>
                )}
              </div>

              {/* Job Profile Info */}
              <div className="space-y-3 pt-1">
                <span className="text-[10px] uppercase tracking-wider font-mono text-slate-500 font-bold block">
                  JOB PROFILE
                </span>
                <div>
                  <h2 className="text-lg font-extrabold text-white font-display leading-snug">
                    {detectedJobDetails.jobTitle}
                  </h2>
                  <p className="text-sm font-semibold text-indigo-300 mt-0.5">
                    {detectedJobDetails.company}
                  </p>
                </div>

                {detectedJobDetails.location && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 pt-1 font-medium">
                    <span>📍</span>
                    <span>{detectedJobDetails.location}</span>
                  </div>
                )}
              </div>

              {/* Candidate Intelligence Context Badge */}
              {candidateProfile && (
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Candidate Context:</span>
                  <span className="text-indigo-300 font-bold">{candidateProfile.name}{candidateProfile.targetRole ? ` • ${candidateProfile.targetRole}` : ''}</span>
                </div>
              )}

              {/* Dynamic Job Match & Skill Gap Evidence Section */}
              {dynamicComparison && dynamicComparison.matchScore && typeof dynamicComparison.matchScore.score === 'number' && (
                <div className="p-3 rounded-xl bg-[#0B0C10] border border-[#232636] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-mono font-bold text-indigo-400">Dynamic Job Match</span>
                      <button
                        onClick={() =>
                          setExplainabilityModal({
                            isOpen: true,
                            title: 'Job Match Score',
                            metric: dynamicComparison.matchScore
                          })
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-200 transition font-bold px-1 rounded hover:bg-indigo-500/20"
                        title="Click to see calculation & evidence breakdown"
                      >
                        ⓘ
                      </button>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-extrabold text-[11px] border border-emerald-500/40">
                      {dynamicComparison.matchScore.score}% • {dynamicComparison.matchScore.label}
                    </span>
                  </div>


                  {dynamicComparison.skillGaps && dynamicComparison.skillGaps.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {dynamicComparison.skillGaps.map((sg: any) => (

                        <span
                          key={sg.skill}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                            sg.status === 'matched'
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                              : sg.status === 'partially_matched'
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                              : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                          }`}
                          title={sg.evidence}
                        >
                          {sg.status === 'matched' ? '✓ ' : sg.status === 'partially_matched' ? '⚠ ' : '✕ '}
                          {sg.skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* CTA Action */}
              <div className="border-t border-[#232636] pt-4 text-center">
                <p className="text-xs text-slate-300 font-medium mb-4">
                  Ready to analyze this opportunity?
                </p>
                <button
                  onClick={() => {
                    setExtensionView('interview_dashboard');
                    startInterview(candidateProfile || undefined, detectedJobDetails);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Continue to Job Intelligence</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : detectedJobList && detectedJobList.length > 0 ? (
            <div className="target-card p-5 border-emerald-500/30 bg-gradient-to-b from-[#161822] to-[#0E1017] space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{detectedJobList.length} Jobs Detected on Page</span>
                </div>
                <button
                  onClick={() => handleExploreJobs()}
                  className="text-[10px] font-mono text-indigo-400 hover:underline"
                >
                  Refresh Jobs
                </button>
              </div>

              {isMultiProfileActive && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border border-indigo-500/40 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-indigo-500/20 text-indigo-300">👥</span>
                    <div>
                      <span className="font-bold text-white block">Multi-Profile Intelligence Active</span>
                      <span className="text-[11px] text-slate-300">Matching jobs using combined profile capabilities</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/30 text-indigo-200 text-[10px] font-mono font-bold">
                    {candidateProfile?.keySkills?.length || 0} Skills
                  </span>
                </div>
              )}

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {detectedJobList.map((job, idx) => {
                  const skills = (candidateProfile?.keySkills && candidateProfile.keySkills.length > 0)
                    ? candidateProfile.keySkills
                    : (profileAnalysis?.technicalSkills || []);
                  const titleLower = (job.jobTitle || '').toLowerCase();
                  const matchCount = skills.filter((s: string) => titleLower.includes(s.toLowerCase())).length;
                  const matchPct = Math.min(96, Math.max(68, 70 + matchCount * 8 + (idx % 3) * 4));

                  return (
                    <div key={idx} className="p-3.5 rounded-xl bg-[#0B0C10] border border-[#232636] space-y-2.5 hover:border-emerald-500/40 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-xs font-bold text-white leading-snug">{job.jobTitle}</h3>
                          <p className="text-[11px] font-semibold text-indigo-300">{job.company} • <span className="text-slate-400 font-normal">{job.location || 'Remote'}</span></p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] font-mono whitespace-nowrap">
                          {matchPct}% Fit
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {skills.slice(0, 3).map((sk: string, sIdx: number) => (
                          <span key={sIdx} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                            ✓ {sk}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          setExtensionView('interview_dashboard');
                          startInterview(candidateProfile || undefined, {
                            jobTitle: job.jobTitle,
                            company: job.company,
                            location: job.location || 'Remote',
                            platform: job.platform || 'LinkedIn',
                            description: job.description || job.jobTitle,
                            skills: skills.slice(0, 4)
                          });
                        }}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600/30 border border-emerald-500/40 hover:bg-emerald-600/50 text-emerald-300 font-bold text-xs transition flex items-center justify-center gap-1"
                      >
                        <span>Analyze & Start AI Interview</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setProfileState('already_analyzed')}
                className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition text-center"
              >
                ← Back to Profile Overview
              </button>
            </div>
          ) : (
            <div className="target-card p-6 border-slate-800 bg-[#161822] space-y-5 text-center shadow-xl">
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <HelpCircle className="w-6 h-6" />
              </div>

              <div className="space-y-2">
                <h2 className="text-base font-bold text-white">This is not a job listing page</h2>
                <p className="text-xs text-slate-400 leading-relaxed px-2">
                  Open a supported job posting on <span className="text-slate-200 font-semibold">LinkedIn, Greenhouse, Lever, Indeed, or Workday</span> to start your personalized AI interview co-pilot.
                </p>
              </div>

              {candidateProfile && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Candidate Intelligence Active</span>
                  </div>
                  <p className="text-slate-300">{candidateProfile.name}{candidateProfile.targetRole ? ` • Strongest for ${candidateProfile.targetRole}` : ''}</p>
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={() => {
                    if (typeof chrome !== 'undefined' && chrome.tabs) {
                      chrome.tabs.create({ url: 'https://www.linkedin.com/jobs/' });
                    }
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Navigate to Job Portal</span>
                </button>
                <button
                  onClick={() => handleExploreJobs()}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                  <span>Scan Active Page for Jobs</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-[11px] text-slate-500 font-mono text-center pb-2">
          InterviewOS • Adaptive AI Intelligence
        </div>
      </div>
    );
  }

  const interviewerMessages = messages.filter((m) => m.sender === 'interviewer');
  const latestMessage = interviewerMessages[interviewerMessages.length - 1];
  const latestQuestion = latestMessage?.text || 'Initializing technical interview session...';
  const latestWhyAsked = latestMessage?.whyAsked || 'AI evaluating job requirements and curriculum RAG to generate optimal technical turn.';

  const handleSubmitAnswer = () => {
    if (!answerText.trim() || isLoading || isDone) return;
    sendCandidateResponse(answerText);
    setAnswerText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const toggleWhyAsked = (id: string) => {
    setExpandedWhyAsked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopySummary = async () => {
    const success = await copyRecruiterSummary(feedback, jobSummary);
    if (success) {
      setCopiedSummaryToast(true);
      setTimeout(() => setCopiedSummaryToast(false), 2500);
    }
  };

  const handleDownloadPDF = () => {
    downloadReportPDF(feedback, jobSummary, candidateProfile);
  };

  const thinkingStagesList = [
    'Reading job description',
    'Understanding candidate profile',
    'Comparing technical skills',
    'Building interview strategy',
    'Generating technical question',
  ];

  return (
    <div className="min-h-screen bg-[#0B0C10] text-slate-100 font-sans flex flex-col antialiased">
      {/* Top Header Bar */}
      <header className="px-4 py-3 bg-[#161822] border-b border-[#232636] flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setExtensionView('profile_not_analyzed')}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 text-xs font-semibold"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-4 h-4 text-slate-300" />
            <span>Back</span>
          </button>
          <AiBotAvatar size="sm" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm font-display text-white tracking-tight">InterviewOS</span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono block">Enterprise AI Intelligence Platform</span>
          </div>
        </div>


        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30 text-[11px] font-semibold transition flex items-center gap-1.5 shadow-sm"
            title="Switch or Add Candidate Profile"
          >
            <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
            <span>{candidateProfile?.name ? candidateProfile.name : 'Profiles'}</span>
          </button>
          <button
            onClick={() => handleScrapeActiveTab()}
            className="px-2.5 py-1 rounded-lg bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/50 text-[11px] font-semibold transition flex items-center gap-1 shadow-sm"
            title="Scan active browser tab for job posting details"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span>Detect Active Job</span>
          </button>
          <button
            onClick={() => handleScrapeActiveTab()}
            className="px-2.5 py-1 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-[11px] font-semibold transition"
          >
            Restart
          </button>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0C10] border border-[#232636] text-slate-300 text-[11px] font-mono">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>{isDone ? 'Finished' : 'Live'}</span>
          </div>
          <button
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            {themeMode === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Interview Anti-Cheating & Integrity Monitor Bar */}
      <div className="px-4 pt-2 bg-[#0B0C10]">
        <AntiCheatingMonitor active={!isDone} />
      </div>

      {/* Main Body Layout: Responsive Navigation & Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation Bar */}
        <aside className="w-full md:w-52 bg-[#161822]/90 border-b md:border-b-0 md:border-r border-[#232636] p-3 flex flex-row md:flex-col justify-between shrink-0">
          <div className="flex md:flex-col gap-1 w-full overflow-x-auto md:overflow-x-visible">
            {/* OVERVIEW GROUP */}
            <button
              onClick={() => setNavKey('session')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition whitespace-nowrap ${
                navKey === 'session' ? 'bg-[#5B46F6] text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>

            {/* INTERVIEW GROUP */}
            <button
              onClick={() => setNavKey('chat')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition whitespace-nowrap ${
                navKey === 'chat' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <ListOrdered className="w-4 h-4 text-cyan-400" />
              <span>Stream ({messages.length})</span>
            </button>

            {/* REPORTS GROUP */}
            <button
              onClick={() => setNavKey('reports')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition whitespace-nowrap ${
                navKey === 'reports' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <FileBarChart className="w-4 h-4 text-emerald-400" />
              <span>Executive Report</span>
            </button>
          </div>

          <button
            onClick={() => setNavKey('settings')}
            className="hidden md:flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 rounded-xl transition"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </aside>

        {/* Center Workspace Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto space-y-5">
          {/* VIEW 1: Active Interview Workspace */}
          {navKey === 'session' && (
            <div className="space-y-5">
              {/* TOP CARDS RESPONSIVE GRID: Match Score, Readiness Score, Skill Gap Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Job Match Score Card */}
                <div className="target-card p-3.5 space-y-2 border-indigo-500/30 bg-gradient-to-br from-[#161822] to-indigo-950/20">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span>Job Match Score</span>
                      <button
                        onClick={() =>
                          setExplainabilityModal({
                            isOpen: true,
                            title: 'Job Match Score',
                            metric: jobSummary?.matchMetricDetails || dynamicComparison?.matchScore,
                            fallbackScore: matchScore,
                            fallbackLabel: matchScore >= 80 ? 'Strong Match' : 'Good Match'
                          })
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-200 transition font-bold px-1 rounded hover:bg-indigo-500/20"
                        title="Click to see calculation & evidence breakdown"
                      >
                        ⓘ
                      </button>
                    </div>
                    <Target className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-white font-display">{matchScore}%</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {matchScore >= 80 ? 'Strong Match' : matchScore >= 60 ? 'Moderate Match' : 'Gap Alignment'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {detectedJobDetails?.jobTitle ? `${detectedJobDetails.jobTitle} • ${detectedJobDetails.company || 'Detected Co'}` : `Based on ${requiredSkills.length} job requirements`}
                  </p>
                </div>

                {/* 2. Interview Readiness Score Card */}
                <div className="target-card p-3.5 space-y-2 border-emerald-500/30 bg-gradient-to-br from-[#161822] to-emerald-950/20">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <div className="flex items-center gap-1.5">
                      <span>Interview Readiness</span>
                      <button
                        onClick={() =>
                          setExplainabilityModal({
                            isOpen: true,
                            title: 'Interview Job Readiness',
                            metric: jobSummary?.jobReadinessMetricDetails || dynamicComparison?.jobReadiness,
                            fallbackScore: readinessScore,
                            fallbackLabel: readinessScore >= 80 ? 'High Readiness' : 'Baseline Assessment'
                          })
                        }
                        className="text-xs text-emerald-400 hover:text-emerald-200 transition font-bold px-1 rounded hover:bg-emerald-500/20"
                        title="Click to see calculation & readiness weights"
                      >
                        ⓘ
                      </button>
                    </div>
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-white font-display">{readinessScore}%</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {readinessScore >= 80 ? 'High Readiness' : 'Baseline Assessment'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">Calculated from profile & technical skills</p>
                </div>

                {/* 3. Skill Gap Breakdown Card */}
                <div className="target-card p-3.5 space-y-2 border-purple-500/30 bg-gradient-to-br from-[#161822] to-purple-950/20 sm:col-span-2 lg:col-span-1">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Skill Gap Breakdown</span>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className="text-slate-400 font-bold shrink-0">Req:</span>
                      <span className="text-slate-200 truncate">{requiredSkills.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">Have: {candidateSkills.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-rose-400 font-medium">
                      <XCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">Missing: {missingSkills.length > 0 ? missingSkills.join(', ') : 'None'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE INTERVIEW TOPIC ROADMAP STEPPER */}
              <div className="target-card p-4 space-y-2.5 border-indigo-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white tracking-wide uppercase">Live Interview Topic Roadmap</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Progress: {interviewerMessages.length} / {progress?.totalQuestions || Math.max(5, requiredSkills.length)} Turns
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
                  {(progress?.roadmapProgress?.length
                    ? progress.roadmapProgress
                    : requiredSkills.map((skill, idx) => ({
                        topic: skill,
                        status: idx === 0 ? 'active' : 'pending'
                      }))
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl text-center border text-[11px] font-medium transition ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : item.status === 'active'
                          ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20'
                          : 'bg-[#0B0C10] border-[#232636] text-slate-500'
                      }`}
                    >
                      <p className="truncate">{item.topic}</p>
                      <span className="text-[9px] uppercase font-mono block mt-0.5 opacity-80">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MAIN INTERVIEW WORKSPACE & AI ASSISTANT CARD */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Question & Answer Box */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold font-display text-white">Technical Turn Workspace</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Question {interviewerMessages.length} of {progress?.totalQuestions || Math.max(5, requiredSkills.length)}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Adaptive AI
                      </span>
                    </div>
                  </div>

                  {/* Main Question Box */}
                  <div className="target-card p-4 space-y-3 border-indigo-500/30 min-h-[140px]">
                    {isLoading ? (
                      <div className="space-y-3 py-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-indigo-400">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          <span>Analyzing opportunity...</span>
                        </div>
                        <div className="space-y-1.5 pl-6 text-xs font-mono">
                          {thinkingStagesList.map((stage, sIdx) => {
                            const isCompleted = sIdx < thinkingStage || (thinkingStage >= 4 && sIdx < 4);
                            const isCurrent = sIdx === thinkingStage;
                            return (
                              <div
                                key={stage}
                                className={`flex items-center gap-2 transition-all ${
                                  isCompleted
                                    ? 'text-emerald-400 font-semibold'
                                    : isCurrent
                                    ? 'text-indigo-300 font-bold'
                                    : 'text-slate-600'
                                }`}
                              >
                                <span>{isCompleted ? '✓' : isCurrent ? '●' : '○'}</span>
                                <span>{stage}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-white leading-relaxed">{latestQuestion}</p>

                        {/* EXPLAINABILITY DRAWER ("Why did I ask this?") */}
                        <div className="pt-2 border-t border-[#232636]">
                          <button
                            onClick={() => toggleWhyAsked('latest')}
                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Why was this question generated?</span>
                            {expandedWhyAsked['latest'] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {expandedWhyAsked['latest'] && (
                            <div className="mt-2 p-3 rounded-xl bg-[#0B0C10] border border-indigo-500/30 text-xs text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                              {latestWhyAsked}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Candidate Answer Textarea */}
                  <div className="space-y-2">
                    <div className="relative">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading || isDone}
                        placeholder={isDone ? 'Interview complete! View Executive Report tab.' : 'Type your technical answer here...'}
                        rows={5}
                        className="w-full bg-[#161822] border border-[#232636] focus:border-[#5B46F6] text-slate-100 placeholder-slate-500 rounded-xl p-3.5 text-xs outline-none transition resize-none focus:ring-1 focus:ring-[#5B46F6] disabled:opacity-50"
                      />
                      <span className="absolute bottom-3 left-4 text-[10px] text-slate-500 font-mono">
                        {answerText.length}/2000
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={!answerText.trim() || isLoading || isDone}
                        className="target-btn-primary text-xs flex items-center gap-2 disabled:opacity-50 px-4 py-2"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>Submit Response</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Guidance Sidebar Card */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="target-card p-4 space-y-3 border-indigo-500/20">
                    <div className="flex items-center gap-3">
                      <AiBotAvatar size="md" />
                      <div>
                        <h3 className="text-xs font-bold text-white">AI Interviewer Engine</h3>
                        <span className="text-[10px] text-emerald-400 font-medium">● Connected to {detectedJobDetails?.platform || 'Job Board'}</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Evaluating candidate turns against detected requirements for <span className="text-white font-semibold">{detectedJobDetails?.jobTitle || 'Target Position'}</span>.
                    </p>
                    <div className="space-y-2 pt-2 border-t border-[#232636]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Session Metadata</span>
                      <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                        <li className="flex justify-between">
                          <span className="text-slate-400">Total Turns</span>
                          <span className="text-indigo-400 font-bold">{messages.length}</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-slate-400">Candidate</span>
                          <span className="text-white truncate max-w-[100px]">{candidateProfile?.name}</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-slate-400">Status</span>
                          <span className={isDone ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                            {isDone ? 'Completed' : 'Active'}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Questions Stream & Turn History */}
          {navKey === 'chat' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Turn History & Explainability Log ({messages.length})</h3>
              <div className="target-card p-4 space-y-4 max-h-[520px] overflow-y-auto">
                {messages.map((m, idx) => (
                  <div key={m.id} className={`flex gap-3 ${m.sender === 'candidate' ? 'justify-end' : ''}`}>
                    {m.sender === 'interviewer' && <AiBotAvatar size="sm" />}
                    <div className={`space-y-1.5 max-w-[88%] ${m.sender === 'candidate' ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 text-[10px] text-slate-400 ${m.sender === 'candidate' ? 'justify-end' : ''}`}>
                        <span className="font-semibold text-white">
                          {m.sender === 'interviewer' ? `AI Interviewer (Turn #${Math.ceil((idx + 1) / 2)})` : 'Candidate'}
                        </span>
                        <span>{m.timestamp}</span>
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          m.sender === 'interviewer'
                            ? 'bg-[#0B0C10] border border-[#232636] rounded-tl-none text-slate-200'
                            : 'bg-[#5B46F6] text-white rounded-tr-none'
                        }`}
                      >
                        {m.text}
                      </div>

                      {/* Explainability drawer for historical interviewer questions */}
                      {m.sender === 'interviewer' && m.whyAsked && (
                        <div className="pt-1">
                          <button
                            onClick={() => toggleWhyAsked(m.id)}
                            className="text-[10px] text-indigo-400 hover:underline font-mono flex items-center gap-1"
                          >
                            <HelpCircle className="w-3 h-3" />
                            <span>Why was this question generated?</span>
                          </button>
                          {expandedWhyAsked[m.id] && (
                            <div className="mt-1.5 p-2.5 rounded-xl bg-[#0B0C10] border border-indigo-500/30 text-[11px] text-slate-300 font-mono whitespace-pre-line">
                              {m.whyAsked}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: Executive Report & PDF Export ("Mic Drop") */}
          {navKey === 'reports' && (
            <div className="space-y-5">
              {/* MIC DROP EXECUTIVE REPORT CARD */}
              <div className="target-card p-5 space-y-4 border-indigo-500/40 bg-gradient-to-br from-[#161822] via-[#12141F] to-indigo-950/30">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232636] pb-3">
                  <div>
                    <h2 className="text-lg font-bold font-display text-white">InterviewOS Executive Outcome Report</h2>
                    <p className="text-xs text-slate-400">
                      Target Role: <span className="text-white font-semibold">{detectedJobDetails?.jobTitle || jobSummary?.role || 'Target Position'}</span> •{' '}
                      Company: <span className="text-indigo-400 font-semibold">{detectedJobDetails?.company || jobSummary?.company || 'Target Organization'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadPDF}
                      className="px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={handleCopySummary}
                      className="px-3 py-1.5 rounded-xl border border-[#232636] bg-[#161822] hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      {copiedSummaryToast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSummaryToast ? 'Copied!' : 'Copy Summary'}</span>
                    </button>
                  </div>
                </div>

                {/* Score Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                  <div className="p-3.5 rounded-2xl bg-[#0B0C10] border border-[#232636] space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Overall Score</span>
                    <p className="text-2xl font-extrabold text-white font-display">{feedback?.overallScore || Math.min(96, matchScore + 4)}/100</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#0B0C10] border border-[#232636] space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Job Match</span>
                    <p className="text-2xl font-extrabold text-indigo-400 font-display">{feedback?.matchScore || matchScore}%</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#0B0C10] border border-[#232636] space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Interview Readiness</span>
                    <p className="text-2xl font-extrabold text-emerald-400 font-display">{feedback?.readinessScore || readinessScore}%</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#0B0C10] border border-[#232636] space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Recommendation</span>
                    <p className="text-sm font-extrabold text-purple-400 mt-1">{feedback?.hiringRecommendation || (matchScore >= 75 ? 'Strong Hire' : 'Potential Hire')}</p>
                  </div>
                </div>

                {/* Top Strength & Biggest Weakness */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>Top Strength</span>
                    </span>
                    <p className="text-xs text-slate-200">
                      {feedback?.strengths?.[0] || `${requiredSkills[0] || 'Technical Domain'} core concepts`}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      <span>Biggest Improvement Area</span>
                    </span>
                    <p className="text-xs text-slate-200">
                      {feedback?.weakAreas?.[0] || feedback?.gaps?.[0] || `${missingSkills[0] || 'Advanced Implementation'} practical depth`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Candidate Profile Manager Modal */}
      <ProfileSelectorModal
        isOpen={isProfileModalOpen}
        initialTab={profileModalInitialTab}
        onClose={() => setIsProfileModalOpen(false)}
        activeProfileId={candidateProfile?.id || profileAnalysis?.profileId}
        onSelectProfile={(prof) => {
          setProfileAnalysis(prof);
          setCandidateProfile({
            id: prof.profileId,
            name: prof.candidateName,
            targetRole: prof.targetRoles?.[0] || prof.headline || '',
            keySkills: prof.technicalSkills || [],
            profileHash: prof.profileHash,
          });
          setProfileState('already_analyzed');
          setExtensionView('profile_not_analyzed');
        }}
        onAnalyzeActiveTab={() => {
          setExtensionView('profile_not_analyzed');
          handleRunProfileAnalysis(undefined, undefined);
        }}
        onAnalyzeCustomUrl={(url) => {
          setExtensionView('profile_not_analyzed');
          handleRunProfileAnalysis(url);
        }}
        onTriggerComparison={handleTriggerComparison}
        onExploreJobsSelected={handleExploreJobsWithSelectedProfiles}
        onExploreJobsBoth={() => {
          getAllAnalyzedProfiles().then((profs) => handleExploreJobsWithSelectedProfiles(profs));
        }}
      />

      <MetricExplainabilityModal
        isOpen={explainabilityModal.isOpen}
        onClose={() => setExplainabilityModal((prev) => ({ ...prev, isOpen: false }))}
        title={explainabilityModal.title}
        metric={explainabilityModal.metric}
        fallbackScore={explainabilityModal.fallbackScore}
        fallbackLabel={explainabilityModal.fallbackLabel}
      />
    </div>
  );
};
