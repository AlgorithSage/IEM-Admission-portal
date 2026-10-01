# QA Test Strategy & Verification: IEM Admission Portal

> **Status**: APPROVED
> **Owner**: @QA
> **Version**: 1.0

## 1. Test Matrix for Required Evaluation Criteria

| Test Suite | Target Feature | Test Scenario | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TS-01** | Document Upload | Upload PDF/PNG marksheet via Angular form | File saved to `backend/uploads/`; Mongoose doc contains `document.filePath` reference only | PASS |
| **TS-02** | File Restrictions | Upload `.exe` or file > 5MB | Express rejects with HTTP 400 Bad Request; friendly Angular error displayed | PASS |
| **TS-03** | Auth & RBAC | Applicant attempts to query `GET /api/admin/stats` | Express returns HTTP 403 Forbidden | PASS |
| **TS-04** | Route Guard | Unauthenticated user navigates to `/applicant/dashboard` | Angular router redirects to `/applicant/login` | PASS |
| **TS-05** | State Machine | Admin tries to transition directly from `Submitted` to `Selected` | Express returns HTTP 400 with invalid transition error message | PASS |
| **TS-06** | State Machine | Admin transitions `Submitted` → `Review` → `Selected` | Status updates successfully and reflects in real-time on applicant tracker | PASS |
| **TS-07** | Aggregation Pipeline | Admin queries dashboard stats | Aggregation pipeline returns accurate counts grouped by status and department | PASS |

## 2. Gate Status
- **approval_status**: `true`
