# IEM Admission Portal (MEAN Stack POC) — Project Write-Up

## 1. Architectural Overview & Design Choices

The **IEM Admission Portal POC** was designed using the canonical **MEAN Stack** (**M**ongoDB, **E**xpress.js, **A**ngular 19+, **N**ode.js) to deliver an end-to-end, single-language (TypeScript / JavaScript) web application. The application strictly observes separation of concerns across a 3-tier decoupled architecture:

```
[Browser Client: Angular 19] 
             │
             ▼ (HTTP JSON & Multipart FormData / Bearer JWT)
[REST API Gateway: Express.js inside Node.js Runtime]
      │                                   │
      ▼ (Binary Write)                    ▼ (BSON Metadata & Queries)
[Server Disk: /uploads]            [Database: MongoDB Engine]
```

### Key Architectural Decisions:

1. **Angular Standalone Architecture with Reactive Forms**:
   - Built on modern Angular standalone components (`standalone: true`), eliminating legacy `NgModule` boilerplate.
   - Strict Reactive Forms (`FormGroup`, `FormControl`, `Validators`) provide immediate field-level validation and clean `FormData` serialization for binary file uploads.

2. **Decoupled Client-Side Routing & UX Guards**:
   - Angular router guards (`authGuard`, `adminGuard`) manage client-side user experience by preventing unauthorized navigation to protected routes.
   - **Critical Design Principle**: Client route guards are treated strictly as UX conveniences, not security boundaries. All security checks are enforced cryptographically on the Express server.

3. **Disk Isolation for File Uploads (Multer)**:
   - Binary marksheets/certificates are streamed to disk storage (`backend/uploads/`) using `multer.diskStorage`.
   - MongoDB documents store only lightweight JSON metadata references (`fileName`, `originalName`, `filePath`, `mimeType`, `fileSize`).
   - **Rationale**: Prevents database bloat, maintains fast BSON indexing, and avoids hitting MongoDB's 16MB document size limit.

4. **Deterministic Status Workflow (State Machine)**:
   - Application status is governed by a strict transition graph (`Submitted` $\rightarrow$ `Review` $\rightarrow$ `Selected` / `Rejected`).
   - Server validates allowed transitions before persisting changes, rejecting unauthorized status jumps with HTTP `400 Bad Request`.

5. **Server-Side MongoDB Aggregation Pipeline**:
   - Admin KPI metrics are computed using MongoDB's native aggregation pipeline (`$facet`, `$group`, `$match`), rather than pulling thousands of documents into Node.js memory.

---

## 2. Server-Side Security, Validation & RBAC Rationale

In web application security, **the client cannot be trusted**. Any user can open Chrome DevTools, modify JavaScript variables, disable Angular route guards, or dispatch direct HTTP requests via cURL or Postman.

### Why Server-Side Enforcement is Mandatory:
- **JWT Cryptographic Verification**: Express middleware intercepts all incoming requests to protected routes, verifies the cryptographic signature of the Bearer JWT using `process.env.JWT_SECRET`, and extracts the verified payload.
- **Server-Side Role Checks**: An endpoint modifier `requireRole('admin')` validates `req.user.role === 'admin'`. If an authenticated applicant attempts to invoke an administrative endpoint (such as `GET /api/admin/stats` or `PATCH /status`), Express immediately aborts the request with `403 Forbidden`.
- **MIME Type & File Size Whitelisting**: Multer enforces server-side binary inspection, accepting only `application/pdf`, `image/jpeg`, and `image/png` up to 5MB, preventing malicious executable uploads.

---

## 3. What We Would Improve for Production

While this scoped POC completely demonstrates the core MEAN stack request-response cycle and all 4 POC modules, a real-world enterprise deployment would incorporate:

1. **Cloud Object Storage (AWS S3 / GCP Cloud Storage)**:
   - Replace local disk storage with pre-signed upload URLs to scalable cloud buckets, backed by a Content Delivery Network (CloudFront/Cloudflare).
2. **Automated Document OCR & Antivirus Scanning**:
   - Introduce an asynchronous worker queue (BullMQ / Redis) to run virus scanning (ClamAV) and extract marksheet data via Google Cloud Document AI.
3. **Transactional Notification & SMS Delivery**:
   - Integrate Webhooks and SMTP/SMS providers (AWS SES, Twilio) for instant transactional notifications on status transitions.
4. **Online Fee Payment Gateway**:
   - Implement Razorpay / Stripe payment integration with cryptographically signed webhook callbacks and idempotent transaction ledgers.
