import { logger } from '../core/logger';
import { registerContentListener } from '../messaging/content';
import { MESSAGES } from '../core/constants';
import { API_CONFIG } from '../config/api';

logger.info('InterviewOS Content Script injected on page:', window.location.href);

interface ExtractedJobContext {
  url: string;
  domain: string;
  jobTitle: string;
  company: string;
  description: string;
}

/**
 * Parses current webpage DOM to extract job posting details
 */
function extractPageJobDetails(): ExtractedJobContext | null {
  const url = window.location.href;
  const domain = window.location.hostname;

  let jobTitle = '';
  let company = '';
  let description = '';

  // 1. LinkedIn Jobs DOM Selectors
  if (domain.includes('linkedin.com')) {
    jobTitle =
      document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      '';

    company =
      document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim() ||
      document.querySelector('.jobs-unified-top-card__company-name')?.textContent?.trim() ||
      '';

    description =
      document.querySelector('#job-details')?.textContent?.trim() ||
      document.querySelector('.jobs-description__content')?.textContent?.trim() ||
      '';
  }
  // 2. Generic Hiring Portals Fallback (Greenhouse, Workday, Indeed, Lever)
  else {
    jobTitle = document.querySelector('h1')?.textContent?.trim() || document.title || '';
    const metaCompany = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
    company = metaCompany || domain.replace('www.', '').split('.')[0];
    description = document.body.innerText.substring(0, 2000);
  }

  if (!jobTitle) return null;

  return {
    url,
    domain,
    jobTitle,
    company: company || 'Target Company',
    description: description.substring(0, 1500),
  };
}

/**
 * Sends extracted job context to backend /api/extension/detect-job endpoint
 */
async function analyzePageJob() {
  const extracted = extractPageJobDetails();
  if (!extracted) return;

  try {
    logger.info('Extracted Job Posting Context:', extracted);
    const response = await fetch(`${API_CONFIG.baseUrl}/api/extension/detect-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: extracted.url,
        domain: extracted.domain,
        jobTitle: extracted.jobTitle,
        company: extracted.company,
        rawDescription: extracted.description,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      logger.info('Backend Job Detection Result:', data);
    }
  } catch (error) {
    logger.error('Failed to execute job detection API:', error);
  }
}

// Execute job detection shortly after page load settles
setTimeout(analyzePageJob, 1500);

// Content script messaging listener
registerContentListener((message, sendResponse) => {
  if (message.type === MESSAGES.TOGGLE_FLOATING_WIDGET) {
    logger.info('Toggling floating widget injection');
    sendResponse({ success: true });
  }
  return true;
});
