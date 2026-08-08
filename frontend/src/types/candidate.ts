export interface Candidate {
  id: string;
  name: string;
  email?: string;
  resumeUrl?: string;
  targetRole: string;
  keySkills: string[];
  profileHash?: string;
}
