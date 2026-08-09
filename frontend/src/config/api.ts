import { env } from '../core/env';

export const API_CONFIG = {
  baseUrl: env.apiBaseUrl,
  timeout: 120000, // 120s timeout to allow Render free tier cold start (50-90s wake up time)
  endpoints: {
    health: '/health',
    interviewStart: '/api/interview/start',
    interviewAnswer: '/api/interview/answer',
    interviewNext: '/api/interview/next',
    interviewReport: (id: string) => `/api/interview/report/${id}`,
    interviewSession: (id: string) => `/api/interview/session/${id}`,
  },
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
};
