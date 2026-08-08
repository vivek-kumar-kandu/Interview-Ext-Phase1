import { CandidateProfileAnalysis } from '../types/profile';

const PROFILE_STORAGE_PREFIX = 'interviewos_profile_';

export async function getProfileAnalysis(profileId: string, profileHash?: string): Promise<CandidateProfileAnalysis | null> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return null;
  }
  const keyWithHash = profileHash ? `${PROFILE_STORAGE_PREFIX}${profileId}_${profileHash}` : null;
  const keyStandard = `${PROFILE_STORAGE_PREFIX}${profileId}`;

  const keysToFetch = keyWithHash ? [keyWithHash, keyStandard] : [keyStandard];

  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keysToFetch, (result) => {
        if (chrome.runtime.lastError || !result) {
          resolve(null);
          return;
        }
        if (keyWithHash && result[keyWithHash]) {
          resolve(result[keyWithHash] as CandidateProfileAnalysis);
          return;
        }
        if (result[keyStandard]) {
          const standardObj = result[keyStandard] as CandidateProfileAnalysis;
          if (!profileHash || standardObj.profileHash === profileHash) {
            resolve(standardObj);
            return;
          }
        }
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

export async function saveProfileAnalysis(analysis: CandidateProfileAnalysis): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }

  if (!analysis.analysisId) {
    analysis.analysisId = `${analysis.profileId}_${Date.now()}`;
  }

  const keyStandard = `${PROFILE_STORAGE_PREFIX}${analysis.profileId}`;
  const keyHash = analysis.profileHash ? `${PROFILE_STORAGE_PREFIX}${analysis.profileId}_${analysis.profileHash}` : keyStandard;
  const keyHistory = `${PROFILE_STORAGE_PREFIX}history_${analysis.analysisId}`;

  const topRole = (analysis.targetRoles && analysis.targetRoles[0]) || (analysis.recommendedRoles && analysis.recommendedRoles[0]) || '';

  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['interviewos_profiles_registry', 'interviewos_profiles_history'], (regRes) => {
        let registry: any[] = regRes.interviewos_profiles_registry || [];
        let history: CandidateProfileAnalysis[] = regRes.interviewos_profiles_history || [];

        const existingIdx = registry.findIndex((item) => item.profileId === analysis.profileId);
        const registryItem = {
          profileId: analysis.profileId,
          analysisId: analysis.analysisId,
          platform: analysis.profilePlatform || 'LinkedIn',
          candidateName: analysis.candidateName || 'Candidate',
          profileUrl: analysis.profileUrl || '',
          profileHash: analysis.profileHash || '',
          headline: analysis.headline || '',
          targetRoles: analysis.targetRoles || [],
          readinessScore: analysis.profileReadinessScore || 0,
          lastUpdatedAt: analysis.lastUpdatedAt || new Date().toISOString()
        };

        if (existingIdx >= 0) {
          registry[existingIdx] = registryItem;
        } else {
          registry.push(registryItem);
        }

        // Maintain full history array
        const histIdx = history.findIndex((h) => h.analysisId === analysis.analysisId || (h.profileId === analysis.profileId && h.analyzedAt === analysis.analyzedAt));
        if (histIdx >= 0) {
          history[histIdx] = analysis;
        } else {
          history.unshift(analysis);
        }

        chrome.storage.local.set({
          [keyStandard]: analysis,
          [keyHash]: analysis,
          [keyHistory]: analysis,
          activeCandidateProfileId: analysis.profileId,
          activeProfileHash: analysis.profileHash,
          interviewos_latest_profile_analysis: analysis,
          interviewos_profiles_registry: registry,
          interviewos_profiles_history: history,
          isProfileAnalyzed: true,
          analyzedCandidate: {
            id: analysis.profileId,
            name: analysis.candidateName || '',
            targetRole: topRole,
            keySkills: analysis.technicalSkills || [],
            profileHash: analysis.profileHash,
            profileUrl: analysis.profileUrl,
          }
        }, () => {
          resolve();
        });
      });
    } catch {
      resolve();
    }
  });
}

export async function hasProfileAnalysis(profileId: string, profileHash?: string): Promise<boolean> {
  const existing = await getProfileAnalysis(profileId, profileHash);
  return !!(existing && existing.analysisStatus === 'complete');
}

export async function clearProfileAnalysis(profileId: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }
  const keyStandard = `${PROFILE_STORAGE_PREFIX}${profileId}`;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.remove([keyStandard, 'analyzedCandidate', 'activeProfileHash'], () => resolve());
    } catch {
      resolve();
    }
  });
}

export async function deleteProfileAnalysis(profileId: string): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }
  const keyStandard = `${PROFILE_STORAGE_PREFIX}${profileId}`;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['interviewos_profiles_registry', 'activeCandidateProfileId'], (res) => {
        let registry: any[] = res.interviewos_profiles_registry || [];
        registry = registry.filter((item) => item.profileId !== profileId);
        
        const updates: Record<string, any> = {
          interviewos_profiles_registry: registry,
        };

        // If deleting active profile, reset active candidate
        if (res.activeCandidateProfileId === profileId) {
          updates.activeCandidateProfileId = null;
          updates.activeProfileHash = null;
          updates.interviewos_latest_profile_analysis = null;
          updates.isProfileAnalyzed = false;
          updates.analyzedCandidate = null;
        }

        chrome.storage.local.remove([keyStandard], () => {
          chrome.storage.local.set(updates, () => resolve());
        });
      });
    } catch {
      resolve();
    }
  });
}

