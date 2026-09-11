const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const PRIMARY_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'meta-llama/llama-3.3-70b-instruct';

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static frontend files from current directory and public folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Multer in-memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.md'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Please upload a PDF, DOCX, or TXT file.`));
    }
  }
});

/**
 * Robust OpenRouter API caller with fallback and structured JSON parser
 */
async function callOpenRouter(messages, temperature = 0.2) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured in backend environment (.env).');
  }

  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL, 'mistralai/mistral-small-24b-instruct-2501', 'deepseek/deepseek-chat'];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://student-career-agent.local',
          'X-Title': 'Student Career and Resume Agent',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: messages,
          temperature: temperature,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`Model ${model} returned status ${response.status}: ${errText}`);
        lastError = new Error(`OpenRouter API error (${response.status}): ${errText}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        lastError = new Error(`Empty response from OpenRouter model ${model}`);
        continue;
      }

      return cleanAndParseJSON(content);
    } catch (err) {
      console.warn(`Failed with model ${model}:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to obtain a valid response from OpenRouter AI models.');
}

/**
 * Clean markdown formatting and safely parse JSON
 */
function cleanAndParseJSON(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    // Find outermost JSON object or array
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonCandidate);
    }

    throw new Error('Unable to parse JSON from AI response: ' + text.substring(0, 200));
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    apiKeyConfigured: Boolean(OPENROUTER_API_KEY),
    primaryModel: PRIMARY_MODEL
  });
});

/**
 * Sample Demo Data Endpoint
 */
