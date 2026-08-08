/**
 * InterviewOS Content Script (Standalone Manifest V3 IIFE Target)
 * Self-contained DOM extractor for hiring portals with zero external module imports.
 */

(() => {
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
  location?: string;
  platform?: string;
  description: string;
  employmentType?: string;
  experienceRequirement?: string;
  skills?: string[];
  requirements?: string[];
  educationRequirements?: string[];
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

function detectPlatformName(domain: string): string {
  if (domain.includes('linkedin.com')) return 'LinkedIn';
  if (domain.includes('internshala.com')) return 'Internshala';
  if (domain.includes('greenhouse.io')) return 'Greenhouse';
  if (domain.includes('lever.co')) return 'Lever';
  if (domain.includes('indeed.com')) return 'Indeed';
  if (domain.includes('wellfound.com') || domain.includes('angel.co')) return 'Wellfound';
  if (domain.includes('glassdoor.com')) return 'Glassdoor';
  if (domain.includes('naukri.com')) return 'Naukri';
  if (domain.includes('workday.com') || domain.includes('myworkdayjobs.com')) return 'Workday';
  const name = domain.replace(/^www\./, '').split('.')[0];
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Job Board';
}

/**
 * Multi-tier robust job context extractor with JSON-LD, OpenGraph meta-tags, and DOM selectors
 */
function parseTitleForJobContext(docTitle: string): { jobTitle?: string; company?: string } {
  if (!docTitle) return {};
  const cleaned = docTitle
    .replace(/\s*\|\s*(LinkedIn|Internshala|Naukri\.com|Naukri|Glassdoor|Indeed|Wellfound)$/i, '')
    .replace(/\s*-\s*(LinkedIn|Internshala|Naukri\.com|Naukri|Glassdoor|Indeed|Wellfound)$/i, '')
    .trim();

  // Pattern 1: Title | Company | Platform or Title - Company
  const parts = cleaned.split(/\s+[|\-—]\s+/);
  if (parts.length >= 2) {
    const candidateTitle = parts[0].trim();
    const candidateCompany = parts[1].replace(/Internship|Job|in\s+[\w\s,]+/gi, '').trim();
    return {
      jobTitle: candidateTitle,
      company: candidateCompany || 'Target Company'
    };
  }

  // Pattern 2: "Role Internship/Job in Location at Company" (Internshala & domain format)
  if (cleaned.toLowerCase().includes(' at ')) {
    const atParts = cleaned.split(/\s+at\s+/i);
    let rolePart = atParts[0]
      .replace(/Internship/gi, '')
      .replace(/Job/gi, '')
      .replace(/in\s+[\w\s,]+/gi, '')
      .trim();
    let companyPart = atParts[1]?.replace(/\|\s*Internshala/gi, '').trim();
    return {
      jobTitle: rolePart,
      company: companyPart || 'Target Company'
    };
  }

  return { jobTitle: cleaned };
}


function extractOpenGraphMeta(): { jobTitle?: string; company?: string; description?: string } {
  try {
    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:title"]')?.getAttribute('content');

    const ogDesc =
      document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      document.querySelector('meta[name="description"]')?.getAttribute('content') ||
      document.querySelector('meta[name="twitter:description"]')?.getAttribute('content');

    if (ogTitle) {
      const parsed = parseTitleForJobContext(ogTitle);
      return {
        jobTitle: parsed.jobTitle,
        company: parsed.company,
        description: ogDesc || undefined
      };
    }
  } catch {
    // Suppress
  }
  return {};
}

/**
 * Multi-tier robust job context extractor with JSON-LD, OpenGraph meta-tags, DOM selectors & document.title fallback
 */
function extractPageJobDetails(): ExtractedJobContext | null {
  const url = window.location.href;
  const domain = window.location.hostname;
  const platform = detectPlatformName(domain);

  // Tier 1: Try JSON-LD Standard Schema.org JobPosting
  const jsonLdData = extractJsonLdJobPosting();
  let jobTitle = jsonLdData?.jobTitle || '';
  let company = jsonLdData?.company || '';
  let description = jsonLdData?.description || '';
  let location = '';

  // Tier 1.5: Try OpenGraph meta tags
  if (!jobTitle) {
    const ogMeta = extractOpenGraphMeta();
    if (ogMeta.jobTitle && !isInvalidJobTitle(ogMeta.jobTitle)) {
      jobTitle = ogMeta.jobTitle;
      if (ogMeta.company && ogMeta.company !== 'Target Company') company = ogMeta.company;
      if (ogMeta.description) description = ogMeta.description;
    }
  }


  // Tier 2: Specialized DOM Selectors (LinkedIn, Greenhouse, Lever, Workday, Indeed)
  if (!jobTitle && domain.includes('linkedin.com')) {
    // Strategy 1: Check detail panel container on right side of split screen
    const detailContainer =
      document.querySelector('.jobs-search__job-details') ||
      document.querySelector('.jobs-details__main-content') ||
      document.querySelector('.job-details-jobs-unified-top-card__container') ||
      document.querySelector('.jobs-unified-top-card');

    if (detailContainer) {
      const heading =
        detailContainer.querySelector('.job-details-jobs-unified-top-card__job-title') ||
        detailContainer.querySelector('.jobs-unified-top-card__job-title') ||
        detailContainer.querySelector('h1') ||
        detailContainer.querySelector('h2') ||
        detailContainer.querySelector('.t-24');

      if (heading && heading.textContent) {
        const text = heading.textContent.trim();
        if (text && text.length > 2 && !text.toLowerCase().includes('linkedin') && text.toLowerCase() !== 'search') {
          jobTitle = text;
        }
      }

      const compElem =
        detailContainer.querySelector('.job-details-jobs-unified-top-card__company-name') ||
        detailContainer.querySelector('.jobs-unified-top-card__company-name') ||
        detailContainer.querySelector('a.topcard__org-name-link') ||
        detailContainer.querySelector('a');

      if (compElem && compElem.textContent) {
        company = compElem.textContent.trim();
      }

      const locElem =
        detailContainer.querySelector('.job-details-jobs-unified-top-card__bullet') ||
        detailContainer.querySelector('.jobs-unified-top-card__bullet') ||
        detailContainer.querySelector('.job-details-jobs-unified-top-card__workplace-type') ||
        detailContainer.querySelector('.topcard__flavor--bullet');

      if (locElem && locElem.textContent) {
        location = locElem.textContent.trim();
      }
    }

    // Strategy 2: Check active item in left search list
    if (!jobTitle) {
      const activeCard =
        document.querySelector('.jobs-search-results-list__list-item--active') ||
        document.querySelector('.job-card-container--active') ||
        document.querySelector('.jobs-search-results-list__list-item');

      if (activeCard) {
        const cardTitle =
          activeCard.querySelector('.job-card-list__title') ||
          activeCard.querySelector('a.job-card-container__link') ||
          activeCard.querySelector('h2') ||
          activeCard.querySelector('strong');

        if (cardTitle && cardTitle.textContent) {
          const text = cardTitle.textContent.trim();
          if (text && text.length > 2 && !text.toLowerCase().includes('linkedin') && text.toLowerCase() !== 'search') {
            jobTitle = text;
          }
        }

        const cardComp =
          activeCard.querySelector('.job-card-container__primary-description') ||
          activeCard.querySelector('.job-card-container__company-name') ||
          activeCard.querySelector('.artdeco-entity-lockup__subtitle');

        if (cardComp && cardComp.textContent) {
          company = cardComp.textContent.trim();
        }

        const cardLoc = activeCard.querySelector('.job-card-container__metadata-item');
        if (cardLoc && cardLoc.textContent) {
          location = cardLoc.textContent.trim();
        }
      }
    }

    description =
      document.querySelector('#job-details')?.textContent?.trim() ||
      document.querySelector('.jobs-description__content')?.textContent?.trim() ||
      document.querySelector('.jobs-description-content')?.textContent?.trim() ||
      document.querySelector('.jobs-box__html-content')?.textContent?.trim() ||
      '';
  } else if (!jobTitle && domain.includes('internshala.com')) {
    // Internshala Scraper
    jobTitle =
      document.querySelector('.profile_on_detail_page')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('.heading_4_5.profile')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('.heading_4_5')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('.profile')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('#heading')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim() ||
      '';

    company =
      document.querySelector('.company_name')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('a.link_display_like_text')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('.heading_6.company_name')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('.heading_6')?.textContent?.replace(/\s+/g, ' ').trim() ||
      '';

    location =
      document.querySelector('.location_link')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('#location_names')?.textContent?.replace(/\s+/g, ' ').trim() ||
      document.querySelector('.locations_container')?.textContent?.replace(/\s+/g, ' ').trim() ||
      '';

    description =
      document.querySelector('.internship_details')?.textContent?.trim() ||
      document.querySelector('#details_container')?.textContent?.trim() ||
      document.querySelector('.text-container')?.textContent?.trim() ||
      document.body.innerText.substring(0, 2500);
  } else if (!jobTitle && (domain.includes('wellfound.com') || domain.includes('angel.co'))) {
    // Wellfound / AngelList Scraper
    jobTitle =
      document.querySelector('[data-test="JobTitle"]')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      '';
    company =
      document.querySelector('[data-test="CompanyName"]')?.textContent?.trim() ||
      document.querySelector('h2')?.textContent?.trim() ||
      '';
    location = document.querySelector('[data-test="JobLocation"]')?.textContent?.trim() || '';
    description = document.body.innerText.substring(0, 2000);
  } else if (!jobTitle && domain.includes('glassdoor.com')) {
    // Glassdoor Scraper
    jobTitle =
      document.querySelector('[data-test="job-title"]')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      '';
    company = document.querySelector('[data-test="employer-name"]')?.textContent?.trim() || '';
    location = document.querySelector('[data-test="location"]')?.textContent?.trim() || '';
    description = document.querySelector('.jobDescriptionContent')?.textContent?.trim() || document.body.innerText.substring(0, 2000);
  } else if (!jobTitle && domain.includes('naukri.com')) {
    // Naukri Scraper
    jobTitle = document.querySelector('h1.jd-header-title')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || '';
    company = document.querySelector('.jd-header-comp-name')?.textContent?.trim() || document.querySelector('.company-name')?.textContent?.trim() || '';
    location = document.querySelector('.location')?.textContent?.trim() || '';
    description = document.querySelector('.job-desc')?.textContent?.trim() || document.body.innerText.substring(0, 2000);
  } else if (!jobTitle) {
    jobTitle =
      document.querySelector('h1.app-title')?.textContent?.trim() ||
      document.querySelector('.job-title')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      '';

    const metaCompany =
      document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
      document.querySelector('meta[name="author"]')?.getAttribute('content');

    company = metaCompany || domain.replace('www.', '').split('.')[0];
    description = document.body.innerText.substring(0, 2000);
  }

  const INVALID_JOB_TITLES = ['linkedin', 'search', 'jobs', 'careers', 'job', 'my jobs', 'preferences', 'feed', 'notifications', 'home', 'messages', 'profile', 'job tracker', 'my career insights'];

  function isInvalidJobTitle(title: string): boolean {
    if (!title || title.trim().length < 2) return true;
    const lower = title.trim().toLowerCase();
    return INVALID_JOB_TITLES.includes(lower) || lower.startsWith('jobs |') || lower.startsWith('jobs -');
  }

  // Tier 3: Parse document.title fallback if DOM failed or returned generic title
  if (isInvalidJobTitle(jobTitle)) {
    const parsed = parseTitleForJobContext(document.title);
    if (parsed.jobTitle && !isInvalidJobTitle(parsed.jobTitle)) {
      jobTitle = parsed.jobTitle;
    }
    if (parsed.company && (!company || company === 'Target Company')) {
      company = parsed.company;
    }
  }

  if (!location) {
    const textSample = (description || document.body.innerText).substring(0, 2000);
    if (textSample.includes('Remote') || textSample.includes('remote')) {
      location = 'Remote';
    } else if (textSample.includes('Hybrid') || textSample.includes('hybrid')) {
      location = 'Hybrid';
    }
  }

  if (isInvalidJobTitle(jobTitle)) return null;


  // Extract technical skills dynamically from extracted description text
  const extractedSkills: string[] = [];
  const knownTechs = [
    'React', 'TypeScript', 'JavaScript', 'Python', 'FastAPI', 'Node.js', 'Java', 'C++', 'C#',
    'HTML', 'CSS', 'Tailwind', 'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'SQL', 'PostgreSQL',
    'MongoDB', 'Redis', 'GraphQL', 'REST API', 'Git', 'Next.js', 'PyTorch', 'TensorFlow',
    'Flutter', 'Android', 'iOS', 'Swift', 'Kotlin', 'Go', 'Rust', 'Spring Boot', 'Django', 'Flask'
  ];
  const fullText = (jobTitle + ' ' + (description || '')).toLowerCase();
  for (const tech of knownTechs) {
    if (fullText.includes(tech.toLowerCase())) {
      extractedSkills.push(tech);
    }
  }

  // Structured debug logs (Requirement 12)
  console.log(`[JOB_DETECTION] url=${url}`);
  console.log(`[JOB_EXTRACTION] title=${jobTitle} company=${company} descriptionChars=${(description || '').length}`);

  return {
    url,
    domain,
    jobTitle,
    company: company || 'Target Company',
    location: location || 'Remote',
    platform,
    description: (description || '').substring(0, 2000),
    skills: extractedSkills,
  };
}




function checkIsLoggedOutPage(): boolean {
  const url = window.location.href.toLowerCase();
  if (url.includes('linkedin.com/login') || url.includes('linkedin.com/authwall') || url.includes('/signup')) {
    return true;
  }
  const loginForm = document.querySelector('form.login__form') || document.querySelector('#username');
  const isPublicNav = document.querySelector('.nav__button-secondary') && !document.querySelector('.global-nav__me');
  return !!(loginForm && isPublicNav);
}interface ExtractedCandidateContext {
  id: string;
  name: string;
  headline: string;
  about?: string;
  location?: string;
  targetRole?: string;
  keySkills: string[];
  skills?: string[];
  experience?: string[];
  education?: string[];
  projects?: string[];
  certifications?: string[];
  profileUrl: string;
  platform: string;
  profileHash: string;
}

/**
 * Structured Data JSON-LD Person Extractor
 */
function extractJsonLdPerson(): { name?: string; headline?: string; description?: string; location?: string } | null {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of Array.from(scripts)) {
      if (!script.textContent) continue;
      const json = JSON.parse(script.textContent);
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item['@type'] === 'Person' || item['@type'] === 'http://schema.org/Person') {
          return {
            name: item.name,
            headline: item.jobTitle || item.headline,
            description: item.description,
            location: typeof item.address === 'string' ? item.address : item.address?.addressLocality || item.address?.addressRegion,
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
 * Normalizes profile URLs to canonical base URLs across supported hiring platforms
 */
function getCanonicalProfileUrl(rawUrl: string, platform: string): string {
  try {
    const cleanUrl = rawUrl.split('?')[0].split('#')[0].replace(/\/+$/, '');
    if (platform === 'LinkedIn') {
      const match = cleanUrl.match(/(https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^/]+)/i);
      if (match) return `${match[1]}/`;
    } else if (platform === 'GitHub') {
      const match = cleanUrl.match(/(https?:\/\/github\.com\/[^/]+)/i);
      if (match && !['/features', '/marketplace', '/explore', '/topics', '/trending', '/login', '/signup'].some(path => match[1].toLowerCase().endsWith(path))) {
        return match[1];
      }
    } else if (platform === 'Indeed') {
      const match = cleanUrl.match(/(https?:\/\/(?:[a-z]+\.)?indeed\.com\/(?:p|me|resume)\/[^/]+)/i);
      if (match) return match[1];
    } else if (platform === 'Naukri') {
      const match = cleanUrl.match(/(https?:\/\/(?:www\.)?naukri\.com\/(?:mnjuser\/profile|profile\/[^/]+))/i);
      if (match) return match[1];
    } else if (platform === 'Internshala') {
      const match = cleanUrl.match(/(https?:\/\/(?:www\.)?internshala\.com\/student\/profile\/[^/]+)/i);
      if (match) return match[1];
    } else if (platform === 'Wellfound') {
      const match = cleanUrl.match(/(https?:\/\/(?:www\.)?(?:wellfound|angel)\.co\/u\/[^/]+)/i);
      if (match) return match[1];
    }
    return cleanUrl;
  } catch {
    return rawUrl.split('?')[0].split('#')[0];
  }
}

/**
 * Robust cyrb53 string hashing function for profile fingerprinting
 */
function cyrb53Hash(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function extractCandidateProfileDetails(): ExtractedCandidateContext | null {
  const url = window.location.href;
  const domain = window.location.hostname.toLowerCase();

  const isLinkedIn = domain.includes('linkedin.com');
  const isIndeed = domain.includes('indeed.com');
  const isNaukri = domain.includes('naukri.com');
  const isGlassdoor = domain.includes('glassdoor.com');
  const isInternshala = domain.includes('internshala.com');
  const isWellfound = domain.includes('wellfound.com') || domain.includes('angel.co');
  const isGitHub = domain.includes('github.com');

  const platform = isLinkedIn ? 'LinkedIn'
    : isIndeed ? 'Indeed'
    : isNaukri ? 'Naukri'
    : isGlassdoor ? 'Glassdoor'
    : isInternshala ? 'Internshala'
    : isWellfound ? 'Wellfound'
    : isGitHub ? 'GitHub' : detectPlatformName(domain);

  // === EARLY RETURN: Skip job listing/search pages — these are NOT candidate profiles ===
  const urlLower = url.toLowerCase();
  if (
    urlLower.includes('/jobs/search') ||
    urlLower.includes('/jobs/view') ||
    urlLower.includes('/jobs/collections') ||
    urlLower.includes('/jobs/recommended') ||
    urlLower.includes('naukri.com/job-listings') ||
    urlLower.includes('naukri.com/jobs') ||
    urlLower.includes('glassdoor.com/job-listing') ||
    urlLower.includes('glassdoor.com/jobs') ||
    urlLower.includes('internshala.com/jobs') ||
    urlLower.includes('internshala.com/internships') ||
    urlLower.includes('indeed.com/viewjob') ||
    urlLower.includes('indeed.com/jobs') ||
    urlLower.includes('wellfound.com/jobs') ||
    urlLower.includes('wellfound.com/l/') ||
    (isLinkedIn && urlLower.includes('/jobs/'))
  ) {
    return null;
  }


  const jsonLd = extractJsonLdPerson();
  let name = jsonLd?.name || '';
  let headline = jsonLd?.headline || '';
  let about = jsonLd?.description || '';
  let location = jsonLd?.location || '';

  // Tier 2: Semantic HTML & Accessibility & DOM Selectors across all supported platforms
  if (!name) {
    const nameElem =
      document.querySelector('h1.text-heading-xlarge') ||
      document.querySelector('.pv-text-details__left-panel h1') ||
      document.querySelector('[data-testid="profile-name"]') ||
      document.querySelector('.ph5 h1') ||
      document.querySelector('h1.vcard-names span.p-name') ||
      document.querySelector('span[itemprop="name"]') ||
      document.querySelector('h1.vcard-names') ||
      document.querySelector('.profile-name') ||
      document.querySelector('.student_name') ||
      document.querySelector('[data-test="UserName"]') ||
      document.querySelector('.name') ||
      document.querySelector('h1');

    name = nameElem?.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  if (!name || name.toLowerCase().includes('linkedin') || name.toLowerCase().includes('login') || name.toLowerCase().includes('sign in') || (name.toLowerCase().includes('developer') && name.includes('('))) {
    let docTitle = document.title
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\s*\|\s*(LinkedIn|Indeed|Naukri|Glassdoor|GitHub|Internshala|Wellfound)$/i, '')
      .trim();
    if (docTitle && !docTitle.toLowerCase().includes('login') && !docTitle.toLowerCase().includes('sign up')) {
      const candidateTitleName = docTitle.split('-')[0].split('|')[0].trim();
      if (candidateTitleName && candidateTitleName.length >= 2) {
        name = candidateTitleName;
      }
    }
  }

  // Strict check: If name extraction fails or is invalid, do NOT fake a profile
  if (!name || name.toLowerCase().includes('linkedin') || name.toLowerCase().includes('sign in') || name.length < 2) {
    return null;
  }

  // Headline (Strict DOM extraction with direct selector check + container fallback)
  let nameElem: Element | null = null;
  if (!headline) {
    nameElem =
      document.querySelector('h1.text-heading-xlarge') ||
      document.querySelector('.pv-text-details__left-panel h1') ||
      document.querySelector('[data-testid="profile-name"]') ||
      document.querySelector('.ph5 h1') ||
      document.querySelector('h1.vcard-names span.p-name') ||
      document.querySelector('span[itemprop="name"]') ||
      document.querySelector('h1.vcard-names') ||
      document.querySelector('.profile-name') ||
      document.querySelector('.student_name') ||
      document.querySelector('[data-test="UserName"]') ||
      document.querySelector('.name') ||
      document.querySelector('h1');

    // Strategy 1: Specific leaf elements for headline FIRST
    const specificHeadlineSelectors = [
      'div.text-body-medium.break-words',
      '.pv-text-details__left-panel div.text-body-medium',
      '.pv-text-details__left-panel .text-body-medium',
      'div.text-body-medium',
      'span.text-body-medium',
      '.ph5 div.text-body-medium',
      '.ph5 .text-body-medium',
      'div[data-generated-suggestion-target]',
      '[data-testid="headline"]',
      '[data-ph5-headline]',
      'div[class*="headline"]',
      '.pv-top-card-sticky-header__headline',
      '.user-profile-bio div',
      '.user-profile-bio',
      '[data-bio-text]'
    ];

    for (const sel of specificHeadlineSelectors) {
      const elems = document.querySelectorAll(sel);
      for (const elem of Array.from(elems)) {
        const text = elem.textContent?.replace(/\s+/g, ' ').trim() || '';
        const lower = text.toLowerCase();
        if (
          text.length > 5 &&
          text.length < 250 &&
          text !== name &&
          !text.startsWith(name) &&
          !lower.includes('contact info') &&
          !lower.includes('connections') &&
          !lower.includes('followers') &&
          !lower.includes('open to') &&
          !lower.includes('talks about') &&
          !lower.includes('search') &&
          !lower.includes('sign in') &&
          !lower.includes('he/him') &&
          !lower.includes('she/her')
        ) {
          headline = text;
          break;
        }
      }
      if (headline) break;
    }
  }

  // Strategy 2: Direct Sibling Traversal from name element (h1)
  if (!headline && nameElem) {
    let curr: Element | null = nameElem.nextElementSibling;
    while (curr && !headline) {
      const text = curr.textContent?.replace(/\s+/g, ' ').trim() || '';
      const lower = text.toLowerCase();
      if (
        text.length > 5 &&
        text.length < 250 &&
        text !== name &&
        !lower.includes('contact info') &&
        !lower.includes('connections') &&
        !lower.includes('followers') &&
        !lower.includes('he/him') &&
        !lower.includes('she/her') &&
        !lower.includes('they/them')
      ) {
        headline = text;
      }
      curr = curr.nextElementSibling;
    }

    if (!headline && nameElem.parentElement) {
      const pContainer = nameElem.parentElement;
      const childElems = pContainer.querySelectorAll('div, span, p');
      for (const cand of Array.from(childElems)) {
        const text = cand.textContent?.replace(/\s+/g, ' ').trim() || '';
        const lower = text.toLowerCase();
        if (
          text.length > 5 &&
          text.length < 250 &&
          text !== name &&
          !text.includes(name) &&
          !lower.includes('contact info') &&
          !lower.includes('connections') &&
          !lower.includes('followers') &&
          !lower.includes('open to') &&
          !lower.includes('enhance profile') &&
          !lower.includes('add section') &&
          !lower.includes('search') &&
          !lower.includes('sign in') &&
          !lower.includes('he/him') &&
          !lower.includes('she/her')
        ) {
          headline = text;
          break;
        }
      }
    }
  }

  // Meta Tag Fallback for headline
  if (!headline) {
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                     document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                     document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
    if (metaDesc) {
      if (metaDesc.includes(' - ')) {
        const parts = metaDesc.split(' - ');
        if (parts.length > 1 && parts[1].length > 3) {
          headline = parts[1].split(' | ')[0].split(' - ')[0].trim();
        }
      } else if (metaDesc.length > 5 && !metaDesc.toLowerCase().includes('linkedin')) {
        headline = metaDesc.trim();
      }
    }
  }

  // Location
  if (!location) {
    const locSelectors = [
      '.pv-text-details__left-panel .text-body-small',
      '.text-body-small.inline.t-black--light',
      '[data-testid="location"]',
      'li[itemprop="homeLocation"]',
      'span.p-label',
      '.octicon-location + span',
      '.location-name',
      '[data-test="JobLocation"]'
    ];

    for (const selector of locSelectors) {
      const elem = document.querySelector(selector);
      if (elem && elem.textContent) {
        const text = elem.textContent.replace(/\s+/g, ' ').trim();
        const lower = text.toLowerCase();
        if (
          text.length > 2 &&
          !lower.includes('notification') &&
          !lower.includes('contact info') &&
          !lower.includes('connection')
        ) {
          location = text;
          break;
        }
      }
    }
  }

  // About / Bio / Summary
  if (!about) {
    const aboutSelectors = [
      '#about ~ div .inline-show-more-text',
      '#about ~ div span[aria-hidden="true"]',
      '#about + div span[aria-hidden="true"]',
      'section[id*="about"] .inline-show-more-text',
      'section[id*="about"] span[aria-hidden="true"]',
      'section[id*="about"] div.pv-shared-text-with-see-more',
      'section[id*="about"] div',
      '.pv-about-section .inline-show-more-text',
      '.pv-about-section span[aria-hidden="true"]',
      '.pv-about__summary-text',
      '.user-profile-bio',
      '.user-bio',
      'article.markdown-body',
      '#readme'
    ];

    for (const sel of aboutSelectors) {
      const elem = document.querySelector(sel);
      if (elem && elem.textContent) {
        const text = elem.textContent.replace(/\s+/g, ' ').trim();
        const lower = text.toLowerCase();
        if (text.length > 10 && !lower.includes('notification') && !lower.includes('contact info')) {
          about = text;
          break;
        }
      }
    }
  }

  if (!about) {
    const aboutHeader = document.querySelector('#about') || Array.from(document.querySelectorAll('h2, span, div')).find(e => e.textContent?.trim().toLowerCase() === 'about');
    if (aboutHeader) {
      const section = aboutHeader.closest('section, div.pv-profile-card, div.artdeco-card') || aboutHeader.parentElement?.parentElement;
      if (section) {
        const textElem = section.querySelector('.inline-show-more-text, span[aria-hidden="true"], div.display-flex, p') || section;
        const text = textElem.textContent?.replace(/\s+/g, ' ').trim() || '';
        if (text.length > 10 && !text.toLowerCase().includes('contact info')) {
          about = text.replace(/^about\s*/i, '').trim();
        }
      }
    }
  }

  // Extract Skills
  const skillElems = document.querySelectorAll(
    '#skills ~ .pvs-list .hoverable-link-text, .pv-skill-category-entity__name-text, [aria-label*="Skill"], section[id*="skill"] li, #skills + div ul li, .skill-tag, .chip, [data-testid="skill-chip"], .key-skill span, .skill_container .skill, [data-test="SkillTag"], .topic-tag, [itemprop="programmingLanguage"]'
  );
  const extractedSkills: string[] = [];
  skillElems.forEach((elem) => {
    const text = elem.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.length > 1 && text.length < 50 && !extractedSkills.includes(text) && !text.toLowerCase().includes('skill')) {
      extractedSkills.push(text);
    }
  });

  // Check tech catalog keywords against full profile text (headline + about + page body)
  const pageBodyText = document.body ? document.body.innerText.slice(0, 5000) : '';
  const fullText = `${headline} ${about} ${pageBodyText}`;
  const techCatalog = [
    'Python', 'React', 'TypeScript', 'JavaScript', 'FastAPI', 'Node.js', 'Java', 'C++', 'C#', 'C',
    'Go', 'Rust', 'SQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Docker', 'Kubernetes', 'AWS',
    'GCP', 'Azure', 'RAG', 'LangGraph', 'LLM', 'PyTorch', 'TensorFlow', 'HTML/CSS', 'Git',
    'GraphQL', 'Next.js', 'Tailwind', 'System Architecture', 'API Development', 'DSA', 'Machine Learning',
    'Data Structures & Algorithms', 'Spring Boot', 'REST APIs', 'UI/UX', 'Figma', 'Microservices',
    'IoT', 'Robotics', 'Patent', 'Hackathon', 'Embedded Systems', 'Artificial Intelligence', 'Computer Science'
  ];

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  techCatalog.forEach((tech) => {
    try {
      const escaped = escapeRegExp(tech);
      const isWordOnly = /^[a-zA-Z0-9_]+$/.test(tech);
      const pattern = isWordOnly ? `\\b${escaped}\\b` : escaped;
      const regex = new RegExp(pattern, 'i');
      if (regex.test(fullText) && !extractedSkills.includes(tech)) {
        extractedSkills.push(tech);
      }
    } catch {
      if (fullText.toLowerCase().includes(tech.toLowerCase()) && !extractedSkills.includes(tech)) {
        extractedSkills.push(tech);
      }
    }
  });

  // Extract Experience (Section-scoped ONLY)
  const extractedExperience: string[] = [];
  let expSectionContainer: Element | null = null;

  const expAnchorElem = document.querySelector('#experience, [id*="experience"], section[id*="experience"], div[data-view-name*="experience"]');
  if (expAnchorElem) {
    expSectionContainer = expAnchorElem.closest('section, .pv-profile-card, .artdeco-card, [data-view-name*="profile-card"]') || expAnchorElem.parentElement?.parentElement || null;
  }

  if (!expSectionContainer) {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, span, div'));
    const expHeading = headings.find(e => e.children.length === 0 && e.textContent?.trim().toLowerCase() === 'experience');
    if (expHeading) {
      expSectionContainer = expHeading.closest('section, .pv-profile-card, .artdeco-card') || expHeading.parentElement?.parentElement || null;
    }
  }

  if (expSectionContainer) {
    const expItems = Array.from(expSectionContainer.querySelectorAll('li')).filter(li => {
      return li.querySelector('.t-bold, h3, h4, [aria-hidden="true"]') && !li.parentElement?.closest('li');
    });

    expItems.forEach(item => {
      const textSpans = Array.from(item.querySelectorAll('span[aria-hidden="true"], .t-bold, .t-14, h3, h4, strong'))
        .map(s => s.textContent?.replace(/\s+/g, ' ').trim() || '')
        .filter(t => t.length > 1 && !t.toLowerCase().includes('employment type') && !t.toLowerCase().includes('skills') && !t.toLowerCase().includes('experience'));

      if (textSpans.length >= 2) {
        const title = textSpans[0];
        const company = textSpans[1].split('·')[0].split('•')[0].trim();
        if (title && company && title !== company) {
          const entry = `${title} at ${company}`;
          if (!extractedExperience.includes(entry)) extractedExperience.push(entry);
        } else if (title && !extractedExperience.includes(title)) {
          extractedExperience.push(title);
        }
      } else if (textSpans.length === 1 && textSpans[0].length > 3 && !extractedExperience.includes(textSpans[0])) {
        extractedExperience.push(textSpans[0]);
      }
    });
  }

  // Extract Education (Section-scoped ONLY)
  const extractedEducation: string[] = [];
  let eduSectionContainer: Element | null = null;

  const eduAnchorElem = document.querySelector('#education, [id*="education"], section[id*="education"], div[data-view-name*="education"]');
  if (eduAnchorElem) {
    eduSectionContainer = eduAnchorElem.closest('section, .pv-profile-card, .artdeco-card, [data-view-name*="profile-card"]') || eduAnchorElem.parentElement?.parentElement || null;
  }

  if (!eduSectionContainer) {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, span, div'));
    const eduHeading = headings.find(e => e.children.length === 0 && e.textContent?.trim().toLowerCase() === 'education');
    if (eduHeading) {
      eduSectionContainer = eduHeading.closest('section, .pv-profile-card, .artdeco-card') || eduHeading.parentElement?.parentElement || null;
    }
  }

  if (eduSectionContainer) {
    const eduItems = eduSectionContainer.querySelectorAll('ul > li, li.artdeco-list__item, div.pvs-entity, div[data-view-name*="education"]');
    eduItems.forEach(item => {
      const textSpans = Array.from(item.querySelectorAll('span[aria-hidden="true"], .t-bold, .t-14, h3, h4, strong'))
        .map(s => s.textContent?.replace(/\s+/g, ' ').trim() || '')
        .filter(t => t.length > 1 && !t.toLowerCase().includes('education'));

      if (textSpans.length >= 2) {
        const school = textSpans[0];
        const degree = textSpans[1];
        if (school && degree && school !== degree) {
          const entry = `${degree} at ${school}`;
          if (!extractedEducation.includes(entry)) extractedEducation.push(entry);
        } else if (school && !extractedEducation.includes(school)) {
          extractedEducation.push(school);
        }
      } else if (textSpans.length === 1 && textSpans[0].length > 3 && !extractedEducation.includes(textSpans[0])) {
        extractedEducation.push(textSpans[0]);
      }
    });
  }

  // Extract Projects
  const projectElems = document.querySelectorAll('#projects ~ .pvs-list .hoverable-link-text, .project-item, section[id*="project"] li, .repo, [itemprop="owns"]');
  const extractedProjects: string[] = [];
  projectElems.forEach((elem) => {
    const text = elem.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.length > 3 && !extractedProjects.includes(text) && extractedProjects.length < 5) {
      extractedProjects.push(text);
    }
  });

  // Extract Certifications
  const certElems = document.querySelectorAll('#licenses_and_certifications ~ .pvs-list .hoverable-link-text, section[id*="certif"] li');
  const extractedCerts: string[] = [];
  certElems.forEach((elem) => {
    const text = elem.textContent?.replace(/\s+/g, ' ').trim();
    if (text && text.length > 3 && !extractedCerts.includes(text) && extractedCerts.length < 5) {
      extractedCerts.push(text);
    }
  });

  // Canonical profile URL & deterministic fingerprint source
  const canonicalUrl = getCanonicalProfileUrl(url, platform);
  const fingerprintSource = [
    platform,
    canonicalUrl,
    name,
    headline,
    about.slice(0, 200),
    extractedSkills.join(','),
    extractedExperience.join(','),
    extractedEducation.join(','),
    extractedProjects.join(',')
  ].join('|');

  const profileHash = `pf_${cyrb53Hash(fingerprintSource)}`;

  const extractedObj: ExtractedCandidateContext = {
    id: `cand_${profileHash}`,
    name,
    headline: headline || '',
    about: about || '',
    location: location || '',
    targetRole: headline ? (headline.split('|')[0]?.split('at')[0]?.split('-')[0]?.trim() || headline) : '',
    keySkills: extractedSkills,
    skills: extractedSkills,
    experience: extractedExperience,
    education: extractedEducation,
    projects: extractedProjects,
    certifications: extractedCerts,
    profileUrl: canonicalUrl,
    platform,
    profileHash,
  };

  // Required Debug Log Output
  console.log(`[InterviewOS] Platform detected: ${platform}`);
  console.log(`[InterviewOS] Profile URL: ${canonicalUrl}`);
  console.log(`[InterviewOS] Extracted candidate:`, {
    name,
    headline,
    about: about ? (about.slice(0, 100) + '...') : '(none)',
    location,
    skills: extractedSkills,
    experience: extractedExperience,
    education: extractedEducation,
    projects: extractedProjects,
    certifications: extractedCerts,
  });
  console.log(`[InterviewOS] Profile hash: ${profileHash}`);

  return extractedObj;
}

let lastDetectedJobUrl = '';

/**
 * Sends extracted job context to backend /api/extension/detect-job endpoint
 */
async function analyzePageJob() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) {
    return null;
  }

  // 1. Check Logged Out State
  if (checkIsLoggedOutPage()) {
    logInfo('Logged out page detected');
    if (chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({ isLoggedOut: true });
        chrome.runtime.sendMessage({ type: 'USER_LOGGED_OUT' });
      } catch {
        // Suppress
      }
    }
    return null;
  }

  // 2. Check Candidate Profile Page Extraction
  const candidateContext = extractCandidateProfileDetails();
  if (candidateContext) {
    logInfo('Extracted Candidate Profile Context:', candidateContext);
    if (chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({ analyzedCandidate: candidateContext, isProfileAnalyzed: true, isLoggedOut: false });
        chrome.runtime.sendMessage({ type: 'CANDIDATE_PROFILE_DETECTED', payload: candidateContext });
      } catch {
        // Suppress
      }
    }
    return null;
  }

  const extracted = extractPageJobDetails();
  if (!extracted) return null;

  // Prevent redundant repetitive API calls — use currentJobId on LinkedIn to detect job switches
  const dedupeKey = getJobDedupeKey();
  if (dedupeKey === lastDetectedJobUrl) {
    return extracted;
  }
  lastDetectedJobUrl = dedupeKey;

  try {
    logInfo('Extracted Job Posting Context:', extracted);

    // Save active job posting context into chrome storage for SidePanel sync
    if (chrome.storage && chrome.storage.local) {
      try {
        chrome.storage.local.set({ activeJobPosting: extracted }, () => {
          if (chrome.runtime.lastError) {
            // Evaluated lastError to mark it handled
          }
        });
      } catch {
        // Ignore extension context invalidated
      }
      try {
        chrome.runtime.sendMessage({ type: 'JOB_PROFILE_DETECTED', payload: extracted }, () => {
          if (chrome.runtime.lastError) {
            // Evaluated lastError to mark it handled
          }
        });
      } catch {
        // Ignore message error if sidepanel is not listening yet
      }
    }

    console.log('[JOB_DOM]', {
      title_candidate: extracted.jobTitle || 'MISSING',
      company_candidate: extracted.company || 'MISSING',
      location_candidate: extracted.location || 'MISSING',
      description_candidate_chars: (extracted.description || '').length
    });

    console.log('[JOB_EXTRACTION]', {
      status: 'success',
      title: extracted.jobTitle,
      company: extracted.company,
      location: extracted.location,
      description_chars: (extracted.description || '').length
    });

    const response = await fetch(`${API_BASE_URL}/api/extension/detect-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: extracted.url,
        domain: extracted.domain,
        pageTitle: document.title,
        jobTitle: extracted.jobTitle,
        company: extracted.company,
        rawDescription: extracted.description,
        job: {
          jobTitle: extracted.jobTitle,
          company: extracted.company,
          description: extracted.description,
          skills: extracted.skills || []
        }
      }),
    });


    if (response.ok) {
      const data = await response.json();
      logInfo('Backend Job Detection Result:', data);
      if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.set({ jobDetectionResult: data }, () => {
            if (chrome.runtime.lastError) {
              // Evaluated lastError to mark it handled
            }
          });
        } catch {
          // Suppress context invalidated
        }
      }
    }
    return extracted;
  } catch (error) {
    logError('Failed to execute job detection API:', error);
    return extracted;
  }
}

let lastUrl = window.location.href;
let lastJobTitle = '';
let lastProfileHash = '';
let lastDocTitle = document.title;

function getJobDedupeKey(): string {
  // For LinkedIn jobs search, use currentJobId param to detect job switches within same search URL
  try {
    const urlObj = new URL(window.location.href);
    if (urlObj.hostname.includes('linkedin.com') && urlObj.pathname.includes('/jobs/')) {
      const jobId = urlObj.searchParams.get('currentJobId');
      if (jobId) return `linkedin_job_${jobId}`;
    }
  } catch { /* ignore */ }
  return window.location.href;
}

function checkSpaJobChange() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return;
  const currentUrl = window.location.href;
  const currentDocTitle = document.title;

  const candidate = extractCandidateProfileDetails();
  if (candidate) {
    if (currentUrl !== lastUrl || candidate.profileHash !== lastProfileHash) {
      lastUrl = currentUrl;
      lastProfileHash = candidate.profileHash || '';
      lastDocTitle = currentDocTitle;
      logInfo('SPA Candidate Profile Change Detected:', candidate.name, candidate.profileHash);
      if (chrome.storage && chrome.storage.local) {
        try {
          chrome.storage.local.set({ analyzedCandidate: candidate, isProfileAnalyzed: true, isLoggedOut: false });
          chrome.runtime.sendMessage({ type: 'CANDIDATE_PROFILE_DETECTED', payload: candidate });
        } catch {
          // Suppress
        }
      }
    }
    return;
  }

  const details = extractPageJobDetails();
  const currentJobTitle = details?.jobTitle || '';

  // Detect job changes: URL change, job title change, OR document title change (LinkedIn SPA tab title updates)
  if (
    currentUrl !== lastUrl ||
    (currentJobTitle && currentJobTitle !== lastJobTitle) ||
    (currentDocTitle !== lastDocTitle && currentDocTitle && !currentDocTitle.toLowerCase().includes('linkedin'))
  ) {
    lastUrl = currentUrl;
    lastJobTitle = currentJobTitle;
    lastDocTitle = currentDocTitle;
    logInfo('SPA Job Change Detected:', currentJobTitle, '| tab title:', currentDocTitle);
    analyzePageJob();
  }
}

/**
 * Scans page DOM for visible job card postings (e.g. LinkedIn /jobs/ home, search results, recommended lists)
 */
function extractPageJobList(): ExtractedJobContext[] {
  const jobs: ExtractedJobContext[] = [];
  const domain = window.location.hostname;
  const platform = detectPlatformName(domain);

  const cardSelectors = [
    '.job-card-container',
    '.jobs-search-results-list__list-item',
    'li.jobs-home-vertical-list__entity-item',
    '.job-card-list',
    '.job-search-card',
    'div[data-job-id]',
    'li[data-occluded-item-id]'
  ];

  const cardElems = document.querySelectorAll(cardSelectors.join(', '));
  cardElems.forEach((card) => {
    const titleElem =
      card.querySelector('.job-card-list__title') ||
      card.querySelector('a.job-card-container__link') ||
      card.querySelector('.job-card-square__title') ||
      card.querySelector('strong') ||
      card.querySelector('h3') ||
      card.querySelector('h4') ||
      card.querySelector('a');

    if (!titleElem || !titleElem.textContent) return;
    const titleText = titleElem.textContent.replace(/\s+/g, ' ').trim();
    if (!titleText || titleText.length < 3 || titleText.toLowerCase().includes('linkedin')) return;

    const compElem =
      card.querySelector('.job-card-container__primary-description') ||
      card.querySelector('.job-card-container__company-name') ||
      card.querySelector('.artdeco-entity-lockup__subtitle') ||
      card.querySelector('.job-card-square__subtitle');

    const companyText = compElem?.textContent?.replace(/\s+/g, ' ').trim() || 'Hiring Company';

    const locElem =
      card.querySelector('.job-card-container__metadata-item') ||
      card.querySelector('.job-card-square__metadata-item');

    const locationText = locElem?.textContent?.replace(/\s+/g, ' ').trim() || 'Remote';

    if (!jobs.some((j) => j.jobTitle === titleText && j.company === companyText)) {
      jobs.push({
        url: window.location.href,
        domain,
        platform,
        jobTitle: titleText,
        company: companyText,
        location: locationText,
        description: `${titleText} at ${companyText}`
      });
    }
  });

  return jobs.slice(0, 8);
}

let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function setupProfileMutationObserver() {
  if (typeof window === 'undefined' || !document.body) return;

  try {
    const observer = new MutationObserver(() => {
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = setTimeout(() => {
        checkSpaJobChange();
      }, 800);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } catch {
    // Suppress observer init failure
  }
}

// Execute job detection & mutation observer setup shortly after page load settles
setTimeout(analyzePageJob, 1000);
setTimeout(setupProfileMutationObserver, 1200);
setInterval(checkSpaJobChange, 1500);

// Content script Chrome runtime message listener
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.id) return false;
      if (message && message.type === 'SCRAPE_CANDIDATE_PROFILE_NOW') {
        logInfo('Scraping candidate profile context upon extension request');
        const candidateDetails = extractCandidateProfileDetails();
        try {
          sendResponse({ success: true, data: candidateDetails });
        } catch {
          // Suppress sendResponse failure
        }
        return true;
      }
      if (message && message.type === 'SCRAPE_JOB_LIST_NOW') {
        const jobList = extractPageJobList();
        try {
          sendResponse({ success: true, data: jobList });
        } catch {
          // Suppress
        }
        return true;
      }
      if (message && (message.type === 'TOGGLE_FLOATING_WIDGET' || message.type === 'RESCAN_JOB' || message.type === 'SCRAPE_JOB_NOW')) {
        logInfo('Re-scanning page job context upon extension request');
        analyzePageJob().then((extracted) => {
          try {
            sendResponse({ success: true, data: extracted });
          } catch {
            // Suppress sendResponse failure on tab disconnect
          }
        });
        return true;
      }
      return true;
    });
  } catch {
    // Suppress context invalidated on script load
  }
}
})();
