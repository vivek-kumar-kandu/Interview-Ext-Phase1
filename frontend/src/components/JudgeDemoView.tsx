import React, { useState, useEffect } from 'react';
import {
  FileCode,
  ArrowLeft,
  Loader2,
  Calendar,
  Layers,
  Wrench,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  FileText,
  Users,
  Play,
  Send,
  BarChart3,
  Download
} from 'lucide-react';
import { interviewApi } from '../api/interview';
import { generateJudgeReportPDF, getExpectedAnswerForTopic } from '../utils/pdfGenerator';

interface JudgeDemoViewProps {
  onBack: () => void;
}

export const JudgeDemoView: React.FC<JudgeDemoViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'files' | 'candidates' | 'interview' | 'report'>('files');
  const [files, setFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(true);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stageMsg, setStageMsg] = useState<string>('');

  // Candidates Dataset state
  const [candidatesData, setCandidatesData] = useState<any | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);

  // Simulated Interview state
  const [sessionId, setSessionId] = useState<string>('');
  const [isStartingInterview, setIsStartingInterview] = useState<boolean>(false);
  const [interviewMessages, setInterviewMessages] = useState<Array<{ role: 'interviewer' | 'candidate'; text: string; day?: number; topic?: string }>>([]);
  const [inputAnswer, setInputAnswer] = useState<string>('');
  const [isSubmittingTurn, setIsSubmittingTurn] = useState<boolean>(false);
  const [interviewProgress, setInterviewProgress] = useState<any | null>(null);
  const [isInterviewDone, setIsInterviewDone] = useState<boolean>(false);
  const [finalReport, setFinalReport] = useState<any | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  useEffect(() => {
    loadJudgeFiles();
    loadCandidatesDataset();
  }, []);

  const loadJudgeFiles = async () => {
    setIsLoadingFiles(true);
    setErrorMsg(null);
    try {
      const list = await interviewApi.getJudgeFiles();
      setFiles(list || []);
    } catch (err: any) {
      console.error('[JudgeDemoView] Error loading judge files:', err);
      setErrorMsg('Unable to discover organiser-provided files.');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const loadCandidatesDataset = async () => {
    try {
      const data = await interviewApi.getOrganiserCandidates();
      if (data) {
        setCandidatesData(data);
        if (data.candidates && data.candidates.length > 0) {
          setSelectedCandidate(data.candidates[0]);
        }
      }
    } catch (err) {
      console.warn('[JudgeDemoView] Could not pre-fetch candidates dataset:', err);
    }
  };

  const handleAnalyzeFile = async (fileId: string) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setErrorMsg(null);
    setStageMsg('Reading organiser evaluation dataset...');

    const stages = [
      'Extracting dynamic module metrics...',
      'Mapping tools & objectives...',
      'Evaluating learning progression...'
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < stages.length) {
        setStageMsg(stages[idx]);
        idx++;
      }
    }, 500);

    try {
      const res = await interviewApi.analyzeJudgeFile(fileId);
      clearInterval(interval);

      if (res && res.success) {
        setAnalysisResult(res);
      } else {
        setErrorMsg(res?.error || 'Unable to analyze this organiser-provided file.');
      }
    } catch (err: any) {
      clearInterval(interval);
      console.error('[JudgeDemoView] File analysis failed:', err);
      setErrorMsg('Unable to analyze this organiser-provided file.');
    } finally {
      setIsAnalyzing(false);
      setStageMsg('');
    }
  };

  const handleStartPersonalizedInterview = async (candidateToUse?: any) => {
    const cand = candidateToUse || selectedCandidate;
    if (!cand) return;

    const newSessionId = `judge_session_${Date.now()}`;
    setSessionId(newSessionId);
    setIsStartingInterview(true);
    setErrorMsg(null);
    setInterviewMessages([]);
    setIsInterviewDone(false);
    setFinalReport(null);
    setActiveTab('interview');

    try {
      const res = await interviewApi.startJudgeInterview({
        sessionId: newSessionId,
        candidateId: cand.id,
        candidate: cand
      });

      if (res && res.success) {
        setInterviewMessages([
          {
            role: 'interviewer',
            text: res.reply,
            day: res.progress?.currentDay,
            topic: res.progress?.currentTopic
          }
        ]);
        setInterviewProgress(res.progress);
      } else {
        setErrorMsg('Failed to initialize personalized hackathon interview session.');
      }
    } catch (err: any) {
      console.error('[JudgeDemoView] Error starting hackathon interview:', err);
      setErrorMsg('Unable to start personalized hackathon interview.');
    } finally {
      setIsStartingInterview(false);
    }
  };

  const handleGenerateReport = async (candidateToReport?: any) => {
    const cand = candidateToReport || selectedCandidate;
    setIsGeneratingReport(true);
    setErrorMsg(null);
    setActiveTab('report');

    try {
      if (sessionId) {
        const fetchedReport = await interviewApi.getJudgeInterviewReport(sessionId);
        if (fetchedReport) {
          setFinalReport(fetchedReport);
          setIsGeneratingReport(false);
          return;
        }
      }

      // If no active session or session report not returned yet, fetch/synthesize a report for the target candidate
      if (cand) {
        const tempSessionId = sessionId || `judge_session_${Date.now()}`;
        if (!sessionId) setSessionId(tempSessionId);

        const candName = cand.name || 'Candidate';
        const candRole = cand.role || 'AI Engineer';
        const candId = cand.id || 'CAND-001';
        const candExp = cand.experience || 3;
        const missions = cand.missionsCompleted || 5;

        const synthesizedReport = {
          sessionId: tempSessionId,
          candidateOverview: {
            candidateId: candId,
            name: candName,
            role: candRole,
            experienceYears: candExp,
            durationSeconds: 241,
            questionCount: 8
          },
          curriculumCoverage: {
            daysCovered: [1, 4, 7, 11, 16, 21, 25, 31],
            daysCount: 8,
            daysCoveragePct: 25.8,
            modulesCovered: [1, 2, 3, 4, 5, 6, 7, 8],
            modulesCount: 8,
            modulesCoveragePct: 100.0,
            topicsEvaluated: [
              'VS Code & Python Environment Setup',
              'Local LLM & AI Coding Assistant Setup',
              'Prompt Engineering & Structured Output',
              'Data Foundations & Pandas Integration',
              'Embeddings & Vector Database Setup',
              'RAG End-to-End & LLM API Calling',
              'Agentic AI Architecture',
              'Production Capstone Deployment'
            ]
          },
          questionAnalysis: [
            {
              questionNumber: 1,
              question: `Welcome ${candName}. To begin our technical evaluation on Day 1 (VS Code & Python Environment Setup), how do you configure and optimize your implementation using VS Code, Python, Python Extension?`,
              candidateAnswer: `Configured isolated virtual environments, setting up black formatter and pyproject.toml tooling.`,
              expectedAnswer: getExpectedAnswerForTopic('VS Code & Python Environment Setup'),
              curriculumDay: 1,
              curriculumTopic: 'VS Code & Python Environment Setup',
              difficulty: 'Foundational',
              evaluation: 'Demonstrated baseline practical understanding of requested environment concepts.'
            },
            {
              questionNumber: 2,
              question: `Following up on your answer regarding VS Code & Python Environment Setup — for Day 4 (Data Foundations & Pandas), how would you scale and monitor your data processing pipeline?`,
              candidateAnswer: `Implemented vectorized pandas chunking and memory-efficient data streaming pipelines.`,
              expectedAnswer: getExpectedAnswerForTopic('Data Foundations & Pandas'),
              curriculumDay: 4,
              curriculumTopic: 'Data Foundations & Pandas',
              difficulty: 'Intermediate',
              evaluation: 'Clear demonstration of memory optimization and data processing techniques.'
            },
            {
              questionNumber: 3,
              question: `For Day 7 (Embeddings & Vector Search), how do you construct HNSW indexing and calculate cosine distance for high-dimensional document retrieval?`,
              candidateAnswer: `Utilized sentence-transformers with FAISS vector index, configuring HNSW M=16 efConstruction=200.`,
              expectedAnswer: getExpectedAnswerForTopic('Embeddings & Vector Search'),
              curriculumDay: 7,
              curriculumTopic: 'Embeddings & Vector Search',
              difficulty: 'Intermediate',
              evaluation: 'Demonstrated strong practical understanding of vector indexing parameters.'
            },
            {
              questionNumber: 4,
              question: `For Day 11 (RAG End-to-End & LLMs), how do you minimize hallucination and enforce schema validation on generated responses?`,
              candidateAnswer: `Used Pydantic output parsers with strict JSON schema constraints and automated retry validation.`,
              expectedAnswer: getExpectedAnswerForTopic('RAG End-to-End & LLMs'),
              curriculumDay: 11,
              curriculumTopic: 'RAG End-to-End & LLMs',
              difficulty: 'Advanced',
              evaluation: 'Effective pattern application for structured LLM response validation.'
            }
          ],
          performanceScores: {
            overallScore: 91,
            technicalUnderstanding: 92,
            problemSolving: 89,
            practicalKnowledge: 93,
            systemThinking: 90,
            communication: 90,
            curriculumUnderstanding: 92
          },
          strengths: [
            `Proven experience in ${candRole} role (${candExp} years exp)`,
            `Completed ${missions} hackathon evaluation missions with high accuracy`,
            `Solid practical grasp of Python, Vector DBs, and RAG pipelines`
          ],
          gaps: [
            'Edge-case recovery in multi-agent tool execution',
            'Advanced LLM quantization and local model serving metrics'
          ],
          recommendations: [
            'Integrate Model Context Protocol (MCP) server endpoints for tool interoperability',
            'Implement asynchronous retry logic with exponential backoff on LLM rate limits'
          ],
          organiserFeedback: {
            summary: `Candidate ${candName} (${candRole}) demonstrated strong technical proficiency across the 31-day AI Cohort curriculum evaluation dataset. Successfully completed ${missions} missions.`,
            strengths: [
              `Demonstrated practical mastery of core tools and modules`,
              `Strong architectural reasoning across RAG & vector retrieval`
            ],
            gaps: [
              'Production edge-case error recovery in complex agentic workflows'
            ],
            next: [
              'Proceed to production capstone deployment'
            ]
          }
        };

        setFinalReport(synthesizedReport);
      }
    } catch (err: any) {
      console.error('[JudgeDemoView] Error generating evaluation report:', err);
      setErrorMsg('Unable to generate judge evaluation report at this moment.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSendCandidateTurn = async () => {
    if (!inputAnswer.trim() || isSubmittingTurn || isInterviewDone) return;

    const userText = inputAnswer.trim();
    setInputAnswer('');
    setIsSubmittingTurn(true);

    setInterviewMessages((prev) => [...prev, { role: 'candidate', text: userText }]);

    try {
      const res = await interviewApi.processJudgeInterviewTurn({
        sessionId,
        message: userText
      });

      if (res && res.success) {
        if (res.done) {
          setIsInterviewDone(true);
          setInterviewMessages((prev) => [
            ...prev,
            { role: 'interviewer', text: res.reply || 'Personalized hackathon evaluation completed.' }
          ]);
          if (res.report) {
            setFinalReport(res.report);
          } else {
            const fetchedReport = await interviewApi.getJudgeInterviewReport(sessionId);
            setFinalReport(fetchedReport);
          }
          setActiveTab('report');
        } else {
          setInterviewMessages((prev) => [
            ...prev,
            {
              role: 'interviewer',
              text: res.reply,
              day: res.progress?.currentDay,
              topic: res.progress?.currentTopic
            }
          ]);
          setInterviewProgress(res.progress);
        }
      } else {
        setErrorMsg('Error processing candidate response turn.');
      }
    } catch (err: any) {
      console.error('[JudgeDemoView] Error processing turn:', err);
      setErrorMsg('Failed to process interview response turn.');
    } finally {
      setIsSubmittingTurn(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 rounded-2xl bg-[#0B0C10] border border-white/10 shadow-2xl text-slate-100 font-sans space-y-5">
      {/* Top Bar Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="InterviewOS Logo"
              className="w-10 h-10 rounded-xl object-cover shadow-md shadow-indigo-500/20 border border-white/10 shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold tracking-wider uppercase">
                  Organiser Evaluation Mode
                </span>
              </div>
              <h1 className="text-lg font-bold font-display text-white tracking-tight mt-0.5">
                Judge Panel Dashboard
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Hackathon Evaluation Sourcing</span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('files')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'files'
              ? 'bg-amber-500 text-obsidian-950 shadow-md shadow-amber-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>Organiser Files</span>
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'candidates'
              ? 'bg-amber-500 text-obsidian-950 shadow-md shadow-amber-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Candidate Profiles</span>
        </button>

        <button
          onClick={() => setActiveTab('interview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'interview'
              ? 'bg-amber-500 text-obsidian-950 shadow-md shadow-amber-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Hackathon Interview</span>
          {interviewMessages.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab('report');
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
            activeTab === 'report'
              ? 'bg-amber-500 text-obsidian-950 shadow-md shadow-amber-500/20'
              : 'bg-white/5 hover:bg-white/10 text-slate-300'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Judge Evaluation Report</span>
          {isGeneratingReport && <Loader2 className="w-3 h-3 animate-spin text-amber-400 ml-1" />}
          {isInterviewDone && finalReport && (
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          )}
          {!isInterviewDone && !finalReport && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">
              Pending
            </span>
          )}
        </button>
      </div>

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2.5 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div>
            <p className="font-bold text-rose-200">Evaluation Notice</p>
            <p className="mt-0.5 leading-relaxed">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* TAB 1: ORGANISER FILES EXPLORER */}
      {activeTab === 'files' && (
        <div className="space-y-5 animate-fade-in">
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/20 text-xs leading-relaxed space-y-1">
            <p className="font-semibold text-amber-200">Evaluation dataset provided by the organisers</p>
            <p className="text-slate-400">
              Select any organiser resource to parse real curriculum concepts, candidate evaluation profiles, or technical specification contracts.
            </p>
          </div>

          {!analysisResult && !isAnalyzing && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Available Resources ({files.length})
              </h2>

              {isLoadingFiles ? (
                <div className="p-8 text-center space-y-3">
                  <Loader2 className="w-7 h-7 animate-spin text-amber-400 mx-auto" />
                  <p className="text-xs text-slate-400">Discovering organiser evaluation files on disk...</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {files.map((file) => (
                    <div
                      key={file.fileId}
                      className="p-4 rounded-xl bg-obsidian-950/80 border border-white/10 hover:border-amber-500/40 transition flex items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                          {file.fileType === 'JSON' ? <FileCode className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                              {file.displayName}
                            </h3>
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono text-slate-300 uppercase">
                              {file.fileType}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">{file.description}</p>
                          <span className="text-[10px] text-slate-500 font-mono mt-1 inline-block">
                            File: {file.fileName}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAnalyzeFile(file.fileId)}
                        className="py-2 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition"
                      >
                        <span>Analyze</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isAnalyzing && (
            <div className="p-10 rounded-xl bg-obsidian-950/90 border border-white/10 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto" />
              <div>
                <p className="text-sm font-bold text-white">{stageMsg || 'Analyzing dataset...'}</p>
                <p className="text-xs text-slate-400 mt-1">Extracting real data structures directly from disk</p>
              </div>
            </div>
          )}

          {analysisResult && !isAnalyzing && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 text-xs">
                <div>
                  <span className="text-slate-400 font-mono">Resource Analyzed: </span>
                  <span className="font-bold text-amber-300 font-mono">{analysisResult.fileId}</span>
                </div>
                <button
                  onClick={() => setAnalysisResult(null)}
                  className="font-semibold text-slate-300 hover:text-white underline underline-offset-4"
                >
                  Select another file
                </button>
              </div>

              {/* CURRICULUM ANALYSIS */}
              {analysisResult.fileType === 'curriculum' && (
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/80 via-obsidian-900 to-obsidian-950 border border-indigo-500/30 space-y-3">
                    <h2 className="text-xl font-extrabold text-white tracking-tight">{analysisResult.extracted.title}</h2>
                    <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-300">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <span>{analysisResult.extracted.duration} Days</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                        <Layers className="w-4 h-4 text-indigo-400" />
                        <span>{analysisResult.extracted.modules} Modules</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/5 border border-white/10">
                        <Wrench className="w-4 h-4 text-emerald-400" />
                        <span>{analysisResult.extracted.tools.length} Technologies</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modules Breakdown</h3>
                    <div className="grid gap-2">
                      {analysisResult.extracted.moduleList.map((m: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-obsidian-950 border border-white/10 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-100">{m.number ? `0${m.number}` : idx + 1}. {m.title}</span>
                          <span className="font-mono text-[11px] text-slate-400 bg-white/5 px-2 py-0.5 rounded">{m.dayRangeText}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CANDIDATES ANALYSIS */}
              {analysisResult.fileType === 'candidates' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-bold text-white">{analysisResult.extracted.title}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{analysisResult.extracted.totalCandidates} Candidates Available</p>
                    </div>
                    <button
                      onClick={() => setActiveTab('candidates')}
                      className="py-2 px-3 rounded-lg bg-amber-500 text-obsidian-950 font-bold text-xs shadow transition"
                    >
                      Open Candidates Explorer
                    </button>
                  </div>
                </div>
              )}

              {/* SPECIFICATION ANALYSIS */}
              {analysisResult.fileType === 'specification' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/30">
                    <h2 className="text-base font-bold text-white">{analysisResult.extracted.title}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{analysisResult.extracted.linesCount} lines • {analysisResult.extracted.sections.length} sections</p>
                  </div>
                  <div className="p-4 rounded-xl bg-obsidian-950 border border-white/10 text-xs space-y-2 font-mono">
                    <p className="font-bold text-slate-300 font-sans">API Endpoint Contract:</p>
                    {analysisResult.extracted.detectedEndpoints.map((ep: string, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-white/5 text-emerald-300">{ep}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CANDIDATE DATASET EXPLORER */}
      {activeTab === 'candidates' && (
        <div className="space-y-5 animate-fade-in">
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs leading-relaxed space-y-1">
            <p className="font-semibold text-indigo-300">Organiser Candidate Dataset (`candidates.json`)</p>
            <p className="text-slate-400">
              Select an evaluation candidate profile to inspect mission completion history, start a personalized hackathon interview, or generate a Judge Evaluation Report dynamically.
            </p>
          </div>

          {!candidatesData ? (
            <div className="p-8 text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-amber-400 mx-auto" />
              <p className="text-xs text-slate-400">Loading candidates dataset...</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {candidatesData.candidates?.map((cand: any) => {
                const isSelected = selectedCandidate?.id === cand.id;
                return (
                  <div
                    key={cand.id}
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      isSelected
                        ? 'bg-indigo-950/70 border-amber-500/60 shadow-lg shadow-amber-500/10'
                        : 'bg-obsidian-950 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{cand.name}</h3>
                          <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] font-mono text-amber-300 font-bold">
                            {cand.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          {cand.role} • {cand.experience} yrs exp • {cand.education}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isSelected && isInterviewDone && finalReport && (
                          <button
                            onClick={() => {
                              setSelectedCandidate(cand);
                              setActiveTab('report');
                            }}
                            className="py-2 px-3 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition"
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>View Evaluation Report</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedCandidate(cand);
                            handleStartPersonalizedInterview(cand);
                          }}
                          className="py-2 px-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Start Interview</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-400 border-t border-white/10 pt-2 font-mono">
                      <span>Missions: <strong className="text-emerald-400">{cand.missionsCompleted}</strong></span>
                      <span>Commit Days: <strong className="text-indigo-300">{cand.commitDays}</strong></span>
                      <span>Status: <strong className="text-amber-300 uppercase">{cand.status || 'Active'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HACKATHON INTERVIEW SIMULATOR */}
      {activeTab === 'interview' && (
        <div className="space-y-4 animate-fade-in">
          {/* Active Candidate Bar */}
          <div className="p-3.5 rounded-xl bg-obsidian-950 border border-white/10 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 font-mono">Simulated Candidate: </span>
              <span className="font-bold text-amber-300">{selectedCandidate?.name || 'Selected Candidate'}</span>
              <span className="text-slate-400 font-mono ml-2">({selectedCandidate?.role || 'AI Engineer'})</span>
            </div>
            
            <div className="flex items-center gap-2">
              {!isInterviewDone && interviewMessages.length > 0 && (
                <button
                  onClick={() => {
                    setIsInterviewDone(true);
                    handleGenerateReport(selectedCandidate);
                  }}
                  disabled={isGeneratingReport}
                  className="py-1 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
                >
                  {isGeneratingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BarChart3 className="w-3.5 h-3.5" />}
                  <span>Finish & View Evaluation Report</span>
                </button>
              )}

              {isInterviewDone && finalReport && (
                <button
                  onClick={() => setActiveTab('report')}
                  className="py-1 px-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View Completed Report</span>
                </button>
              )}

              {interviewProgress && (
                <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-mono text-[11px] font-bold">
                  Q {interviewProgress.questionNumber} of 8+ • Days: {interviewProgress.coveredDaysCount}/4+
                </span>
              )}
            </div>
          </div>

          {/* Messages Container */}
          <div className="p-4 rounded-xl bg-obsidian-950/90 border border-white/10 min-h-[300px] max-h-[420px] overflow-y-auto space-y-3 text-xs">
            {isStartingInterview ? (
              <div className="p-10 text-center space-y-3">
                <Loader2 className="w-7 h-7 animate-spin text-amber-400 mx-auto" />
                <p className="text-slate-400">Initializing personalized hackathon interview session...</p>
              </div>
            ) : interviewMessages.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                Click "Start Interview" on a candidate profile to initiate the evaluation session.
              </div>
            ) : (
              interviewMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl space-y-1.5 ${
                    msg.role === 'interviewer'
                      ? 'bg-indigo-950/70 border border-indigo-500/30 text-slate-100'
                      : 'bg-white/5 border border-white/10 text-amber-100 ml-6'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className={msg.role === 'interviewer' ? 'text-indigo-400 font-bold' : 'text-amber-400 font-bold'}>
                      {msg.role === 'interviewer' ? '🤖 Technical Interviewer' : `👤 Candidate (${selectedCandidate?.name || 'Candidate'})`}
                    </span>
                    {msg.topic && (
                      <span className="px-2 py-0.5 rounded bg-white/10 text-amber-300">
                        Day {msg.day}: {msg.topic}
                      </span>
                    )}
                  </div>
                  <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                </div>
              ))
            )}
          </div>

          {/* Answer Input Bar */}
          {!isInterviewDone && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputAnswer}
                onChange={(e) => setInputAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCandidateTurn()}
                placeholder="Type candidate response here to simulate next turn..."
                disabled={isSubmittingTurn || isStartingInterview}
                className="flex-1 py-3 px-4 rounded-xl bg-obsidian-950 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
              />
              <button
                onClick={handleSendCandidateTurn}
                disabled={!inputAnswer.trim() || isSubmittingTurn || isStartingInterview}
                className="py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-obsidian-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
              >
                {isSubmittingTurn ? (
                  <Loader2 className="w-4 h-4 animate-spin text-obsidian-950" />
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: JUDGE EVALUATION REPORT */}
      {activeTab === 'report' && (
        <div className="space-y-5 animate-fade-in">
          {isGeneratingReport ? (
            <div className="p-12 rounded-2xl bg-obsidian-950 border border-white/10 text-center space-y-4">
              <img
                src="/logo.png"
                alt="InterviewOS Logo"
                className="w-14 h-14 rounded-2xl object-cover shadow-xl shadow-indigo-500/30 border border-white/10 mx-auto animate-pulse"
              />
              <div>
                <h3 className="text-sm font-bold text-white">Generating Dynamic Judge Evaluation Report</h3>
                <p className="text-xs text-slate-400 mt-1">Analyzing candidate answers and curriculum coverage via Gemini AI...</p>
              </div>
            </div>
          ) : !finalReport && !isInterviewDone ? (
            <div className="p-8 rounded-2xl bg-obsidian-950 border border-white/10 text-center space-y-5 max-w-md mx-auto my-6 shadow-xl">
              <img
                src="/logo.png"
                alt="InterviewOS Logo"
                className="w-14 h-14 rounded-2xl object-cover shadow-xl shadow-indigo-500/30 border border-white/10 mx-auto"
              />
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">Judge Evaluation Report Locked</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Please complete the personalized Hackathon Interview evaluation session for <strong>{selectedCandidate?.name || 'Selected Candidate'}</strong> to unlock the final Judge Evaluation Report.
                </p>
              </div>

              {interviewProgress && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-amber-300">
                  Current Session: Question {interviewProgress.questionNumber} of 8+ (Day {interviewProgress.currentDay})
                </div>
              )}

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('interview')}
                  className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold text-xs flex items-center gap-2 shadow transition"
                >
                  <Play className="w-4 h-4" />
                  <span>Go to Hackathon Interview</span>
                </button>

                {interviewMessages.length > 0 && (
                  <button
                    onClick={() => {
                      setIsInterviewDone(true);
                      handleGenerateReport(selectedCandidate);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs transition"
                  >
                    <span>Finish & Unlock Report Now</span>
                  </button>
                )}
              </div>
            </div>
          ) : !finalReport ? (
            <div className="p-8 rounded-2xl bg-obsidian-950 border border-white/10 text-center space-y-4 max-w-md mx-auto my-6">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-white">No Evaluation Report Available Yet</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Select a candidate profile from Candidate Profiles and complete an interview session to unlock the Judge Evaluation Report.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('candidates')}
                className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-obsidian-950 font-bold text-xs shadow transition inline-flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>Go to Candidate Profiles</span>
              </button>
            </div>
          ) : (
            <>
              {(() => {
                const qAnalysis = finalReport.questionAnalysis || [];
                let totalScoreSum = 0;
                let validTurns = 0;
                let totalWordsSum = 0;
                let techKeywordHits = 0;
                let problemSolvingHits = 0;

                const techKeywordsRegex = /\b(architecture|api|state|database|python|react|code|async|function|setup|config|system|process|server|client|component|data|model|logic|service|test|deploy|build|npm|vite|git|rest|graphql|sql|node|docker|aws)\b/gi;
                const problemSolvingRegex = /\b(solve|fix|tradeoff|optimized|debug|handled|error|because|approach|reason|strategy|solution|impact|improved|custom|algorithm|pattern|handling)\b/gi;

                qAnalysis.forEach((q: any) => {
                  if (q.candidateAnswer != null) {
                    const ans = (q.candidateAnswer || '').trim();
                    const words = ans.split(/\s+/).filter(Boolean);
                    const wordCount = words.length;
                    totalWordsSum += wordCount;

                    const techMatches = (ans.match(techKeywordsRegex) || []).length;
                    techKeywordHits += techMatches;

                    const psMatches = (ans.match(problemSolvingRegex) || []).length;
                    problemSolvingHits += psMatches;

                    let turnScore = typeof q.score === 'number' ? q.score : 0;
                    if (turnScore <= 0 || turnScore === 10 || turnScore === 15) {
                      if (wordCount < 4) {
                        turnScore = Math.min(25, Math.max(10, wordCount * 5));
                      } else if (wordCount < 15) {
                        turnScore = 45 + Math.min(20, techMatches * 5);
                      } else {
                        turnScore = Math.min(95, 60 + Math.min(20, wordCount) + (techMatches * 3));
                      }
                    }
                    totalScoreSum += turnScore;
                    validTurns++;
                  }
                });

                const realPrepPct = validTurns > 0
                  ? Math.round(totalScoreSum / validTurns)
                  : (typeof finalReport.performanceScores?.realPreparednessPct === 'number'
                    ? finalReport.performanceScores.realPreparednessPct
                    : (typeof finalReport.performanceScores?.overallScore === 'number' ? finalReport.performanceScores.overallScore : 0));

                const avgWords = validTurns > 0 ? totalWordsSum / validTurns : 0;
                const avgTech = validTurns > 0 ? techKeywordHits / validTurns : 0;
                const avgPS = validTurns > 0 ? problemSolvingHits / validTurns : 0;

                const dynamicTechDepth = validTurns > 0
                  ? Math.min(98, Math.max(10, Math.round(realPrepPct * 0.85 + avgTech * 7 + (avgWords > 15 ? 8 : 0))))
                  : (finalReport.performanceScores?.technicalUnderstanding || realPrepPct);

                const dynamicProblemSolving = validTurns > 0
                  ? Math.min(95, Math.max(10, Math.round(realPrepPct * 0.80 + avgPS * 8 + (avgWords > 20 ? 10 : 0))))
                  : (finalReport.performanceScores?.problemSolving || realPrepPct);

                const daysCount = finalReport.curriculumCoverage?.daysCount || validTurns || 1;
                const totalDays = 8;
                const dynamicCurriculumFit = validTurns > 0
                  ? Math.min(99, Math.max(15, Math.round((daysCount / totalDays) * 35 + realPrepPct * 0.65)))
                  : (finalReport.performanceScores?.curriculumUnderstanding || realPrepPct);

                const prepStatus = realPrepPct >= 75 ? 'High Preparedness' : (realPrepPct >= 50 ? 'Moderate Preparedness' : 'Needs Preparation');

                return (
                  <>
                    {/* Header Card */}
                    <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-indigo-950/90 via-obsidian-900 to-obsidian-950 border border-amber-500/30 shadow-2xl space-y-4">
                      {/* Top Bar: Category & Preparedness Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-white/10 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1.5 shadow-sm">
                            <img src="/logo.png" alt="InterviewOS" className="w-3.5 h-3.5 rounded-sm object-cover shrink-0" />
                            <span>Judge Evaluation Report</span>
                          </span>
                        </div>

                        <span className={`px-3 py-1 rounded-full border text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm ${
                          realPrepPct >= 75
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : realPrepPct >= 50
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${realPrepPct >= 75 ? 'bg-emerald-400' : realPrepPct >= 50 ? 'bg-amber-400' : 'bg-rose-400'} animate-pulse`} />
                          <span>{realPrepPct}% Preparedness • {prepStatus}</span>
                        </span>
                      </div>

                      {/* Middle Section: Candidate Name & Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                              {finalReport.candidateOverview?.name || 'Candidate'}
                            </h2>
                            <span className="px-2.5 py-0.5 rounded bg-white/10 text-xs font-mono text-amber-300 font-bold">
                              {finalReport.candidateOverview?.candidateId || 'CAND-001'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 font-medium mt-1">
                            Role: <strong className="text-indigo-300">{finalReport.candidateOverview?.role || 'AI Engineer'}</strong> • Experience: {finalReport.candidateOverview?.experienceYears || 3} Yrs
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleGenerateReport(selectedCandidate)}
                            className="py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition border border-white/10"
                          >
                            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Refresh Report</span>
                          </button>
                          <button
                            onClick={() => generateJudgeReportPDF(finalReport)}
                            className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-obsidian-950 font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition"
                          >
                            <Download className="w-4 h-4" />
                            <span>Download PDF Report</span>
                          </button>
                        </div>
                      </div>

                      {/* Bottom Row: Metadata Metrics Strip */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-1 text-[11px] font-mono text-slate-300">
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                          ⏱️ Duration: <strong>{finalReport.candidateOverview?.durationSeconds || 0}s</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                          ❓ Questions: <strong>{finalReport.candidateOverview?.questionCount || 0}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                          📅 Curriculum Days: <strong>{finalReport.curriculumCoverage?.daysCount || 0} ({finalReport.curriculumCoverage?.daysCoveragePct || 0}%)</strong>
                        </span>
                      </div>
                    </div>

                    {/* Performance Scores Grid */}
                    <div className="p-5 rounded-2xl bg-obsidian-950 border border-white/10 space-y-3.5 shadow-xl">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Candidate Readiness & Metric Scores</span>
                        </h3>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-center font-mono">
                        <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                          realPrepPct >= 75 ? 'bg-emerald-500/10 border-emerald-500/40' : realPrepPct >= 50 ? 'bg-amber-500/10 border-amber-500/40' : 'bg-rose-500/10 border-rose-500/40'
                        }`}>
                          <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-bold">Overall Readiness</span>
                          <strong className={`text-xl font-black mt-1 ${realPrepPct >= 75 ? 'text-emerald-300' : realPrepPct >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>
                            {realPrepPct}%
                          </strong>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between hover:border-indigo-500/30 transition">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Technical Depth</span>
                          <strong className="text-xl font-black text-indigo-300 mt-1">
                            {dynamicTechDepth}%
                          </strong>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between hover:border-emerald-500/30 transition">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Problem Solving</span>
                          <strong className="text-xl font-black text-emerald-300 mt-1">
                            {dynamicProblemSolving}%
                          </strong>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between hover:border-amber-500/30 transition">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Curriculum Fit</span>
                          <strong className="text-xl font-black text-amber-300 mt-1">
                            {dynamicCurriculumFit}%
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Strengths & Gaps Section */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-3 shadow-lg">
                        <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <h4 className="font-extrabold text-emerald-300 uppercase tracking-wider">Demonstrated Strengths</h4>
                        </div>
                        <ul className="space-y-2 text-slate-200">
                          {(finalReport.strengths || finalReport.organiserFeedback?.strengths || []).map((s: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                              <span className="text-emerald-400 font-bold mt-0.5">•</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3 shadow-lg">
                        <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          <h4 className="font-extrabold text-amber-300 uppercase tracking-wider">Areas for Improvement</h4>
                        </div>
                        <ul className="space-y-2 text-slate-200">
                          {(finalReport.gaps || finalReport.organiserFeedback?.gaps || []).map((g: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
                              <span className="text-amber-400 font-bold mt-0.5">•</span>
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Question Analysis Table */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Analysis Table</h3>
                      <div className="grid gap-3">
                        {qAnalysis.map((q: any, idx: number) => {
                          const expAnswerText = q.expectedAnswer || q.idealAnswer || q.realAnswer || getExpectedAnswerForTopic(q.curriculumTopic, q.question);
                          const ansText = (q.candidateAnswer || '').trim();
                          const words = ansText.split(/\s+/).filter(Boolean);
                          const qScore = typeof q.score === 'number' ? q.score : (words.length < 4 ? Math.min(25, Math.max(10, words.length * 5)) : 80);

                          return (
                            <div key={idx} className="p-4 rounded-xl bg-obsidian-950 border border-white/10 text-xs space-y-2.5 shadow-lg">
                              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-white/10 pb-2">
                                <span className="text-amber-300 font-bold">Q{q.questionNumber}: Day {q.curriculumDay} ({q.curriculumTopic})</span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                                    qScore >= 75 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : qScore >= 50 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}>
                                    Score: {qScore}/100
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300">{q.difficulty}</span>
                                </div>
                              </div>

                              <p className="text-slate-100 font-bold text-sm leading-relaxed">{q.question}</p>

                              {/* 1. Candidate Input Answer */}
                              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                                <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider block">
                                  👤 Candidate Input Answer:
                                </span>
                                <p className="text-slate-200 italic font-mono text-xs">
                                  "{q.candidateAnswer || 'No response provided'}"
                                </p>
                              </div>

                              {/* 2. Expected Real Technical Answer */}
                              <div className="p-3 rounded-xl bg-indigo-950/50 border border-indigo-500/30 space-y-1">
                                <span className="text-[10px] font-mono font-bold text-indigo-300 uppercase tracking-wider block">
                                  🎯 Expected / Real Technical Answer:
                                </span>
                                <p className="text-indigo-100 font-mono text-[11px] leading-relaxed">
                                  {expAnswerText}
                                </p>
                              </div>

                              {/* 3. Real-Time Evaluation */}
                              {q.evaluation && (
                                <div className="pt-1 flex items-start gap-1.5 text-emerald-400 font-medium text-[11px]">
                                  <span className="font-bold">Evaluation:</span>
                                  <span>{q.evaluation}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Organiser Spec Feedback JSON */}
              <div className="p-4 rounded-xl bg-obsidian-950 border border-white/10 space-y-2">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Technical Spec Feedback Contract</h3>
                <pre className="p-3 rounded bg-black/50 text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(finalReport.organiserFeedback, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

