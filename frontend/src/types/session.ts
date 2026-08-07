import { Candidate } from './candidate';
import { Question } from './question';

export type SessionStatus = 'idle' | 'active' | 'paused' | 'completed' | 'terminated';

export interface InterviewSession {
  id: string;
  candidate: Candidate;
  roleTitle: string;
  experienceLevel: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  questions: Question[];
}
