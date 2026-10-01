# System Architecture Document: IEM Admission Portal (MEAN Stack POC)

> **Owner**: `@ARCH` (System Architect)
> **Status**: APPROVED
> **Target Stack**: MEAN (MongoDB, Express.js, Angular 19+, Node.js)
> **Design Pattern**: 3-Tier Layered Architecture with RESTful API

---

## 1. System Topology & The Request-Response Loop

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ANGULAR CLIENT (Browser)                        │
│  Port 4200 · Standalone Components · Reactive Forms · Route Guards     │
│  ├── 1. Landing & Pathway Selector                                     │
│  ├── 2. Applicant Module (Dashboard, Form, Status Tracker)             │
│  └── 3. Admin Module (Analytics Dashboard, Review Queue, Workflow)     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼  HTTP JSON / Multipart FormData (Bearer JWT)
┌────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS REST API (Node.js)                      │
│  Port 5000 · Middleware Pipeline · JWT Auth · Multer Disk Engine       │
│  ├── Routes: /api/auth, /api/applications, /api/admin                  │
│  ├── Middleware: auth.middleware.js (RBAC), upload.middleware.js       │
│  └── Controllers: State-machine validation, Aggregation queries        │
└────────────────────────────────────────────────────────────────────────┘
                   │                                  │
    Binary File    │                                  │ Mongoose ODM
    to Local Disk  ▼                                  ▼ BSON Documents
┌───────────────────────────────┐  ┌────────────────────────────────────┐
│         SERVER DISK           │  │              MONGODB               │
│  /uploads/                    │  │  Port 27017 (Local / Atlas)        │
│  marksheet-17112345.pdf       │  │  • users collection                │
│  (Isolated Binary Storage)    │  │  • applications collection         │
└───────────────────────────────┘  │    (Document metadata ref only)    │
                                   └────────────────────────────────────┘
```

---

## 2. API Contract Specification

### Auth Endpoints (`/api/auth`)
* `POST /api/auth/register` — Body: `{ name, email, password, phone, role }` → Returns: `{ user, token }`
* `POST /api/auth/login` — Body: `{ email, password }` → Returns: `{ user, token }`
* `GET  /api/auth/me` — Header: `Bearer <token>` → Returns current user profile & role

### Applicant Endpoints (`/api/applications`)
* `POST /api/applications` — Content-Type: `multipart/form-data` (Fields: personal & academic data; File: `marksheet`) → Creates record, saves file to disk, returns saved Application with Document reference.
* `GET  /api/applications/my-application` — Header: `Bearer <token>` → Returns logged-in applicant's application.

### Admin Endpoints (`/api/admin`)
* `GET  /api/admin/stats` — Header: `Bearer <token>` (Admin only) → Runs MongoDB Aggregation Pipeline ($group, $match, $facet) and returns counts by department and status.
* `GET  /api/admin/applications` — Query params: `?status=...&department=...` → Returns filtered list of applications.
* `PATCH /api/admin/applications/:id/status` — Body: `{ status, remarks }` → Enforces state-machine transition check; returns updated application.

---

## 3. Database Schema Design (Mongoose)

### `User` Schema
```javascript
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true }, // bcrypt hashed
  phone: { type: String },
  role: { type: String, enum: ['applicant', 'admin'], default: 'applicant' },
  createdAt: { type: Date, default: Date.now }
}
```

### `Application` Schema
```javascript
{
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  address: { type: String, required: true },
  
  // Academic & Program
  department: { type: String, enum: ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'BBA'], required: true },
  qualifyingExam: { type: String, required: true },
  passingYear: { type: Number, required: true },
  percentage: { type: Number, required: true },
  
  // POC 1: Multer Document Reference (Not the binary!)
  document: {
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  
  // POC 3: Status State Machine
  status: {
    type: String,
    enum: ['Submitted', 'Review', 'Selected', 'Rejected'],
    default: 'Submitted'
  },
  adminRemarks: { type: String, default: '' },
  statusHistory: [
    {
      fromStatus: String,
      toStatus: String,
      changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      changedAt: { type: Date, default: Date.now },
      remarks: String
    }
  ]
}
```
