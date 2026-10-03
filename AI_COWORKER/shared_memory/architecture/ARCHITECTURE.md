# System Architecture Document: IEM Admission Portal (Dual-Persistence Architecture)

> **Owner**: `@ARCH` (System Architect)
> **Status**: APPROVED
> **Target Stack**: Angular 19+, Express.js (Node.js), PostgreSQL, MongoDB Atlas
> **Design Pattern**: 3-Tier Layered Architecture with Polyglot Persistence & Serverless Monorepo Deployment
> **Version**: 2.0

---

## 1. System Topology & Dual Persistence Flow

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ANGULAR CLIENT (Browser)                        │
│  Port 4200 · Standalone Components · BVA Service · Route Guards        │
│  ├── 1. Institutional Brand Navbar & Unified User Profile Widget       │
│  ├── 2. Landing & Pathway Selector Modal                               │
│  ├── 3. Applicant Module (Password Strength, Form, Status Tracker)     │
│  └── 4. Admin Module (Analytics Dashboard, Review Queue, Workflow)     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼  HTTP JSON / Multipart FormData (Bearer JWT)
                                       (Relative /api or Base URL)
┌────────────────────────────────────────────────────────────────────────┐
│                     EXPRESS.JS REST API GATEWAY                        │
│  Port 5000 / Vercel Serverless (@vercel/node)                          │
│  ├── Cold-Start DB Connection Caching Middleware                       │
│  ├── CORS Protection (Vercel Production & Localhost)                   │
│  ├── Routes: /api/health, /api/auth, /api/applications, /api/admin    │
│  ├── Middleware: auth.middleware.js (RBAC), upload.middleware.js       │
│  └── Controllers: State-machine validation, Aggregation pipelines      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
┌──────────────────┐   ┌───────────────────────────┐   ┌─────────────────────────┐
│ UPLOAD STORAGE   │   │     POSTGRESQL (Pool)     │   │   MONGODB ATLAS (ODM)   │
│ Local: uploads/  │   │  Port 5432 / DATABASE_URL │   │  Port 27017 / MONGO_URI │
│ Serverless: /tmp │   │  • users (UUID, version)  │   │  • users collection     │
│ (Metadata-only)  │   │  • user_history (Audit)   │   │  • applications coll.   │
│                  │   │  • Relational Profiles    │   │  • $facet Aggregations  │
└──────────────────┘   └───────────────────────────┘   └─────────────────────────┘
```

---

## 2. API Contract Specification

### Health Check Endpoint
* `GET /api/health` — Returns system status, timestamp, and environment.

### Auth Endpoints (`/api/auth`)
* `POST /api/auth/register` — Body: `{ name, email, password, phone, role }`
  - Validates input format and uniqueness.
  - Inserts relational profile into PostgreSQL (with default `row_version = 1`).
  - Persists synchronized user document in MongoDB Atlas.
  - Returns: `{ success: true, user: { id, name, email, role }, token }`.
* `POST /api/auth/login` — Body: `{ email, password }`
  - Performs dual-DB credential authentication (PostgreSQL primary, MongoDB fallback).
  - Verifies bcrypt hash (salt rounds = 10).
  - Returns: `{ success: true, user: { id, name, email, role }, token }`.
* `GET  /api/auth/me` — Header: `Bearer <token>`
  - Returns authenticated user profile, role, and current session claims.

### Applicant Endpoints (`/api/applications`)
* `POST /api/applications` — Content-Type: `multipart/form-data` (Personal & academic fields + `marksheet` file).
  - Enforces Boundary Value Analysis (BVA) on percentage (0-100), passing year, and required contacts.
  - Saves file to disk / `/tmp/uploads` via Multer and records metadata.
  - Sets initial state to `Submitted`.
  - Returns saved application document with file reference URI.
* `GET  /api/applications/my-application` — Header: `Bearer <token>`
  - Retrieves application submitted by authenticated applicant.
  - Returns `404` gracefully with `{ success: true, application: null }` if none submitted yet, preventing unhandled frontend exceptions.

### Admin Endpoints (`/api/admin`)
* `GET  /api/admin/stats` — Header: `Bearer <token>` (Admin only).
  - Executes MongoDB aggregation pipeline (`$facet`, `$group`, `$match`).
  - Returns total counts, status breakdown (`Submitted`, `Review`, `Selected`, `Rejected`), and program distribution.
* `GET  /api/admin/applications` — Query params: `?status=...&department=...`
  - Returns paginated and filtered list of applications.
* `PATCH /api/admin/applications/:id/status` — Body: `{ status, remarks }`
  - Enforces deterministic state-machine transition map.
  - Records transition in `statusHistory` subdocument array with timestamp and admin ID.

---

## 3. Database Schema Design

### 3.1 PostgreSQL Relational Schema

```sql
-- PGCrypto for UUID Generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Relational Users Table with Optimistic Row Versioning
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20) DEFAULT '',
  address TEXT DEFAULT '',
  role VARCHAR(20) CHECK (role IN ('applicant', 'admin')) DEFAULT 'applicant',
  row_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Audit Trail Table for Historical Profile Versioning
CREATE TABLE IF NOT EXISTS user_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR(20),
  address TEXT,
  row_version INT,
  changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  change_reason TEXT DEFAULT 'Profile update'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON user_history(user_id);
```

### 3.2 MongoDB Mongoose Schema

#### `User` Schema
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

#### `Application` Schema
```javascript
{
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
  address: { type: String, required: true },
  
  // Academic & Program (BVA Validated)
  department: { type: String, enum: ['B.Tech', 'M.Tech', 'MBA', 'MCA', 'BBA'], required: true },
  qualifyingExam: { type: String, required: true },
  passingYear: { type: Number, required: true },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  
  // Document Metadata Reference
  document: {
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    filePath: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  
  // Status State Machine
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

---

## 4. Multi-Database Resilience & State Synchronization
1. **Connection Caching**: MongoDB connection instance is cached across serverless invocations to avoid exhaustion of connection pools on cold starts.
2. **Dual-Auth Fallback**: The auth controller queries PostgreSQL; if PostgreSQL is disconnected or the record is missing, it falls back to MongoDB Atlas seamlessly.
3. **Optimistic Concurrency Control (OCC)**: Profile updates increment `row_version` in PostgreSQL to prevent race conditions during concurrent modifications.
