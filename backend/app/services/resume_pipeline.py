import re
import unicodedata
import logging
from typing import Dict, List, Any, Optional, Tuple, Set

logger = logging.getLogger(__name__)

# ============================================================================
# REGEX PATTERNS FOR ENTITY DETECTION
# ============================================================================

EMAIL_REGEX = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', re.IGNORECASE)
PHONE_REGEX = re.compile(r'(?:\+?\d{1,3}[\s.-]?)?(?:\d{3,5}[\s.-]?){2,3}\d{3,4}\b|\+?\d{10,13}\b')

GITHUB_REGEX = re.compile(r'(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_-]+)', re.IGNORECASE)
LINKEDIN_REGEX = re.compile(r'(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)', re.IGNORECASE)
URL_REGEX = re.compile(r'https?://[^\s<>"]+|www\.[^\s<>"]+', re.IGNORECASE)

# Known Soft Skills Catalog (Must NOT be technical skills or target roles)
SOFT_SKILLS_SET: Set[str] = {
    "teamwork", "communication", "adaptability", "leadership", "problem solving",
    "critical thinking", "time management", "collaboration", "interpersonal skills",
    "public speaking", "emotional intelligence", "work ethic", "decision making",
    "conflict resolution", "creativity", "flexibility", "active listening",
    "negotiation", "multitasking", "self-motivation", "organization", "patience",
    "presentation skills", "team player", "analytical thinking", "soft skills"
}

# Known Technical Skill Categories
PROGRAMMING_LANGUAGES: Set[str] = {
    "python", "java", "c++", "c#", "c", "javascript", "typescript", "go", "golang",
    "rust", "sql", "html", "css", "r", "swift", "kotlin", "php", "ruby", "scala",
    "bash", "shell", "powershell", "dart", "perl", "haskell", "assembly"
}

FRAMEWORKS: Set[str] = {
    "react", "react.js", "reactjs", "next.js", "nextjs", "angular", "vue", "vue.js",
    "fastapi", "django", "flask", "spring", "spring boot", "express", "express.js",
    "node.js", "nodejs", "svelte", "tailwind", "tailwindcss", "bootstrap", "asp.net",
    "laravel", "ruby on rails", "flutter", "react native", "electron"
}

DATABASES: Set[str] = {
    "mongodb", "mysql", "postgresql", "postgres", "redis", "sqlite", "oracle",
    "cassandra", "dynamodb", "elasticsearch", "firebase", "firestore", "neo4j",
    "cockroachdb", "mariadb", "supabase"
}

TOOLS_DEVOPS: Set[str] = {
    "docker", "kubernetes", "k8s", "git", "github", "gitlab", "jenkins", "terraform",
    "ansible", "webpack", "vite", "jira", "postman", "figma", "circleci", "prometheus",
    "grafana", "nginx", "apache", "linux", "ubuntu", "bash", "maven", "gradle"
}

AI_ML_TECH: Set[str] = {
    "tensorflow", "pytorch", "langchain", "rag", "llm", "llms", "vector database",
    "scikit-learn", "keras", "opencv", "nlp", "deep learning", "transformers",
    "huggingface", "fastembed", "chromadb", "qdrant", "pinecone", "machine learning",
    "artificial intelligence", "generative ai", "gemini", "openai", "spacy"
}

CLOUD_TECH: Set[str] = {
    "aws", "amazon web services", "gcp", "google cloud", "azure", "microsoft azure",
    "cloudflare", "heroku", "vercel", "netlify", "aws lambda", "s3", "ec2"
}

# Invalid Target Role Words / Contact Terms / Metadata / Degree & Section Artifacts
INVALID_ROLE_WORDS: Set[str] = {
    "github", "linkedin", "portfolio", "email", "phone", "mobile", "contact",
    "resume", "curriculum", "cv", "profile", "overview", "india", "delhi",
    "mumbai", "bangalore", "san francisco", "california", "new york", "london",
    "location", "address", "page", "document", "candidate", "student", "member",
    "user", "work", "experience", "education", "projects", "skills", "details",
    "personal", "contact information", "technical skills", "summary", "objective",
    "b.tech", "btech", "m.tech", "mtech", "bachelor", "master", "bsc", "msc", "phd",
    "degree", "diploma", "curriculum vitae", "page 1", "page 2", "certifications", "achievements"
}


