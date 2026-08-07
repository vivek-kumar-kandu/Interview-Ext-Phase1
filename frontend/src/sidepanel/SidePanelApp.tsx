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
  Share2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useInterviewStore } from '../store/interview.store';

export const SidePanelApp: React.FC = () => {
  const [navKey, setNavKey] = useState<'session' | 'chat' | 'reports' | 'settings'>('session');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [answerText, setAnswerText] = useState('');
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);

  const {
    messages,
    isLoading,
    isDone,
    feedback,
    candidateProfile,
    startInterview,
    sendCandidateResponse,
  } = useInterviewStore();

  useEffect(() => {
    if (messages.length === 0) {
      startInterview();
    }
  }, [messages.length, startInterview]);

  const interviewerMessages = messages.filter((m) => m.sender === 'interviewer');
  const latestQuestion = interviewerMessages[interviewerMessages.length - 1]?.text || 'Initializing technical interview session...';

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

  return (
    <div className="min-h-screen bg-[#0B0C10] text-slate-100 font-sans flex flex-col antialiased">
      {/* Top Header Bar */}
      <header className="px-6 py-3 bg-[#161822] border-b border-[#232636] flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <AiBotAvatar size="sm" />
          <span className="font-bold text-base font-display text-white tracking-tight">InterviewOS</span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => startInterview()}
            className="px-3.5 py-1.5 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition"
          >
            Restart Session
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B0C10] border border-[#232636] text-slate-300 text-xs font-medium font-mono">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isDone ? 'Finished' : 'Live Session'}</span>
          </div>
          <button
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
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
                <span>Feedback Reports</span>
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
            <div className="grid grid-cols-12 gap-6 items-start">
              {/* Question & Answer Box (8 cols) */}
              <div className="col-span-8 space-y-5">
                <div className="space-y-2">
                  <h2 className="text-xl font-bold font-display text-white">Interview in Progress</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">
                      Question {interviewerMessages.length} of 8
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Adaptive AI
                    </span>
                    <span className="target-badge-purple">
                      {candidateProfile?.targetRole || 'Technical Round'}
                    </span>
                  </div>
                </div>

                {/* Main Question Box */}
                <div className="target-card p-5 space-y-3 border-indigo-500/30 min-h-[140px] flex flex-col justify-center">
                  {isLoading ? (
                    <div className="flex items-center gap-3 text-indigo-400 py-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs font-medium">FastAPI & LangChain analyzing answer & generating question...</span>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-white leading-relaxed">
                      {latestQuestion}
                    </p>
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
                      placeholder={isDone ? "Interview session complete! Check reports tab." : "Type your answer here..."}
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

              {/* AI Guidance Sidebar Card (4 cols) */}
              <div className="col-span-4 space-y-4">
                <div className="target-card p-5 space-y-4 border-indigo-500/20">
                  <div className="flex items-center gap-3">
                    <AiBotAvatar size="md" />
                    <div>
                      <h3 className="text-xs font-bold text-white">AI Interviewer</h3>
                      <span className="text-[10px] text-emerald-400 font-medium">
                        ● Connected to FastAPI (Port 8000)
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Evaluating responses statefully against hiring candidate criteria and FastAPI backend orchestrator.
                  </p>

                  <div className="space-y-2 pt-2 border-t border-[#232636]">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Live Metrics</span>
                    <ul className="space-y-2 text-xs text-slate-300">
                      <li className="flex items-center justify-between">
                        <span className="text-slate-400">Total Turns</span>
                        <span className="font-mono text-indigo-400 font-bold">{messages.length}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-slate-400">Candidate</span>
                        <span className="font-semibold text-white">{candidateProfile?.name}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="text-slate-400">Status</span>
                        <span className={isDone ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                          {isDone ? "Completed" : "In Progress"}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: Questions Stepper & Chat Adaptive Stream */}
          {navKey === 'chat' && (
            <div className="grid grid-cols-12 gap-6 items-start">
              {/* Questions Stepper Timeline (4 cols) */}
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

              {/* Chat Stream (8 cols) */}
              <div className="col-span-8 space-y-4">
                <div className="target-card p-4 min-h-[460px] flex flex-col justify-between">
                  <div className="space-y-4 max-h-[380px] overflow-y-auto p-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex gap-3 ${m.sender === 'candidate' ? 'justify-end' : ''}`}
                      >
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
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex items-center gap-2 text-xs text-indigo-400 p-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>AI is generating response...</span>
                      </div>
                    )}
                  </div>

                  {/* Reply Input */}
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

          {/* VIEW 3: Detailed Feedback Report & Analytics */}
          {navKey === 'reports' && (
            <div className="space-y-6">
              {/* Header Title Bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-display text-white">
                    {candidateProfile?.targetRole || 'Technical Interview'} Report
                  </h2>
                  <p className="text-xs text-slate-400">
                    Candidate: {candidateProfile?.name} • <span className="text-emerald-400 font-semibold">{isDone ? 'Completed' : 'In Progress'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 rounded-xl border border-[#232636] bg-[#161822] hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                  <button className="p-2 rounded-xl border border-[#232636] bg-[#161822] hover:bg-slate-800 text-slate-400 hover:text-white transition">
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Score Overview Grid */}
              <div className="grid grid-cols-12 gap-6 items-center">
                {/* Radial Overall Score Card (5 cols) */}
                <div className="col-span-5 target-card p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <span className="text-xs font-semibold text-slate-400">Overall AI Rating</span>
                  <div className="w-32 h-32 rounded-full border-4 border-indigo-500 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/20 bg-indigo-950/20">
                    <span className="text-3xl font-extrabold font-display text-white">
                      {feedback?.overallScore || (isDone ? 88 : '--')}
                    </span>
                    <span className="text-[11px] text-slate-400">/100</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-white">
                      {feedback?.hiringRecommendation || (isDone ? 'Strong Hire' : 'Interview In Progress')}
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-[240px]">
                      {feedback?.summary || 'Submit candidate turns to generate complete skill breakdown and AI recommendation.'}
                    </p>
                  </div>
                </div>

                {/* Score Breakdown Bars (7 cols) */}
                <div className="col-span-7 target-card p-6 space-y-3">
                  <h3 className="text-xs font-bold text-white">Category Breakdown</h3>
                  {[
                    { label: 'Technical Knowledge', score: feedback?.technicalKnowledge || 90 },
                    { label: 'Communication', score: feedback?.communication || 86 },
                    { label: 'Reasoning & Logic', score: feedback?.reasoning || 89 },
                    { label: 'Overall Competency', score: feedback?.overallScore || 88 },
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

              {/* Bottom 3 Columns: Strengths, Areas to Improve, Recommendation */}
              <div className="grid grid-cols-3 gap-6">
                <div className="target-card p-4 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Strengths</span>
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {(feedback?.strengths || ['System Architecture', 'React & TypeScript', 'State Management']).map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>

                <div className="target-card p-4 space-y-2">
                  <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>Areas to Improve</span>
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-300">
                    {(feedback?.gaps || feedback?.weakAreas || ['SSR Hydration Edge Cases']).map((g: string, i: number) => (
                      <li key={i}>• {g}</li>
                    ))}
                  </ul>
                </div>

                <div className="target-card p-4 space-y-2">
                  <h4 className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Recommendation</span>
                  </h4>
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    {feedback?.hiringRecommendation || 'Strong Hire'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {feedback?.next || 'Proceed to system design deep dive.'}
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
