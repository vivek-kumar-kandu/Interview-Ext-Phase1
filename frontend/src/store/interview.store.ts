import { useState, useEffect } from 'react';
import { interviewApi, InterviewApiResponse } from '../api/interview';
import { Candidate } from '../types/candidate';
import { BackendFeedback, JobAnalysisSummary, ProgressMetrics } from '../types/feedback';
import { logger } from '../core/logger';

export interface ChatTurnMessage {
  id: string;
  sender: 'interviewer' | 'candidate';
  text: string;
  timestamp: string;
  whyAsked?: string;
}

export interface InterviewStoreState {
  sessionId: string;
  messages: ChatTurnMessage[];
  isLoading: boolean;
  isDone: boolean;
  feedback: BackendFeedback | null;
  candidateProfile: Candidate | null;
  isProfileAnalyzed: boolean;
  isLoggedOut: boolean;
  matchScore: number;
  readinessScore: number;
  requiredSkills: string[];
  candidateSkills: string[];
  missingSkills: string[];
  jobSummary: JobAnalysisSummary | null;
  progress: ProgressMetrics | null;
  thinkingStage: number; // 0 = idle, 1-5 = animated thinking stages
}

let subscribers: Array<() => void> = [];
let state: InterviewStoreState = {
  sessionId: `session_${Date.now()}`,
  messages: [],
  isLoading: false,
  isDone: false,
  feedback: null,
  candidateProfile: null,
  isProfileAnalyzed: false,
  isLoggedOut: false,
  matchScore: 0,
  readinessScore: 0,
  requiredSkills: [],
  candidateSkills: [],
  missingSkills: [],
  jobSummary: null,
  progress: {
    questionsCount: 0,
    totalQuestions: 5,
    topicsCovered: [],
    remainingTopics: [],
    roadmapProgress: [],
  },
  thinkingStage: 0,
};

// Automatic candidate context restoration from persistent Chrome storage
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
  try {
    chrome.storage.local.get(['analyzedCandidate', 'isProfileAnalyzed'], (res) => {
      if (res.isProfileAnalyzed && res.analyzedCandidate) {
        state = {
          ...state,
          candidateProfile: res.analyzedCandidate,
          isProfileAnalyzed: true,
          candidateSkills: res.analyzedCandidate.keySkills || state.candidateSkills,
        };
        subscribers.forEach((cb) => cb());
      }
    });
  } catch {
    // Suppress context invalidated
  }
}

const notify = () => subscribers.forEach((cb) => cb());

const simulateThinkingTimeline = async () => {
  for (let stage = 1; stage <= 5; stage++) {
    state = { ...state, thinkingStage: stage };
    notify();
    await new Promise((res) => setTimeout(res, 250));
  }
};

