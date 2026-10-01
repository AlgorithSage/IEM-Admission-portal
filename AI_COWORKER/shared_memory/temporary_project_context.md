# Temporary Project Context: IEM Admission Portal (MEAN Stack POC)

> **Status**: SYNCHRONIZED — Initialized from IEM Admission Portal PRD & Assignment Specification
> **Owner**: @PM
> **Active Target**: MEAN Stack POC (MongoDB, Express.js, Angular, Node.js)

## 1. Vision & Overview
The **IEM Admission Portal POC** is a scoped, end-to-end admission management system demonstrating the full MEAN stack request-response loop:
- **Angular** frontend captures admission applications & document uploads.
- **Express.js** REST API running on **Node.js** processes business rules, JWT auth, and role verification.
- **MongoDB** persists application records, user accounts, and document metadata references.

## 2. In-Scope vs. Out-of-Scope Boundaries
- **In Scope**:
  1. **Landing Page**: Public portal matching IEM visual branding (`landing page.png`), hero banner, programs, and pathway selector.
  2. **Applicant Module**: Registration/Login, dedicated **Applicant Dashboard**, single admission application form, and document upload (marksheet) with real-time status tracking.
  3. **Admin Module**: Admin login, RBAC-protected **Admin Dashboard** with MongoDB aggregation metrics ($group, $match), and status workflow transitions.
  4. **4 Core POC Demonstrations**:
     - *Document Upload*: Handled via `multer` to server disk (`uploads/`), storing only the reference in MongoDB.
     - *Auth & RBAC*: JWT with server-side role check (`requireRole('admin')`). Angular guards provide UX routing protection.
     - *Status Workflow*: State machine validating allowed transitions (`Submitted` → `Review` → `Selected` / `Rejected`).
     - *Admin Dashboard*: Aggregation pipeline calculating department and status counts.
- **Out of Scope**:
  - Live payment gateways (Mock/simulated only).
  - External SMS/OTP gateways.
  - Multi-tier complex institutional bureaucracy.
  - Production cloud clustering and auto-scaling.

## 3. Core Architecture
- **Frontend**: Angular 19+ (Standalone components, Reactive Forms, Angular Router, HttpClient, CanActivateFn Guards).
- **Backend API**: Node.js v24 + Express.js.
- **Database**: MongoDB with Mongoose ODM (dual-mode: local MongoDB / Atlas with automatic fallback).
- **File System Storage**: Multer diskStorage saving binary files to `/uploads/` and returning URI references.
