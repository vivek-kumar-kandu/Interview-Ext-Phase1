export type QuestionCategory = 'technical' | 'behavioral' | 'architecture' | 'coding' | 'system_design';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  sessionIndex: number;
  text: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  expectedKeyPoints: string[];
  suggestedFollowUps?: string[];
  candidateAnswer?: string;
  timeSpentSeconds?: number;
}
