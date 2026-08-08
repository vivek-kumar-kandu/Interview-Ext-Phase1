import { apiClient } from './client';
import { Candidate } from '../types/candidate';
import { BackendFeedback, JobAnalysisSummary, ProgressMetrics } from '../types/feedback';
import { env } from '../core/env';
import { extractSkillsFromJob, computeDynamicSkillAnalysis } from '../store/interview.store';

export interface StartInterviewPayload {
  sessionId: string;
  candidate: Candidate | Record<string, unknown>;
  job?: Record<string, any>;
}

export interface SendResponsePayload {
  sessionId: string;
  message: string;
}

export type InterviewApiPayload = StartInterviewPayload | SendResponsePayload;


export interface InterviewApiResponse {
  reply: string;
  done: boolean;
  whyAsked?: string;
  matchScore?: number;
  readinessScore?: number;
  requiredSkills?: string[];
  candidateSkills?: string[];
  missingSkills?: string[];
  jobSummary?: JobAnalysisSummary;
  progress?: ProgressMetrics;
  feedback?: BackendFeedback;
}

export const interviewApi = {
  /**
   * Universal POST /api/interview endpoint execution
   * Accepts both session start payload and turn response payload
   */
  postInterview: async (payload: InterviewApiPayload): Promise<InterviewApiResponse> => {
    if (env.enableMockApi) {
      const jobObj = ('job' in payload && payload.job) ? payload.job : {};
      const jobTitle = jobObj.jobTitle || jobObj.role || 'Software Engineer';
      const company = jobObj.company || 'Target Company';
      const description = jobObj.description || '';

      const reqSkills = (jobObj.skills && jobObj.skills.length > 0)
        ? jobObj.skills
        : extractSkillsFromJob(jobTitle, description);

      const candidateObj = ('candidate' in payload && payload.candidate) ? (payload.candidate as any) : {};
      const candidateSkillsInput = candidateObj.keySkills || [];
      const analysis = computeDynamicSkillAnalysis(reqSkills, candidateSkillsInput);

      const defaultProgress: ProgressMetrics = {
        questionsCount: 'message' in payload ? 2 : 1,
        totalQuestions: Math.max(5, reqSkills.length),
        topicsCovered: [reqSkills[0] || 'Core Concepts'],
        remainingTopics: reqSkills.slice(1),
        roadmapProgress: analysis.roadmapProgress
      };

      if ('candidate' in payload) {
        const candName = candidateObj.name || 'Candidate';
        const primarySkill = reqSkills[0] || 'technical requirements';
        return {
          reply: `Welcome ${candName}. Preparing your AI Technical Interview for ${jobTitle} at ${company}.\n\nQuestion 1: In the context of ${jobTitle} at ${company}, how do you evaluate and implement ${primarySkill} best practices?`,
          done: false,
          whyAsked: `• Job posting requires ${primarySkill} for ${jobTitle} at ${company}.\n• Assessing baseline competency alignment against detected job requirements.\n• Evaluating practical domain experience.`,
          matchScore: analysis.matchScore,
          readinessScore: analysis.readinessScore,
          requiredSkills: analysis.requiredSkills,
          candidateSkills: analysis.candidateSkills,
          missingSkills: analysis.missingSkills,
          progress: defaultProgress,
          jobSummary: {
            company,
            role: jobTitle,
            detectedSkills: reqSkills,
            matchScore: analysis.matchScore,
            readinessScore: analysis.readinessScore,
            requiredSkills: analysis.requiredSkills,
            candidateSkills: analysis.candidateSkills,
            missingSkills: analysis.missingSkills,
          }
        };
      } else {
        const userMsg = payload.message || '';
        const isFinished = userMsg.toLowerCase().includes('finish') || userMsg.toLowerCase().includes('done');
        if (isFinished) {
          return {
            reply: `Interview Complete for ${jobTitle} position at ${company}. Generating detailed skill analysis.`,
            done: true,
            whyAsked: 'All required technical modules covered. Session finished.',
            matchScore: analysis.matchScore,
            readinessScore: Math.min(98, analysis.readinessScore + 5),
            requiredSkills: analysis.requiredSkills,
            candidateSkills: analysis.candidateSkills,
            missingSkills: analysis.missingSkills,
            progress: {
              ...defaultProgress,
              questionsCount: defaultProgress.totalQuestions,
              topicsCovered: reqSkills,
              remainingTopics: [],
            },
            feedback: {
              overallScore: Math.min(96, analysis.matchScore + 4),
              technicalKnowledge: Math.min(95, analysis.matchScore + 2),
              communication: 88,
              reasoning: 90,
              matchScore: analysis.matchScore,
              readinessScore: Math.min(98, analysis.readinessScore + 5),
              hiringRecommendation: analysis.matchScore >= 75 ? 'Strong Hire' : 'Potential Hire',
              summary: `Candidate demonstrated foundational understanding of ${reqSkills.slice(0, 2).join(' & ')} for ${jobTitle} at ${company}.`,
              strengths: reqSkills.slice(0, 2).map((s: string) => `${s} core fundamentals`),
              weakAreas: analysis.missingSkills.map((s: string) => `${s} practical depth`),
              learningRoadmap: analysis.missingSkills.map((s: string) => `Study ${s} implementation patterns`),
              recruiterSummary: `Candidate evaluated for ${jobTitle} at ${company}. Job Match: ${analysis.matchScore}%, Readiness: ${analysis.readinessScore}%. Recommendation: ${analysis.matchScore >= 75 ? 'Strong Hire' : 'Potential Hire'}.`,
              topStrength: reqSkills[0] || 'Core Domain',
              biggestWeakness: analysis.missingSkills[0] || 'Advanced Edge Cases',
              nextRecommendedTopic: analysis.missingSkills[0] || reqSkills[0] || 'System Design',
              gaps: analysis.missingSkills,
              next: analysis.missingSkills.slice(0, 2),
            },
          };
        }

        const nextSkill = reqSkills[1] || reqSkills[0] || 'Architecture';
        return {
          reply: `Follow-up Question: Regarding your implementation of ${nextSkill} — what trade-offs do you consider when optimizing for production scale?`,
          done: false,
          whyAsked: `• Follow-up generated based on candidate's previous response.\n• Drilling deeper into trade-offs and architectural reasoning for ${nextSkill}.\n• Evaluating job-specific technical depth.`,
          matchScore: analysis.matchScore,
          readinessScore: analysis.readinessScore,
          requiredSkills: analysis.requiredSkills,
          candidateSkills: analysis.candidateSkills,
          missingSkills: analysis.missingSkills,
          progress: defaultProgress,
        };
      }
    }


    // Direct REST API consumption from backend endpoint http://localhost:8000/api/interview
    let formattedPayload: Record<string, unknown> = { ...payload };
    if ('candidate' in payload && payload.candidate) {
      const cand = payload.candidate as Record<string, any>;
      const jobInput = 'job' in payload && payload.job ? payload.job : null;
      const targetJobTitle = jobInput?.jobTitle || cand.targetRole || 'Candidate';
      const targetCompany = jobInput?.company || 'Target Company';
      const targetSkills = jobInput?.skills && jobInput.skills.length > 0 ? jobInput.skills : (cand.keySkills || []);

      formattedPayload = {
        sessionId: payload.sessionId,
        candidate: {
          member: {
            id: cand.id || `cand_${Date.now()}`,
            name: cand.name || 'Candidate',
            jobRole: cand.targetRole || targetJobTitle,
            yearsExperience: cand.yearsExperience || 2,
            education: cand.education || 'Higher Education',
            status: cand.status || 'Active',
          },
          missions: (cand.keySkills || []).map((skill: string, idx: number) => ({
            day: (idx + 1) * 3,
            title: skill,
            passed: true,
            attempts: 1,
            skipped: false
          })),
          signals: { commitDays: 14, missionsCompleted: (cand.keySkills || []).length || 5, missionsFirstTry: 4 }
        },
        job: {
          jobTitle: targetJobTitle,
          company: targetCompany,
          description: jobInput?.description || '',
          skills: targetSkills
        }
      };
    }

    const response = await apiClient.post<InterviewApiResponse>('/api/interview', formattedPayload);
    return response;
  },

  analyzeCandidateProfile: async (
    profileId: string,
    platform: string,
    profileUrl: string,
    profileContext: Record<string, any>
  ): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/extension/analyze-profile', {
        profileId,
        platform,
        profileUrl,
        profileContext,
      });
      return res;
    } catch (e: any) {
      if (e?.response?.data) {
        return e.response.data;
      }
      console.error('[InterviewOS] Backend profile analysis failed:', e);
      throw e;
    }
  },

  uploadAndAnalyzeResume: async (file: File | null, resumeText?: string): Promise<any> => {
    try {
      const formData = new FormData();
      if (file) {
        formData.append('resume', file);
        formData.append('file', file);
      }
      if (resumeText) {
        formData.append('resumeText', resumeText);
      }

      const res = await apiClient.post<any>('/api/extension/analyze-resume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return res;
    } catch (e: any) {
      if (e?.response?.data?.detail) {
        throw new Error(e.response.data.detail);
      } else if (e?.response?.data?.message) {
        throw new Error(e.response.data.message);
      }
      console.error('[InterviewOS] Backend resume analysis failed:', e);
      throw e;
    }
  },

  compareCandidateProfiles: async (profiles: any[]): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/candidate/compare-profiles', { profiles });
      if (res) return res;
    } catch (e) {
      console.warn('[InterviewOS] Backend compare profiles error:', e);
    }

    const compared = profiles.map(p => ({
      platform: p.profilePlatform || p.platform || 'Web',
      profileId: p.profileId || 'cand',
      candidateName: p.candidateName || 'Candidate'
    }));

    const platformSkills: Record<string, string[]> = {};
    const allSkillsList: string[] = [];
    const allRolesList: string[] = [];

    profiles.forEach(p => {
      const plat = p.profilePlatform || p.platform || 'Web';
      const skills = (p.technicalSkills || p.strongSkills || p.keySkills || []) as string[];
      const roles = (p.targetRoles || p.recommendedRoles || []) as string[];
      platformSkills[plat] = Array.from(new Set(skills));
      skills.forEach(s => { if (!allSkillsList.includes(s)) allSkillsList.push(s); });
      roles.forEach(r => { if (!allRolesList.includes(r)) allRolesList.push(r); });
    });

    const sharedStrengths = allSkillsList.filter(skill =>
      Object.values(platformSkills).every(skList =>
        skList.some(s => s.toLowerCase() === skill.toLowerCase())
      )
    );

    const platformUniqueStrengths: Record<string, string[]> = {};
    Object.entries(platformSkills).forEach(([plat, skList]) => {
      const otherSkills = Object.entries(platformSkills)
        .filter(([p]) => p !== plat)
        .flatMap(([, list]) => list.map(s => s.toLowerCase()));
      platformUniqueStrengths[plat] = skList.filter(s => !otherSkills.includes(s.toLowerCase()));
    });

    const consistencyScore = profiles.length > 1
      ? Math.min(98, Math.max(50, Math.round((sharedStrengths.length / Math.max(1, allSkillsList.length)) * 100 + 40)))
      : 100;

    return {
      profilesCompared: compared,
      profileConsistencyScore: consistencyScore,
      breakdown: {
        identityConsistency: true,
        experienceConsistency: true,
        skillsConsistencyScore: consistencyScore,
        careerPositioningScore: Math.min(98, consistencyScore + 5),
      },
      sharedStrengths,
      platformUniqueStrengths,
      profileGapNotice: sharedStrengths.length < allSkillsList.length
        ? 'Your profiles present different technical skill sets across hiring platforms.'
        : 'Your profiles maintain consistent technical alignment across hiring platforms.',
      unifiedSkills: allSkillsList,
      unifiedTargetRoles: allRolesList,
    };
  },

  compareCandidateToJob: async (candidate: any, job: any): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/candidate/compare-job', {
        candidate,
        job
      });
      if (res) return res;
    } catch (e) {
      console.warn('[InterviewOS] /api/candidate/compare-job endpoint call failed:', e);
    }
    return null;
  },

  detectJobProfile: async (req: any): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/extension/detect-job', req);
      return res;
    } catch (e: any) {
      console.error('[InterviewOS] /api/extension/detect-job endpoint call failed:', e);
      return null;
    }
  },

  analyzeJobMatch: async (candidateProfile: any, job: any): Promise<any> => {

    try {
      const normalizedJob = {
        url: job?.url || '',
        title: job?.jobTitle || job?.title || '',
        company: job?.company || '',
        location: job?.location || '',
        description: job?.description || job?.rawDescription || '',
        skills: job?.skills || [],
        requirements: job?.requirements || []
      };
      const res = await apiClient.post<any>('/api/extension/analyze-job-match', {
        candidateProfile,
        job: normalizedJob
      });
      if (res) return res;
    } catch (e: any) {
      console.error('[InterviewOS] /api/extension/analyze-job-match endpoint call failed:', e);
      if (e?.response?.data?.detail) {
        throw new Error(e.response.data.detail);
      }
      throw e;
    }
    return null;
  },



  getJobRecommendations: async (profileAnalysis: any): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/candidate/recommend-jobs', {
        profileAnalysis
      });
      if (res) return res;
    } catch (e: any) {
      console.error('[InterviewOS] Failed to fetch job recommendations:', e);
      if (e?.response?.data?.detail) {
        throw new Error(e.response.data.detail);
      }
      throw e;
    }
  },

  startLpaInterview: async (payload: { candidateProfile: any; jobProfile: any; matchAnalysis: any; expectedLpa: number; sessionId?: string }): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/interview/start', payload);
      return res;
    } catch (e: any) {
      console.error('[InterviewOS] startLpaInterview failed:', e);
      const detail = e?.response?.data?.detail || e?.message || 'AI interviewer is temporarily unavailable. Please try again.';
      throw new Error(detail);
    }
  },

  processLpaAnswer: async (payload: { sessionId: string; answer: string; expectedLpa?: number }): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/interview/answer', payload);
      return res;
    } catch (e: any) {
      console.error('[InterviewOS] processLpaAnswer failed:', e);
      const detail = e?.response?.data?.detail || e?.message || 'AI interviewer is temporarily unavailable. Please try again.';
      throw new Error(detail);
    }
  },

  logIntegrityEvent: async (payload: { sessionId: string; eventType: string; timestamp?: string; detail?: string }): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/interview/integrity', payload);
      return res;
    } catch (e: any) {
      console.warn('[InterviewOS] logIntegrityEvent notice:', e);
      return null;
    }
  },
};


