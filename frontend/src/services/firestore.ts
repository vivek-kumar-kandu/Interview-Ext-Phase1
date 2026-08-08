import { db } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { CandidateProfileAnalysis } from '../types/profile';

const SESSION_KEY = 'interviewos_session_id';

/**
 * Retrieves or generates a deterministic installation session ID stored in chrome.storage.local
 */
export async function getOrCreateSessionId(): Promise<string> {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get([SESSION_KEY], (result) => {
        if (result && result[SESSION_KEY]) {
          resolve(result[SESSION_KEY]);
        } else {
          const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          chrome.storage.local.set({ [SESSION_KEY]: newId });
          resolve(newId);
        }
      });
    });
  }
  let localId = localStorage.getItem(SESSION_KEY);
  if (!localId) {
    localId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(SESSION_KEY, localId);
  }
  return localId;
}

/**
 * Saves candidate profile to Cloud Firestore under interviewos/sessions/{sessionId}/candidateProfile
 */
export async function saveCandidateProfile(profile: CandidateProfileAnalysis): Promise<boolean> {
  try {
    const sessionId = await getOrCreateSessionId();
    const userId = sessionId;

    const payload = {
      name: profile.candidateName,
      candidateName: profile.candidateName,
      headline: profile.headline || "",
      summary: profile.summary || "",
      location: (profile as any).location || "",
      skills: profile.technicalSkills || [],
      experience: profile.experience || [],
      education: profile.education || [],
      projects: profile.projects || [],
      certifications: (profile as any).certifications || [],
      targetRoles: profile.targetRoles || profile.recommendedRoles || [],
      profileCompleteness: profile.profileCompleteness ?? profile.profileReadinessScore ?? 0,
      profileReadinessScore: profile.profileReadinessScore ?? profile.profileCompleteness ?? 0,
      resumeHash: profile.resumeHash || profile.profileHash || "",
      resumeFileName: profile.resumeFileName || "",
      resumeStoragePath: profile.resumeStoragePath || "",
      profileId: profile.profileId,
      profileHash: profile.profileHash,
      roleFitRankings: profile.roleFitRankings || [],
      analyzedAt: profile.analyzedAt,
      updatedAt: new Date().toISOString(),
    };

    // 1. Store under users/{userId}/candidateProfiles/{profileId} (Section 14 Firestore spec)
    const profId = profile.profileId || `prof_${Date.now()}`;
    const userProfileRef = doc(db, 'users', userId, 'candidateProfiles', profId);
    await setDoc(userProfileRef, payload, { merge: true });

    // 2. Store under users/{userId}/analyses/{analysisId}
    const analysisId = `analysis_${Date.now()}`;
    const analysisRef = doc(db, 'users', userId, 'analyses', analysisId);
    await setDoc(analysisRef, profile, { merge: true });

    // 3. Store under interviewos/sessions/user_sessions/{sessionId}
    const sessionDocRef = doc(db, 'interviewos', 'sessions', 'user_sessions', sessionId);
    await setDoc(sessionDocRef, payload, { merge: true });

    // 3. Store under global resumes/{resumeHash} collection
    const resumeDocId = profile.resumeHash || profile.profileId || `cand_${sessionId}`;
    const resumeRef = doc(db, 'resumes', resumeDocId);
    await setDoc(resumeRef, {
      ...payload,
      sessionId,
    }, { merge: true });

    // 4. Store under candidates/{candidateId} collection (Section 13)
    const candId = profile.profileId || `cand_${sessionId}`;
    const candRef = doc(db, 'candidates', candId);
    await setDoc(candRef, {
      profile: payload,
      analysis: profile,
      resumeHash: profile.resumeHash || "",
      createdAt: profile.analyzedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log('[InterviewOS Firestore] Candidate profile written to candidates/', candId);
    return true;

  } catch (err: any) {
    if (err?.code === 'permission-denied' || err?.message?.includes('permission-denied')) {
      console.info("[InterviewOS Firestore] Cloud Firestore security rule note: Update database rules in Firebase Console to 'allow read, write: if true;'.");
    } else {
      console.info("[InterviewOS Firestore] Save profile note:", err?.message || err);
    }
    return false;
  }
}

/**
 * Retrieves stored candidate profile from Cloud Firestore
 */
export async function getCandidateProfile(): Promise<CandidateProfileAnalysis | null> {
  try {
    const sessionId = await getOrCreateSessionId();
    const docRef = doc(db, 'interviewos', 'sessions', 'user_sessions', sessionId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.candidateName) {
        return data as CandidateProfileAnalysis;
      }
    }
  } catch (err) {
    console.warn('[InterviewOS Firestore] Failed to fetch candidate profile:', err);
  }
  return null;
}

/**
 * Saves job compatibility analysis to Cloud Firestore
 */
export async function saveJobAnalysis(jobId: string, jobAnalysis: any): Promise<boolean> {
  try {
    const sessionId = await getOrCreateSessionId();
    const userId = sessionId;

    // 1. Store under users/{userId}/jobMatches/{matchId}
    const matchId = jobId || `match_${Date.now()}`;
    const userMatchRef = doc(db, 'users', userId, 'jobMatches', matchId);
    await setDoc(userMatchRef, {
      ...jobAnalysis,
      matchId,
      sessionId,
      savedAt: new Date().toISOString()
    }, { merge: true });

    // 2. Store under interviewos/sessions/user_sessions/{sessionId}/jobAnalyses/{jobId}
    const docRef = doc(db, 'interviewos', 'sessions', 'user_sessions', sessionId, 'jobAnalyses', jobId);
    await setDoc(docRef, {
      ...jobAnalysis,
      jobId,
      sessionId,
      savedAt: new Date().toISOString()
    }, { merge: true });
    console.log('[InterviewOS Firestore] Job analysis saved successfully:', jobId);
    return true;
  } catch (err) {
    console.error('[InterviewOS Firestore] Failed to save job analysis:', err);
    return false;
  }
}

/**
 * Retrieves job analysis from Cloud Firestore
 */
export async function getJobAnalysis(jobId: string): Promise<any | null> {
  try {
    const sessionId = await getOrCreateSessionId();
    const docRef = doc(db, 'interviewos', 'sessions', 'user_sessions', sessionId, 'jobAnalyses', jobId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('[InterviewOS Firestore] Failed to fetch job analysis:', err);
  }
  return null;
}

/**
 * Saves technical interview session turn and feedback to Cloud Firestore
 */
export async function saveInterviewSession(interviewId: string, interviewData: any): Promise<boolean> {
  try {
    const sessionId = await getOrCreateSessionId();
    const userId = sessionId;

    // 1. Store under users/{userId}/interviewSessions/{sessionId}
    const userSessionRef = doc(db, 'users', userId, 'interviewSessions', interviewId || sessionId);
    await setDoc(userSessionRef, {
      ...interviewData,
      interviewId,
      sessionId,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 2. Store under interviewos/sessions/user_sessions/{sessionId}/interviews/{interviewId}
    const docRef = doc(db, 'interviewos', 'sessions', 'user_sessions', sessionId, 'interviews', interviewId);
    await setDoc(docRef, {
      ...interviewData,
      interviewId,
      sessionId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log('[InterviewOS Firestore] Interview session saved successfully:', interviewId);
    return true;
  } catch (err) {
    console.error('[InterviewOS Firestore] Failed to save interview session:', err);
    return false;
  }
}

/**
 * Retrieves technical interview session from Cloud Firestore
 */
export async function getInterviewSession(interviewId: string): Promise<any | null> {
  try {
    const sessionId = await getOrCreateSessionId();
    const docRef = doc(db, 'interviewos', 'sessions', 'user_sessions', sessionId, 'interviews', interviewId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('[InterviewOS Firestore] Failed to fetch interview session:', err);
  }
  return null;
}

/**
 * Saves job recommendations to Cloud Firestore
 */
export async function saveJobRecommendations(profileId: string, recommendationData: any): Promise<boolean> {
  try {
    const sessionId = await getOrCreateSessionId();
    const docRef = doc(db, 'interviewos', 'sessions', 'user_sessions', sessionId, 'recommendations', profileId || 'default');
    await setDoc(docRef, {
      ...recommendationData,
      profileId,
      sessionId,
      savedAt: new Date().toISOString()
    }, { merge: true });
    console.log('[InterviewOS Firestore] Job recommendations saved for profile:', profileId);
    return true;
  } catch (err) {
    console.warn('[InterviewOS Firestore] Failed to save job recommendations:', err);
    return false;
  }
}

/**
 * Retrieves job recommendations from Cloud Firestore
 */
export async function getJobRecommendations(profileId: string): Promise<any | null> {
  try {
    const sessionId = await getOrCreateSessionId();
    const docRef = doc(db, 'interviewos', 'sessions', 'user_sessions', sessionId, 'recommendations', profileId || 'default');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('[InterviewOS Firestore] Failed to fetch job recommendations:', err);
  }
  return null;
}

