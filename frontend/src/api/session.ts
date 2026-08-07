import { apiClient } from './client';
import { API_CONFIG } from '../config/api';
import { InterviewSession } from '../types/session';
import { env } from '../core/env';

export const sessionApi = {
  getSession: async (sessionId: string) => {
    if (env.enableMockApi) {
      const mockSession: InterviewSession = {
        id: sessionId,
        candidate: {
          id: 'cand_123',
          name: 'Alex Johnson',
          email: 'alex.j@example.com',
          targetRole: 'Senior Frontend Engineer',
          keySkills: ['React', 'TypeScript', 'Vite'],
        },
        roleTitle: 'Senior Frontend Engineer',
        experienceLevel: 'Senior (5+ yrs)',
        status: 'active',
        startedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        currentQuestionIndex: 1,
        totalQuestions: 5,
        questions: [],
      };
      return { success: true, data: mockSession, timestamp: new Date().toISOString() };
    }
    return apiClient.get<InterviewSession>(API_CONFIG.endpoints.interviewSession(sessionId));
  },
};
