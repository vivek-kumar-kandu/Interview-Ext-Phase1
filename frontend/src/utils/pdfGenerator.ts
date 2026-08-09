import { jsPDF } from 'jspdf';

export const getExpectedAnswerForTopic = (topic: string, question?: string): string => {
  const topLower = (topic || '').toLowerCase();
  const qLower = (question || '').toLowerCase();

  if (topLower.includes('vs code') || topLower.includes('environment setup') || qLower.includes('vs code')) {
    return 'Set up an isolated Python virtual environment (python -m venv .venv), configure pyproject.toml / requirements.txt, enable official Python and Pylance extensions in VS Code, and automate code formatting using Ruff/Black.';
  }
  if (topLower.includes('local llm') || topLower.includes('ai coding assistant') || topLower.includes('ollama')) {
    return 'Run local LLMs via Ollama (ollama run qwen2.5-coder), point VS Code AI assistant extensions to localhost:11434/v1 API endpoints, and monitor local VRAM/CPU memory footprint.';
  }
  if (topLower.includes('react') || topLower.includes('github') || topLower.includes('frontend')) {
    return 'Create Vite React frontend application connected via REST/WebSockets to FastAPI backend, manage component state cleanly, setup CORS headers, and commit version-controlled code to GitHub.';
  }
  if (topLower.includes('pandas') || topLower.includes('structured data') || topLower.includes('data foundations')) {
    return 'Process datasets using pandas with vectorized operations and streaming chunk sizes, validate input data schemas with Pydantic, handle missing values, and export normalized JSON/Parquet outputs.';
  }
  if (topLower.includes('embeddings') || topLower.includes('vector search') || topLower.includes('faiss')) {
    return 'Generate dense text embeddings using SentenceTransformers, chunk documents recursively (500 tokens with 50 overlap), build an HNSW FAISS/Qdrant vector index, and execute cosine similarity search.';
  }
  if (topLower.includes('rag') || topLower.includes('llm api') || topLower.includes('end-to-end')) {
    return 'Construct end-to-end RAG pipelines by retrieving top-k vector context chunks, injecting system prompt guardrails, calling LLM endpoints with temperature=0.2, and validating structured Pydantic responses.';
  }
  if (topLower.includes('chatbot') || topLower.includes('fastapi') || topLower.includes('backend integration')) {
    return 'Develop asynchronous FastAPI web backend with stateful session management, stream LLM token outputs via Server-Sent Events (SSE), and handle connection lifecycle events.';
  }
  if (topLower.includes('agent') || topLower.includes('orchestration') || topLower.includes('langchain')) {
    return 'Implement agentic control loops using LangGraph/LangChain, binding tool calling schemas, handling tool execution fallbacks, and maintaining conversational state history.';
  }
  if (topLower.includes('mcp') || topLower.includes('model context protocol')) {
    return 'Expose MCP server resources and tools following JSON-RPC protocol over stdio/SSE transports, validating requests against tool schemas and returning structured responses.';
  }
  if (topLower.includes('capstone') || topLower.includes('deployment') || topLower.includes('docker')) {
    return 'Containerize microservices with multi-stage Dockerfiles, deploy on Kubernetes/Cloud Run, set up health checks, auto-scaling, and telemetry logging with Prometheus/Grafana.';
  }
  return 'Apply industry standard technical practices, modular software design, schema validation, error handling, and robust automated test suites.';
};

