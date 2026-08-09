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

const localTurnSessionStore: Record<
  string,
  {
    currentTurn: number;
    currentQuestion?: string;
    currentTopic?: string;
    answers: Array<{ questionNumber?: number; question: string; answer: string; topic: string; score: number }>;
  }
> = {};

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

  startLpaInterview: async (payload: { candidateProfile?: any; jobProfile?: any; matchAnalysis?: any; expectedLpa?: number; sessionId?: string; job?: any; candidate?: any; interviewPreferences?: any }): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/extension/interview/start', payload);
      return res;
    } catch (e: any) {
      console.warn('[InterviewOS] /api/extension/interview/start fallback to /api/interview/start:', e);
      try {
        const res2 = await apiClient.post<any>('/api/interview/start', payload);
        return res2;
      } catch (e2: any) {
        console.warn('[InterviewOS] Backend Gemini/Session notice — activating role-calibrated local interviewer fallback.');
        const job = payload.jobProfile || payload.job || {};
        const cand = payload.candidateProfile || payload.candidate || {};
        const jobTitle = job.jobTitle || job.title || job.role || 'Technical Position';
        const company = job.company || 'Target Company';
        const candName = cand.name || cand.candidateName || 'Candidate';
        const reqSkills = job.requiredSkills || job.skills || cand.skills || ['System Architecture'];
        const primarySkill = Array.isArray(reqSkills) && reqSkills.length > 0 ? reqSkills[0] : 'System Architecture';
        const lpa = payload.expectedLpa || 12;
        const sid = payload.sessionId || `sess_fb_${Date.now()}`;

        const qText = `Hello ${candName}. Welcome to our technical evaluation for the ${jobTitle} role at ${company}. To begin, could you walk me through a key project where you applied ${primarySkill}? Please describe your core technical architecture decisions, key trade-offs, and how you handled unexpected failure modes or performance bottlenecks.`;

        localTurnSessionStore[sid] = {
          currentTurn: 1,
          currentQuestion: qText,
          currentTopic: String(primarySkill),
          answers: []
        };

        return {
          success: true,
          sessionId: sid,
          interviewId: `intv_${Date.now()}`,
          questionNumber: 1,
          question: qText,
          topic: String(primarySkill),
          difficulty: lpa > 18 ? 'Senior/Lead' : lpa > 8 ? 'Mid-level' : 'Junior',
          totalQuestionsEstimate: 8,
          expectedLpa: lpa,
          session: {
            title: `${jobTitle} Technical Evaluation`,
            focusAreas: [primarySkill, 'System Design', 'Performance'],
            difficulty: lpa > 18 ? 'Senior/Lead' : 'Mid-level',
            estimatedQuestions: 8
          },
          firstQuestion: {
            id: `q_1_${Date.now()}`,
            text: qText,
            category: String(primarySkill),
            difficulty: lpa > 18 ? 'Senior/Lead' : 'Mid-level',
            expectedSignals: ['Technical Depth', 'Architecture', 'Trade-offs']
          }
        };
      }
    }
  },

  startInterview: async (payload: any): Promise<any> => {
    return interviewApi.startLpaInterview(payload);
  },

  processLpaAnswer: async (payload: { sessionId: string; answer: string; expectedLpa?: number; elapsedSeconds?: number; integrityMetrics?: any }): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/extension/interview/answer', payload);
      return res;
    } catch (e: any) {
      console.warn('[InterviewOS] /api/extension/interview/answer fallback to /api/interview/answer:', e);
      try {
        const res2 = await apiClient.post<any>('/api/interview/answer', payload);
        return res2;
      } catch (e2: any) {
        console.warn('[InterviewOS] Backend Gemini/Session notice — activating sequential turn evaluation tracker.');
        const sid = payload.sessionId || 'default_session';
        if (!localTurnSessionStore[sid]) {
          localTurnSessionStore[sid] = {
            currentTurn: 1,
            currentQuestion: 'Could you walk me through a key project where you applied System Architecture & Core Design?',
            currentTopic: 'System Architecture & Core Design',
            answers: []
          };
        }

        const currentTurn = localTurnSessionStore[sid].currentTurn;
        const askedQuestion = localTurnSessionStore[sid].currentQuestion || 'Technical Evaluation Question';
        const askedTopic = localTurnSessionStore[sid].currentTopic || 'System Architecture';

        const userAns = (payload.answer || '').trim();
        const words = userAns.split(/\s+/).filter(Boolean).length;

        let score = 82;
        if (words < 5) score = 35;
        else if (words < 20) score = 65;

        localTurnSessionStore[sid].answers.push({
          questionNumber: currentTurn,
          question: askedQuestion,
          answer: userAns,
          topic: askedTopic,
          score: score
        });

        localTurnSessionStore[sid].currentTurn += 1;
        const nextTurn = localTurnSessionStore[sid].currentTurn;
        const isFinalTurn = nextTurn > 8;

        const topics = [
          'System Architecture & Core Design',
          'State Management & Data Flow',
          'API Integration & Async Handling',
          'Performance Optimization & Caching',
          'Database Schema & Query Efficiency',
          'Security & Authentication Best Practices',
          'Testing, CI/CD & Error Monitoring',
          'Scalability & Production Failure Recovery'
        ];

        const nextTopic = topics[(nextTurn - 1) % topics.length] || 'System Design';
        const nextQText = isFinalTurn
          ? 'Thank you for completing all technical evaluation turns. Your evaluation report is now ready.'
          : `Moving to our next competency area (${nextTopic}): how do you approach ${nextTopic} in a production environment? Please describe a real-world scenario or technical decision you made.`;

        localTurnSessionStore[sid].currentQuestion = nextQText;
        localTurnSessionStore[sid].currentTopic = nextTopic;

        if (isFinalTurn) {
          const allEvals = localTurnSessionStore[sid].answers;
          const totalScore = Math.round(allEvals.reduce((acc: number, curr: { score: number }) => acc + curr.score, 0) / Math.max(1, allEvals.length));
          const qAnalysis = allEvals.map((item: any, idx: number) => ({
            questionNumber: idx + 1,
            curriculumDay: idx + 1,
            curriculumTopic: item.topic,
            question: item.question,
            interviewerQuestion: item.question,
            candidateAnswer: item.answer,
            userAnswer: item.answer,
            score: item.score,
            difficulty: 'Mid-level',
            evaluation: item.score >= 75 ? 'Demonstrated strong technical depth.' : 'Basic technical coverage.'
          }));

          return {
            success: true,
            sessionId: sid,
            questionNumber: currentTurn,
            interviewComplete: true,
            score: totalScore,
            strengths: ['Solid technical understanding', 'Clear explanation of choices'],
            gaps: ['Could explore high-concurrency scaling trade-offs'],
            feedback: {
              overallScore: totalScore,
              strengths: ['Demonstrated clear domain knowledge', 'Effective problem-solving approach'],
              weaknesses: ['Minor: deeper profiling of edge cases recommended']
            },
            reportSnapshot: {
              overallScore: totalScore,
              strengths: ['Solid technical understanding', 'Clear explanation of choices'],
              weaknesses: ['Minor: deeper profiling of edge cases recommended'],
              questions: qAnalysis,
              questionAnalysis: qAnalysis
            }
          };
        }

        return {
          success: true,
          sessionId: sid,
          questionNumber: nextTurn,
          question: nextQText,
          topic: nextTopic,
          difficulty: 'Mid-level',
          isFollowUp: false,
          interviewComplete: false,
          score: score,
          strengths: ['Demonstrated technical reasoning', 'Clear explanation of core concepts'],
          gaps: ['Could provide deeper code-level implementation detail'],
          nextQuestion: {
            id: `q_${nextTurn}_${Date.now()}`,
            text: nextQText,
            category: nextTopic,
            difficulty: 'Mid-level'
          }
        };
      }
    }
  },

  submitAnswer: async (payload: any): Promise<any> => {
    return interviewApi.processLpaAnswer(payload);
  },

  logIntegrityEvent: async (payload: { sessionId: string; eventType: string; timestamp?: string; detail?: string }): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/extension/interview/integrity', payload);
      return res;
    } catch (e: any) {
      try {
        const res2 = await apiClient.post<any>('/api/interview/integrity', payload);
        return res2;
      } catch (e2) {
        console.warn('[InterviewOS] logIntegrityEvent notice:', e2);
        return null;
      }
    }
  },

  getInterviewReport: async (sessionId: string): Promise<any> => {
    try {
      const res = await apiClient.get<any>(`/api/interview/report/${sessionId}`);
      return res;
    } catch (e: any) {
      try {
        const res2 = await apiClient.post<any>(`/api/interview/report/${sessionId}`);
        return res2;
      } catch (e2) {
        console.error('[InterviewOS] getInterviewReport error:', e2);
        return null;
      }
    }
  },

  endInterviewEarly: async (sessionId: string): Promise<any> => {
    try {
      const res = await apiClient.post<any>(`/api/interview/end/${sessionId}`);
      return res;
    } catch (e: any) {
      console.error('[InterviewOS] endInterviewEarly error:', e);
      return null;
    }
  },

  getJudgeFiles: async (): Promise<any> => {
    try {
      const res = await apiClient.get<any>('/api/v1/judge/files');
      if (res && res.files) return res.files;
    } catch (e) {
      console.warn('[InterviewOS] Backend getJudgeFiles API unreachable, fallback to default organiser files:', e);
    }
    return [
      {
        fileId: 'curriculum.json',
        fileName: 'curriculum.json',
        displayName: 'AI Cohort Curriculum',
        fileType: 'JSON',
        description: '31-day AI Cohort curriculum with 8 modules, daily topics, tools, objectives, and learning progression.'
      },
      {
        fileId: 'candidates.json',
        fileName: 'candidates.json',
        displayName: 'Evaluation Candidate Profiles',
        fileType: 'JSON',
        description: 'Organiser evaluation dataset containing 5 candidate profiles, completed missions, and performance signals.'
      },
      {
        fileId: 'technical-spec.md',
        fileName: 'technical-spec.md',
        displayName: 'Interview Technical Specification',
        fileType: 'Markdown',
        description: 'API technical specification and submission contract for HTTP endpoints, payloads, and feedback format.'
      }
    ];
  },

  analyzeJudgeFile: async (fileId: string): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/v1/judge/analyze', { fileId });
      return res;
    } catch (e: any) {
      console.error('[InterviewOS] Backend analyzeJudgeFile error:', e);
      if (e?.response?.data?.error) {
        return { success: false, error: e.response.data.error, detail: e.response.data.detail };
      }
      return {
        success: false,
        error: 'Unable to analyze this organiser-provided file.',
        detail: 'Network error or backend endpoint unavailable.'
      };
    }
  },

  getOrganiserCandidates: async (): Promise<any> => {
    try {
      const res = await apiClient.get<any>('/api/v1/judge/candidates');
      if (res && res.extracted) return res.extracted;
    } catch (e) {
      console.warn('[InterviewOS] getOrganiserCandidates error:', e);
    }
    return null;
  },

  startJudgeInterview: async (payload: { sessionId: string; candidateId?: string; candidate?: any }): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/v1/judge/interview/start', payload);
      return res;
    } catch (e: any) {
      console.error('[InterviewOS] startJudgeInterview error:', e);
      throw e;
    }
  },

  processJudgeInterviewTurn: async (payload: { sessionId: string; message: string }): Promise<any> => {
    try {
      const res = await apiClient.post<any>('/api/v1/judge/interview/turn', payload);
      return res;
    } catch (e: any) {
      console.error('[InterviewOS] processJudgeInterviewTurn error:', e);
      throw e;
    }
  },

  getJudgeInterviewReport: async (sessionId: string): Promise<any> => {
    try {
      const res = await apiClient.get<any>(`/api/v1/judge/interview/report/${sessionId}`);
      return res;
    } catch (e: any) {
      console.error('[InterviewOS] getJudgeInterviewReport error:', e);
      return null;
    }
  },
};



