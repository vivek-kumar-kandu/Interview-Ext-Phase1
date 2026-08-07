export interface QuestionEvaluation {
  questionId: string;
  score: number;
  clarityScore: number;
  technicalAccuracyScore: number;
  strengths: string[];
  improvements: string[];
  aiAnalysis: string;
}

export interface LiveFeedback {
  overallSentiment: 'positive' | 'neutral' | 'negative';
  pacingFeedback: 'too_fast' | 'optimal' | 'too_slow';
  keyHighlights: string[];
}

export interface BackendFeedback {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string;
  overallScore?: number;
  technicalKnowledge?: number;
  communication?: number;
  reasoning?: number;
  hiringRecommendation?: string;
  weakAreas?: string[];
}