# ============================================================================
# 1. RESUME TEXT NORMALIZATION
# ============================================================================

def normalize_resume_text(raw_text: str) -> str:
    """
    Normalizes raw extracted resume text across diverse formats (ATS, PDF, DOCX, Canva two-column, tables):
    - Unicode normalization (NFKC)
    - Carriage return and control character cleanup
    - Whitespace & repeated newline removal
    - PDF broken sentence reconstruction
    - Header / footer pattern removal
    """
    if not raw_text:
        return ""

    # 1. Unicode normalization
    text = unicodedata.normalize("NFKC", raw_text)

    # 2. Normalize carriage returns
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # 3. Standardize bullet characters
    bullets = ["•", "⁃", "▪", "►", "❖", "✦", "➢", "✔", "", ""]
    for b in bullets:
        text = text.replace(b, "* ")

    # 4. Remove repeating page numbers & headers/footers
    lines = text.splitlines()
    clean_lines = []
    
    for line in lines:
        stripped = line.strip()
        # Filter out empty lines or page number lines like "Page 1 of 2", "Page 1", "Curriculum Vitae"
        if not stripped:
            continue
        if re.match(r'^(page\s+\d+(\s+of\s+\d+)?|curriculum\s+vitae|resume)$', stripped, re.IGNORECASE):
            continue
        # Replace multiple inline spaces/tabs with single space
        normalized_line = re.sub(r'[ \t]+', ' ', stripped)
        clean_lines.append(normalized_line)

    # 5. Reconstruct broken lines (e.g. PDF split lines where line does not end with punctuation)
    reconstructed = []
    buffer = ""
    
    for line in clean_lines:
        if not buffer:
            buffer = line
        else:
            # If buffer doesn't end with sentence terminator and current line starts with lowercase or bullet
            if not buffer.endswith(('.', ':', ';', '!', '?', '*', '-')) and (line[0].islower() or line.startswith('*')):
                buffer += " " + line
            else:
                reconstructed.append(buffer)
                buffer = line
    if buffer:
        reconstructed.append(buffer)

    return "\n".join(reconstructed)


# ============================================================================
# 2. DETERMINISTIC ENTITY EXTRACTION BEFORE GEMINI
# ============================================================================

def extract_contact_and_entities(text: str) -> Dict[str, Any]:
    """
    Extracts contact info (email, phone, linkedin, github, portfolio, location)
    using deterministic regex before sending text to Gemini.
    """
    email_match = EMAIL_REGEX.search(text)
    email = email_match.group(0) if email_match else None

    # Phone extraction
    phone_pattern = re.compile(r'(?:\+\d{1,3}[\s.-]?)?\(?\d{2,5}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}')
    phone = None
    for match in phone_pattern.finditer(text):
        p_clean = match.group(0).strip()
        digits = re.sub(r'\D', '', p_clean)
        if 7 <= len(digits) <= 15:
            phone = p_clean
            break

    # GitHub URL
    github_match = GITHUB_REGEX.search(text)
    github = f"https://github.com/{github_match.group(1)}" if github_match else None

    # LinkedIn URL
    linkedin_match = LINKEDIN_REGEX.search(text)
    linkedin = f"https://linkedin.com/in/{linkedin_match.group(1)}" if linkedin_match else None

    # Portfolio / other URLs
    all_urls = URL_REGEX.findall(text)
    portfolio = None
    for u in all_urls:
        if "github.com" not in u.lower() and "linkedin.com" not in u.lower():
            portfolio = u.strip()
            break

    # Location heuristic (City, State / Country)
    location_match = re.search(r'\b([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z\s]+))\b', text)
    location = location_match.group(1).strip() if location_match else None

    return {
        "email": email,
        "phone": phone,
        "linkedin": linkedin,
        "github": github,
        "portfolio": portfolio,
        "location": location
    }


# ============================================================================
# 3. INTELLIGENT SKILL CLASSIFICATION
# ============================================================================

