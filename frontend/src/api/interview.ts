import { apiClient } from './client';
import { Candidate } from '../types/candidate';
import { BackendFeedback } from '../types/feedback';
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
  feedback?: BackendFeedback;
}

export const interviewApi = {
  /**
   * Universal POST /api/interview endpoint execution
   * Accepts both session start payload and turn response payload
   */
  postInterview: async (payload: InterviewApiPayload): Promise<InterviewApiResponse> => {
    if (env.enableMockApi) {
      if ('candidate' in payload) {
        return {
          reply: `Hello ${payload.candidate.name || 'Candidate'}! Welcome to your technical interview. To begin, could you introduce yourself and describe your recent experience with React and TypeScript system architecture?`,
          done: false,
        };
      } else {
        const isFinished = payload.message.toLowerCase().includes('finish') || payload.message.toLowerCase().includes('done');
        if (isFinished) {
          return {
            reply: 'Thank you for taking the time to complete this technical interview session.',
            done: true,
            feedback: {
              summary: 'The candidate demonstrated strong proficiency in modern frontend frameworks, state management optimization, and modular UI structure.',
              strengths: [
                'Clear communication of technical trade-offs',
                'Deep understanding of state batching and re-renders',
                'Clean TypeScript structure and code organization',
              ],
              gaps: [
                'Could elaborate further on server-side rendering hydration edge cases',
              ],
              next: 'Strong Hire - Recommend proceeding to system design deep dive.',
            },
          };
        }
        return {
          reply: `Great point on "${payload.message.substring(0, 30)}...". How do you handle real-time state synchronization when building high-frequency WebSockets or SSE extensions?`,
          done: false,
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
