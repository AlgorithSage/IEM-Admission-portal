# Temporary Project Context: IEM Admission Portal (Dual Persistence & Serverless Ready)

> **Status**: SYNCHRONIZED — Updated to reflect Dual Database Architecture (PostgreSQL + MongoDB), Vercel monorepo deployment, and UX enhancements.
> **Owner**: @PM
> **Active Target**: Dual-Database Architecture & Vercel Monorepo Deployment
> **Version**: 2.0

## 1. Vision & Overview
The **IEM Admission Portal** is a production-hardened admission management system demonstrating full-stack engineering with dual relational & document databases:
- **Angular 19** frontend captures admission applications, enforces BVA validation rules, provides password security tooling, and handles document uploads.
- **Express.js** REST API running on **Node.js** processes business rules, JWT auth with resilient multi-DB fallback, and role verification.
- **PostgreSQL** persists relational user profiles with optimistic row-versioning (`row_version`) and audit history (`user_history`).
- **MongoDB Atlas** persists application records, document metadata references, and analytics pipelines.
- **Vercel Monorepo** seamlessly serves the Angular frontend and routes API endpoints via serverless lambda handlers with DB connection caching.

## 2. In-Scope vs. Out-of-Scope Boundaries
- **In Scope**:
  1. **Landing Page**: Public portal matching IEM visual branding (`landing page.png`), hero banner, programs, and pathway selector.
  2. **Applicant Module**: Registration/Login with password visibility toggle & strength meter, dedicated **Applicant Dashboard**, BVA-validated admission form, and document upload (marksheet) with real-time status tracking and printable receipt.
  3. **Admin Module**: Admin login, RBAC-protected **Admin Dashboard** with MongoDB aggregation metrics ($group, $match), applicant search/filter, and status workflow transitions.
  4. **Core Technical Demonstrations**:
     - *Dual-Database Persistence*: PostgreSQL for relational user profiles with row-versioning & audit history; MongoDB Atlas for applications and analytics.
     - *Document Upload*: Handled via `multer` to server disk (`uploads/`) with serverless fallback to `os.tmpdir()` (`/tmp/uploads`), storing only references in the database.
     - *Auth & RBAC*: JWT with server-side role check (`requireRole('admin')`) and resilient dual-DB sync. Angular guards provide UX routing protection.
     - *Status Workflow*: State machine validating allowed transitions (`Submitted` → `Review` → `Selected` / `Rejected`).
     - *Admin Dashboard*: Aggregation pipeline calculating department and status counts.
     - *Vercel Serverless*: Monorepo deployment with connection caching and CORS protection.
- **Out of Scope**:
  - Live payment gateways (Mock/simulated only).
  - External SMS/OTP gateways.
  - Multi-tier complex institutional bureaucracy.

## 3. Core Architecture
- **Frontend**: Angular 19+ (Standalone components, Reactive Forms, BVA Validation Service, Angular Router, HttpClient, CanActivateFn Guards).
- **Backend API**: Node.js + Express.js (Modular routes, serverless cold-start DB caching, centralized error middleware).
- **Relational DB**: PostgreSQL via `pg` Pool (`DATABASE_URL` with SSL support, `pgcrypto` UUIDs, table versioning).
- **Document DB**: MongoDB Atlas with Mongoose ODM (Auto-reconnection and connection reuse).
- **File System Storage**: Multer diskStorage saving binary files to `uploads/` (local) or `os.tmpdir()/uploads` (serverless Vercel) and returning URI references.