def classify_skills(skills_list: List[str]) -> Dict[str, List[str]]:
    """
    Classifies a list of skill strings into technical vs soft skills and technical categories.
    Strictly prevents soft skills (Teamwork, Communication, Adaptability) from being placed in technicalSkills.
    """
    tech_skills = []
    soft_skills = []
    prog_langs = []
    frameworks = []
    databases = []
    tools = []
    cloud = []
    ai_ml = []

    for item in skills_list:
        clean = str(item).strip()
        if not clean or len(clean) < 2:
            continue

        lower = clean.lower()

        # Check soft skill
        if lower in SOFT_SKILLS_SET or any(s == lower for s in ["teamwork", "communication", "adaptability", "leadership", "problem solving"]):
            if clean not in soft_skills:
                soft_skills.append(clean)
            continue

        # Check if it's a contact or invalid entity/degree/heading
        if EMAIL_REGEX.search(clean) or PHONE_REGEX.search(clean) or URL_REGEX.search(clean) or lower in INVALID_ROLE_WORDS:
            continue

        # Classify technical categories
        if lower in PROGRAMMING_LANGUAGES:
            prog_langs.append(clean)
        if lower in FRAMEWORKS or any(f in lower for f in ["react", "fastapi", "django", "spring"]):
            frameworks.append(clean)
        if lower in DATABASES or any(d in lower for d in ["sql", "mongo", "postgres", "redis"]):
            databases.append(clean)
        if lower in TOOLS_DEVOPS or any(t in lower for t in ["docker", "git", "kubernetes"]):
            tools.append(clean)
        if lower in AI_ML_TECH or any(a in lower for a in ["pytorch", "tensorflow", "llm", "rag", "ai"]):
            ai_ml.append(clean)
        if lower in CLOUD_TECH or any(c in lower for c in ["aws", "azure", "gcp"]):
            cloud.append(clean)

        if clean not in tech_skills:
            tech_skills.append(clean)

    return {
        "technicalSkills": tech_skills,
        "softSkills": soft_skills,
        "programmingLanguages": list(set(prog_langs)),
        "frameworks": list(set(frameworks)),
        "databases": list(set(databases)),
        "tools": list(set(tools)),
        "cloudTechnologies": list(set(cloud)),
        "aiMlTechnologies": list(set(ai_ml))
    }


# ============================================================================
# 4. TARGET ROLE VALIDATOR (MANDATORY POST-PROCESSING GUARD)
# ============================================================================

def is_valid_target_role(role_candidate: str, profile_evidence: Dict[str, Any]) -> bool:
    """
    Validates whether a proposed target role string resembles a true occupation/job title
    and has supporting evidence in the candidate profile.
    
    REJECTS:
    - Phone numbers, Emails, URLs & Platforms
    - Soft skills (Teamwork, Communication, Adaptability)
    - Locations (India, Delhi, San Francisco)
    - Generic resume words (Resume, Profile, CV, B.Tech, Education)
    """
    if not role_candidate:
        return False
        
    role_str = str(role_candidate).strip()
    if len(role_str) < 3 or len(role_str) > 60:
        return False

    # 1. Reject Regex match for Email, Phone, URL
    if EMAIL_REGEX.search(role_str) or PHONE_REGEX.search(role_str) or URL_REGEX.search(role_str):
        logger.warning(f"[ROLE VALIDATOR] Rejected contact entity from target roles: '{role_str}'")
        return False

    lower = role_str.lower()

    # 2. Reject exact match or substring of invalid keywords
    for invalid_kw in INVALID_ROLE_WORDS:
        if invalid_kw == lower or f" {invalid_kw} " in f" {lower} ":
            logger.warning(f"[ROLE VALIDATOR] Rejected invalid keyword from target roles: '{role_str}' (matched '{invalid_kw}')")
            return False

    # 3. Reject soft skills
    if lower in SOFT_SKILLS_SET:
        logger.warning(f"[ROLE VALIDATOR] Rejected soft skill from target roles: '{role_str}'")
        return False

    # 4. Must contain occupation/role word or technology title
    role_indicators = [
        "developer", "engineer", "architect", "analyst", "scientist", "specialist",
        "consultant", "lead", "manager", "administrator", "designer", "programmer",
        "intern", "associate", "full stack", "frontend", "backend", "software",
        "data", "ai", "machine learning", "cloud", "devops", "system", "qa", "tester", "mobile"
    ]
    
    tech_skills = profile_evidence.get("technicalSkills") or profile_evidence.get("skills") or []
    tech_skills_lower = [t.lower() for t in tech_skills]

    has_role_indicator = any(ind in lower for ind in role_indicators)
    has_tech_skill_match = any(t in lower for t in tech_skills_lower if len(t) >= 3)

    if not (has_role_indicator or has_tech_skill_match):
        logger.warning(f"[ROLE VALIDATOR] Rejected role lacking occupational evidence: '{role_str}'")
        return False

    return True


