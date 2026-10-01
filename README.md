# IEM Admission Portal — MEAN Stack POC

A scoped, modular Proof-of-Concept (POC) of an online college admission system built on the **MEAN Stack** (**M**ongoDB, **E**xpress.js, **A**ngular 19+, **N**ode.js).

---

## 🏛️ Project Showcase & Visual Design
The frontend faithfully implements the official IEM institutional visual aesthetic based on [`landing page.png`](file:///c:/Users/archi/OneDrive/Desktop/IEM%20ADMISSION%20PORTAL/landing%20page.png):
* **Brand Colors**: IEM Gold (`#F59E0B`), Charcoal/Dark Slate (`#18181B`), Warm Cream Canvas (`#FEFDF6`), and Soft Tinted Feature Cards.
* **Layout**: Hero Section (*"Your Future Begins Here"*), 4 Feature Highlights, Popular Programs (*B.Tech, M.Tech, MBA, MCA, BBA*), Pathway Selector Modal, Applicant Dashboard, Admission Form, Status Tracker, and Admin Scrutiny Panel.

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js**: v18+ or v24+
* **NPM**: v9+ or v11+

### Quick Start (Both Client & Server)

```bash
# Option A: From root using unified scripts
npm run client     # Starts Angular Client at http://localhost:4200
npm run server     # Starts Express Server at http://localhost:5000

# Option B: Run individually
# 1. Start Server
cd server
npm start          # Or "npm run dev" for nodemon live-reload

# 2. Start Client (in a separate terminal)
cd client
npm start
```
The client will be live at **`http://localhost:4200`** and the server REST API at **`http://localhost:5000`**.

---

## 🎯 4 Core POC Demonstration Modules

| Module | What It Does | Key Concept It Demonstrates for Viva |
| :--- | :--- | :--- |
| **1. Document Upload** | Applicant uploads marksheet/certificate | File written to disk via `multer`; only a metadata reference (`fileName`, `fileSize`, `filePath`) is stored in MongoDB. |
| **2. Auth & RBAC** | Applicant vs Admin login | JWT token issuance + server-side role verification (`requireRole('admin')`). Proves Angular route guards are UX-only, not security boundaries. |
| **3. Status Workflow** | `Submitted` → `Review` → `Selected` / `Rejected` | Server validates allowed state transitions via a state-machine graph; illegal jumps return HTTP `400 Bad Request`. |
| **4. Admin Dashboard** | KPI counts by department & status | Real-time counts calculated inside MongoDB using the native Aggregation Pipeline (`$group`, `$match`, `$facet`), demonstrating NoSQL aggregation vs SQL `GROUP BY`. |

---

## 🔑 Demo Credentials (One-Click Demo in UI)

The frontend includes **"Demo Login"** shortcut buttons on both login screens:

### Applicant Portal (`/applicant/login`)
* **Email**: `aarav.sharma@gmail.com`
* **Password**: `password123`
* **Role**: `applicant`
* **Access**: Applicant Dashboard, Fill Form & Upload Marksheet, Track Dossier & Timeline.

### Administrator Portal (`/admin/login`)
* **Email**: `admin@iem.edu.in`
* **Password**: `adminpassword123`
* **Role**: `admin`
* **Access**: Admin Scrutiny Panel, Aggregation Metrics Cards, Review Table & Status State Machine Actions.

---

## 🔄 The MEAN Stack Request-Response Loop
1. **Angular (Browser)**: Component captures form data / file input $\rightarrow$ `ApplicationService` makes HTTP request (`http.post` with `FormData` / `Bearer JWT`).
2. **Express.js (Node.js)**: Router matches endpoint (`/api/applications`) $\rightarrow$ Executes middleware (`multer` writes file to disk, `authMiddleware` verifies JWT).
3. **Mongoose (ODM)**: Queries or persists JSON-like document in MongoDB collections.
4. **MongoDB**: Stores document / executes Aggregation Pipeline $\rightarrow$ Returns BSON results.
5. **Express**: Serializes result into JSON response and sends HTTP response with appropriate status code (200 / 201 / 400 / 403).
6. **Angular**: Receives JSON observable $\rightarrow$ Updates reactive signals $\rightarrow$ Angular DOM updates live.

---

## 📂 Project Directory Structure

```text
IEM-ADMISSION-PORTAL/
├── client/ (or frontend/)     # Angular 19+ Client
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/          # Singletons loaded once (guards, interceptors, base API)
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   └── admin.guard.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── auth.interceptor.ts    # Attaches Bearer JWT
│   │   │   │   └── services/
│   │   │   │       ├── auth.service.ts
│   │   │   │       └── application.service.ts
│   │   │   ├── shared/        # Reusable UI & presentation widgets
│   │   │   │   ├── components/
│   │   │   │   │   ├── navbar/
│   │   │   │   │   └── pathway-modal/
│   │   │   │   └── pipes/
│   │   │   ├── features/      # Feature slices (domain-driven pages)
│   │   │   │   ├── landing/
│   │   │   │   │   └── landing.component.*
│   │   │   │   ├── auth/
│   │   │   │   │   ├── applicant-login/
│   │   │   │   │   └── admin-login/
│   │   │   │   ├── applicant/
│   │   │   │   │   ├── applicant-dashboard/
│   │   │   │   │   ├── application-form/
│   │   │   │   │   └── status-tracker/
│   │   │   │   └── admin/
│   │   │   │       └── admin-dashboard/
│   │   │   ├── models/        # Shared frontend TypeScript interfaces
│   │   │   │   ├── user.model.ts
│   │   │   │   └── application.model.ts
│   │   │   ├── app.routes.ts  # Root standalone routing definition
│   │   │   └── app.component.*
│   │   ├── assets/            # Static assets & branding
│   │   ├── environments/      # Environment configurations (API baseURL)
│   │   │   ├── environment.ts
│   │   │   └── environment.prod.ts
│   │   ├── index.html
│   │   └── styles.css
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
│
├── server/                    # Node.js + Express + Mongoose Backend
│   ├── config/
│   │   └── db.js              # MongoDB Mongoose connection handler
│   ├── controllers/           # Business logic & request handling (Plural)
│   │   ├── auth.controller.js         # Register, Login, JWT issuance
│   │   └── application.controller.js  # Apply, file metadata save, status state machine, aggregation stats
│   ├── models/                # Mongoose Schemas (Singular)
│   │   ├── User.js            # User credentials, roles ('applicant' | 'admin')
│   │   └── Application.js     # Form fields, state machine status, marksheet metadata
│   ├── routes/                # Express API Route declarations
│   │   ├── api.js             # Master router mounting sub-routes
│   │   ├── auth.routes.js     # /api/auth/*
│   │   └── application.routes.js # /api/applications/*, /api/admin/*
│   ├── middlewares/           # Custom Express middlewares
│   │   ├── auth.middleware.js # Bearer JWT verification & requireRole('admin')
│   │   ├── upload.middleware.js # Multer diskStorage configuration & MIME filters
│   │   └── error.middleware.js # Centralized HTTP error handler
│   ├── uploads/               # Disk-isolated storage for uploaded marksheets (gitignored)
│   ├── .env                   # PORT, MONGO_URI, JWT_SECRET, CORS_ORIGIN
│   ├── package.json           # Backend dependencies (express, mongoose, multer, jsonwebtoken, bcryptjs, cors)
│   └── server.js              # Express app initialization & server entry point
│
├── .gitignore                 # node_modules/, server/uploads/, server/.env, dist/
├── README.md                  # System architecture, viva demo guide & run commands
└── package.json               # Optional root runner ("npm run dev" with concurrently)

```
