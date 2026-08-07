import React, { useState, useEffect } from 'react';
import { AiBotAvatar } from '../components/common/AiBotAvatar';
import {
  Clock,
  Sun,
  Moon,
  LayoutDashboard,
  ListOrdered,
  FileBarChart,
  Settings,
  Send,
  Download,
  CheckCircle2,
  XCircle,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Zap,
  Target,
  Copy,
  Check,
  Award,
} from 'lucide-react';
import { useInterviewStore } from '../store/interview.store';
import { downloadReportPDF, copyRecruiterSummary } from '../lib/reportExporter';

export const SidePanelApp: React.FC = () => {
  const [navKey, setNavKey] = useState<'session' | 'chat' | 'reports' | 'settings'>('session');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [answerText, setAnswerText] = useState('');
  const [expandedWhyAsked, setExpandedWhyAsked] = useState<Record<string, boolean>>({});
  const [copiedSummaryToast, setCopiedSummaryToast] = useState(false);

  const {
    messages,
    isLoading,
    isDone,
    feedback,
    candidateProfile,
    matchScore,
    readinessScore,
    requiredSkills,
    candidateSkills,
    missingSkills,
    jobSummary,
    progress,
    thinkingStage,
    startInterview,
    sendCandidateResponse,
  } = useInterviewStore();

  useEffect(() => {
    if (messages.length === 0) {
      startInterview();
    }
  }, [messages.length, startInterview]);

  const interviewerMessages = messages.filter((m) => m.sender === 'interviewer');
  const latestMessage = interviewerMessages[interviewerMessages.length - 1];
  const latestQuestion = latestMessage?.text || 'Initializing technical interview session...';
  const latestWhyAsked = latestMessage?.whyAsked || 'AI evaluating job requirements and curriculum RAG to generate optimal technical turn.';

  const handleSubmitAnswer = () => {
    if (!answerText.trim() || isLoading || isDone) return;
    sendCandidateResponse(answerText);
    setAnswerText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitAnswer();
    }
  };

  const toggleWhyAsked = (id: string) => {
    setExpandedWhyAsked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopySummary = async () => {
    const success = await copyRecruiterSummary(feedback, jobSummary);
    if (success) {
      setCopiedSummaryToast(true);
      setTimeout(() => setCopiedSummaryToast(false), 2500);
    }
  };

  const handleDownloadPDF = () => {
    downloadReportPDF(feedback, jobSummary, candidateProfile);
  };

  const thinkingStagesList = [
    'Reading Job Description',
    'Retrieving Curriculum RAG',
    'Evaluating Previous Answer',
    'Planning Next Question',
    'Generating Interview Question',
  ];

  return (
    <div className="min-h-screen bg-[#0B0C10] text-slate-100 font-sans flex flex-col antialiased">
      {/* Top Header Bar */}
      <header className="px-4 py-3 bg-[#161822] border-b border-[#232636] flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-2.5">
          <AiBotAvatar size="sm" />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm font-display text-white tracking-tight">InterviewOS</span>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-300 border border-indigo-500/40">
                Phase 2 Freeze
              </span>
            </div>
            <span className="text-[9px] text-slate-400 font-mono block">Enterprise AI Intelligence Platform</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => startInterview()}
            className="px-2.5 py-1 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-[11px] font-semibold transition"
          >
            Restart
          </button>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0C10] border border-[#232636] text-slate-300 text-[11px] font-mono">
            <Clock className="w-3 h-3 text-indigo-400" />
            <span>{isDone ? 'Finished' : 'Live'}</span>
          </div>
          <button
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            {themeMode === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main Body Layout: Responsive Navigation & Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation Bar */}
        <aside className="w-full md:w-52 bg-[#161822]/90 border-b md:border-b-0 md:border-r border-[#232636] p-3 flex flex-row md:flex-col justify-between shrink-0">
          <div className="flex md:flex-col gap-1 w-full overflow-x-auto md:overflow-x-visible">
            {/* OVERVIEW GROUP */}
            <button
              onClick={() => setNavKey('session')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition whitespace-nowrap ${
                navKey === 'session' ? 'bg-[#5B46F6] text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>

            {/* INTERVIEW GROUP */}
            <button
              onClick={() => setNavKey('chat')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition whitespace-nowrap ${
                navKey === 'chat' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <ListOrdered className="w-4 h-4 text-cyan-400" />
              <span>Stream ({messages.length})</span>
            </button>

            {/* REPORTS GROUP */}
            <button
              onClick={() => setNavKey('reports')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl transition whitespace-nowrap ${
                navKey === 'reports' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <FileBarChart className="w-4 h-4 text-emerald-400" />
              <span>Executive Report</span>
            </button>
          </div>

          <button
            onClick={() => setNavKey('settings')}
            className="hidden md:flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 rounded-xl transition"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </aside>

        {/* Center Workspace Content */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto space-y-5">
          {/* VIEW 1: Active Interview Workspace */}
          {navKey === 'session' && (
            <div className="space-y-5">
              {/* TOP CARDS RESPONSIVE GRID: Match Score, Readiness Score, Skill Gap Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {/* 1. Job Match Score Card */}
                <div className="target-card p-3.5 space-y-2 border-indigo-500/30 bg-gradient-to-br from-[#161822] to-indigo-950/20">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Job Match Score</span>
                    <Target className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-white font-display">{matchScore}%</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Excellent Match
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    Role: {jobSummary?.company || 'Target Co'} — {jobSummary?.role || 'AI Engineer'}
                  </p>
                </div>

                {/* 2. Interview Readiness Score Card */}
                <div className="target-card p-3.5 space-y-2 border-emerald-500/30 bg-gradient-to-br from-[#161822] to-emerald-950/20">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Interview Readiness</span>
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-white font-display">{readinessScore}%</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Ready to Apply
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">Based on turn metrics & RAG coverage</p>
                </div>

                {/* 3. Skill Gap Breakdown Card */}
                <div className="target-card p-3.5 space-y-2 border-purple-500/30 bg-gradient-to-br from-[#161822] to-purple-950/20 sm:col-span-2 lg:col-span-1">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Skill Gap Breakdown</span>
                    <Sparkles className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center gap-1 overflow-hidden">
                      <span className="text-slate-400 font-bold shrink-0">Req:</span>
                      <span className="text-slate-200 truncate">{requiredSkills.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">Have: {candidateSkills.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-rose-400 font-medium">
                      <XCircle className="w-3 h-3 shrink-0" />
                      <span className="truncate">Missing: {missingSkills.join(', ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE INTERVIEW TOPIC ROADMAP STEPPER */}
              <div className="target-card p-4 space-y-2.5 border-indigo-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white tracking-wide uppercase">Live Interview Topic Roadmap</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Progress: {interviewerMessages.length} / 8 Turns
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
                  {(progress?.roadmapProgress?.length
                    ? progress.roadmapProgress
                    : [
                        { topic: 'FastAPI Architecture', status: 'completed' },
                        { topic: 'LangGraph State', status: 'active' },
                        { topic: 'RAG Retrieval', status: 'pending' },
                        { topic: 'Docker Containerization', status: 'pending' },
                        { topic: 'Redis Caching', status: 'pending' },
                      ]
                  ).map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl text-center border text-[11px] font-medium transition ${
                        item.status === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : item.status === 'active'
                          ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold shadow-md shadow-indigo-500/20'
                          : 'bg-[#0B0C10] border-[#232636] text-slate-500'
                      }`}
                    >
                      <p className="truncate">{item.topic}</p>
                      <span className="text-[9px] uppercase font-mono block mt-0.5 opacity-80">{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MAIN INTERVIEW WORKSPACE & AI ASSISTANT CARD */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Question & Answer Box */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold font-display text-white">Technical Turn Workspace</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Question {interviewerMessages.length} of 8</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        Adaptive AI
                      </span>
                    </div>
                  </div>

                  {/* Main Question Box */}
                  <div className="target-card p-4 space-y-3 border-indigo-500/30 min-h-[140px]">
                    {isLoading ? (
                      <div className="space-y-3 py-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>AI Thinking Timeline</span>
                        </div>
                        <div className="space-y-1.5 pl-6 text-xs font-mono">
                          {thinkingStagesList.map((stage, sIdx) => (
                            <div
                              key={stage}
                              className={`flex items-center gap-2 transition-all ${
                                sIdx <= thinkingStage ? 'text-emerald-400 font-semibold' : 'text-slate-600'
                              }`}
                            >
                              <span>{sIdx <= thinkingStage ? '✓' : '○'}</span>
                              <span>{stage}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-white leading-relaxed">{latestQuestion}</p>

                        {/* EXPLAINABILITY DRAWER ("Why did I ask this?") */}
                        <div className="pt-2 border-t border-[#232636]">
                          <button
                            onClick={() => toggleWhyAsked('latest')}
                            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Why was this question generated?</span>
                            {expandedWhyAsked['latest'] ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {expandedWhyAsked['latest'] && (
                            <div className="mt-2 p-3 rounded-xl bg-[#0B0C10] border border-indigo-500/30 text-xs text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                              {latestWhyAsked}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Candidate Answer Textarea */}
                  <div className="space-y-2">
                    <div className="relative">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading || isDone}
                        placeholder={isDone ? 'Interview complete! View Executive Report tab.' : 'Type your technical answer here...'}
                        rows={5}
                        className="w-full bg-[#161822] border border-[#232636] focus:border-[#5B46F6] text-slate-100 placeholder-slate-500 rounded-xl p-3.5 text-xs outline-none transition resize-none focus:ring-1 focus:ring-[#5B46F6] disabled:opacity-50"
                      />
                      <span className="absolute bottom-3 left-4 text-[10px] text-slate-500 font-mono">
                        {answerText.length}/2000
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={!answerText.trim() || isLoading || isDone}
                        className="target-btn-primary text-xs flex items-center gap-2 disabled:opacity-50 px-4 py-2"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>Submit Response</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Guidance Sidebar Card */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="target-card p-4 space-y-3 border-indigo-500/20">
                    <div className="flex items-center gap-3">
                      <AiBotAvatar size="md" />
                      <div>
                        <h3 className="text-xs font-bold text-white">AI Interviewer Engine</h3>
                        <span className="text-[10px] text-emerald-400 font-medium">● FastAPI & Pydantic Connected</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Evaluating candidate turns against job posting DOM skills and curriculum RAG vector modules.
                    </p>
                    <div className="space-y-2 pt-2 border-t border-[#232636]">
                      <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Session Metadata</span>
                      <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                        <li className="flex justify-between">
                          <span className="text-slate-400">Total Turns</span>
                          <span className="text-indigo-400 font-bold">{messages.length}</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-slate-400">Candidate</span>
                          <span className="text-white truncate max-w-[100px]">{candidateProfile?.name}</span>
                        </li>
                        <li className="flex justify-between">
                          <span className="text-slate-400">Status</span>
                          <span className={isDone ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                            {isDone ? 'Completed' : 'Active'}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Questions Stream & Turn History */}
          {navKey === 'chat' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white">Turn History & Explainability Log ({messages.length})</h3>
              <div className="target-card p-4 space-y-4 max-h-[520px] overflow-y-auto">
                {messages.map((m, idx) => (
                  <div key={m.id} className={`flex gap-3 ${m.sender === 'candidate' ? 'justify-end' : ''}`}>
                    {m.sender === 'interviewer' && <AiBotAvatar size="sm" />}
                    <div className={`space-y-1.5 max-w-[88%] ${m.sender === 'candidate' ? 'text-right' : ''}`}>
                      <div className={`flex items-center gap-2 text-[10px] text-slate-400 ${m.sender === 'candidate' ? 'justify-end' : ''}`}>
                        <span className="font-semibold text-white">
                          {m.sender === 'interviewer' ? `AI Interviewer (Turn #${Math.ceil((idx + 1) / 2)})` : 'Candidate'}
                        </span>
                        <span>{m.timestamp}</span>
                      </div>
                      <div
                        className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                          m.sender === 'interviewer'
                            ? 'bg-[#0B0C10] border border-[#232636] rounded-tl-none text-slate-200'
                            : 'bg-[#5B46F6] text-white rounded-tr-none'
                        }`}
                      >
                        {m.text}
                      </div>

                      {/* Explainability drawer for historical interviewer questions */}
                      {m.sender === 'interviewer' && m.whyAsked && (
                        <div className="pt-1">
                          <button
                            onClick={() => toggleWhyAsked(m.id)}
                            className="text-[10px] text-indigo-400 hover:underline font-mono flex items-center gap-1"
                          >
                            <HelpCircle className="w-3 h-3" />
                            <span>Why was this question generated?</span>
                          </button>
                          {expandedWhyAsked[m.id] && (
                            <div className="mt-1.5 p-2.5 rounded-xl bg-[#0B0C10] border border-indigo-500/30 text-[11px] text-slate-300 font-mono whitespace-pre-line">
                              {m.whyAsked}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: Executive Report & PDF Export ("Mic Drop") */}
          {navKey === 'reports' && (
            <div className="space-y-5">
              {/* MIC DROP EXECUTIVE REPORT CARD */}
              <div className="target-card p-5 space-y-4 border-indigo-500/40 bg-gradient-to-br from-[#161822] via-[#12141F] to-indigo-950/30">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#232636] pb-3">
                  <div>
                    <h2 className="text-lg font-bold font-display text-white">InterviewOS Executive Outcome Report</h2>
                    <p className="text-xs text-slate-400">
                      Target Role: <span className="text-white font-semibold">{jobSummary?.role || 'AI Engineer'}</span> •{' '}
                      Company: <span className="text-indigo-400 font-semibold">{jobSummary?.company || 'Target Company'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDownloadPDF}
                      className="px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={handleCopySummary}
                      className="px-3 py-1.5 rounded-xl border border-[#232636] bg-[#161822] hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      {copiedSummaryToast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSummaryToast ? 'Copied!' : 'Copy Summary'}</span>
                    </button>
                  </div>
                </div>

                {/* Score Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                  <div className="p-3.5 rounded-2xl bg-[#0B0C10] border border-[#232636] space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Overall Score</span>
                    <p className="text-2xl font-extrabold text-white font-display">{feedback?.overallScore || 88}/100</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#0B0C10] border border-[#232636] space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Job Match</span>
                    <p className="text-2xl font-extrabold text-indigo-400 font-display">{feedback?.matchScore || matchScore}%</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#0B0C10] border border-[#232636] space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Interview Readiness</span>
                    <p className="text-2xl font-extrabold text-emerald-400 font-display">{feedback?.readinessScore || readinessScore}%</p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#0B0C10] border border-[#232636] space-y-1">
                    <span className="text-[10px] text-slate-400 font-mono uppercase">Recommendation</span>
                    <p className="text-sm font-extrabold text-purple-400 mt-1">{feedback?.hiringRecommendation || 'Strong Hire'}</p>
                  </div>
                </div>

                {/* Top Strength & Biggest Weakness */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Award className="w-4 h-4" />
                      <span>Top Strength</span>
                    </span>
                    <p className="text-xs text-slate-200">
                      {feedback?.strengths?.[0] || 'FastAPI Async Architecture & Vector Store Integration'}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" />
                      <span>Biggest Improvement Area</span>
                    </span>
                    <p className="text-xs text-slate-200">
                      {feedback?.weakAreas?.[0] || feedback?.gaps?.[0] || 'Docker Container Networking & Kubernetes Spec'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
