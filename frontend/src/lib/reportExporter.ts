import { BackendFeedback, JobAnalysisSummary } from '../types/feedback';
import { Candidate } from '../types/candidate';

/**
 * Downloads / prints a beautifully formatted PDF executive report
 */
export function downloadReportPDF(
  feedback: BackendFeedback | null,
  jobSummary: JobAnalysisSummary | null,
  candidateProfile: Candidate | null
) {
  const candidateName = candidateProfile?.name || 'Alex Johnson';
  const role = jobSummary?.role || candidateProfile?.targetRole || 'AI Engineer';
  const company = jobSummary?.company || 'OpenAI';
  const matchScore = feedback?.matchScore ?? jobSummary?.matchScore ?? 92;
  const readinessScore = feedback?.readinessScore ?? jobSummary?.readinessScore ?? 88;
  const recommendation = feedback?.hiringRecommendation || 'Strong Hire';
  const topStrength = feedback?.topStrength || (feedback?.strengths && feedback.strengths[0]) || 'System Architecture';
  const biggestWeakness = feedback?.biggestWeakness || (feedback?.weakAreas && feedback.weakAreas[0]) || 'Docker Deployment';
  const nextTopic = feedback?.nextRecommendedTopic || (Array.isArray(feedback?.next) ? feedback.next[0] : feedback?.next) || 'Redis';

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>InterviewOS Executive Report - ${candidateName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0b0c10;
      color: #e2e8f0;
      margin: 0;
      padding: 32px;
      line-height: 1.5;
    }
    .card {
      background-color: #161822;
      border: 1px solid #232636;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #5b46f6;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
    }
    .badge {
      background-color: rgba(91, 70, 246, 0.2);
      border: 1px solid #5b46f6;
      color: #a5b4fc;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric-box {
      background-color: #0b0c10;
      border: 1px solid #232636;
      border-radius: 12px;
      padding: 16px;
    }
    .metric-title {
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 28px;
      font-weight: 800;
      color: #38bdf8;
    }
    .recommendation-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 14px;
      background-color: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    ul {
      margin: 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
    @media print {
      body { background-color: #ffffff; color: #1e293b; }
      .card { border-color: #e2e8f0; background-color: #f8fafc; }
      .metric-box { background-color: #ffffff; border-color: #cbd5e1; }
      .metric-value { color: #0284c7; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="logo">InterviewOS Executive Report</div>
        <div style="font-size: 14px; color: #94a3b8;">Enterprise AI Technical Candidate Assessment</div>
      </div>
      <div class="badge">Phase 2 Freeze</div>
    </div>

    <div style="margin-bottom: 24px;">
      <h2 style="margin: 0 0 4px 0; font-size: 20px;">Candidate: ${candidateName}</h2>
      <p style="margin: 0; color: #94a3b8;">Target Position: <strong style="color: #ffffff;">${role}</strong> at <strong style="color: #ffffff;">${company}</strong></p>
    </div>

    <div class="grid">
      <div class="metric-box">
        <div class="metric-title">Job Match Compatibility</div>
        <div class="metric-value" style="color: #38bdf8;">${matchScore}%</div>
      </div>
      <div class="metric-box">
        <div class="metric-title">Interview Readiness</div>
        <div class="metric-value" style="color: #34d399;">${readinessScore}%</div>
      </div>
    </div>

    <div class="metric-box" style="margin-bottom: 24px;">
      <div class="metric-title">Hiring Recommendation</div>
      <div style="margin-top: 8px;">
        <span class="recommendation-badge">${recommendation}</span>
      </div>
    </div>

    <div class="grid">
      <div class="metric-box">
        <div class="metric-title" style="color: #34d399;">Top Strength</div>
        <div style="font-weight: 700; font-size: 16px; margin-top: 4px;">${topStrength}</div>
      </div>
      <div class="metric-box">
        <div class="metric-title" style="color: #f87171;">Primary Gap</div>
        <div style="font-weight: 700; font-size: 16px; margin-top: 4px;">${biggestWeakness}</div>
      </div>
    </div>

    <div class="metric-box" style="margin-bottom: 24px;">
      <div class="metric-title" style="color: #a855f7;">Recommended Focus Topic</div>
      <div style="font-weight: 700; font-size: 16px; margin-top: 4px;">${nextTopic}</div>
    </div>

    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 16px; color: #a5b4fc;">Recruiter Executive Summary</h3>
      <p style="background-color: #0b0c10; border: 1px solid #232636; border-radius: 8px; padding: 12px; font-size: 13px; color: #cbd5e1;">
        ${feedback?.recruiterSummary || `Candidate ${candidateName} evaluated for ${role} at ${company}. Overall Score: ${feedback?.overallScore || 88}/100, Job Match: ${matchScore}%, Interview Readiness: ${readinessScore}%. Recommendation: ${recommendation}. Top Strength: ${topStrength}.`}
      </p>
    </div>

    ${feedback?.strengths && feedback.strengths.length > 0 ? `
    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 16px; color: #34d399;">Key Identified Strengths</h3>
      <ul>
        ${feedback.strengths.map((s) => `<li>${s}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${feedback?.weakAreas && feedback.weakAreas.length > 0 ? `
    <div style="margin-bottom: 20px;">
      <h3 style="font-size: 16px; color: #f87171;">Key Identified Gaps</h3>
      <ul>
        ${feedback.weakAreas.map((w) => `<li>${w}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

  </div>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}

/**
 * One-click copy recruiter executive summary to clipboard
 */
export async function copyRecruiterSummary(
  feedback: BackendFeedback | null,
  jobSummary: JobAnalysisSummary | null
): Promise<boolean> {
  const company = jobSummary?.company || 'OpenAI';
  const role = jobSummary?.role || 'AI Engineer';
  const matchScore = feedback?.matchScore ?? jobSummary?.matchScore ?? 92;
  const readinessScore = feedback?.readinessScore ?? jobSummary?.readinessScore ?? 88;
  const recommendation = feedback?.hiringRecommendation || 'Strong Hire';
  const topStrength = feedback?.topStrength || (feedback?.strengths && feedback.strengths[0]) || 'System Architecture';

  const textToCopy = feedback?.recruiterSummary || 
    `Candidate evaluated for ${role} at ${company}. Overall Score: ${feedback?.overallScore || 88}/100, Job Match: ${matchScore}%, Interview Readiness: ${readinessScore}%. Recommendation: ${recommendation}. Top Strength: ${topStrength}.`;

  try {
    await navigator.clipboard.writeText(textToCopy);
    return true;
  } catch {
    // Fallback using textarea execCommand
    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textArea);
    return success;
  }
}
