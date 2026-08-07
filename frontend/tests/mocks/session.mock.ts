import { InterviewSession } from '../../src/types/session';

export const mockInterviewSession: InterviewSession = {
  id: 'test_sess_001',
  candidate: {
    id: 'cand_test',
    name: 'Jane Doe',
    email: 'jane@example.com',
    targetRole: 'Full Stack Engineer',
    keySkills: ['React', 'Node.js', 'System Design'],
  },
  roleTitle: 'Full Stack Engineer',
  experienceLevel: 'Senior',
  status: 'active',
  startedAt: '2026-08-07T12:00:00Z',
  currentQuestionIndex: 1,
  totalQuestions: 5,
  questions: [],
};
