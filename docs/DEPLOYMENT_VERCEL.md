# Vercel Deployment Guide — IEM Admission Portal

This repository is pre-configured for seamless deployment to [Vercel](https://vercel.com).

---

## Architecture on Vercel

- **Client**: Angular 19+ SPA (Output Directory: `dist/frontend/browser`)
- **Serverless API**: Express REST API entrypoint via `/api/index.js`
- **Database Layer**:
  - **MongoDB Atlas**: Cloud cluster already active (configured via `MONGO_URI`)
  - **PostgreSQL**: Managed cloud database (e.g., Neon / Supabase / Aiven / Railway Postgres) configured via `DATABASE_URL` or standard `PG_*` credentials.

---

## Deployment Steps

### Method 1: Deploy Full-Stack Monorepo (Root Directory)

1. **Import Repository in Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and select **`AlgorithSage/IEM-Admission-portal`**.
   - Keep **Root Directory** as `./` (default).
   - Vercel will automatically read [`vercel.json`](./vercel.json) and build both the Angular client and the Express Serverless functions.

2. **Configure Environment Variables** in Vercel Project Settings:
   | Key | Description | Example / Recommended Value |
   |---|---|---|
   | `MONGO_URI` | MongoDB Atlas Connection String | `mongodb+srv://...` |
   | `JWT_SECRET` | Secret key for signing Auth tokens | e.g. `iem_admission_jwt_secret_2026` |
   | `JWT_EXPIRES_IN` | Token expiration period | `7d` |
   | `NODE_ENV` | Runtime environment | `production` |
   | `DATABASE_URL` | Cloud PostgreSQL connection string | `postgresql://...` (Neon/Supabase) |

3. **Click Deploy**:
   - Vercel builds the bundle and serves both the Angular frontend and `/api/*` endpoints under the same custom domain with automatic SSL.

---

### Method 2: Deploy Frontend Only (Client Root)

If running the Express backend on Render, Railway, or VPS:

1. In Vercel, set **Root Directory** to `client`.
2. Framework Preset: **Angular**.
3. Build Command: `ng build`
4. Output Directory: `dist/frontend/browser`
5. [`client/vercel.json`](./client/vercel.json) handles HTML5 SPA route rewrites automatically.
