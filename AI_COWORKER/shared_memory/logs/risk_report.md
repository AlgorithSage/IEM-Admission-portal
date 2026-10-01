# Risk Report: IEM Admission Portal (MEAN Stack POC)

> **Status**: APPROVED
> **Owner**: @GUARD
> **Version**: 1.0

## 1. Identified Architectural & Operational Risks

| Risk ID | Category | Severity | Description | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Document Storage | HIGH | Uploading large executable or binary files could exhaust disk space or introduce malware. | Restricted Multer `fileFilter` to `application/pdf`, `image/jpeg`, `image/png` only. Strict 5MB file size limit. Sanitized random timestamp filenames. |
| **RSK-02** | Security & RBAC | HIGH | Relying solely on Angular route guards (`admin.guard.ts`) can be bypassed via direct HTTP calls (Postman/curl). | Implemented mandatory Express server-side middleware `auth.middleware.js` checking JWT signature and `req.user.role === 'admin'` on every sensitive route. |
| **RSK-03** | Workflow Integrity| MEDIUM | Direct manipulation of status field to 'Selected' without review. | Server-enforced state machine rejecting illegal status transitions with HTTP 400. |
| **RSK-04** | Database Aggregation | LOW | Memory overhead when calculating counts for large datasets in Node.js runtime. | Delegated computation to MongoDB database engine using `$facet` and `$group` aggregation pipeline. |

## 2. Approval Status
- **Gate Passed**: `true`
- **Assessment**: The scoped POC properly addresses file isolation, server-side RBAC, and state machine integrity. Ready for execution.
