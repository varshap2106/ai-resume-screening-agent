# 🎓 Student Career & Resume AI Agent

An autonomous, full-stack AI career advisor and ATS resume scanner engineered for university students and recent graduates. Powered by **Node.js, Express, Vanilla JavaScript, HTML5/CSS3, and the OpenRouter API**.

---

## 🌟 Key Features

### 1. 📄 Intelligent Profile & Resume Parser
- **Multi-Format Ingestion**: Upload **PDF**, **DOCX**, or **TXT** files, or paste profile text directly.
- **Deep Extraction**: Extracts Candidate Summary, Technical Skills, Frameworks & Tools, Soft Skills, Education & Coursework, Academic/Personal Projects, Work & Leadership Experience, and Certifications.
- **Readiness Scoring**: Generates an overall **Career Readiness Score (0-100)** with strengths and constructive improvement areas.

### 2. 🎯 Career Fit (Top 5 Best-Fit Job Roles)
- Recommends the student's **top 5 best-fit entry-level tech/business roles** ranked by Match Percentage.
- For every role, breaks down:
  - **Match Percentage** & Fit Rationale.
  - **Matching Skills** already present in the student's profile.
  - **Missing Skills** required by the market.
  - **Actionable 3-Step Learning Roadmap** with realistic timelines.

### 3. 🔎 Target Job Role Fit Checker
- Student inputs any target role (e.g. `Data Analyst`, `Full Stack Developer`, `DevOps Engineer`).
- Categorizes readiness into 4 clear tiers:
  - 🟢 **Strong Fit** (80%+)
  - 🔵 **Moderate Fit** (60-79%)
  - 🟡 **Needs Improvement** (40-59%)
  - 🔴 **Poor Fit** (<40%)
- Provides detailed hiring manager explanations, competency breakdowns, and a prioritized gap-bridging action plan.

### 4. 📋 Job Description (JD) Analyzer
- Paste any real-world Job Description from LinkedIn, Indeed, or Handshake.
- Computes ATS match percentage, matching skills, missing required skills, and critical ATS keywords/buzzwords.
- Highlights experience & scope gaps.
- Delivers concrete **section-by-section resume tailoring recommendations** and **tailored interview preparation questions**.

### 5. ✨ AI Resume Improver (Truth-Preserving & ATS-Optimized)
- **Zero Hallucination Guarantee**: Strict ethical AI prompt ensuring no fake skills, fabricated metrics, or unearned certifications are invented.
- Generates high-impact headline variations.
- Professional summary rewrites with diff breakdown.
- Upgraded project and experience bullet points using the **Google XYZ Formula** (*"Accomplished [X] as measured by [Y] by doing [Z]"*).
- ATS compliance checklist & one-click clipboard export.

### ⚡ 1-Click Demo Profiles & JDs Included
- Built-in sample student profile (**Alex Chen** - Senior CS student with Web & Data projects).
- Built-in sample job posting (**Junior Data Analyst & BI Specialist** at Apex Data Solutions).

---

## 🏗️ Project Architecture

```
├── api/
│   └── index.js              # Serverless handler for Vercel deployment
├── demo/
│   ├── sample_resume.txt     # Pre-configured student resume for testing
│   └── sample_jd.txt         # Pre-configured Job Description
├── public/
│   └── index.html            # Frontend Single Page App (Embedded CSS + Vanilla JS)
├── .env                      # Environment variables (OpenRouter API Key)
├── .env.example              # Template for environment variables
├── .gitignore                # Git ignore rules for node_modules and .env
├── index.html                # Root frontend entry
├── package.json              # Dependencies and start scripts
├── server.js                 # Express server & OpenRouter API gateway
├── vercel.json               # Zero-config Vercel deployment settings
└── README.md                 # Complete documentation
```

---

## 🚀 Quickstart Guide (Local Development)

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Installation
```bash
# Clone repository
git clone https://github.com/your-username/student-career-resume-agent.git
cd student-career-resume-agent

# Install dependencies
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root folder (or copy `.env.example`):
```env
OPENROUTER_API_KEY=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
OPENROUTER_MODEL=google/gemini-2.0-flash-001
OPENROUTER_FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct
PORT=3000
```

### 4. Run the Application
```bash
# Start server
npm start
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🌐 Deployment Instructions

### Deploying to Vercel
1. Push your project to GitHub (see below).
2. Go to [Vercel Dashboard](https://vercel.com/new) and click **"Add New Project"**.
3. Import your GitHub repository.
4. Under **Environment Variables**, add:
   - `OPENROUTER_API_KEY`: `your-openrouter-key`
   - `OPENROUTER_MODEL`: `google/gemini-2.0-flash-001`
5. Click **Deploy**. Vercel will automatically build and host your app via `vercel.json` and `/api/index.js`.

### Pushing to GitHub
```bash
git init
git add .
git commit -m "feat: complete student career and resume AI agent"
git branch -M main
git remote add origin https://github.com/<your-username>/student-career-resume-agent.git
git push -u origin main
```

---

## 🔒 Security & Best Practices
- **API Key Protection**: The OpenRouter API key is kept exclusively on the server side (`.env` and backend routes). Frontend code never receives or exposes the API key.
- **Model Fallback**: Uses Google Gemini 2.0 Flash as the primary fast model with automatic fallback to Meta Llama 3.3 70B if limits or latency occur.
- **Strict JSON Parsing**: Backend guarantees structured, validated JSON data responses.

---

## 📄 License
MIT License. Free for educational and personal career use.