export const generateJudgeReportPDF = (report: any): void => {
  if (!report) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const candName = report.candidateOverview?.name || 'Candidate';
  const candRole = report.candidateOverview?.role || 'AI Engineer';
  const candId = report.candidateOverview?.candidateId || 'CAND-001';
  const duration = report.candidateOverview?.durationSeconds || 0;
  const qCount = report.candidateOverview?.questionCount || 0;
  const daysCovered = report.curriculumCoverage?.daysCount || 0;
  const daysPct = report.curriculumCoverage?.daysCoveragePct || 0;

  const questions = report.questionAnalysis || [];
  let totalScoreSum = 0;
  let answeredCount = 0;

  questions.forEach((q: any) => {
    if (q.candidateAnswer != null) {
      const ansText = (q.candidateAnswer || '').trim();
      const words = ansText.split(/\s+/).filter(Boolean);
      let qScore = typeof q.score === 'number' ? q.score : (words.length < 4 ? Math.min(25, Math.max(10, words.length * 5)) : 75);
      totalScoreSum += qScore;
      answeredCount++;
    }
  });

  const realPrepPct = typeof report.performanceScores?.realPreparednessPct === 'number'
    ? report.performanceScores.realPreparednessPct
    : typeof report.performanceScores?.overallScore === 'number'
    ? report.performanceScores.overallScore
    : (answeredCount > 0 ? Math.round(totalScoreSum / answeredCount) : 0);

  const prepStatus = realPrepPct >= 75 ? 'High Preparedness' : (realPrepPct >= 50 ? 'Moderate Preparedness' : 'Needs Preparation');

  let y = 15;

  // Header Banner
  doc.setFillColor(15, 23, 42); // Dark slate bg
  doc.rect(10, y, 190, 24, 'F');

  doc.setTextColor(245, 158, 11); // Amber
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('InterviewOS — Judge Evaluation Report', 15, y + 9);

  doc.setTextColor(226, 232, 240);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Organiser Evaluation Mode • AI Cohort Hackathon Dataset', 15, y + 16);

  y += 30;

  // Candidate Overview & Preparedness Card
  doc.setLineWidth(0.5);
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(10, y, 190, 26, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${candName} (${candRole})`, 14, y + 8);

  // Preparedness Score Badge
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  if (realPrepPct >= 75) doc.setTextColor(16, 185, 129); // Emerald
  else if (realPrepPct >= 50) doc.setTextColor(245, 158, 11); // Amber
  else doc.setTextColor(239, 68, 68); // Red
  doc.text(`Real Candidate Preparedness: ${realPrepPct}% (${prepStatus})`, 105, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Candidate ID: ${candId}  |  Duration: ${duration}s  |  Questions: ${qCount}  |  Curriculum Days: ${daysCovered} (${daysPct}%)`, 14, y + 18);

  y += 32;

  // Executive Technical Summary
  const summaryText = report.organiserFeedback?.summary || report.summary || 'Evaluation completed.';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Executive Technical Summary (Real-Time Evaluation)', 10, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const splitSummary = doc.splitTextToSize(summaryText, 185);
  doc.text(splitSummary, 10, y);
  y += splitSummary.length * 4.5 + 4;

  // Key Strengths & Gaps
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(16, 185, 129); // Emerald
  doc.text('Key Strengths Demonstrated:', 10, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const strengths = report.organiserFeedback?.strengths || [];
  strengths.forEach((s: string) => {
    doc.text(`• ${s}`, 12, y);
    y += 4.5;
  });
  y += 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(239, 68, 68); // Red/Rose
  doc.text('Identified Gaps & Areas for Improvement:', 10, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const gaps = report.organiserFeedback?.gaps || [];
  gaps.forEach((g: string) => {
    doc.text(`• ${g}`, 12, y);
    y += 4.5;
  });
  y += 6;

  // Per-Question Analysis Table Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Per-Question Real-Time Evaluation Breakdown', 10, y);
  y += 6;

  questions.forEach((q: any, idx: number) => {
    const expAnswerText = q.expectedAnswer || q.idealAnswer || q.realAnswer || getExpectedAnswerForTopic(q.curriculumTopic, q.question);
    const candAnswerText = q.candidateAnswer ? `Candidate Input Answer: "${q.candidateAnswer}"` : 'Candidate Input Answer: (No response provided)';

    doc.setFontSize(7.5);
    const qLines = doc.splitTextToSize(`Q: ${q.question}`, 184);
    const candLines = doc.splitTextToSize(candAnswerText, 184);
    const expLines = doc.splitTextToSize(`Expected Real Answer: ${expAnswerText}`, 184);
    const evalLines = doc.splitTextToSize(`Evaluation: ${q.evaluation || 'Evaluated'}`, 184);

    const boxHeight = 10 + (qLines.length * 3.8) + (candLines.length * 3.8) + (expLines.length * 3.8) + (evalLines.length * 3.8);

    if (y + boxHeight > 275) {
      doc.addPage();
      y = 15;
    }

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(10, y, 190, boxHeight, 1, 1, 'F');

    let currentY = y + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`Q${idx + 1}: Day ${q.curriculumDay} (${q.curriculumTopic || 'General'})`, 12, currentY);
    currentY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(qLines, 12, currentY);
    currentY += qLines.length * 3.8;

    doc.setFont('helvetica', 'italic');
    doc.setTextColor(180, 83, 9); // Amber for candidate answer
    doc.text(candLines, 12, currentY);
    currentY += candLines.length * 3.8;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138); // Indigo for expected real answer
    doc.text(expLines, 12, currentY);
    currentY += expLines.length * 3.8;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(5, 150, 105); // Emerald for evaluation
    doc.text(evalLines, 12, currentY);

    y += boxHeight + 4;
  });

  // Save PDF
  const cleanName = candName.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Judge_Evaluation_Report_${cleanName}.pdf`);
};
