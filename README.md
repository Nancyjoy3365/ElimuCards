# ElimuCards

> Digital CBC & Cambridge Report Cards for Kenyan Schools

ElimuCards is a cloud-based school report card management system built specifically for Kenyan schools implementing the Competency-Based Curriculum (CBC) and Cambridge/British curriculum. It replaces the physical KICD assessment book and printed report cards with a fast, secure, multi-role digital system.

**Live app:** [elimu-cards.vercel.app](https://elimu-cards.vercel.app)

---

## The Problem

Kenyan schools using CBC face a recurring challenge at the end of every term:

- Teachers write the same marks in multiple places — the assessment book, the report card, the class register
- Class teachers spend days chasing subject teachers for marks before parent-teacher meetings
- Parents only find out how their child is doing when they collect the physical report card — often too late to act
- Assessment books get lost, damaged or left at school
- Printing report cards costs schools thousands of shillings every term

ElimuCards solves all of this.

---

## What It Does

**Teachers enter grades once. Parents see results the same day. The head teacher always knows where things stand.**

---

## Features

### CBC Assessment — Digital
- Three-level assessment structure matching the official KICD assessment book exactly: **Strand → Sub-strand → Learning Outcome**
- Official KICD learning outcomes pre-loaded for PP1 and PP2 — one click setup
- Admin can paste outcomes for other grades directly from the curriculum design document
- Teachers click **EE / ME / AE / BE** per outcome — exactly like the physical book
- Reflection field per outcome for teacher comments
- Progress bar showing graded outcomes vs total per student

### Cambridge / British Curriculum
- Year 1–9 percentage and letter grade entry (A to E)
- Checkpoint Years 6 and 9 with official 0–50 performance bands (Outstanding, High, Good, Aspiring, Basic)
- Multiple exam entry per term — Entry Exam, Mid Term, End Term (admin configures which apply)

### Dual Curriculum Support
- CBC only, Cambridge only, or both in the same school
- Curriculum Switcher in the header for instant context switching
- Separate student registers and grade records per curriculum

### Admin Dashboard
- Class Overview with animated stream dropdowns
- Student Register grouped by class and stream
- Staff Directory with subject assignments per teacher
- Parent Directory with child links
- Bulk student import via CSV/Excel with smart column detection
- Bulk parent import via CSV
- Curriculum Builder — Load from KICD, Paste from Book, or Manual Entry
- School Settings — term configuration, exam structure, academic year

### Teacher Dashboard
- One student at a time grade entry with Save & Next navigation
- Student tab row showing who has been graded (green checkmark) and who hasn't
- Progress indicator per student
- Home Class View — read-only master grid of all subjects for the whole class
- Final Remarks field per student per term
- Cambridge exam tabs per subject

### Parent Dashboard
- Access from any phone browser — no app download needed
- Child Switcher for parents with multiple children
- Collapsible Subject Cards with full strand breakdown
- Progress indicators — Improving / Steady / Needs Attention
- Term Comparison table — all three terms side by side
- **Download Report Card as PDF** — professionally formatted A4

### Security
- Row Level Security (RLS) enforced at database level — complete school data isolation
- Role-based access control — admins, teachers and parents each see only what they need
- Supabase Auth with secure password hashing
- Password reset via email link
- Show/hide password toggle on all inputs
- HTTPS encryption on all data transfers (TLS 1.3)
- File size limits on CSV imports
- Audit trail for grade changes
- Session timeout after 30 days

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 (Vite) |
| Backend | Supabase (BaaS) |
| Database | PostgreSQL (hosted on Supabase) |
| Authentication | Supabase Auth |
| Hosting | Vercel |
| Styling | Inline CSS with design token system |
| Fonts | Plus Jakarta Sans |
| PDF generation | Browser print API |
| Server location | Frankfurt, Germany (EU) |

---

## Database Schema

```
schools
├── classes (school_id)
├── students (school_id)
├── teachers (school_id)
├── parents (school_id)
├── strands (school_id)
│   └── sub_strands (strand_id)
│       └── learning_outcomes (sub_strand_id)
│           └── outcome_grades (student_id, outcome_id)
├── grades (student_id, subject, term)
├── remarks (teacher_id, student_id, term)
├── parent_invites (school_id, student_id)
└── grade_audit (school_id, student_id)
```

---

## User Roles

| Role | Access |
|------|--------|
| **Administrator** | Full school access — setup, users, all grades and reports |
| **Subject Teacher** | Only their assigned subjects and classes |
| **Home Class Teacher** | Read-only master grid for their class + final remarks |
| **Parent** | Their children's report cards only |

---

## Supported Curricula

### CBC Kenya
- Grades: PP1, PP2, Grade 1–9
- Grading: EE / ME / AE / BE per learning outcome
- Pre-loaded KICD data: PP1 and PP2 (Phase 1)
- Term calendar: Term 1 Jan–Apr · Term 2 May–Jul · Term 3 Aug–Nov

### Cambridge / British
- Years: Early Years, Year 1–9
- Grading: Percentage (0–100%) and letter grade (A–E)
- Checkpoint Years 6 & 9: Score 0–50 with official performance bands
- Term calendar: Term 1 Sep–Dec · Term 2 Jan–Mar · Term 3 Apr–Jun

---

## Getting Started — Local Development

### Prerequisites
- Node.js 18+
- A Supabase project ([supabase.com](https://supabase.com))

### Installation

```bash
# Clone the repo
git clone https://github.com/Nancyjoy3365/ElimuCards.git
cd ElimuCards/elimucards

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the `elimucards` folder:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Database Setup

Run the SQL in `supabase/schema.sql` in your Supabase SQL Editor to create all required tables.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and go through the School Setup Wizard.

---

## Deployment

The app is deployed on Vercel with automatic deployments from the `main` branch on GitHub.

```bash
# Push to trigger deployment
git add .
git commit -m "your message"
git push origin main
```

Add your Supabase environment variables in Vercel → Project Settings → Environment Variables.

---


## Roadmap

- CBC PP1 and PP2 with KICD pre-loaded data
- Cambridge grading with Checkpoint support
- PDF report card download
- Bulk student and parent CSV import
- Mobile-responsive layout



---

## Contact
 
**Email:** elimucards@gmail.com 
**Website:** [elimu-cards.vercel.app](https://elimu-cards.vercel.app)  
**Location:** Nairobi, Kenya  

---

## License

This project is proprietary software. All rights reserved.  
© 2026 ElimuCards. Built in Nairobi, Kenya.