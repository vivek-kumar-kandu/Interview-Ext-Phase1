import React, { useState, useRef } from 'react';
import { CheckCircle, AlertCircle, Sparkles, ArrowRight, Loader2, FileText } from 'lucide-react';
import { interviewApi } from '../api/interview';
import { useInterviewStore } from '../store/interview.store';
import { saveResumeToFirestore, uploadResumeToFirebaseStorage } from '../lib/firebase';
import { saveCandidateProfile, getOrCreateSessionId } from '../services/firestore';
import { formatErrorMessage } from '../lib/errorUtils';

interface ResumeUploadCardProps {
  onProfileAnalyzed: (profile: any) => void;
}

export const ResumeUploadCard: React.FC<ResumeUploadCardProps> = ({ onProfileAnalyzed }) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [stageMessage, setStageMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
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
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
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
      'Identifying technical skills...',
      'Analyzing domain evidence...',
      'Building candidate profile...'
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
        setErrorMsg(formatErrorMessage(res.errorMessage, "Couldn't analyze resume. Please retry uploading."));
      } else {
        setErrorMsg('Resume analysis failed. Please try uploading the resume again.');
      }
    } catch (err: any) {
      clearInterval(stageInterval);
      console.error('[InterviewOS] Resume Analysis Failure:', err);
      setErrorMsg(formatErrorMessage(err, 'Resume analysis failed. Please try uploading your resume again.'));
    } finally {
      setIsUploading(false);
      setStageMessage('');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-5 rounded-2xl bg-obsidian-900/90 backdrop-blur-xl border border-white/10 shadow-2xl space-y-5 text-slate-100 font-sans relative overflow-hidden">
      <div className="text-center space-y-1.5">
        <div className="inline-flex p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-0.5">
          <Sparkles className="w-5 h-5 animate-pulse text-indigo-400" />
        </div>
        <h2 className="text-lg font-bold font-display tracking-tight text-white">Upload Candidate Resume</h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
          InterviewOS extracts verified skills and experience to power job matching and AI interviews.
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 ${
          file
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : isDragOver
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-white/10 hover:border-indigo-500/50 bg-obsidian-950/60 hover:bg-obsidian-800/60'
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
          <div className="flex flex-col items-center space-y-1.5">
            <CheckCircle className="w-9 h-9 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-200 truncate max-w-[240px]">
              {file.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {(file.size / 1024).toFixed(1)} KB • Click to replace file
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <div className="p-3 rounded-full bg-white/5 text-slate-400 group-hover:text-indigo-400 transition-colors">
              <FileText className="w-6 h-6 text-indigo-400" />
            </div>
            <span className="text-xs font-semibold text-slate-200">
              Drag & drop PDF, DOCX or TXT resume
            </span>
            <span className="text-[10px] text-slate-500">
              or browse files from your computer
            </span>
          </div>
        )}
      </div>

      {stageMessage && (
        <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-medium font-mono animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>{stageMessage}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        onClick={handleProcessResume}
        disabled={isUploading || !file}
        className="btn-primary w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isUploading ? (
          <>
            <Loader2 className="w-4 h-4 text-white animate-spin" />
            <span>{stageMessage || 'Processing Resume...'}</span>
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


