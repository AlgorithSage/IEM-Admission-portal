# Security Audit & RBAC Verification: IEM Admission Portal

> **Status**: APPROVED
> **Owner**: @SEC
> **Version**: 2.0

---

## 1. Security Invariants Audit

### 1. Client Guard vs Server Enforcement
* `admin.guard.ts` and `auth.guard.ts` serve strictly as UX conveniences in Angular to prevent invalid UI transitions.
* All authorization checks are cryptographically guaranteed on the Express backend via `jwt.verify(token, JWT_SECRET)` and role verification:
  ```javascript
  const requireRole = (role) => (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
  ```

### 2. Dual-Persistence & Audit Trail Security
* **PostgreSQL Passwords**: Securely hashed with `bcryptjs` (salt rounds = 10) in `password_hash` column.
* **Row-Versioning & Audit Log**:
  - Updates to user records increment `row_version`.
  - Profile modifications log historical snapshots to `user_history`, providing an immutable audit trail for identity changes.
* **MongoDB Passwords**: Stored with `select: false` to ensure password hashes are never leaked in application query projections.

### 3. File Upload Hardening
* Files are validated via Multer `fileFilter` restricting MIME types strictly to `application/pdf`, `image/jpeg`, and `image/png`.
* Strict 5MB file size limit enforced at middleware layer.
* Filenames are sanitized and appended with cryptographically secure random integers.
* Serverless execution safely restricts upload operations to `os.tmpdir()`, preventing directory traversal and execution vulnerabilities.
* Database stores only metadata and URI references, never raw file binaries.

### 4. CORS & Network Defense
* CORS whitelist restricts origins to configured production domains (`*.vercel.app`) and local development ports (`4200`, `5000`).
* Request headers are sanitized and HTTP methods restricted.

---

## 2. Gate Status
- **approval_status**: `true`
- **Assessment**: All authentication, role enforcement, audit logging, and upload restrictions meet production security requirements.
