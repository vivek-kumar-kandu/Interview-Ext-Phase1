import { QuestionEvaluation } from './feedback';

export type HireRecommendation = 'strong_hire' | 'hire' | 'weak_hire' | 'no_hire';

export interface FeedbackReport {
  id: string;
  sessionId: string;
  candidateName: string;
  roleTitle: string;
  overallScore: number;
  recommendation: HireRecommendation;
  summary: string;
  categoryScores: Record<string, number>;
  evaluations: QuestionEvaluation[];
  generatedAt: string;
}
