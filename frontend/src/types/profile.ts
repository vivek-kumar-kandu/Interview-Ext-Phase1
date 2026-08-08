export interface RoleFitRecommendation {
  role: string;
  fitScore: number;
  rank: number;
  whyFit: string[];
  whatToImprove: string[];
}

export interface ProfileComparisonResult {
  profilesCompared: { platform: string; profileId: string; candidateName: string }[];
  profileConsistencyScore: number;
  breakdown: {
    identityConsistency: boolean;
    experienceConsistency: boolean;
    skillsConsistencyScore: number;
    careerPositioningScore: number;
  };
  sharedStrengths: string[];
  platformUniqueStrengths: Record<string, string[]>;
  profileGapNotice?: string;
  unifiedSkills: string[];
  unifiedTargetRoles: string[];
}

export interface CandidateProfileAnalysis {
  analysisId?: string;
  profileId: string;
  profileUrl: string;
  profilePlatform: string;
  candidateName: string;
  analyzedAt: string;
  lastUpdatedAt: string;
  analysisVersion: string;

  headline?: string;
  summary?: string;
  candidateSummary?: string;
  location?: string;

  targetRoles: any[];
  technicalSkills: string[];
  softSkills: string[];
  experience: any[];
  projects: any[];
  education: any[];
  certifications?: string[];
  achievements: string[];

  strongSkills: string[];
  developingSkills: string[];
  strongestAreas?: string[];
  developmentAreas?: string[];
  skillGaps: string[];

  recommendedRoles?: string[];
  roleFitRankings?: RoleFitRecommendation[];
  profileHash?: string;
  resumeHash?: string;
  resumeFileName?: string;
  resumeStoragePath?: string;
  extractedCharCount?: number;
  profileCompleteness?: number;
  profileReadinessScore?: number | null;
  profileSignals?: Record<string, any>;
  analysisStatus: 'complete' | 'analyzing' | 'error' | 'insufficient_evidence' | 'incomplete_evidence';

  errorMessage?: string;
  missingEvidence?: string[];
  evidenceState?: string;
}

export interface NormalizedCandidateProfile {
  platform: string;
  profileUrl: string;
  profileId: string;
  profileHash: string;
  name: string;
  headline?: string;
  about?: string;
  location?: string;
  skills: string[];
  experience: string[];
  education: string[];
  projects: string[];
  certifications?: string[];
}

export type PageCategory = 'candidate_profile' | 'job_posting' | 'job_list' | 'general_platform';

export interface PageDetectionResult {
  category: PageCategory;
  platform: string;
  profileId?: string;
  canonicalUrl?: string;
}

export function detectPageCategory(url: string): PageDetectionResult {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    let platform = 'Job Board';
    if (domain.includes('linkedin.com')) platform = 'LinkedIn';
    else if (domain.includes('indeed.com')) platform = 'Indeed';
    else if (domain.includes('greenhouse.io')) platform = 'Greenhouse';
    else if (domain.includes('lever.co')) platform = 'Lever';
    else if (domain.includes('glassdoor.com')) platform = 'Glassdoor';
    else if (domain.includes('naukri.com')) platform = 'Naukri';
    else if (domain.includes('internshala.com')) platform = 'Internshala';
    else if (domain.includes('wellfound.com') || domain.includes('angel.co')) platform = 'Wellfound';
    else if (domain.includes('github.com')) platform = 'GitHub';
    else if (domain.includes('workday.com') || domain.includes('myworkdayjobs.com')) platform = 'Workday';

    const isProfile =
      (domain.includes('linkedin.com') && (pathname.includes('/in/') || pathname.includes('/profile'))) ||
      (domain.includes('indeed.com') && (pathname.includes('/me') || pathname.includes('/profile') || pathname.includes('/resume') || pathname.includes('/p/'))) ||
      (domain.includes('naukri.com') && (pathname.includes('/mnjuser/') || pathname.includes('/profile'))) ||
      (domain.includes('glassdoor.com') && pathname.includes('/profile')) ||
      (domain.includes('wellfound.com') && (pathname.includes('/u/') || pathname.includes('/profile'))) ||
      (domain.includes('internshala.com') && (pathname.includes('/student/') || pathname.includes('/profile'))) ||
      (domain.includes('github.com') && !pathname.includes('/search') && !pathname.includes('/settings') && pathname.split('/').filter(Boolean).length === 1);

    if (isProfile) {
      const { profileId, canonicalUrl } = normalizeProfileIdentity(url);
      return { category: 'candidate_profile', platform, profileId, canonicalUrl };
    }

    const isSingleJob =
      pathname.includes('/jobs/view') ||
      pathname.includes('/jobs/collections') ||
      pathname.includes('/viewjob') ||
      pathname.includes('/jd/') ||
      pathname.includes('/internship/detail') ||
      domain.includes('greenhouse.io') ||
      domain.includes('lever.co') ||
      domain.includes('myworkdayjobs.com');

    if (isSingleJob) {
      return { category: 'job_posting', platform };
    }

    const isJobList =
      pathname.includes('/jobs') ||
      pathname.includes('/internships') ||
      pathname.includes('/search');

    if (isJobList) {
      return { category: 'job_list', platform };
    }

    return { category: 'general_platform', platform };
  } catch {
    return { category: 'general_platform', platform: 'Web' };
  }
}

