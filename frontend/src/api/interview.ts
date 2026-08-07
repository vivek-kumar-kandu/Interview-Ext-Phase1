import { apiClient } from './client';
import { Candidate } from '../types/candidate';
import { BackendFeedback, JobAnalysisSummary, ProgressMetrics } from '../types/feedback';
import { env } from '../core/env';

export interface StartInterviewPayload {
  sessionId: string;
  candidate: Candidate | Record<string, unknown>;
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
      const defaultReqSkills = ['FastAPI', 'Docker', 'LangGraph', 'Redis'];
      const defaultCandSkills = ['FastAPI', 'LangGraph', 'Python', 'React'];
      const defaultMissingSkills = ['Docker', 'Redis'];

      const defaultProgress: ProgressMetrics = {
        questionsCount: 'message' in payload ? 2 : 1,
        totalQuestions: 8,
        topicsCovered: ['FastAPI', 'LangGraph'],
        remainingTopics: ['RAG', 'Docker', 'Redis'],
        roadmapProgress: [
          { index: 1, topic: 'FastAPI', status: 'completed', day: 7 },
          { index: 2, topic: 'LangGraph', status: 'active', day: 10 },
          { index: 3, topic: 'RAG Architecture', status: 'pending', day: 13 },
          { index: 4, topic: 'Docker Containerization', status: 'pending', day: 21 },
          { index: 5, topic: 'Redis Caching & State', status: 'pending', day: 28 },
        ]
      };

      if ('candidate' in payload) {
        return {
          reply: `Welcome ${payload.candidate.name || 'Alex Johnson'}. Preparing your AI Technical Interview for AI Engineer at OpenAI.\n\nQuestion 1: Explain how you optimize FastAPI async endpoint concurrency and database connection pool sizing under high stress loads.`,
          done: false,
          whyAsked: `• Job requires FastAPI & async system architecture for AI Engineer at OpenAI.\n• Curriculum RAG targets module: FastAPI.\n• Evaluating baseline technical depth for initial interview turn.`,
          matchScore: 92,
          readinessScore: 88,
          requiredSkills: defaultReqSkills,
          candidateSkills: defaultCandSkills,
          missingSkills: defaultMissingSkills,
          progress: defaultProgress,
        };
      } else {
        const isFinished = payload.message.toLowerCase().includes('finish') || payload.message.toLowerCase().includes('done');
        if (isFinished) {
          return {
            reply: 'Interview Complete. Generating your detailed skill gap analysis and executive report.',
            done: true,
            whyAsked: 'All curriculum modules completed. Interview concluded.',
            matchScore: 92,
            readinessScore: 88,
            requiredSkills: defaultReqSkills,
            candidateSkills: defaultCandSkills,
            missingSkills: defaultMissingSkills,
            progress: {
              ...defaultProgress,
              questionsCount: 8,
              topicsCovered: ['FastAPI', 'LangGraph', 'RAG Architecture', 'Docker Containerization', 'Redis Caching & State'],
              remainingTopics: [],
            },
            feedback: {
              overallScore: 88,
              technicalKnowledge: 90,
              communication: 86,
              reasoning: 89,
              matchScore: 92,
              readinessScore: 88,
              hiringRecommendation: 'Strong Hire',
              summary: 'Alex Johnson demonstrated exceptional system architecture depth, async connection pooling expertise, and state orchestration capability.',
              strengths: [
                'System Architecture & Async Processing',
                'LangGraph Orchestration & Turn Memory',
                'Structured Technical Reasoning',
                'FastAPI High-Throughput Endpoint Design',
              ],
              weakAreas: [
                'Docker Networking & Multi-Stage Image Optimization',
                'Redis Cluster Partitioning under peak concurrent traffic',
              ],
              learningRoadmap: [
                'Review Docker multi-stage build caching strategies',
                'Implement Redis sentinel fallback failover logic for state persistence',
              ],
              recruiterSummary: 'Candidate Alex Johnson evaluated for AI Engineer at OpenAI. Overall Score: 88/100, Job Match: 92%, Interview Readiness: 88%. Recommendation: Strong Hire. Top Strength: System Architecture.',
              topStrength: 'System Architecture',
              biggestWeakness: 'Docker Deployment',
              nextRecommendedTopic: 'Redis',
              gaps: ['Docker Deployment'],
              next: ['Redis'],
            },
          };
        }
        return {
          reply: `Follow-up Question: Deepening into state management — how do you design LangGraph checkpointers to prevent state corruption when worker instances fail mid-graph execution?`,
          done: false,
          whyAsked: `• Follow-up generated based on previous candidate response.\n• Drilling deeper into trade-offs and edge cases for LangGraph state persistence.\n• Validating practical implementation depth.`,
          matchScore: 92,
          readinessScore: 88,
          requiredSkills: defaultReqSkills,
          candidateSkills: defaultCandSkills,
          missingSkills: defaultMissingSkills,
          progress: defaultProgress,
        };
      }
    }


    // Direct REST API consumption from backend endpoint http://localhost:8000/api/interview
    let formattedPayload: Record<string, unknown> = { ...payload };
    if ('candidate' in payload && payload.candidate) {
      const cand = payload.candidate as Record<string, any>;
      formattedPayload = {
        sessionId: payload.sessionId,
        candidate: {
          member: {
            id: cand.id || 'cand_01',
            name: cand.name || 'Alex Johnson',
            jobRole: cand.targetRole || cand.jobRole || 'Senior Frontend Engineer',
            yearsExperience: cand.yearsExperience || 5,
            education: cand.education || 'B.S. Computer Science',
            status: cand.status || 'Active',
          },
          missions: [],
          signals: { commitDays: 10, missionsCompleted: 5, missionsFirstTry: 4 }
        },
        job: {
          jobTitle: cand.targetRole || 'Senior Frontend Engineer',
          company: 'Target Company',
          skills: cand.keySkills || ['React', 'TypeScript']
        }
      };
    }

    const response = await apiClient.post<InterviewApiResponse>('/api/interview', formattedPayload);
    return response;
  },
};
