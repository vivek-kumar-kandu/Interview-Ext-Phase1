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

export interface RoadmapItem {
  index: number;
  topic: string;
  status: 'completed' | 'active' | 'pending';
  day: number;
}

export interface ProgressMetrics {
  questionsCount: number;
  totalQuestions: number;
  topicsCovered: string[];
  remainingTopics: string[];
  roadmapProgress: RoadmapItem[];
}

export interface EvidenceItem {
  category: string;
  title: string;
  detail: string;
  sourcePlatform?: string;
}

export interface MetricBreakdownItem {
  metric: string;
  score: number;
  weight: number;
  weightedScore: number;
  evidence: string;
}

export interface MetricScore {
  score: number;
  label: string;
  calculation: string;
  weights: Record<string, number>;
  breakdown: MetricBreakdownItem[];
  evidence: EvidenceItem[];
  confidence: number;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface DynamicSkillGap {
  skill: string;
  status: 'matched' | 'partially_matched' | 'missing';
  evidence: string;
  sourcePlatform?: string;
}

export interface CandidateJobComparisonResponse {
  candidateName: string;
  jobTitle: string;
  company: string;
  matchScore: MetricScore;
  jobReadiness: MetricScore;
  skillGaps: DynamicSkillGap[];
  explanationText: string;
}

export interface JobAnalysisSummary {
  company: string;
  role: string;
  detectedSkills: string[];
  estimatedDuration?: string;
  difficulty?: string;
  matchScore: number;
  readinessScore: number;
  requiredSkills: string[];
  candidateSkills: string[];
  missingSkills: string[];
  matchMetricDetails?: MetricScore;
  jobReadinessMetricDetails?: MetricScore;
  skillGapDetails?: DynamicSkillGap[];
}

export interface BackendFeedback {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string | string[];
  overallScore?: number;
  technicalKnowledge?: number;
  communication?: number;
  reasoning?: number;
  matchScore?: number;
  readinessScore?: number;
  hiringRecommendation?: string;
  weakAreas?: string[];
  learningRoadmap?: string[];
  recruiterSummary?: string;
  topStrength?: string;
  biggestWeakness?: string;
  nextRecommendedTopic?: string;
}