# ============================================================================
# 5. POST-PROCESSING VALIDATION & CONTAMINATION PURGE
# ============================================================================

def sanitize_and_validate_candidate(
    parsed_json: Dict[str, Any],
    extracted_contact: Dict[str, Any],
    resume_text: str
) -> Dict[str, Any]:
    """
    Mandatory post-processing pipeline that purges raw LLM response contamination,
    validates target roles, classifies skills, and formats evidence-based JSON.
    """
    cand = parsed_json.get("candidate") or {}
    
    # 1. Merge Contact Info
    contact = {
        "email": cand.get("contact", {}).get("email") or cand.get("email") or extracted_contact.get("email"),
        "phone": cand.get("contact", {}).get("phone") or cand.get("phone") or extracted_contact.get("phone"),
        "linkedin": cand.get("contact", {}).get("linkedin") or cand.get("linkedin") or extracted_contact.get("linkedin"),
        "github": cand.get("contact", {}).get("github") or cand.get("github") or extracted_contact.get("github"),
        "portfolio": cand.get("contact", {}).get("portfolio") or cand.get("portfolio") or extracted_contact.get("portfolio"),
        "location": cand.get("contact", {}).get("location") or cand.get("location") or extracted_contact.get("location")
    }

    # Build set of contact strings to purge from all lists
    contact_values_to_purge = set()
    for v in contact.values():
        if v:
            contact_values_to_purge.add(str(v).strip().lower())

    # 2. Extract and Classify Skills
    raw_skills = parsed_json.get("technicalSkills") or parsed_json.get("skills") or cand.get("technicalSkills") or []
    if isinstance(raw_skills, list):
        clean_raw_skills = [str(s).strip() for s in raw_skills if str(s).strip()]
    else:
        clean_raw_skills = []

    classified_skills = classify_skills(clean_raw_skills)

    # Filter out any contact string from technical skills
    technical_skills = [
        s for s in classified_skills["technicalSkills"]
        if s.lower() not in contact_values_to_purge
    ]
    raw_soft = parsed_json.get("softSkills") or parsed_json.get("soft_skills") or []
    soft_skills = list(dict.fromkeys(classified_skills["softSkills"] + [str(s).strip() for s in raw_soft if str(s).strip() and str(s).lower() in SOFT_SKILLS_SET]))

    # 3. Format Experience, Education, Projects & Purge Contamination
    formatted_exp = []
    for e in (parsed_json.get("experience") or []):
        if isinstance(e, dict):
            comp = (e.get("company") or "").strip()
            r_title = (e.get("role") or e.get("jobTitle") or "").strip()
            dur = (e.get("duration") or "").strip()
            raw_kw = e.get("keyWork") or e.get("description") or ""
            if isinstance(raw_kw, list):
                key_work = raw_kw[0].strip() if raw_kw else ""
            else:
                key_work = str(raw_kw).strip()
            techs = e.get("technologies") or []

            if EMAIL_REGEX.search(comp) or PHONE_REGEX.search(comp) or EMAIL_REGEX.search(r_title) or PHONE_REGEX.search(r_title):
                continue

            if comp or r_title:
                formatted_exp.append({
                    "role": r_title,
                    "company": comp,
                    "duration": dur,
                    "keyWork": str(key_work),
                    "technologies": techs if isinstance(techs, list) else []
                })

    formatted_edu = []
    for ed in (parsed_json.get("education") or []):
        if isinstance(ed, dict):
            inst = (ed.get("institution") or "").strip()
            deg = (ed.get("degree") or "").strip()
            yr = (ed.get("year") or ed.get("duration") or ed.get("fieldOfStudy") or "").strip()
            ev = (ed.get("evidence") or "").strip()

            if EMAIL_REGEX.search(inst) or PHONE_REGEX.search(inst) or EMAIL_REGEX.search(deg) or PHONE_REGEX.search(deg):
                continue

            if inst or deg:
                formatted_edu.append({
                    "degree": deg,
                    "institution": inst,
                    "year": yr,
                    "evidence": ev
                })

    formatted_proj = []
    for p in (parsed_json.get("projects") or []):
        if isinstance(p, dict):
            pname = (p.get("name") or "").strip()
            pdesc = (p.get("description") or "").strip()
            ptech = p.get("technologies") or []

            if EMAIL_REGEX.search(pname) or PHONE_REGEX.search(pname):
                continue

            if pname:
                formatted_proj.append({
                    "name": pname,
                    "description": pdesc,
                    "technologies": ptech if isinstance(ptech, list) else []
                })

    # 4. Target Roles
    raw_target_roles = parsed_json.get("targetRoles") or parsed_json.get("target_roles") or cand.get("targetRoles") or []
    validated_roles = []

    profile_evidence = {
        "technicalSkills": technical_skills,
        "experience": formatted_exp,
        "education": formatted_edu,
        "projects": formatted_proj
    }

    for r_item in raw_target_roles:
        role_str = ""
        fit_score = 85
        why_fit = ""

        if isinstance(r_item, dict):
            role_str = r_item.get("role") or ""
            fit_score = int(r_item.get("fitScore") or r_item.get("confidence", 0.85) * (100 if float(r_item.get("confidence", 0.85)) <= 1.0 else 1))
            why_fit = (r_item.get("whyFit") or "").strip()
            if not why_fit and r_item.get("evidence"):
                ev_raw = r_item.get("evidence")
                why_fit = f"Supported by evidence in {', '.join(ev_raw) if isinstance(ev_raw, list) else str(ev_raw)}."
        elif isinstance(r_item, str):
            role_str = r_item.strip()

        if is_valid_target_role(role_str, profile_evidence):
            if not why_fit and technical_skills:
                why_fit = f"Strong fit based on verified experience with {', '.join(technical_skills[:2])}."
            validated_roles.append({
                "role": role_str,
                "fitScore": fit_score,
                "whyFit": why_fit
            })

    # 5. Incomplete resume check (Section 6 & 7)
    is_incomplete = (len(technical_skills) == 0 and len(formatted_exp) == 0 and len(formatted_proj) == 0)

    strongest_areas = parsed_json.get("strongestAreas") or []
    development_areas = parsed_json.get("developmentAreas") or []

    if is_incomplete:
        validated_roles = []
        strongest_areas = []
        development_areas = []
        candidate_summary = "Not enough information was found in this resume to generate reliable career recommendations."
    else:
        candidate_summary = (parsed_json.get("candidateSummary") or cand.get("summary") or "").strip()

    # 6. Weighted Profile Completeness Calculation (Section 7)
    # Education: 15%, Experience: 25%, Technical Skills: 20%, Projects: 20%, Achievements: 10%, Summary/About: 10%
    completeness = 0
    if len(formatted_edu) > 0:
        completeness += 15
    if len(formatted_exp) > 0:
        completeness += min(25, len(formatted_exp) * 15)
    if len(technical_skills) > 0:
        completeness += min(20, len(technical_skills) * 4)
    if len(formatted_proj) > 0:
        completeness += min(20, len(formatted_proj) * 10)
    if len(parsed_json.get("achievements") or []) > 0:
        completeness += 10
    if candidate_summary and not is_incomplete:
        completeness += 10

    profile_completeness = min(100, completeness)

    return {
        "candidateSummary": candidate_summary,
        "candidate": {
            "name": (cand.get("name") or "").strip(),
            "headline": (cand.get("headline") or "").strip(),
            "summary": candidate_summary,
            "contact": contact
        },
        "technicalSkills": technical_skills,
        "softSkills": soft_skills,
        "programmingLanguages": classified_skills["programmingLanguages"],
        "frameworks": classified_skills["frameworks"],
        "databases": classified_skills["databases"],
        "tools": classified_skills["tools"],
        "cloudTechnologies": classified_skills["cloudTechnologies"],
        "aiMlTechnologies": classified_skills["aiMlTechnologies"],
        "experience": formatted_exp,
        "education": formatted_edu,
        "projects": formatted_proj,
        "achievements": parsed_json.get("achievements") or [],
        "targetRoles": validated_roles,
        "strongestAreas": strongest_areas,
        "developmentAreas": development_areas,
        "profileCompleteness": profile_completeness
    }
