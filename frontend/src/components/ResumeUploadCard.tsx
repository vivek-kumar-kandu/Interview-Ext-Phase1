import React, { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { interviewApi } from '../api/interview';
import { useInterviewStore } from '../store/interview.store';
import { saveResumeToFirestore, uploadResumeToFirebaseStorage } from '../lib/firebase';
import { saveCandidateProfile, getOrCreateSessionId } from '../services/firestore';

interface ResumeUploadCardProps {
  onProfileAnalyzed: (profile: any) => void;
}

export const ResumeUploadCard: React.FC<ResumeUploadCardProps> = ({ onProfileAnalyzed }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [stageMessage, setStageMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setCandidateProfile, clearCandidateProfile } = useInterviewStore();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setErrorMsg('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setErrorMsg('');
    }
  };

  const handleProcessResume = async () => {
    if (!file) {
      setErrorMsg('Please select a resume file (PDF, DOCX, TXT) to continue.');
      return;
    }

    // 1. Immediately clear stale profile state
    clearCandidateProfile();
    setIsUploading(true);
    setErrorMsg('');
    setStageMessage('Analyzing your resume...');

    // Animated loading stages
    const stages = [
      'Extracting experience...',
      'Identifying skills...',
      'Understanding projects...',
      'Building your candidate profile...'
    ];
    let stageIdx = 0;
    const stageInterval = setInterval(() => {
      if (stageIdx < stages.length) {
        setStageMessage(stages[stageIdx]);
        stageIdx++;
      }
    }, 600);

    try {
      // 2. Execute backend resume analysis via Gemini
      const res = await interviewApi.uploadAndAnalyzeResume(file);
      clearInterval(stageInterval);

      const isAnalysisValid = Boolean(
        res &&
        res.analysisStatus !== 'error' &&
        !res.errorMessage?.startsWith('AI_ANALYSIS_FAILED')
      );

      if (isAnalysisValid) {
        setStageMessage('Profile updated ✓');

        const firstRoleStr = Array.isArray(res.targetRoles) && res.targetRoles.length > 0
          ? (typeof res.targetRoles[0] === 'object' ? res.targetRoles[0].role : res.targetRoles[0])
          : (res.headline || '');

        const candidateStateObj = {
          id: res.profileId || `cand_resume_${Date.now()}`,
          name: res.candidateName || 'Candidate',
          targetRole: firstRoleStr,
          keySkills: res.technicalSkills || [],
          profileHash: res.profileHash,
          resumeHash: res.resumeHash,
          profileCompleteness: res.profileCompleteness ?? res.profileReadinessScore ?? 0,
        };

        setCandidateProfile(candidateStateObj);

        // Persistent Storage
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({
            analyzedCandidate: res,
            isProfileAnalyzed: true
          });
        }

        // 3. Upload Binary File to Firebase Storage & Document to Firestore
        const userId = await getOrCreateSessionId();
        if (res.resumeHash) {
          const storageUrl = await uploadResumeToFirebaseStorage(file, userId, res.resumeHash);
          if (storageUrl) {
            res.resumeStoragePath = `resumes/${userId}/${res.resumeHash}.${file.name.split('.').pop()?.toLowerCase() || 'pdf'}`;
          }
        }

        await saveCandidateProfile(res);
        await saveResumeToFirestore(res);

        onProfileAnalyzed(res);
      } else if (res && (res.errorMessage || res.summary === "Couldn't analyze resume")) {
        setErrorMsg(res.errorMessage || "Couldn't analyze resume. Please retry uploading.");
      } else {
        setErrorMsg('Resume analysis failed. Please try uploading the resume again.');
      }
    } catch (err: any) {
      clearInterval(stageInterval);
      console.error('[InterviewOS] Resume Analysis Failure:', err);
      setErrorMsg(err?.message || 'Resume analysis failed. Please try uploading the resume again.');
    } finally {
      setIsUploading(false);
      setStageMessage('');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-6 text-slate-100 font-sans">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1">
          <Sparkles className="w-6 h-6 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold font-display tracking-tight text-white">Upload Your Resume</h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
          InterviewOS analyzes your resume skills, experience, and education to personalize every job match and technical interview.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          file
            ? 'border-emerald-500/50 bg-emerald-950/10'
            : 'border-slate-700 hover:border-indigo-500/50 bg-slate-900/50 hover:bg-slate-850/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md"
          onChange={handleFileChange}
          className="hidden"
        />

        {file ? (
          <div className="flex flex-col items-center space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-200 truncate max-w-[220px]">
              {file.name}
            </span>
            <span className="text-[10px] text-slate-400">
              {(file.size / 1024).toFixed(1)} KB • Click to change file
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <Upload className="w-10 h-10 text-slate-400 group-hover:text-indigo-400 transition-colors" />
            <span className="text-xs font-semibold text-slate-300">
              Drop PDF, DOCX or TXT resume here
            </span>
            <span className="text-[10px] text-slate-500">
              or click to browse from your computer
            </span>
          </div>
        )}
      </div>

      {stageMessage && (
        <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium font-mono animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>{stageMessage}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        onClick={handleProcessResume}
        disabled={isUploading || !file}
        className="w-full py-3 px-4 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 text-white animate-spin" />
            <span>{stageMessage || 'Processing...'}</span>
          </>
        ) : (
          <>
            <span>Analyze Resume & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  );
};

