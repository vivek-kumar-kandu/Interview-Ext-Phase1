import React, { useState, useEffect } from 'react';
import { AiBotAvatar } from '../components/common/AiBotAvatar';
import {
  Clock,
  Sun,
  Moon,
  LayoutDashboard,
  PlayCircle,
  ListOrdered,
  FileCode,
  FileBarChart,
  PieChart,
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
  Award,
  Zap,
  Target,
  Copy,
  Check,
} from 'lucide-react';
import { useInterviewStore } from '../store/interview.store';
import { downloadReportPDF, copyRecruiterSummary } from '../lib/reportExporter';

export const SidePanelApp: React.FC = () => {
  const [navKey, setNavKey] = useState<'session' | 'chat' | 'reports' | 'settings'>('session');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [answerText, setAnswerText] = useState('');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
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
      <header className="px-6 py-3 bg-[#161822] border-b border-[#232636] flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <AiBotAvatar size="sm" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base font-display text-white tracking-tight">InterviewOS</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-r from-indigo-500/30 to-purple-500/30 text-indigo-300 border border-indigo-500/40">
                Phase 2 Freeze
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Enterprise AI Interview Intelligence Platform</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Priority 1: Job Match Card Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-300 text-xs font-semibold">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span>{matchScore}% — Excellent Match</span>
          </div>

          {/* Priority 1: Readiness Score Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>{readinessScore}% — Ready to Apply</span>
          </div>

          <button
            onClick={() => startInterview()}
            className="px-3 py-1.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition"
          >
            Restart
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0B0C10] border border-[#232636] text-slate-300 text-xs font-medium font-mono">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isDone ? 'Finished' : 'Live Session'}</span>
          </div>
          <button
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            {themeMode === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Body Layout: Sidebar + Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Navigation */}
        <aside className="w-56 bg-[#161822]/90 border-r border-[#232636] p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-6">
            {/* OVERVIEW GROUP */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">Overview</span>
              <button
                onClick={() => setNavKey('session')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition ${
                  navKey === 'session' ? 'bg-[#5B46F6] text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Overview</span>
              </button>
            </div>

            {/* INTERVIEW GROUP */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">Interview</span>
              <button
                onClick={() => setNavKey('session')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition ${
                  navKey === 'session' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <PlayCircle className="w-4 h-4 text-indigo-400" />
                  <span>Current Session</span>
                </div>
                <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              </button>
              <button
                onClick={() => setNavKey('chat')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition ${
                  navKey === 'chat' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <ListOrdered className="w-4 h-4 text-cyan-400" />
                <span>Questions Stream</span>
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/40 transition">
                <FileCode className="w-4 h-4 text-purple-400" />
                <span>Notes</span>
              </button>
            </div>

            {/* REPORTS GROUP */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2">Reports</span>
              <button
                onClick={() => setNavKey('reports')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition ${
                  navKey === 'reports' ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <FileBarChart className="w-4 h-4 text-emerald-400" />
                <span>Executive Reports</span>
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/40 transition">
                <PieChart className="w-4 h-4 text-amber-400" />
                <span>Analytics</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => setNavKey('settings')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/40 rounded-xl transition"
          >
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </button>
        </aside>

        {/* Center Workspace Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* VIEW 1: Active Interview Workspace */}
          {navKey === 'session' && (
            <div className="space-y-6">
              {/* TOP CARDS GRID: Match Score, Readiness Score, Skill Gap Breakdown */}
              <div className="grid grid-cols-12 gap-4">
                {/* 1. Job Match Score Card */}
                <div className="col-span-4 target-card p-4 space-y-2 border-indigo-500/30 bg-gradient-to-br from-[#161822] to-indigo-950/20">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Job Match Score</span>
                    <Target className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-display">{matchScore}%</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Excellent Match
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Target Role: OpenAI — AI Engineer</p>
                </div>

                {/* 2. Interview Readiness Score Card */}
                <div className="col-span-4 target-card p-4 space-y-2 border-emerald-500/30 bg-gradient-to-br from-[#161822] to-emerald-950/20">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Interview Readiness</span>
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-white font-display">{readinessScore}%</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Ready to Apply
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">Based on turn metrics & RAG coverage</p>
                </div>

                {/* 3. Skill Gap Analysis Breakdown */}
                <div className="col-span-4 target-card p-4 space-y-2 border-purple-500/30">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-semibold">
                    <span>Skill Gap Breakdown</span>
                    <Award className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">Required:</span>
                      <span className="font-mono text-white truncate max-w-[140px]">{requiredSkills.join(', ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-400">
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Your Skills:</span>
                      <span className="font-mono text-emerald-300 font-semibold truncate max-w-[140px]">{candidateSkills.join(', ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-rose-400">
                      <span className="flex items-center gap-1"><XCircle className="w-3 h-3" /> Missing Skills:</span>
                      <span className="font-mono text-rose-300 font-semibold truncate max-w-[140px]">{missingSkills.join(', ')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Priority 3: Live Interview Topic Roadmap */}
              <div className="target-card p-4 space-y-3 border-indigo-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Live Interview Topic Roadmap</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Progress: {progress?.questionsCount || 1} / {progress?.totalQuestions || 8} Turns
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(progress?.roadmapProgress || [
                    { index: 1, topic: 'FastAPI', status: 'completed' },
                    { index: 2, topic: 'LangGraph', status: 'active' },
                    { index: 3, topic: 'RAG', status: 'pending' },
                    { index: 4, topic: 'Docker', status: 'pending' },
                    { index: 5, topic: 'Redis', status: 'pending' },
                  ]).map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border text-xs flex flex-col items-center justify-center gap-1 transition ${
                        item.status === 'completed'
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                          : item.status === 'active'
                          ? 'bg-indigo-950/50 border-indigo-500/60 text-indigo-200 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/20'
                          : 'bg-[#0B0C10] border-[#232636] text-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-1 font-semibold text-[11px]">
                        {item.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : item.status === 'active' ? (
                          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-slate-600 flex items-center justify-center text-[9px]">○</span>
                        )}
                        <span>{item.topic}</span>
                      </div>
                      <span className="text-[9px] uppercase tracking-wider font-mono opacity-80">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* MAIN INTERVIEW TURN WORKSPACE (Question + Thinking Animation + Explainability Accordion) */}
              <div className="grid grid-cols-12 gap-6 items-start">
                <div className="col-span-8 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold font-display text-white">Technical Turn Workspace</h2>
                    <span className="text-xs font-semibold text-slate-400">Question {interviewerMessages.length} of 8</span>
                  </div>

                  {/* Priority 2: AI Thinking Timeline Animation during Response Generation */}
                  {(isLoading || thinkingStage > 0) && (
                    <div className="target-card p-5 space-y-3 border-indigo-500/40 bg-gradient-to-r from-[#161822] via-indigo-950/30 to-[#161822]">
                      <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI Reasoning & Orchestrator Active</span>
                      </div>
                      <div className="space-y-2 pt-1">
                        {thinkingStagesList.map((stg, idx) => {
                          const currentStageNum = thinkingStage || 1;
                          const isDoneStage = idx + 1 < currentStageNum;
                          const isCurrentStage = idx + 1 === currentStageNum;
                          return (
                            <div
                              key={stg}
                              className={`flex items-center gap-2.5 text-xs transition-all ${
                                isDoneStage
                                  ? 'text-emerald-400 font-semibold'
                                  : isCurrentStage
                                  ? 'text-indigo-300 font-bold translate-x-1'
                                  : 'text-slate-600'
                              }`}
                            >
                              {isDoneStage ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : isCurrentStage ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                              ) : (
                                <span className="w-3.5 h-3.5 rounded-full border border-slate-700 flex items-center justify-center text-[9px]">
                                  {idx + 1}
                                </span>
                              )}
                              <span>{stg}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Main Question Card with Priority 2: Explainability Accordion */}
                  <div className="target-card p-5 space-y-4 border-indigo-500/30">
                    <p className="text-sm font-semibold text-white leading-relaxed">{latestQuestion}</p>

                    {/* Priority 2: Explainability Accordion ("Why Was This Question Generated?") */}
                    <div className="border-t border-[#232636] pt-3">
                      <button
                        onClick={() => latestMessage && toggleWhyAsked(latestMessage.id)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                      >
                        <div className="flex items-center gap-2">
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Why Was This Question Generated? (AI Rationale)</span>
                        </div>
                        {latestMessage && expandedWhyAsked[latestMessage.id] ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                      {latestMessage && (expandedWhyAsked[latestMessage.id] ?? true) && (
                        <div className="mt-2.5 p-3 rounded-xl bg-[#0B0C10] border border-[#232636] text-xs text-slate-300 font-mono whitespace-pre-line leading-relaxed">
                          {latestWhyAsked}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Candidate Response Form */}
                  <div className="space-y-2">
                    <div className="relative">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isLoading || isDone}
                        placeholder={isDone ? 'Interview session complete! Check executive report.' : 'Type your detailed technical answer...'}
                        rows={6}
                        className="w-full bg-[#161822] border border-[#232636] focus:border-[#5B46F6] text-slate-100 placeholder-slate-500 rounded-xl p-4 text-xs outline-none transition resize-none focus:ring-1 focus:ring-[#5B46F6] disabled:opacity-50"
                      />
                      <span className="absolute bottom-3 left-4 text-[10px] text-slate-500 font-mono">
                        {answerText.length}/2000
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={!answerText.trim() || isLoading || isDone}
                        className="target-btn-primary text-xs flex items-center gap-2 disabled:opacity-50"
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>Submit Answer</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Priority 3: Live Sidebar Card */}
                <div className="col-span-4 space-y-4">
                  <div className="target-card p-5 space-y-4 border-indigo-500/20">
                    <div className="flex items-center gap-3">
                      <AiBotAvatar size="md" />
                      <div>
                        <h3 className="text-xs font-bold text-white">AI Interviewer Engine</h3>
                        <span className="text-[10px] text-emerald-400 font-medium">● FastAPI & Pydantic Connected</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[#232636] text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Total Turns</span>
                        <span className="font-mono text-indigo-400 font-bold">{messages.length}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Candidate</span>
                        <span className="font-semibold text-white">{candidateProfile?.name}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Status</span>
                        <span className={isDone ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                          {isDone ? 'Finished' : 'In Progress'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Questions Stepper & Chat Adaptive Stream */}
          {navKey === 'chat' && (
            <div className="grid grid-cols-12 gap-6 items-start">
              <div className="col-span-4 target-card p-4 space-y-3">
                <h3 className="text-xs font-bold text-white px-1">Turn History ({messages.length})</h3>
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
                  {messages.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() => setSelectedQuestionIndex(idx)}
                      className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between text-xs transition ${
                        selectedQuestionIndex === idx
                          ? 'bg-[#5B46F6]/20 border border-[#5B46F6]/40 text-white font-semibold'
                          : 'text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono">
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[120px]">
                          {m.sender === 'interviewer' ? 'Question' : 'Answer'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{m.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col-span-8 space-y-4">
                <div className="target-card p-4 min-h-[460px] flex flex-col justify-between">
                  <div className="space-y-4 max-h-[380px] overflow-y-auto p-2">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex gap-3 ${m.sender === 'candidate' ? 'justify-end' : ''}`}>
                        {m.sender === 'interviewer' && <AiBotAvatar size="sm" />}
                        <div className={`space-y-1 max-w-[85%] ${m.sender === 'candidate' ? 'text-right' : ''}`}>
                          <div className={`flex items-center gap-2 text-[10px] text-slate-400 ${m.sender === 'candidate' ? 'justify-end' : ''}`}>
                            <span className="font-semibold text-white">
                              {m.sender === 'interviewer' ? 'AI Interviewer' : 'Candidate'}
                            </span>
                            <span>{m.timestamp}</span>
                          </div>
                          <div
                            className={`p-3 rounded-2xl text-xs leading-relaxed ${
                              m.sender === 'interviewer'
                                ? 'bg-[#0B0C10] border border-[#232636] rounded-tl-none text-slate-200'
                                : 'bg-[#5B46F6] text-white rounded-tr-none'
                            }`}
                          >
                            {m.text}
                          </div>
                          {m.whyAsked && (
                            <div className="mt-1 p-2 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[10px] text-indigo-300 font-mono whitespace-pre-line text-left">
                              <strong>Why Asked:</strong> {m.whyAsked}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-[#232636] flex gap-2">
                    <input
                      type="text"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isLoading || isDone}
                      placeholder="Type your answer..."
                      className="w-full bg-[#0B0C10] border border-[#232636] rounded-xl px-4 py-2 text-xs outline-none focus:border-[#5B46F6] disabled:opacity-50"
                    />
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={!answerText.trim() || isLoading || isDone}
                      className="target-btn-primary p-2.5 rounded-xl disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: Priority 3 — "Mic Drop" Executive Report & PDF Export */}
          {navKey === 'reports' && (
            <div className="space-y-6">
              {/* Header Title Bar with Export & Copy Buttons */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-display text-white">
                    "Mic Drop" Executive Report
                  </h2>
                  <p className="text-xs text-slate-400">
                    Candidate: <strong className="text-white">{candidateProfile?.name}</strong> • Role: <strong className="text-white">{jobSummary?.role || 'AI Engineer'}</strong> at <strong className="text-white">{jobSummary?.company || 'OpenAI'}</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopySummary}
                    className="px-3.5 py-2 rounded-xl border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    {copiedSummaryToast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                    <span>{copiedSummaryToast ? 'Copied Summary!' : 'Copy Recruiter Summary'}</span>
                  </button>
                  <button
                    onClick={() => downloadReportPDF(feedback, jobSummary, candidateProfile)}
                    className="px-3.5 py-2 rounded-xl border border-[#232636] bg-[#161822] hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* Priority 3: Executive Score & Outcome Card */}
              <div className="grid grid-cols-12 gap-6 items-center">
                {/* Radial Score Card */}
                <div className="col-span-5 target-card p-6 flex flex-col items-center justify-center text-center space-y-3 border-indigo-500/30">
                  <span className="text-xs font-semibold text-slate-400">Overall Assessment Rating</span>
                  <div className="w-32 h-32 rounded-full border-4 border-indigo-500 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/20 bg-indigo-950/20">
                    <span className="text-3xl font-extrabold font-display text-white">
                      {feedback?.overallScore || (isDone ? 88 : 88)}
                    </span>
                    <span className="text-[11px] text-slate-400">/100</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-emerald-400">
                      {feedback?.hiringRecommendation || 'Strong Hire'}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-[240px]">
                      {feedback?.summary || 'Candidate demonstrated exceptional system architecture depth and async connection pooling expertise.'}
                    </p>
                  </div>
                </div>

                {/* Score Breakdown Bars */}
                <div className="col-span-7 target-card p-6 space-y-3 border-indigo-500/30">
                  <h3 className="text-xs font-bold text-white">Category Breakdown</h3>
                  {[
                    { label: 'Technical Knowledge', score: feedback?.technicalKnowledge || 90 },
                    { label: 'Communication', score: fallbackCommScore(feedback) },
                    { label: 'Reasoning & Logic', score: feedback?.reasoning || 89 },
                    { label: 'Job Match Compatibility', score: matchScore },
                    { label: 'Interview Readiness', score: readinessScore },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">{item.label}</span>
                        <span className="font-mono text-indigo-400 font-semibold">{item.score}/100</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Priority 3: Executive Outcome Metrics (Top Strength, Biggest Weakness, Next Recommended Topic) */}
              <div className="grid grid-cols-3 gap-6">
                <div className="target-card p-4 space-y-2 border-emerald-500/30 bg-emerald-950/10">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Top Strength</span>
                  </h4>
                  <p className="text-sm font-bold text-white">
                    {feedback?.topStrength || 'System Architecture'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Demonstrated async endpoint optimization and graph state memory design.
                  </p>
                </div>

                <div className="target-card p-4 space-y-2 border-rose-500/30 bg-rose-950/10">
                  <h4 className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" />
                    <span>Biggest Weakness</span>
                  </h4>
                  <p className="text-sm font-bold text-white">
                    {feedback?.biggestWeakness || 'Docker Deployment'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Needs multi-stage build optimization and container network isolation.
                  </p>
                </div>

                <div className="target-card p-4 space-y-2 border-purple-500/30 bg-purple-950/10">
                  <h4 className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Next Recommended Topic</span>
                  </h4>
                  <p className="text-sm font-bold text-white">
                    {feedback?.nextRecommendedTopic || 'Redis'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Focus on Redis sentinel cluster partitioning and session cache failovers.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

function fallbackCommScore(fb: any) {
  return fb?.communication || 86;
}