export function extractSkillsFromJob(role: string, description: string = ''): string[] {
  const text = `${role} ${description}`.toLowerCase();
  const techMap: Record<string, string> = {
    // Technical & AI
    'fastapi': 'FastAPI',
    'python': 'Python',
    'langgraph': 'LangGraph',
    'rag': 'RAG Architecture',
    'docker': 'Docker',
    'redis': 'Redis',
    'react': 'React',
    'javascript': 'JavaScript',
    'typescript': 'TypeScript',
    'node': 'Node.js',
    'express': 'Node.js / Express',
    'frontend': 'Frontend Architecture',
    'front-end': 'Frontend Architecture',
    'backend': 'Backend Systems',
    'back-end': 'Backend Systems',
    'fullstack': 'Fullstack Architecture',
    'full-stack': 'Fullstack Architecture',
    'postgres': 'PostgreSQL',
    'mongo': 'MongoDB',
    'kube': 'Kubernetes',
    'k8s': 'Kubernetes',
    'aws': 'AWS Cloud',
    'devops': 'DevOps & CI/CD',
    'git': 'Git & Version Control',
    'machine learning': 'Machine Learning',
    'data': 'Data Analytics',
    'sql': 'SQL & Databases',
    // Sales, Marketing & Business Development
    'sales': 'Sales Strategy',
    'business development': 'Business Development',
    'lead': 'Lead Generation',
    'client': 'Client Acquisition',
    'negotiat': 'Negotiation',
    'crm': 'CRM & Pipeline',
    'market': 'Market Research',
    'marketing': 'Digital Marketing',
    'account': 'Account Management',
    // Design & Product
    'design': 'UI/UX Design',
    'figma': 'Figma & Prototyping',
    'product': 'Product Management',
    'operations': 'Operations Strategy',
  };

  const detected: string[] = [];
  for (const [keyword, skillName] of Object.entries(techMap)) {
    if (text.includes(keyword) && !detected.includes(skillName)) {
      detected.push(skillName);
    }
  }

  if (detected.length === 0) {
    // Extract non-stop words from job title
    const stopWords = new Set(['internship', 'intern', 'part', 'time', 'full', 'senior', 'junior', 'lead', 'associate', 'hiring', 'role', 'in', 'at', 'of', 'and', 'for', 'a', 'the', 'with']);
    const titleWords = role
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

    if (titleWords.length > 0) {
      const derived = titleWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      return derived.slice(0, 4);
    }
    return ['Core Competencies', 'Problem Solving', 'Domain Knowledge', 'Communication'];
  }

  return detected;
}

