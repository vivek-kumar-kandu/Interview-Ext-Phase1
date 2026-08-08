import React, { useState } from 'react';

interface DevVerificationPanelProps {
  extractedContext?: any;
  profileState: string;
  profileAnalysis: any;
  errorMessage?: string;
}

export const DevVerificationPanel: React.FC<DevVerificationPanelProps> = ({
  extractedContext,
  profileState,
  profileAnalysis,
  errorMessage,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const resumeFileName = profileAnalysis?.resumeFileName || extractedContext?.resumeFileName || 'resume.pdf';
  const resumeHash = profileAnalysis?.resumeHash || profileAnalysis?.profileHash || 'N/A';
  const charCount = profileAnalysis?.extractedCharCount || (profileAnalysis?.summary?.length || 0);

  const name = profileAnalysis?.candidateName || extractedContext?.name || 'N/A';
  const skillsCount = profileAnalysis?.technicalSkills?.length || profileAnalysis?.keySkills?.length || 0;
  const expCount = profileAnalysis?.experience?.length || 0;
  const eduCount = profileAnalysis?.education?.length || 0;
  const completeness = profileAnalysis?.profileCompleteness ?? profileAnalysis?.profileReadinessScore ?? 0;

  const isGeminiSuccess = profileAnalysis && profileAnalysis.analysisStatus === 'complete';
  const isFirestoreSuccess = !!(profileAnalysis && (profileAnalysis.profileHash || profileAnalysis.resumeHash));

  return (
    <div className="my-3 rounded-lg border border-slate-700 bg-slate-900/90 text-xs shadow-md overflow-hidden font-mono">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 hover:bg-slate-750 text-emerald-400 font-semibold transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          🛠️ Dev Verification Panel (Resume Pipeline)
        </span>
        <span className="text-slate-400">{isOpen ? '▼' : '►'}</span>
      </button>

      {isOpen && (
        <div className="p-3 space-y-2 text-slate-300 text-[11px]">
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-slate-400">Resume File:</span>{' '}
              <span className="text-emerald-300 font-bold">{resumeFileName}</span>
            </div>
            <div>
              <span className="text-slate-400">Extracted Chars:</span>{' '}
              <span className="text-cyan-300 font-bold">{charCount}</span>
            </div>
            <div className="col-span-2 truncate">
              <span className="text-slate-400">Resume Hash (SHA-256):</span>{' '}
              <span className="text-purple-300 font-bold">{resumeHash}</span>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-2 grid grid-cols-2 gap-1">
            <div>Gemini Analysis: <span className={isGeminiSuccess ? 'text-emerald-400 font-bold' : errorMessage ? 'text-rose-400 font-bold' : 'text-amber-400'}>{isGeminiSuccess ? 'SUCCESS' : errorMessage ? 'FAILED' : 'PENDING'}</span></div>
            <div>Firestore Write: <span className={isFirestoreSuccess ? 'text-emerald-400 font-bold' : 'text-amber-400'}>{isFirestoreSuccess ? 'SUCCESS' : 'PENDING'}</span></div>
          </div>

          <div className="border-t border-slate-800 pt-2 grid grid-cols-2 gap-1">
            <div>Candidate Name: <span className="text-emerald-300 font-bold">{name}</span></div>
            <div>Completeness: <span className="text-emerald-400 font-bold">{completeness}%</span></div>
            <div>Skills Count: <span className="text-cyan-400 font-bold">{skillsCount}</span></div>
            <div>Experience Count: <span className="text-cyan-400 font-bold">{expCount}</span></div>
            <div>Education Count: <span className="text-cyan-400 font-bold">{eduCount}</span></div>
            <div>UI State: <span className="text-amber-300 font-bold">{profileState}</span></div>
          </div>

          {errorMessage && (
            <div className="text-rose-400 text-[10px] mt-1 break-words bg-rose-950/30 p-1.5 rounded border border-rose-800/40">
              Error: {errorMessage}
            </div>
          )}

          {profileAnalysis && (
            <div className="pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-[10px] text-cyan-400 hover:underline font-bold"
                >
                  {showRawJson ? 'Hide Analyzed Profile JSON' : 'Show Analyzed Profile JSON'}
                </button>
                {showRawJson && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(profileAnalysis, null, 2));
                      alert('Candidate Profile JSON copied to clipboard!');
                    }}
                    className="text-[10px] text-indigo-300 hover:text-indigo-100 bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30 transition"
                  >
                    Copy JSON
                  </button>
                )}
              </div>
              {showRawJson && (
                <pre className="mt-2 p-2 bg-slate-950 rounded text-[10px] text-slate-300 overflow-x-auto max-h-56 border border-slate-800 select-text whitespace-pre-wrap font-mono">
                  {JSON.stringify(profileAnalysis, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