export function normalizeProfileIdentity(url: string): { profileId: string; canonicalUrl: string; platform: string } {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.toLowerCase();

    if (domain.includes('linkedin.com')) {
      const match = parsed.pathname.match(/\/in\/([^\/]+)/i);
      const rawHandle = match ? decodeURIComponent(match[1]).trim().toLowerCase() : 'me';
      const handle = rawHandle.replace(/\s+/g, '-');
      return {
        profileId: `linkedin:${handle}`,
        canonicalUrl: `https://www.linkedin.com/in/${handle}/`,
        platform: 'LinkedIn',
      };
    }

    if (domain.includes('indeed.com')) {
      const match = parsed.pathname.match(/\/(?:me|profile|resume|p)\/([^\/]+)/i);
      const handle = match ? match[1].toLowerCase() : 'me';
      return {
        profileId: `indeed:${handle}`,
        canonicalUrl: `https://www.indeed.com/me/${handle}`,
        platform: 'Indeed',
      };
    }

    if (domain.includes('naukri.com')) {
      const match = parsed.pathname.match(/\/profile\/([^\/]+)/i);
      const handle = match ? match[1].toLowerCase() : 'me';
      return {
        profileId: `naukri:${handle}`,
        canonicalUrl: `https://www.naukri.com/profile/${handle}`,
        platform: 'Naukri',
      };
    }

    if (domain.includes('glassdoor.com')) {
      const match = parsed.pathname.match(/\/profile\/([^\/]+)/i);
      const handle = match ? match[1].toLowerCase() : 'me';
      return {
        profileId: `glassdoor:${handle}`,
        canonicalUrl: `https://www.glassdoor.com/profile/${handle}`,
        platform: 'Glassdoor',
      };
    }

    if (domain.includes('internshala.com')) {
      const match = parsed.pathname.match(/\/(?:student|profile)\/([^\/]+)/i);
      const handle = match ? match[1].toLowerCase() : 'me';
      return {
        profileId: `internshala:${handle}`,
        canonicalUrl: `https://internshala.com/student/profile/${handle}`,
        platform: 'Internshala',
      };
    }

    if (domain.includes('github.com')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const handle = parts[0] ? parts[0].toLowerCase() : 'me';
      return {
        profileId: `github:${handle}`,
        canonicalUrl: `https://github.com/${handle}`,
        platform: 'GitHub',
      };
    }

    const platformName = domain.replace(/^www\./, '').split('.')[0] || 'web';
    const platform = platformName.charAt(0).toUpperCase() + platformName.slice(1);
    const pathClean = parsed.pathname.replace(/\/$/, '').toLowerCase() || 'me';
    return {
      profileId: `${platformName}:${pathClean}`,
      canonicalUrl: `${parsed.origin}${parsed.pathname}`,
      platform,
    };
  } catch {
    return {
      profileId: `generic:${url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}`,
      canonicalUrl: url,
      platform: 'Web',
    };
  }
}

export interface ProfileRegistryItem {
  profileId: string;
  platform: string;
  candidateName: string;
  profileUrl: string;
  profileHash: string;
  headline?: string;
  lastUpdatedAt: string;
}

export async function saveProfileToStorage(analysis: CandidateProfileAnalysis): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;

  const storageKey = `interviewos_profile_${analysis.profileId}_${analysis.profileHash || 'hash'}`;
  const registryKey = 'interviewos_profiles_registry';

  return new Promise((resolve) => {
    chrome.storage.local.get([registryKey], (res) => {
      let registry: ProfileRegistryItem[] = res[registryKey] || [];

      const existingIdx = registry.findIndex((item) => item.profileId === analysis.profileId);
      const registryItem: ProfileRegistryItem = {
        profileId: analysis.profileId,
        platform: analysis.profilePlatform || 'LinkedIn',
        candidateName: analysis.candidateName || 'Candidate',
        profileUrl: analysis.profileUrl || '',
        profileHash: analysis.profileHash || '',
        headline: analysis.headline || '',
        lastUpdatedAt: analysis.lastUpdatedAt || new Date().toISOString()
      };

      if (existingIdx >= 0) {
        registry[existingIdx] = registryItem;
      } else {
        registry.push(registryItem);
      }

      chrome.storage.local.set(
        {
          [storageKey]: analysis,
          [`interviewos_latest_${analysis.profileId}`]: storageKey,
          [registryKey]: registry
        },
        () => resolve()
      );
    });
  });
}

export async function getProfileFromStorage(profileId: string): Promise<CandidateProfileAnalysis | null> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return null;

  const latestPointerKey = `interviewos_latest_${profileId}`;

  return new Promise((resolve) => {
    chrome.storage.local.get([latestPointerKey], (ptrRes) => {
      const storageKey = ptrRes[latestPointerKey];
      if (!storageKey) {
        resolve(null);
        return;
      }
      chrome.storage.local.get([storageKey], (res) => {
        resolve(res[storageKey] || null);
      });
    });
  });
}

export async function getAllProfilesFromStorage(): Promise<CandidateProfileAnalysis[]> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return [];

  const registryKey = 'interviewos_profiles_registry';

  return new Promise((resolve) => {
    chrome.storage.local.get([registryKey], async (res) => {
      const registry: ProfileRegistryItem[] = res[registryKey] || [];
      if (registry.length === 0) {
        resolve([]);
        return;
      }

      const results: CandidateProfileAnalysis[] = [];
      for (const item of registry) {
        const prof = await getProfileFromStorage(item.profileId);
        if (prof) {
          results.push(prof);
        }
      }
      resolve(results);
    });
  });
}

