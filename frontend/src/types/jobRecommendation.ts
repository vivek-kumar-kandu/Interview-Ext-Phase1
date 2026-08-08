export interface RecommendedJobProfile {
  id: string;
  jobTitle: string;
  matchPercentage: number;
  whyMatch: string;
  matchingSkills: string[];
  missingSkills: string[];
  experienceAlignment: string;
  careerFit: 'Excellent Match' | 'Strong Match' | 'Good Match' | string;
  description: string;
  resumeStrengths: string[];
  areasToImprove: string[];
  interviewPrepTopics: string[];
  suggestedTech: string[];
}

export interface JobRecommendationResponse {
  candidateName: string;
  heading: string;
  subheading: string;
  recommendations: RecommendedJobProfile[];
  generatedAt?: string;
  evidenceCount?: number;
}