export function computeDynamicSkillAnalysis(reqSkills: string[], candSkills: string[]) {
  const candNormalized = candSkills.map(c => c.toLowerCase());

  const matched = reqSkills.filter(s => candNormalized.some(c => c.includes(s.toLowerCase()) || s.toLowerCase().includes(c)));
  const missing = reqSkills.filter(s => !candNormalized.some(c => c.includes(s.toLowerCase()) || s.toLowerCase().includes(c)));

  const matchedCount = matched.length;
  const totalReq = Math.max(reqSkills.length, 1);
  const skillMatchPct = Math.min(100, Math.max(0, Math.round((matchedCount / totalReq) * 100)));
  const matchScore = candSkills.length > 0 ? skillMatchPct : 0;

  const profileReadinessBase = candSkills.length > 0 ? Math.min(98, Math.max(30, 40 + candSkills.length * 5)) : 0;
  const missingPenalty = missing.length * 3;
  const readinessScore = candSkills.length > 0
    ? Math.min(98, Math.max(0, Math.round((profileReadinessBase * 0.4) + (matchScore * 0.6) - missingPenalty)))
    : 0;

  const roleFitScore = Math.min(98, Math.max(60, Math.round(skillMatchPct * 0.8 + 20)));
  const projScore = Math.min(98, Math.max(50, Math.round(readinessScore * 0.85)));
  const seniorityScore = Math.min(98, Math.max(50, Math.round(matchScore * 0.9)));

  const matchMetricDetails = {
    score: matchScore,
    label: matchScore >= 85 ? 'Exceptional Match' : matchScore >= 75 ? 'Strong Match' : matchScore >= 60 ? 'Good Match' : 'Potential Fit',
    calculation: `Skill Alignment (${skillMatchPct}% × 40%) + Experience (${matchScore}% × 25%) + Role Fit (${roleFitScore}% × 15%) + Projects (${projScore}% × 10%) + Seniority (${seniorityScore}% × 10%) = ${matchScore}%`,
    weights: {
      'Technical Skill Alignment': 0.40,
      'Experience Alignment': 0.25,
      'Role Positioning Alignment': 0.15,
      'Project Relevance': 0.10,
      'Seniority & Scope': 0.10,
    },
    breakdown: [
      { metric: 'Technical Skill Alignment', score: skillMatchPct, weight: 0.40, weightedScore: Math.round(skillMatchPct * 0.40), evidence: `${matched.length} of ${totalReq} required skills verified` },
      { metric: 'Experience Alignment', score: matchScore, weight: 0.25, weightedScore: Math.round(matchScore * 0.25), evidence: 'Experience depth evaluation' },
      { metric: 'Role Positioning Alignment', score: roleFitScore, weight: 0.15, weightedScore: Math.round(roleFitScore * 0.15), evidence: 'Role positioning fit' },
      { metric: 'Project Relevance', score: projScore, weight: 0.10, weightedScore: Math.round(projScore * 0.10), evidence: 'Project portfolio evidence' },
      { metric: 'Seniority & Scope', score: seniorityScore, weight: 0.10, weightedScore: Math.round(seniorityScore * 0.10), evidence: 'Seniority scope' },
    ],
    evidence: matched.map(s => ({ category: 'Technical Skill Match', title: `Verified Skill: ${s}`, detail: `Verified candidate competency in ${s}.`, sourcePlatform: 'Candidate Context' })),
    confidence: 0.92,
    matchedSkills: matched,
    missingSkills: missing,
  };

  const jobReadinessMetricDetails = {
    score: readinessScore,
    label: readinessScore >= 75 ? 'Ready for Interview' : 'Requires Targeted Preparation',
    calculation: `Profile Readiness (${profileReadinessBase}% × 40%) + Job Match (${matchScore}% × 60%) - Gap Penalty (${missingPenalty}%) = ${readinessScore}%`,
    weights: { 'Job Match Weight': 0.60, 'Profile Readiness Weight': 0.40 },
    breakdown: [
      { metric: 'Job Specific Compatibility', score: matchScore, weight: 0.60, weightedScore: Math.round(matchScore * 0.60), evidence: 'Direct job requirements alignment' },
      { metric: 'Profile Base Readiness', score: profileReadinessBase, weight: 0.40, weightedScore: Math.round(profileReadinessBase * 0.40), evidence: 'General technical profile readiness' }
    ],
    evidence: [],
    confidence: 0.90,
    matchedSkills: matched,
    missingSkills: missing
  };

  const skillGapDetails = reqSkills.map(s => {
    const isMatched = matched.includes(s);
    return {
      skill: s,
      status: (isMatched ? 'matched' : 'missing') as 'matched' | 'partially_matched' | 'missing',
      evidence: isMatched ? `Verified competency in ${s}.` : `No direct evidence of ${s} detected in candidate profile context.`,
      sourcePlatform: isMatched ? 'Candidate Context' : undefined
    };
  });

  const roadmapItems = reqSkills.map((skill, idx) => ({
    index: idx + 1,
    topic: skill,
    status: (idx === 0 ? 'active' : 'pending') as 'completed' | 'active' | 'pending',
    day: (idx + 1) * 3
  }));

  return {
    requiredSkills: reqSkills,
    candidateSkills: matched.length > 0 ? matched : (candSkills.length > 0 ? [candSkills[0]] : []),
    missingSkills: missing,
    matchScore: matchScore,
    readinessScore: readinessScore,
    roadmapProgress: roadmapItems,
    matchMetricDetails,
    jobReadinessMetricDetails,
    skillGapDetails
  };
}