export async function setActiveProfile(analysis: CandidateProfileAnalysis): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return;
  }
  const topRole = (analysis.targetRoles && analysis.targetRoles[0]) || (analysis.recommendedRoles && analysis.recommendedRoles[0]) || '';

  return new Promise((resolve) => {
    try {
      chrome.storage.local.set({
        activeCandidateProfileId: analysis.profileId,
        activeProfileHash: analysis.profileHash,
        interviewos_latest_profile_analysis: analysis,
        isProfileAnalyzed: true,
        analyzedCandidate: {
          id: analysis.profileId,
          name: analysis.candidateName || '',
          targetRole: topRole,
          keySkills: analysis.technicalSkills || [],
          profileHash: analysis.profileHash,
          profileUrl: analysis.profileUrl,
        }
      }, () => resolve());
    } catch {
      resolve();
    }
  });
}

export async function createManualProfile(data: {
  name: string;
  targetRole: string;
  keySkills: string[];
  platform?: string;
  profileUrl?: string;
}): Promise<CandidateProfileAnalysis> {
  const profileId = `custom:${data.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  const now = new Date().toISOString();
  
  const calculatedReadiness = Math.min(98, Math.max(50, 50 + data.keySkills.length * 5));
  const calculatedFit = Math.min(98, Math.max(65, 60 + data.keySkills.length * 4));

  const analysis: CandidateProfileAnalysis = {
    profileId,
    profileUrl: data.profileUrl || `https://linkedin.com/in/${data.name.toLowerCase().replace(/\s+/g, '-')}`,
    profilePlatform: data.platform || 'Custom Profile',
    candidateName: data.name,
    analyzedAt: now,
    lastUpdatedAt: now,
    analysisVersion: '1.0.0',
    headline: data.targetRole,
    summary: `Manual candidate profile created for ${data.name} targeting ${data.targetRole}.`,
    targetRoles: [data.targetRole],
    technicalSkills: data.keySkills,
    softSkills: ['Problem Solving', 'Communication', 'Teamwork'],
    experience: [`${data.targetRole}`],
    projects: ['Technical Projects'],
    education: ['Technical Education'],
    achievements: ['Domain Focus'],
    strongSkills: data.keySkills,
    developingSkills: ['Advanced System Architecture'],
    skillGaps: [],
    recommendedRoles: [data.targetRole],
    roleFitRankings: [
      {
        role: data.targetRole,
        fitScore: calculatedFit,
        rank: 1,
        whyFit: data.keySkills,
        whatToImprove: ['Advanced Domain Optimization'],
      }
    ],
    profileHash: `hash_${Date.now()}`,
    profileReadinessScore: calculatedReadiness,
    analysisStatus: 'complete',
  };

  await saveProfileAnalysis(analysis);
  return analysis;
}

export async function getAllAnalyzedProfiles(): Promise<CandidateProfileAnalysis[]> {
  if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
    return [];
  }
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(null, (items) => {
        if (chrome.runtime.lastError || !items) {
          resolve([]);
          return;
        }
        const profilesMap = new Map<string, CandidateProfileAnalysis>();
        
        // 1. First load from persistent history array if present
        if (items.interviewos_profiles_history && Array.isArray(items.interviewos_profiles_history)) {
          for (const item of items.interviewos_profiles_history) {
            if (item && item.profileId) {
              const uKey = item.analysisId || `${item.profileId}_${item.analyzedAt || 'time'}`;
              profilesMap.set(uKey, item);
            }
          }
        }

        // 2. Iterate all storage keys starting with PROFILE_STORAGE_PREFIX
        for (const [key, value] of Object.entries(items)) {
          if (key.startsWith(PROFILE_STORAGE_PREFIX) && value && typeof value === 'object' && (value as any).profileId) {
            const prof = value as CandidateProfileAnalysis;
            const uniqueKey = prof.analysisId || `${prof.profileId}_${prof.analyzedAt || prof.profileHash || 'default'}`;
            if (!profilesMap.has(uniqueKey)) {
              profilesMap.set(uniqueKey, prof);
            }
          }
        }

        const sorted = Array.from(profilesMap.values()).sort((a, b) => {
          const timeA = new Date(a.analyzedAt || a.lastUpdatedAt || 0).getTime();
          const timeB = new Date(b.analyzedAt || b.lastUpdatedAt || 0).getTime();
          return timeB - timeA;
        });

        resolve(sorted);
      });
    } catch {
      resolve([]);
    }
  });
}

export async function exportAllProfilesAsJSON(): Promise<void> {
  const allProfiles = await getAllAnalyzedProfiles();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allProfiles, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `interviewos_analyzed_profiles_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}




