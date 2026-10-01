# Product Requirement Document (PRD): IEM Admission Portal (MEAN Stack POC)

> **Owner**: `@PM` (Product Manager & Orchestrator)
> **Status**: FINALIZED & APPROVED
> **Target Users**: Prospective Applicants, IEM Admission Cell Administrators
> **Core Architecture**: MEAN Stack (MongoDB, Express.js, Angular, Node.js)

---

## 1. Feature Modules & Functional Specifications

### Module 0: Public Landing Page & Pathway Selector (`@PM-FEAT-00`)
- **Landing Page**: Implements IEM branding per `landing page.png`:
  - Brand header with IEM logo and navigation links (*Home, Programs, How to Apply, Important Dates, Contact Us*).
  - Hero Section: *"Your Future Begins Here"* with quick CTA buttons (*Apply Now*, *Explore Programs*).
  - Feature highlights: *Easy Application, Secure & Reliable, Track in Real-time, Timely Updates*.
  - Popular Programs cards: *B.Tech (4 Years), M.Tech (2 Years), MBA (2 Years), MCA (2 Years), BBA (3 Years)*.
- **Pathway Selector**: Modal presenting choice:
  - **Applicant Portal**: Redirects to Student Login / Registration.
  - **Administrator Portal**: Redirects to Staff / Admin Authentication.

### Module 1: Auth & Role-Based Access Control (`@PM-FEAT-01`)
- **Registration**: Student provides Name, Email, Password, Mobile.
- **Authentication**: JWT issuance on successful login containing `{ id, email, role }`.
- **Client Route Guards**: Angular `authGuard` and `adminGuard` handle UX redirection.
- **Server-Side Enforcement**: Express `authMiddleware` and `adminOnlyMiddleware` verify token and role on all protected API calls.

### Module 2: Applicant Dashboard & Admission Application Form (`@PM-FEAT-02`)
- **Applicant Dashboard**:
  - Welcome banner with student profile.
  - Quick application status badge.
  - Action cards to launch/continue form, track status, or view guidelines.
- **Admission Form**:
  - Personal Information: Full Name, Email, Phone, Date of Birth, Gender, Address.
  - Academic Qualification: 12th/Graduation Board, Passing Year, Percentage / CGPA.
  - Program Selection: Dropdown of IEM programs (B.Tech, M.Tech, MBA, MCA, BBA).
  - Client-side validation: Reactive form controls with instant feedback.

### Module 3: Document Upload with Multer (`@PM-FEAT-03`)
- **File Input**: Upload Marksheet / Certificate (PDF, PNG, JPEG up to 5MB).
- **Disk Storage**: Express `multer` writes binary file to server disk (`/uploads/`).
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

### Module 5: Admin Dashboard & MongoDB Aggregation Pipeline (`@PM-FEAT-05`)
- **Aggregation Pipeline**: Real-time stats calculated via MongoDB `$facet`, `$group`, `$match`:
  - Total application count.
  - Breakdown counts by status (`Submitted`, `Review`, `Selected`, `Rejected`).
  - Breakdown counts by department / program.
- **Applicant Review Queue**:
  - Table of submitted applications with search and department/status filter.
  - View applicant details and document reference link.
  - Interactive status transition buttons.
