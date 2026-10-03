# Deployment & Run Log: IEM Admission Portal (Dual Persistence & Vercel Monorepo)

> **Status**: READY FOR RUNTIME & CLOUD DEPLOYMENT
> **Owner**: @OPS
> **Version**: 2.0

---

## 1. Local Runtime Specification

- **Node.js Runtime**: v20+ / v24+
- **NPM Package Manager**: 10+ / 11+
- **Backend Port**: `5000` (`http://localhost:5000`)
- **Frontend Port**: `4200` (`http://localhost:4200`)
- **Primary Relational DB**: PostgreSQL (Port `5432` or cloud `DATABASE_URL` with SSL)
- **Document DB**: MongoDB Atlas (`MONGO_URI`)
- **File Upload Directory**: `server/uploads/` (local)

### Local Startup Commands
```bash
# Terminal 1: Backend
cd server
npm install
npm run dev # or node server.js

# Terminal 2: Frontend
cd client
npm install
npm start # or ng serve
```

---

## 2. Cloud Deployment Specification (Vercel Monorepo)

The repository is configured for zero-configuration monorepo deployment via `vercel.json`:
- **Frontend Build**:
  - Framework: Angular CLI
  - Root: `client/`
  - Output Directory: `client/dist/client/browser`
  - Command: `npm run build`
- **Backend API Serverless Function**:
  - Runtime: `@vercel/node`
  - Entrypoint: `server/server.js`
  - Route Mapping: All `/api/(.*)` requests route to `server/server.js`.
- **Serverless Optimizations**:
  - Mongoose connection caching to handle cold-start invocations without exhausting database pools.
  - Upload directory falls back dynamically to `os.tmpdir()/uploads` within lambda execution contexts.
  - Production CORS whitelist for `*.vercel.app` domains.

---

## 3. Seed Accounts & Provisioned Credentials

The database auto-seeds default administrative and demo student accounts on startup across both PostgreSQL and MongoDB Atlas:

| Role | Email | Password | Pre-populated Status |
| :--- | :--- | :--- | :--- |
| **Admission Officer (Admin)** | `admin@iem.edu.in` | `adminpassword123` | Active Staff Account |
| **Student (Applicant)** | `aarav.sharma@gmail.com` | `password123` | Active Applicant Account |

---

## 4. Environment Variables Checklist

Ensure the following variables are defined in `.env` (local) or Vercel Environment Variables:
- `PORT=5000`
- `NODE_ENV=production`
- `MONGO_URI=mongodb+srv://...`
- `DATABASE_URL=postgres://...` (Optional, activates PostgreSQL dual-persistence)
- `JWT_SECRET=your_jwt_secret_key`
- `CORS_ORIGIN=https://iem-admission-portal.vercel.app`