app.get('/api/sample-data', (req, res) => {
  try {
    const resumePath = path.join(__dirname, 'demo', 'sample_resume.txt');
    const jdPath = path.join(__dirname, 'demo', 'sample_jd.txt');

    let sampleResume = '';
    let sampleJD = '';

    if (fs.existsSync(resumePath)) {
      sampleResume = fs.readFileSync(resumePath, 'utf-8');
    }
    if (fs.existsSync(jdPath)) {
      sampleJD = fs.readFileSync(jdPath, 'utf-8');
    }

    const demoCandidates = [
      {
        id: 'demo-cand-1',
        name: 'Alex Chen',
        headline: 'Senior CS Student | Full-Stack & Data',
        skills: ['Python', 'SQL', 'PostgreSQL', 'JavaScript', 'React', 'Node.js', 'Express', 'Git', 'Pandas'],
        education: ['B.S. in Computer Science - University of Washington (GPA: 3.75, Exp. May 2025)'],
        experience: ['Software Engineering Intern at Campus Web Services (6 mos)', 'Undergraduate Research Assistant (1 yr)'],
        text: sampleResume || `ALEX CHEN
Seattle, WA | alex.chen@email.com | github.com/alexchen-dev
EDUCATION: B.S. in Computer Science, University of Washington (GPA: 3.75, 2021-2025)
SKILLS: Python, JavaScript, SQL, PostgreSQL, React, Node.js, Express, Pandas, Git, REST APIs
EXPERIENCE:
- Software Engineering Intern, Campus Web Services: Built REST APIs, optimized SQL queries by 35%.
- Research Assistant, UW Data Lab: Analyzed student engagement data using Python and Pandas.
PROJECTS:
- E-Commerce Sales Forecasting: Python, Pandas, PostgreSQL, Streamlit. Analyzed 100k+ transactions.
- Course Compass: Full-stack React/Node app for course registration used by 1,200+ students.`
      },
      {
        id: 'demo-cand-2',
        name: 'Priya Sharma',
        headline: 'Data Analyst & BI Specialist',
        skills: ['SQL', 'Python', 'Tableau', 'Power BI', 'Excel', 'Pandas', 'NumPy', 'PostgreSQL', 'Snowflake', 'Statistics', 'A/B Testing'],
        education: ['B.S. in Data Analytics & Information Systems - UC Davis (GPA: 3.88, Graduated Dec 2024)'],
        experience: ['Data Analytics Intern at RetailPulse Solutions (8 mos)', 'Business Intelligence Peer Tutor (1 yr)'],
        text: `PRIYA SHARMA
San Francisco, CA | priya.sharma@email.com | linkedin.com/in/priyasharma-data
EDUCATION: B.S. in Data Analytics, University of California Davis (GPA: 3.88)
SKILLS: SQL (Advanced), Python (Pandas, NumPy, Scikit-learn), Tableau, Power BI, Excel (VBA/Pivot), Snowflake, PostgreSQL, Statistical Modeling, A/B Testing
EXPERIENCE:
- Data Analytics Intern, RetailPulse Solutions: Built executive KPI dashboards in Tableau monitoring $2.4M ARR; automated weekly SQL pipelines reducing report generation time by 60%.
- Business Intelligence Tutor: Mentored 40+ undergrads in advanced SQL querying and dashboard UX design.
PROJECTS:
- Customer Churn Prediction & Retention Dashboard: Built predictive logistic regression model in Python and deployed live interactive Tableau story reducing churn risk by 18%.
- Real-Time Supply Chain BI Tracker: Extracted 250k rows from PostgreSQL into Power BI with DAX measures.`
      },
      {
        id: 'demo-cand-3',
        name: 'Marcus Vance',
        headline: 'Junior Frontend Developer & UI Designer',
        skills: ['JavaScript', 'HTML5', 'CSS3', 'React', 'Tailwind CSS', 'Figma', 'TypeScript', 'UI/UX Design', 'Git', 'REST APIs'],
        education: ['B.A. in Digital Media & Web Design - San Jose State University (GPA: 3.50, 2024)'],
        experience: ['Frontend Web Developer Freelance (1.5 yrs)', 'UI/UX Design Intern at CreativHQ (5 mos)'],
        text: `MARCUS VANCE
San Jose, CA | marcus.vance@email.com | github.com/marcusv-ui
EDUCATION: B.A. in Digital Media & Web Development, SJSU (GPA: 3.50)
SKILLS: JavaScript (ES6+), React, HTML5/CSS3, Tailwind CSS, TypeScript, Figma, UI/UX Wireframing, Git
EXPERIENCE:
- Frontend Freelancer: Designed and built responsive web applications for 5 local businesses using React and Tailwind CSS.
- UI/UX Intern, CreativHQ: Created high-fidelity Figma design systems and user journey maps.
PROJECTS:
- DesignTokens Design System: React component library with accessible micro-interactions.
- FoodieFinder: Mobile-first web app with geolocation searching local restaurants.`
      },
      {
        id: 'demo-cand-4',
        name: 'Elena Rostova',
        headline: 'Cloud Infrastructure & DevOps Engineer',
        skills: ['Docker', 'Kubernetes', 'AWS', 'Linux', 'Go', 'Bash', 'CI/CD (GitHub Actions)', 'Terraform', 'Python', 'Prometheus'],
        education: ['B.S. in Software Engineering - Oregon State University (GPA: 3.65, 2024)'],
        experience: ['DevOps Intern at CloudScale Networks (7 mos)', 'Systems Administrator Student Assistant (1 yr)'],
        text: `ELENA ROSTOVA
Portland, OR | elena.rostova@email.com | github.com/erostova-devops
EDUCATION: B.S. in Software Engineering, Oregon State University (GPA: 3.65)
SKILLS: Docker, Kubernetes, AWS (EC2, S3, IAM, Lambda), Linux/Unix, Go, Bash Scripting, GitHub Actions, Terraform, Python, Prometheus/Grafana
EXPERIENCE:
- DevOps Intern, CloudScale Networks: Designed automated CI/CD pipelines deploying Docker microservices on Kubernetes; cut build failure rates by 40%.
- Student Systems Admin: Maintained university Linux lab servers and LDAP authentication.
PROJECTS:
- Cloud-Native Metric Monitor: Go microservice capturing server telemetry and visualizing in Prometheus.
- Multi-Region Terraform AWS Blueprint: Automated zero-downtime infrastructure provisioning.`
      }
    ];

    res.json({
      success: true,
      sampleResume,
      sampleJD,
      demoCandidates
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * File Upload & Text Extraction
 */
app.post('/api/upload-resume', upload.single('resumeFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file was uploaded.' });
    }

    const file = req.file;
    const ext = path.extname(file.originalname).toLowerCase();
    let extractedText = '';

    if (ext === '.pdf') {
      const pdfData = await pdfParse(file.buffer);
      extractedText = pdfData.text;
    } else if (ext === '.docx') {
      const docxResult = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = docxResult.value;
    } else if (ext === '.txt' || ext === '.md') {
      extractedText = file.buffer.toString('utf-8');
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported file format.' });
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'The uploaded file appears to be empty or contains scanned images without selectable text.'
      });
    }

    res.json({
      success: true,
      filename: file.originalname,
      size: file.size,
      text: extractedText.trim()
    });
  } catch (err) {
    console.error('Upload parsing error:', err);
    res.status(500).json({ success: false, error: 'Error reading uploaded file: ' + err.message });
  }
});

