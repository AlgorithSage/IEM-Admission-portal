# Security Audit & RBAC Verification: IEM Admission Portal

> **Status**: APPROVED
> **Owner**: @SEC
> **Version**: 1.0

## 1. Security Invariants Audit

1. **Client Guard vs Server Enforcement**:
   - `admin.guard.ts` and `auth.guard.ts` serve strictly as UX conveniences to prevent invalid UI transitions.
   - All authorization checks are cryptographically guaranteed on the Express backend via `jwt.verify(token, JWT_SECRET)` and role verification:
     ```javascript
     export const requireRole = (role) => (req, res, next) => {
       if (!req.user || req.user.role !== role) {
         return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
       }
       next();
     };
     ```

2. **File Upload Hardening**:
   - Files are stored outside public web roots with sanitized filenames.
   - MIME type verification prevents executable uploads.
   - Only document metadata reference is stored in MongoDB, preventing BSON document bloat.

3. **Credential Storage**:
   - Passwords hashed using `bcryptjs` with salt rounds = 10.
   - Passwords excluded from MongoDB query projections (`select: false`).

## 2. Gate Status
- **approval_status**: `true`
