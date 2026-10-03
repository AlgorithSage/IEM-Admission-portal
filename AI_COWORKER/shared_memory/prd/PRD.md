# Product Requirement Document (PRD): IEM Admission Portal (Dual Persistence & Vercel Monorepo)

> **Owner**: `@PM` (Product Manager & Orchestrator)
> **Status**: FINALIZED & APPROVED
> **Target Users**: Prospective Applicants, IEM Admission Cell Administrators
> **Core Architecture**: Angular 19+, Express.js, PostgreSQL, MongoDB Atlas
> **Version**: 2.0

---

## 1. Feature Modules & Functional Specifications

### Module 0: Public Landing Page & Pathway Selector (`@PM-FEAT-00`)
- **Landing Page**: Implements IEM branding per `landing page.png`:
  - Brand header with official IEM logo, institutional badge, and context-aware navigation.
  - Hero Section: *"Your Future Begins Here"* with quick CTA buttons (*Apply Now*, *Explore Programs*).
  - Feature highlights: *Easy Application, Secure & Reliable, Track in Real-time, Timely Updates*.
  - Popular Programs cards: *B.Tech (4 Years), M.Tech (2 Years), MBA (2 Years), MCA (2 Years), BBA (3 Years)*.
- **Pathway Selector**: Modal presenting choice:
  - **Applicant Portal**: Redirects to Student Login / Registration.
  - **Administrator Portal**: Redirects to Staff / Admin Authentication.

### Module 1: Auth & Role-Based Access Control (`@PM-FEAT-01`)
- **Registration**: Student provides Name, Email, Password, Mobile, Address. Accounts are synchronized across PostgreSQL (with row-versioning) and MongoDB Atlas.
- **Password Security UX**: Interactive eye toggle for visibility and real-time password strength meter (evaluating length, lowercase, uppercase, digits, symbols).
- **Authentication**: Dual-persistence login (PostgreSQL primary with MongoDB Atlas fallback). Generates signed JWT containing `{ id, email, role }`.
- **Client Route Guards**: Angular `authGuard` and `adminGuard` handle UX redirection.
- **Server-Side Enforcement**: Express `auth.middleware.js` and `requireRole` verify token and role on all protected API calls.

### Module 2: Applicant Dashboard & Admission Application Form (`@PM-FEAT-02`)
- **Applicant Dashboard**:
  - Welcome banner with student profile and quick status badge.
  - Action cards to launch/continue form, track status, or view guidelines.
- **Admission Form**:
  - Personal Information: Full Name, Email, Phone, Date of Birth, Gender, Address.
  - Academic Qualification: Qualifying Exam, Passing Year, Percentage / CGPA.
  - Program Selection: Dropdown of IEM programs (B.Tech, M.Tech, MBA, MCA, BBA).
  - **Boundary Value Analysis (BVA)**: Client-side validation service verifying score boundaries (0–100%), graduation years, and formatting. Suppresses valid popouts for a clean UI.

### Module 3: Document Upload with Multer (`@PM-FEAT-03`)
- **File Input**: Upload Marksheet / Certificate (PDF, PNG, JPEG up to 5MB) via drag-and-drop or file picker.
- **Dual-Mode Storage**: Express `multer` writes binary files to `server/uploads/` in local dev or `os.tmpdir()/uploads` on serverless platforms.
- **Database Reference**: Only metadata stored in MongoDB:
  - `fileName`, `originalName`, `filePath`, `mimeType`, `fileSize`, `uploadedAt`.
- **Reference Access**: Static file route `/uploads/:filename` serves preview to authorized users.

### Module 4: Status Workflow Engine (`@PM-FEAT-04`)
- **Lifecycle States**: `Submitted` → `Review` → `Selected` / `Rejected`.
- **Server-Enforced State Machine**: Express endpoint `PATCH /api/admin/applications/:id/status` validates allowed transitions:
  - `Submitted` can only transition to `Review`.
  - `Review` can transition to `Selected` or `Rejected`.
  - Terminal states cannot arbitrarily jump without structured review.
- **Rejection/Bad Request**: Illegal jumps return HTTP `400 Bad Request`.
- **Audit Logging**: Each transition appends to the `statusHistory` array with timestamp and admin ID.

### Module 5: Admin Dashboard & MongoDB Aggregation Pipeline (`@PM-FEAT-05`)
- **Aggregation Pipeline**: Real-time stats calculated via MongoDB `$facet`, `$group`, `$match`:
  - Total application count.
  - Breakdown counts by status (`Submitted`, `Review`, `Selected`, `Rejected`).
  - Breakdown counts by department / program.
- **Applicant Review Queue**:
  - Table of submitted applications with search and department/status filter.
  - View applicant details and document reference link.
  - Interactive status transition buttons with admin remarks.