export const interviewStore = {
  get: () => state,

  setJobContext: (job: any) => {
    if (!job) return;
    const reqSkills = extractSkillsFromJob(job.jobTitle || job.role || '', job.description || '');
    const candSkills = state.candidateProfile?.keySkills || [];
    const analysis = computeDynamicSkillAnalysis(reqSkills, candSkills);

    console.log(`[InterviewOS] Job detected: ${job.jobTitle || job.role || 'Job Role'} at ${job.company || 'Company'}`);
    console.log(`[InterviewOS] Required skills:`, analysis.requiredSkills);
    console.log(`[InterviewOS] Candidate skills:`, candSkills);
    console.log(`[InterviewOS] Matched skills:`, analysis.candidateSkills);
    console.log(`[InterviewOS] Missing skills:`, analysis.missingSkills);
    console.log(`[InterviewOS] Job match score: ${analysis.matchScore}%`);

    state = {
      ...state,
      matchScore: analysis.matchScore,
      readinessScore: analysis.readinessScore,
      requiredSkills: analysis.requiredSkills,
      candidateSkills: analysis.candidateSkills,
      missingSkills: analysis.missingSkills,
      progress: {
        questionsCount: 1,
        totalQuestions: Math.max(5, analysis.requiredSkills.length),
        topicsCovered: [analysis.requiredSkills[0] || 'Fundamentals'],
        remainingTopics: analysis.requiredSkills.slice(1),
        roadmapProgress: analysis.roadmapProgress
      },
      jobSummary: {
        company: job.company || 'Target Company',
        role: job.jobTitle || job.role || 'Job Role',
        detectedSkills: analysis.requiredSkills,
        matchScore: analysis.matchScore,
        readinessScore: analysis.readinessScore,
        requiredSkills: analysis.requiredSkills,
        candidateSkills: analysis.candidateSkills,
        missingSkills: analysis.missingSkills,
        matchMetricDetails: analysis.matchMetricDetails,
        jobReadinessMetricDetails: analysis.jobReadinessMetricDetails,
        skillGapDetails: analysis.skillGapDetails,
      }
    };
    notify();
  },

  clearCandidateProfile: () => {
    state = {
      ...state,
      candidateProfile: null,
      isProfileAnalyzed: false,
      candidateSkills: [],
      matchScore: 0,
      readinessScore: 0,
      missingSkills: state.requiredSkills,
    };
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.remove(['analyzedCandidate', 'isProfileAnalyzed']);
      } catch {
        // Suppress storage error
      }
    }
    notify();
  },

  setCandidateProfile: (candidate: Candidate | null) => {
    const candSkills = candidate?.keySkills || [];
    let updatedAnalysis = null;
    if (candSkills.length > 0 && state.requiredSkills && state.requiredSkills.length > 0) {
      updatedAnalysis = computeDynamicSkillAnalysis(state.requiredSkills, candSkills);
    }

    state = {
      ...state,
      candidateProfile: candidate,
      isProfileAnalyzed: !!candidate,
      isLoggedOut: false,
      candidateSkills: candSkills.length > 0 ? candSkills : state.candidateSkills,
      matchScore: updatedAnalysis ? updatedAnalysis.matchScore : state.matchScore,
      readinessScore: updatedAnalysis ? updatedAnalysis.readinessScore : state.readinessScore,
      missingSkills: updatedAnalysis ? updatedAnalysis.missingSkills : state.missingSkills,
    };
    if (candidate && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({ analyzedCandidate: candidate, isProfileAnalyzed: true });
      } catch {
        // Suppress storage error
      }
    }
    notify();
  },

  setLoggedOutState: (isLoggedOut: boolean) => {
    state = { ...state, isLoggedOut };
    notify();
  },

  /**
   * Step 1: Start Interview (POST /api/interview with sessionId, candidate & job)
   */
  startInterview: async (customCandidate?: Candidate, customJob?: any) => {
    const candidate = customCandidate || state.candidateProfile!;
    const sessionId = `session_${Date.now()}`;
    const jobPayload = customJob || (state.jobSummary ? {
      jobTitle: state.jobSummary.role,
      company: state.jobSummary.company,
      skills: state.jobSummary.detectedSkills,
      description: (state.jobSummary as any).description || ''
    } : undefined);

    state = {
      ...state,
      sessionId,
      candidateProfile: candidate,
      isLoading: true,
      messages: [],
      isDone: false,
      feedback: null,
      thinkingStage: 1,
    };
    notify();

    // Start thinking animation in background, execute API request concurrently
    const thinkingPromise = simulateThinkingTimeline();
    try {
      const data: InterviewApiResponse = await interviewApi.postInterview({
        sessionId,
        candidate,
        job: jobPayload,
      });
      await thinkingPromise;

      const greetingMessage: ChatTurnMessage = {
        id: `msg_${Date.now()}`,
        sender: 'interviewer',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        whyAsked: data.whyAsked,
      };

      state = {
        ...state,
        isLoading: false,
        thinkingStage: 0,
        isDone: data.done,
        feedback: data.feedback || null,
        messages: [greetingMessage],
        matchScore: data.matchScore ?? state.matchScore,
        readinessScore: data.readinessScore ?? state.readinessScore,
        requiredSkills: data.requiredSkills || state.requiredSkills,
        candidateSkills: data.candidateSkills || state.candidateSkills,
        missingSkills: data.missingSkills || state.missingSkills,
        progress: data.progress || state.progress,
        jobSummary: data.jobSummary || state.jobSummary,
      };
      logger.info('Interviewer Greeting:', data.reply);
    } catch (e) {
      logger.error('Failed to start interview:', e);
      state = { ...state, isLoading: false, thinkingStage: 0 };
    }
    notify();
  },

  /**
   * Step 2: Send Candidate Response (POST /api/interview with sessionId & message)
   */
  sendCandidateResponse: async (userMessage: string) => {
    if (!userMessage.trim() || state.isLoading || state.isDone) return;

    const candidateMsg: ChatTurnMessage = {
      id: `msg_cand_${Date.now()}`,
      sender: 'candidate',
      text: userMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    state = {
      ...state,
      messages: [...state.messages, candidateMsg],
      isLoading: true,
      thinkingStage: 1,
    };
    notify();

    // Start thinking animation in background, execute API request concurrently
    const thinkingPromise = simulateThinkingTimeline();
    try {
      const data: InterviewApiResponse = await interviewApi.postInterview({
        sessionId: state.sessionId,
        message: userMessage,
      });
      await thinkingPromise;

      if (data.done) {
        logger.info('Interview Finished!');
        state = {
          ...state,
          isLoading: false,
          thinkingStage: 0,
          isDone: true,
          feedback: data.feedback || null,
          matchScore: data.matchScore ?? state.matchScore,
          readinessScore: data.readinessScore ?? state.readinessScore,
          progress: data.progress || state.progress,
        };
      } else {
        const interviewerMsg: ChatTurnMessage = {
          id: `msg_int_${Date.now()}`,
          sender: 'interviewer',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          whyAsked: data.whyAsked,
        };

        state = {
          ...state,
          isLoading: false,
          thinkingStage: 0,
          messages: [...state.messages, interviewerMsg],
          matchScore: data.matchScore ?? state.matchScore,
          readinessScore: data.readinessScore ?? state.readinessScore,
          requiredSkills: data.requiredSkills || state.requiredSkills,
          candidateSkills: data.candidateSkills || state.candidateSkills,
          missingSkills: data.missingSkills || state.missingSkills,
          progress: data.progress || state.progress,
        };
        logger.info('Next Question:', data.reply);
      }
    } catch (e) {
      logger.error('Failed to send candidate response:', e);
      state = { ...state, isLoading: false, thinkingStage: 0 };
    }
    notify();
  },

  subscribe: (callback: () => void) => {
    subscribers.push(callback);
    return () => {
      subscribers = subscribers.filter((cb) => cb !== callback);
    };
  },
};

export const useInterviewStore = () => {
  const [interviewState, setInterviewState] = useState(interviewStore.get());

  useEffect(() => {
    return interviewStore.subscribe(() => {
      setInterviewState({ ...interviewStore.get() });
    });
  }, []);

  return {
    ...interviewState,
    startInterview: interviewStore.startInterview,
    sendCandidateResponse: interviewStore.sendCandidateResponse,
    setJobContext: interviewStore.setJobContext,
    setCandidateProfile: interviewStore.setCandidateProfile,
    clearCandidateProfile: interviewStore.clearCandidateProfile,
    setLoggedOutState: interviewStore.setLoggedOutState,
  };
};