/**
 * Feature 1: Profile Parser & Extractor
 * Extracts skills, education, projects, certifications, experience, strengths and weaknesses.
 */
app.post('/api/parse-profile', async (req, res) => {
  try {
    const { profileText } = req.body;
    if (!profileText || profileText.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid resume text or upload a document.'
      });
    }

    const systemPrompt = `You are an expert AI Student Career Advisor and ATS Resume Parser.
Your job is to thoroughly analyze student resumes/profiles and extract structured data accurately.
Be meticulous. Identify real skills, projects, coursework, and realistic student strengths and improvement areas.

Return ONLY a JSON object with this exact schema:
{
  "candidate": {
    "name": "Candidate Name or 'Student Candidate'",
    "headline": "Current student title or aspirational title",
    "contact": {
      "email": "Email if found",
      "phone": "Phone if found",
      "location": "Location if found",
      "links": ["LinkedIn", "GitHub", "Portfolio links if found"]
    },
    "summary": "2-3 sentence executive summary of the student's background and core focus"
  },
  "readinessScore": 82, // An integer 0-100 indicating general career readiness for entry-level tech/business jobs
  "skills": {
    "technical": ["Python", "JavaScript", "SQL", ...],
    "frameworksAndTools": ["React", "Node.js", "Git", "Docker", ...],
    "softSkills": ["Problem Solving", "Team Leadership", "Communication", ...]
  },
  "education": [
    {
      "degree": "Degree and Major",
      "institution": "University / College",
      "year": "Graduation date/range",
      "gpa": "GPA if listed or null",
      "coursework": ["Course 1", "Course 2"]
    }
  ],
  "projects": [
    {
      "title": "Project Name",
      "technologies": ["React", "Express", "PostgreSQL"],
      "description": "Brief summary of what was built",
      "keyHighlights": ["Highlight 1", "Highlight 2"]
    }
  ],
  "experience": [
    {
      "role": "Role Title",
      "organization": "Company / Organization / Club",
      "period": "Duration",
      "responsibilities": ["Bullet point 1", "Bullet point 2"]
    }
  ],
  "certifications": [
    "Cert 1",
    "Cert 2"
  ],
  "strengths": [
    "Strength 1 with specific evidence from resume",
    "Strength 2 with specific evidence from resume",
    "Strength 3 with specific evidence from resume"
  ],
  "weaknesses": [
    "Constructive improvement area 1 (e.g. lack of quantified impact metrics, missing cloud experience)",
    "Constructive improvement area 2",
    "Constructive improvement area 3"
  ]
}`;

    const userPrompt = `Analyze this student resume/profile text carefully:\n\n${profileText}`;

    const parsedData = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    res.json({ success: true, data: parsedData });
  } catch (err) {
    console.error('Parse profile error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Feature 2: Career Fit (Top 5 Best-Fit Job Roles)
 * Recommends top 5 roles with match %, matching skills, missing skills, what to learn.
 */
app.post('/api/career-fit', async (req, res) => {
  try {
    const { profile, profileText } = req.body;
    if (!profile && !profileText) {
      return res.status(400).json({ success: false, error: 'Profile data is required.' });
    }

    const systemPrompt = `You are a Career Strategist for University Students and Recent Graduates.
Given the student's profile, recommend their TOP 5 BEST-FIT JOB ROLES.
Rank them from highest match percentage to lowest.
Ensure each role has realistic match percentages (e.g., 65%-95%), accurate matching skills from their profile, critical missing skills required by the industry for entry-level positions, and a practical 3-step learning roadmap.

Return ONLY a JSON object with this exact schema:
{
  "topRoles": [
    {
      "rank": 1,
      "roleTitle": "Full Stack Developer",
      "matchPercentage": 88,
      "fitReason": "Clear, encouraging explanation of why this student is well-positioned for this role based on their projects and skills.",
      "matchingSkills": ["JavaScript", "React", "Node.js", "REST APIs", "Git"],
      "missingSkills": ["TypeScript", "CI/CD Pipelines", "Docker containerization", "Unit Testing"],
      "learningRoadmap": [
        {
          "step": 1,
          "title": "Master TypeScript",
          "action": "Convert an existing React project to TypeScript to master typing, interfaces, and generics.",
          "estimatedTime": "2-3 weeks"
        },
        {
          "step": 2,
          "title": "Learn Automated Testing",
          "action": "Write unit and integration tests using Jest and React Testing Library.",
          "estimatedTime": "1-2 weeks"
        },
        {
          "step": 3,
          "title": "Build a Full-Stack Production App",
          "action": "Implement CI/CD with GitHub Actions and deploy with Docker or cloud serverless.",
          "estimatedTime": "3-4 weeks"
        }
      ]
    }
  ],
  "careerSummary": "A motivational 2-paragraph overall career guidance summary for the student."
}`;

    const userPrompt = `Analyze this student profile and generate their TOP 5 best-fit job roles:\n\n${JSON.stringify(profile || profileText, null, 2)}`;

    const careerData = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    res.json({ success: true, data: careerData });
  } catch (err) {
    console.error('Career fit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Feature 3: Job Role Checker
 * Student enters target role (e.g. "Data Analyst"), AI evaluates fit:
 * Strong Fit / Moderate Fit / Needs Improvement / Poor Fit + explains why.
 */
app.post('/api/check-role', async (req, res) => {
  try {
    const { targetRole, profile, profileText } = req.body;
    if (!targetRole || targetRole.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Please enter a target job role to check.' });
    }
    if (!profile && !profileText) {
      return res.status(400).json({ success: false, error: 'Student profile data is required.' });
    }

    const systemPrompt = `You are an AI Hiring Manager and Career Advisor.
Evaluate the student's readiness and match for the specific target job role: "${targetRole}".

Determine their fit category strictly as ONE of these four:
- "Strong Fit" (Match >= 80%: Has strong core skills, relevant projects/experience)
- "Moderate Fit" (Match 60-79%: Has transferable skills and foundational knowledge, but missing key specialized skills or portfolio proof)
- "Needs Improvement" (Match 40-59%: Major skill gaps or lack of relevant domain experience, but feasible with dedicated upskilling)
- "Poor Fit" (Match < 40%: Unrelated background requiring significant fundamental retraining)

Return ONLY a JSON object with this exact schema:
{
  "targetRole": "${targetRole}",
  "fitLevel": "Strong Fit" | "Moderate Fit" | "Needs Improvement" | "Poor Fit",
  "matchPercentage": 82,
  "verdictHeadline": "One-line punchy verdict summary",
  "detailedExplanation": "Thorough explanation of why the student received this evaluation, comparing their background against real industry expectations for entry-level ${targetRole}.",
  "matchingCompetencies": ["Skill/Experience 1", "Skill/Experience 2", "Skill/Experience 3"],
  "criticalGaps": ["Missing Skill/Concept 1", "Missing Skill/Concept 2", "Missing Skill/Concept 3"],
  "competencyBreakdown": {
    "technicalSkillsScore": 85, // 0-100
    "projectRelevanceScore": 75, // 0-100
    "experienceScore": 70, // 0-100
    "domainKnowledgeScore": 80 // 0-100
  },
  "actionPlan": [
    {
      "priority": "High",
      "recommendation": "Specific actionable task to improve fit for ${targetRole}"
    },
    {
      "priority": "Medium",
      "recommendation": "Second specific task"
    },
    {
      "priority": "Medium",
      "recommendation": "Third specific task"
    }
  ]
}`;

    const userPrompt = `Target Job Role to Evaluate: ${targetRole}\n\nStudent Profile:\n${JSON.stringify(profile || profileText, null, 2)}`;

    const fitData = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    res.json({ success: true, data: fitData });
  } catch (err) {
    console.error('Check role error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Feature 4: JD Analyzer
 * Student pastes Job Description, compares it with profile:
 * Match percentage, matching skills, missing skills, missing keywords, experience gaps, what to update in resume.
 */
app.post('/api/analyze-jd', async (req, res) => {
  try {
    const { jobDescription, profile, profileText } = req.body;
    if (!jobDescription || jobDescription.trim().length < 30) {
      return res.status(400).json({ success: false, error: 'Please paste a complete Job Description.' });
    }
    if (!profile && !profileText) {
      return res.status(400).json({ success: false, error: 'Student profile data is required.' });
    }

    const systemPrompt = `You are an advanced ATS (Applicant Tracking System) Scanner & Senior Recruiter.
Your task is to perform an in-depth comparative gap analysis between the candidate's profile and the provided Job Description.

Analyze:
1. Match Percentage (realistic calculation based on hard requirements, preferred requirements, keywords, and domain)
2. Matching Skills (skills found in both)
3. Missing Skills (critical required/preferred skills in JD that are absent in profile)
4. Missing Keywords & ATS Buzzwords (exact terms recruiters search for that are missing)
5. Experience & Scope Gaps (differences in expected years, scale, leadership, tools)
6. What to update in the resume (tailoring advice to maximize ATS score and interview chances)

Return ONLY a JSON object with this exact schema:
{
  "jobTitle": "Extracted or inferred Job Title from JD",
  "companyName": "Extracted or inferred Company Name from JD or 'Target Employer'",
  "matchPercentage": 78,
  "fitStatus": "High Match" | "Moderate Match" | "Low Match",
  "summaryAnalysis": "2-3 sentence recruiter assessment of candidate's competitiveness for this specific job posting.",
  "matchingSkills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4"],
  "missingSkills": ["Missing Skill 1", "Missing Skill 2", "Missing Skill 3"],
  "missingKeywords": ["ATS Keyword 1", "ATS Keyword 2", "ATS Keyword 3", "ATS Keyword 4"],
  "experienceGaps": [
    "Experience gap 1 (e.g. JD requires experience with Snowflake warehouse; profile only shows PostgreSQL)",
    "Experience gap 2 (e.g. JD requires Tableau dashboard building; profile has no BI tool experience)"
  ],
  "resumeUpdateRecommendations": [
    {
      "section": "Professional Summary",
      "advice": "Align summary to highlight quantitative data analysis and dashboard storytelling."
    },
    {
      "section": "Skills Section",
      "advice": "Group SQL and Python tools under 'Data Engineering & Analytics' and add relevant libraries."
    },
    {
      "section": "Projects / Experience",
      "advice": "In the E-Commerce forecasting project, explicitly mention KPI tracking and statistical validation to match JD keywords."
    }
  ],
  "interviewPrepQuestions": [
    "Question 1 tailored to the gaps/match for this JD",
    "Question 2 tailored to the gaps/match for this JD",
    "Question 3 tailored to the gaps/match for this JD"
  ]
}`;

    const userPrompt = `JOB DESCRIPTION:\n${jobDescription}\n\nCANDIDATE PROFILE:\n${JSON.stringify(profile || profileText, null, 2)}`;

    const jdAnalysisData = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    res.json({ success: true, data: jdAnalysisData });
  } catch (err) {
    console.error('JD analyzer error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Feature 5: Resume Improvement
 * Suggest improvements to headline, summary, skills, projects, and experience.
 * CRITICAL CONSTRAINT: Never invent skills, experience, certifications or achievements.
 */
app.post('/api/improve-resume', async (req, res) => {
  try {
    const { profile, profileText, targetRole, jobDescription } = req.body;
    if (!profile && !profileText) {
      return res.status(400).json({ success: false, error: 'Student profile data is required.' });
    }

    const systemPrompt = `You are a World-Class Resume Writer and Tech Career Coach.
Your mission is to upgrade the student's resume into a high-impact, ATS-optimized document.

CRITICAL RULE:
NEVER invent skills, fake work experience, unearned certifications, or fabricated metrics that do not exist or cannot be reasonably inferred from their real achievements.
Instead, improve the WRITING QUALITY, IMPACT, CLARITY, STRONG ACTION VERBS, and GOOGLE XYZ FORMULA ("Accomplished [X] as measured by [Y] by doing [Z]").

Provide actionable suggestions across:
1. Headline (Modern, keyword-rich headlines)
2. Professional Summary (Polished, punchy student summaries)
3. Skills Categorization (Clean grouping for recruiter readability)
4. Projects Section Improvements (Before vs. After rewritten bullet points with action verbs)
5. Experience Section Improvements (Before vs. After rewritten bullet points)
6. ATS Formatting & Recruiter Tips (Dos & Don'ts)

Return ONLY a JSON object with this exact schema:
{
  "headlineSuggestions": [
    "Primary Recommended Headline",
    "Alternative Headline Option 1",
    "Alternative Headline Option 2"
  ],
  "summaryRewrite": {
    "originalSummary": "Original summary or 'Not Provided'",
    "improvedSummary": "Polished, compelling 3-4 sentence professional summary tailored to the student's true strengths.",
    "keyChangesMade": "Explanation of what made this summary significantly stronger"
  },
  "skillsReorganization": {
    "category1Name": "Languages & Core",
    "category1Skills": ["Python", "JavaScript", "SQL"],
    "category2Name": "Frameworks & Web",
    "category2Skills": ["React.js", "Node.js", "Express.js"],
    "category3Name": "Data & Tools",
    "category3Skills": ["Pandas", "PostgreSQL", "Git", "Postman"],
    "category4Name": "Professional Competencies",
    "category4Skills": ["REST APIs", "Agile/Scrum", "Data Analysis"]
  },
  "projectImprovements": [
    {
      "projectTitle": "Project Name",
      "originalBullets": ["Original bullet point or summary"],
      "improvedBullets": [
        "Enhanced bullet using XYZ formula with strong action verb and technical depth",
        "Second enhanced bullet with clear problem-solving impact"
      ],
      "improvementsExplained": "Why this version appeals more to hiring managers"
    }
  ],
  "experienceImprovements": [
    {
      "role": "Role / Position",
      "organization": "Company / Organization",
      "originalBullets": ["Original responsibilities"],
      "improvedBullets": [
        "Upgraded bullet focusing on measurable contribution and mentorship/technical skill",
        "Upgraded second bullet"
      ],
      "improvementsExplained": "Key enhancement made"
    }
  ],
  "atsChecklist": [
    { "check": "Use standard single-column layout without tables or text boxes", "status": "Passed" },
    { "check": "Include standard section headers (Education, Skills, Experience, Projects)", "status": "Passed" },
    { "check": "Lead every bullet point with strong active power verbs", "status": "Recommended" },
    { "check": "Quantify outcomes with percentages, user counts, or speedups where applicable", "status": "Recommended" }
  ]
}`;
    let context = `STUDENT PROFILE:\n${JSON.stringify(profile || profileText, null, 2)}`;
    if (targetRole) {
      context += `\n\nTARGET ROLE FOR TAILORING: ${targetRole}`;
    }
    if (jobDescription) {
      context += `\n\nTARGET JOB DESCRIPTION FOR TAILORING:\n${jobDescription}`;
    }

    const improvementData = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: context }
    ]);

    res.json({ success: true, data: improvementData });
  } catch (err) {
    console.error('Improve resume error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Feature 6: Recruiter Screening - Batch Candidate Ranking & Deep Analysis
 * Accepts Job Description + multiple candidate resumes, ranks candidates with deep ATS & recruiter insights
 */
app.post('/api/screen-candidates', async (req, res) => {
  try {
    const { jobDescription, candidates } = req.body;

    if (!jobDescription || jobDescription.trim().length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid Job Description with requirements.'
      });
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please upload or provide at least one candidate resume.'
      });
    }

    const systemPrompt = `You are an AI Executive Recruiter and ATS Candidate Screening Engine.
Your mission is to objectively screen, rank, and compare a batch of candidate resumes against a specific Job Description.

Analyze each candidate with high recruiter rigor:
1. Match Score (0-100 integer) based on alignment with core requirements, preferred skills, domain experience, and education.
2. Fit Status strictly as ONE of: "Strong Fit" (>=80%), "Good Fit" (65-79%), "Moderate Fit" (45-64%), or "Needs Work" (<45%).
3. Matching Skills (skills & tools found in both the candidate profile and the JD).
4. Missing Critical Skills (essential requirements in JD missing from the candidate).
5. Competency Ratings (0-100 scores for: Technical Skills, Domain Experience, Education/Certifications).
6. Recruiter Fit Summary (2-3 punchy sentences evaluating why this candidate fits or misses the role).
7. Candidate Strengths (2-3 notable competitive advantages).
8. Potential Red/Green Flags (e.g. "Green: Has deployed production ML apps", "Flag: Lacks SQL experience required for core duties").
9. Tailored Interview Questions (2-3 targeted technical and behavioral validation questions specifically testing candidate gaps or claims).

Return ONLY a JSON object with this exact schema:
{
  "screeningSummary": "2-3 sentence hiring manager executive summary summarizing the applicant pool quality and key observations.",
  "topRecommendation": "Name of the single best candidate and why they stand out.",
  "candidates": [
    {
      "id": "candidate-id-from-input",
      "name": "Candidate Name",
      "headline": "Current title or student major",
      "matchScore": 88,
      "fitStatus": "Strong Fit",
      "matchingSkills": ["Python", "SQL", "Tableau", "Pandas"],
      "missingSkills": ["AWS Redshift", "Snowflake"],
      "competencyScores": {
        "technical": 90,
        "experience": 82,
        "education": 88
      },
      "fitSummary": "Strong alignment with data analysis requirements, solid SQL proficiency and hands-on dashboard portfolio.",
      "strengths": ["Quantified project results with 25% query optimization", "Strong portfolio in analytics"],
      "flags": ["Green: Strong Python/Pandas foundations", "Note: Needs onboarding for cloud data warehousing"],
      "tailoredInterviewQuestions": [
        "Can you walk us through how you optimized the PostgreSQL queries in your analytics project?",
        "How would you approach migrating local CSV workflows into a scalable cloud warehouse?"
      ]
    }
  ]
}`;

    const candidatesPayload = candidates.map((c, idx) => `
--- CANDIDATE #${idx + 1} ---
ID: ${c.id || `cand-${idx + 1}`}
Name: ${c.name || `Candidate ${idx + 1}`}
Provided Skills: ${Array.isArray(c.skills) ? c.skills.join(', ') : (c.skills || 'Not specified')}
Provided Education: ${Array.isArray(c.education) ? c.education.join(', ') : (c.education || 'Not specified')}
Provided Experience: ${Array.isArray(c.experience) ? c.experience.join(', ') : (c.experience || 'Not specified')}
Resume Full Content / Excerpt:
${(c.text || JSON.stringify(c)).substring(0, 3000)}
`).join('\n\n');

    const userPrompt = `TARGET JOB DESCRIPTION:\n${jobDescription}\n\nAPPLICANT POOL (${candidates.length} CANDIDATES):\n${candidatesPayload}`;

    const screeningData = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], 0.2);

    // Safeguard mapping & ensure IDs and arrays align
    if (screeningData && Array.isArray(screeningData.candidates)) {
      screeningData.candidates = screeningData.candidates.map((c, idx) => {
        const original = candidates[idx] || {};
        return {
          id: c.id || original.id || `cand-${idx + 1}`,
          name: c.name || original.name || `Candidate ${idx + 1}`,
          headline: c.headline || original.headline || 'Applicant',
          matchScore: typeof c.matchScore === 'number' ? Math.min(100, Math.max(0, c.matchScore)) : 65,
          fitStatus: c.fitStatus || (c.matchScore >= 80 ? 'Strong Fit' : c.matchScore >= 65 ? 'Good Fit' : c.matchScore >= 45 ? 'Moderate Fit' : 'Needs Work'),
          matchingSkills: Array.isArray(c.matchingSkills) ? c.matchingSkills : [],
          missingSkills: Array.isArray(c.missingSkills) ? c.missingSkills : [],
          competencyScores: c.competencyScores || { technical: 75, experience: 70, education: 75 },
          fitSummary: c.fitSummary || 'Candidate evaluated against job description requirements.',
          strengths: Array.isArray(c.strengths) ? c.strengths : [],
          flags: Array.isArray(c.flags) ? c.flags : [],
          tailoredInterviewQuestions: Array.isArray(c.tailoredInterviewQuestions) ? c.tailoredInterviewQuestions : [
            'Can you explain your relevant experience for this position?',
            'What strategies would you use to quickly learn the missing tools in our stack?'
          ],
          education: original.education || [],
          experience: original.experience || []
        };
      });

      // Sort candidate ranking descending by matchScore
      screeningData.candidates.sort((a, b) => b.matchScore - a.matchScore);
    }

    res.json({ success: true, data: screeningData });
  } catch (err) {
    console.error('Batch screening error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  const indexHtml = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexHtml)) {
    res.sendFile(indexHtml);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Start Server if run directly
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  function startServer(portToTry) {
    const server = app.listen(portToTry, () => {
      console.log(`\n====================================================`);
      console.log(`🚀 Student Career & Resume Agent Server is running!`);
      console.log(`📍 Local URL: http://localhost:${portToTry}`);
      console.log(`🔑 OpenRouter Key: ${OPENROUTER_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
      console.log(`🤖 Primary AI Model: ${PRIMARY_MODEL}`);
      console.log(`====================================================\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${portToTry} is already in use. Trying port ${portToTry + 1}...`);
        startServer(portToTry + 1);
      } else {
        console.error('❌ Server startup error:', err);
      }
    });
  }

  startServer(Number(PORT) || 3000);
}

module.exports = app;
