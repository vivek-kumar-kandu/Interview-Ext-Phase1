import { apiClient } from './client';
import { API_CONFIG } from '../config/api';
import { FeedbackReport } from '../types/report';
import { env } from '../core/env';

export const reportApi = {
  getReport: async (reportId: string) => {
    if (env.enableMockApi) {
      const mockReport: FeedbackReport = {
        id: reportId,
        sessionId: `sess_${reportId}`,
        candidateName: 'Alex Johnson',
        roleTitle: 'Senior Frontend Engineer',
        overallScore: 89,
        recommendation: 'strong_hire',
        summary: 'Exceptional communication skills with deep mastery over modern frontend system design, state batching, and performance metrics.',
        categoryScores: {
          Technical: 92,
          Architecture: 88,
          Communication: 95,
          ProblemSolving: 85,
        },
        evaluations: [],
        generatedAt: new Date().toISOString(),
      };
      return { success: true, data: mockReport, timestamp: new Date().toISOString() };
    }
    return apiClient.get<FeedbackReport>(API_CONFIG.endpoints.interviewReport(reportId));
  },
};
