# Final Project Context: IEM Admission Portal (MEAN Stack POC)

> **Status**: OMNIPRESENT — Activated for all MAS Agents (@PM, @GUARD, @ARCH, @DESIGN, @FE, @BE, @SEC, @ETHICS, @QA, @OPS, @DATA, @DEBUGGER, @REPAIR)
> **Version**: 1.0
> **Source of Truth**: IEM Admission Portal PRD v1.0, Assignment Specification & `landing page.png`
> **Brand Theme Palette (Strict IEM Codes)**: 
> - Primary Amber/Gold: `#F59E0B` (Accent: `#D97706`, Hover: `#B45309`)
> - Dark Charcoal/Navy: `#18181B` / `#0F172A`
> - Cream/Off-White Canvas: `#FFFDF5` / `#F8FAFC`
> - Surface White: `#FFFFFF`
> - Status Colors: Submitted (`#3B82F6`), Review (`#F59E0B`), Selected (`#10B981`), Rejected (`#EF4444`)

---

## 1. Product Vision & Execution Scope
A full-stack, modular MEAN POC for the Institute of Engineering & Management (IEM) online admission system. It showcases a clear request-response loop:
1. **Angular Client**: Calls `http.get` / `http.post` (Multipart/FormData for uploads, JSON for auth/status).
2. **Express Server (on Node)**: Routes requests, executes `multer` for disk storage, verifies JWT & RBAC, enforces status state machine.
3. **Mongoose / MongoDB**: Persists documents, indexes fields, and aggregates statistics using pipelines (`$group`, `$match`).
4. **Express Response**: Sends JSON metadata back to the client.
5. **Angular Updates**: Dynamic DOM update with signal/observable binding.

---

## 2. Core Approved Tech Stack & Invariants

| Layer / Domain | Technology | Configuration / Standards | Key Invariant / Responsibility |
| :--- | :--- | :--- | :--- |
| **Database (M)** | **MongoDB + Mongoose ODM** | Port `27017` / Atlas URI | Stores JSON-like documents. Never stores raw file binaries. |
| **Backend API (E & N)**| **Express.js (Node.js runtime)** | Port `5000` | REST API, JWT auth, Multer file handling, state machine validation. |
| **Frontend Web App (A)**| **Angular 19+** | Port `4200` | Standalone components, Reactive Forms, Route Guards (UX only). |
| **Document Storage** | **Multer Disk Storage** | Local directory `/uploads` | Disk holds files; MongoDB stores metadata references only. |
| **Security & RBAC** | **JWT + bcryptjs** | Bearer Token in HTTP Header | Server-side role check (`requireRole('admin')`). Security is strictly on Express. |
| **Status Engine** | **Deterministic State Machine** | Strict transition map | Only `Submitted` → `Review` → `Selected` / `Rejected` permitted. |
| **Analytics Engine** | **MongoDB Aggregation Pipeline**| `$group`, `$match`, `$facet` | Real-time counts by department and status. |

---

## 3. User Roles & Access Control Matrix

1. **`guest` (Unauthenticated)**:
   - Access Public Landing Page (`/`).
   - Open Pathway Selector modal (Applicant vs Admin).
   - Register or Login.
2. **`applicant`**:
   - Access **Applicant Dashboard** (`/applicant/dashboard`).
   - Submit one admission form with marksheet upload (`/applicant/apply`).
   - View application status, submitted details & document reference preview (`/applicant/status`).
3. **`admin`**:
   - Access **Admin Dashboard** (`/admin/dashboard`).
   - View real-time aggregated metrics by department and status.
   - Filter, search, and review applicants.
   - Advance application status along the allowed state machine.
