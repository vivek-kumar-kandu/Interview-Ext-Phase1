/**
 * InterviewOS Content Script (Standalone Manifest V3 IIFE Target)
 * Self-contained DOM extractor for hiring portals with zero external module imports.
 */

const API_BASE_URL = 'http://localhost:8000';
const LOG_PREFIX = '[InterviewOS Content Script]';

function logInfo(...args: unknown[]) {
  console.log(LOG_PREFIX, ...args);
}

function logError(...args: unknown[]) {
  console.error(LOG_PREFIX, ...args);
}

logInfo('Injected on page:', window.location.href);

interface ExtractedJobContext {
  url: string;
  domain: string;
  jobTitle: string;
  company: string;
  description: string;
}

/**
 * Robust JSON-LD Schema.org JobPosting Extractor
 */
function extractJsonLdJobPosting(): { jobTitle?: string; company?: string; description?: string } | null {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      if (!script.textContent) continue;
      const json = JSON.parse(script.textContent);
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item['@type'] === 'JobPosting' || item['@type'] === 'http://schema.org/JobPosting') {
          return {
            jobTitle: item.title,
            company: item.hiringOrganization?.name || item.hiringOrganization?.legalName,
            description: item.description ? item.description.replace(/<[^>]*>?/gm, '') : undefined,
          };
        }
      }
    }
  } catch {
    // Fail silently on invalid JSON-LD
  }
  return null;
}

/**
 * Multi-tier robust job context extractor with JSON-LD, OpenGraph meta-tags, and DOM selectors
 */
function extractPageJobDetails(): ExtractedJobContext | null {
  const url = window.location.href;
  const domain = window.location.hostname;

  // Tier 1: Try JSON-LD Standard Schema.org JobPosting
  const jsonLdData = extractJsonLdJobPosting();
  let jobTitle = jsonLdData?.jobTitle || '';
  let company = jsonLdData?.company || '';
  let description = jsonLdData?.description || '';

  // Tier 2: Specialized DOM Selectors (LinkedIn, Greenhouse, Lever, Workday, Indeed)
  if (!jobTitle) {
    if (domain.includes('linkedin.com')) {
      jobTitle =
        document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() ||
        document.querySelector('.jobs-unified-top-card__job-title')?.textContent?.trim() ||
        document.querySelector('h1.t-24')?.textContent?.trim() ||
        document.querySelector('h1')?.textContent?.trim() ||
        '';

      company =
        document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim() ||
        document.querySelector('.jobs-unified-top-card__company-name')?.textContent?.trim() ||
        document.querySelector('a.topcard__org-name-link')?.textContent?.trim() ||
        '';

      description =
        document.querySelector('#job-details')?.textContent?.trim() ||
        document.querySelector('.jobs-description__content')?.textContent?.trim() ||
        '';
    } else {
      jobTitle =
        document.querySelector('h1.app-title')?.textContent?.trim() ||
        document.querySelector('.job-title')?.textContent?.trim() ||
        document.querySelector('h1')?.textContent?.trim() ||
        document.title ||
        '';

      const metaCompany =
        document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
        document.querySelector('meta[name="author"]')?.getAttribute('content');

      company = metaCompany || domain.replace('www.', '').split('.')[0];
      description = document.body.innerText.substring(0, 2000);
    }
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
    logInfo('Extracted Job Posting Context:', extracted);
    const response = await fetch(`${API_BASE_URL}/api/extension/detect-job`, {
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
      logInfo('Backend Job Detection Result:', data);
    }
  } catch (error) {
    logError('Failed to execute job detection API:', error);
  }
}

// Execute job detection shortly after page load settles
setTimeout(analyzePageJob, 1500);

// Content script Chrome runtime message listener
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'TOGGLE_FLOATING_WIDGET') {
      logInfo('Toggling floating widget injection');
      sendResponse({ success: true });
    }
    return true;
  });
}
