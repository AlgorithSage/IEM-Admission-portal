# Risk Report: IEM Admission Portal (Dual Persistence & Serverless Architecture)

> **Status**: APPROVED
> **Owner**: @GUARD
> **Version**: 2.0

---

## 1. Identified Architectural & Operational Risks

| Risk ID | Category | Severity | Description | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | Document Storage | HIGH | Executable/malicious uploads or oversized payloads could exhaust disk space or introduce security vulnerabilities. | Restricted Multer `fileFilter` to `application/pdf`, `image/jpeg`, `image/png` only. Strict 5MB limit. Random sanitized filenames. Dual-mode storage (local `uploads/` vs serverless `/tmp`). |
| **RSK-02** | Security & RBAC | HIGH | Relying solely on client route guards can be bypassed via direct HTTP calls. | Mandatory Express server-side middleware `auth.middleware.js` cryptographically verifies JWT tokens and checks `req.user.role === 'admin'` on all sensitive endpoints. |
| **RSK-03** | Workflow Integrity | MEDIUM | Direct manipulation of status field to 'Selected' without intermediate review. | Server-enforced state machine rejecting illegal status jumps with HTTP 400 Bad Request. |
| **RSK-04** | Database Aggregation | LOW | Memory overhead when computing statistics on large datasets in Node.js runtime. | Delegated computation to MongoDB database engine using `$facet` and `$group` aggregation pipeline. |
| **RSK-05** | Dual-DB Sync & Availability | MEDIUM | Transient network issues causing PostgreSQL or MongoDB to be momentarily unreachable. | Implemented resilient dual-auth fallback in `auth.controller.js`. If PostgreSQL is offline, system automatically falls back to MongoDB Atlas without failing user requests. |
| **RSK-06** | Serverless Cold-Start Latency | MEDIUM | Repeated database handshakes on serverless cold starts creating latency spikes. | Cached database connection instances in `config/db.js`, reusing connections across lambda function invocations. |

---

## 2. Approval Status
- **Gate Passed**: `true`
- **Assessment**: System architecture proactively mitigates multi-DB synchronization, serverless cold starts, and RBAC vulnerabilities. Ready for deployment.
