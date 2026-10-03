# Final Project Context: IEM Admission Portal (Dual Persistence Engine: MongoDB + PostgreSQL)

> **Status**: OMNIPRESENT — Activated for all MAS Agents (@PM, @GUARD, @ARCH, @DESIGN, @FE, @BE, @SEC, @ETHICS, @QA, @OPS, @DATA, @DEBUGGER, @REPAIR)
> **Version**: 2.0 (Dual-Engine Persistence & Vercel Serverless Monorepo)
> **Source of Truth**: IEM Admission Portal PRD v2.0, Assignment Specification & `landing page.png`
> **Brand Theme Palette (Strict IEM Codes)**: 
> - Primary Amber/Gold: `#F59E0B` (Accent: `#D97706`, Hover: `#B45309`)
> - Dark Charcoal/Navy: `#18181B` / `#0F172A`
> - Cream/Off-White Canvas: `#FFFDF5` / `#F8FAFC`
> - Surface White: `#FFFFFF`
> - Status Colors: Submitted (`#3B82F6`), Review (`#F59E0B`), Selected (`#10B981`), Rejected (`#EF4444`)

---

## 1. Product Vision & Execution Scope
A full-stack, enterprise-grade admission system for the Institute of Engineering & Management (IEM). It incorporates dual relational and document persistence engines, BVA validation, and Vercel serverless deployment:
1. **Angular 19 Client**: Standalone components, BVA form validation service, context-aware institutional navbar, password visibility/strength utilities, and HTTP communication with relative API routing.
2. **Express Server (Node.js runtime)**: Serverless-ready REST API with connection caching, Multer file handling with serverless `/tmp` fallback, JWT & server-side RBAC, and deterministic status state machine.
3. **Dual Persistence Layer**:
   - **PostgreSQL**: Relational user entity with optimistic concurrency row-versioning (`row_version`), audit trail logging (`user_history`), and cloud connection pooling with SSL.
   - **MongoDB Atlas**: Document persistence for admission applications, document upload references, lifecycle status tracking, and high-performance aggregation pipelines (`$group`, `$facet`).
4. **Resilient Dual-Auth Engine**: Synchronized authentication supporting primary database query and seamless failover to ensure 100% login uptime.
5. **Vercel Monorepo Architecture**: Unified deployment routing Angular build artifacts and Express serverless functions seamlessly under a single origin.

---

## 2. Core Approved Tech Stack & Invariants

| Layer / Domain | Technology | Configuration / Standards | Key Invariant / Responsibility |
| :--- | :--- | :--- | :--- |
| **Relational Database** | **PostgreSQL (pg Pool)** | Port `5432` / `DATABASE_URL` (SSL) | Relational user profiles, optimistic row versioning (`row_version`), and historical audit trail table (`user_history`). |
| **Document Database** | **MongoDB Atlas + Mongoose** | Port `27017` / `MONGO_URI` | Stores application documents, status history, and analytical aggregation pipelines. No raw binaries. |
| **Backend API Gateway** | **Express.js (Node.js runtime)** | Port `5000` / Vercel Serverless | REST API, connection caching for cold starts, JWT auth, Multer file handling, state machine validation. |
| **Frontend Web App** | **Angular 19+** | Port `4200` / Vercel Edge | Standalone components, Reactive Forms, BVA validation service, context-aware navbar, Route Guards (UX only). |
| **Document Storage** | **Multer Disk Engine** | `uploads/` (Local) / `/tmp/uploads` (Serverless) | Files stored on disk; database holds URI and metadata references only. |
| **Security & RBAC** | **JWT + bcryptjs** | Bearer Token in HTTP Header | Server-side role check (`requireRole('admin')`). Security strictly enforced on Express backend. |
| **Status Engine** | **Deterministic State Machine** | Strict transition map | Only `Submitted` → `Review` → `Selected` / `Rejected` permitted. |
| **Analytics Engine** | **MongoDB Aggregation Pipeline** | `$group`, `$match`, `$facet` | Real-time counts by department and status. |
| **Hosting & CI/CD** | **Vercel Monorepo** | `vercel.json` | Single-repository build & deploy routing Angular static assets and `/api` serverless handler. |

---

## 3. User Roles & Access Control Matrix

1. **`guest` (Unauthenticated)**:
   - Access Public Landing Page (`/`).
   - Open Pathway Selector modal (Applicant vs Admin).
   - Register or Login with interactive password strength meter and visibility toggles.
2. **`applicant`**:
   - Access **Applicant Dashboard** (`/applicant/dashboard`).
   - Submit one admission application with BVA-validated fields and marksheet upload (`/applicant/apply`).
   - View application status, submitted details, safe document reference preview, and printable receipt (`/applicant/status`).
3. **`admin`**:
   - Access **Admin Dashboard** (`/admin/dashboard`).
   - View real-time aggregated metrics by department and status via MongoDB aggregation.
   - Filter, search, and review applicants.
   - Advance application status along the deterministic state machine with audit remarks.
