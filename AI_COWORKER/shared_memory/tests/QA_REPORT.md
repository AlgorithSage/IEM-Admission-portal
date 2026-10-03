# QA Report: Admission Workflow (Applicant + Admin)

> **Owner**: @QA
> **Version**: 3.1 (2026-10-03)
> **Overall status**: PASS — ready for Vercel once the configuration items in "Open items" are set

## Scope

Full workflow from the Level 2/3 DFDs and activity diagrams:

Applicant: register → form (save/resume draft) → final review → submit documents → view documents → pay fee (Razorpay test-mode mock) → application ID + admission slip (PDF) emailed → track status → replace rejected documents → resubmit.

Admin: login → dashboard stats → search/filter/paginate → full application view → view/verify/reject documents → Review / On Hold / Correction Requested / Selected / Rejected → payment, email log and audit trail → CSV report.

## Test suites

| Suite | How to run | Environment | Result |
| --- | --- | --- | --- |
| API end-to-end | `cd server && npm run test:e2e` (`server/scripts/e2e-workflow.js`) | Real server process, real PostgreSQL (Neon), MongoDB Atlas in an isolated `<db>_e2e` database (dropped after), test users deleted after | **68 / 68 PASS** (mock email); **69 / 69 PASS** with `E2E_USE_SMTP=1` against a real SMTP server (Ethereal) |
| Blob upload path | Server started with a Blob token; token issuance is local HMAC | Token for own folder issued; other user's folder 403; no login 401; disk uploads disabled | **5 / 5 PASS** (real upload/read needs the project's Blob store) |
| Browser end-to-end | Playwright + Edge driving the Angular app (session scratchpad script, not in repo) | Angular dev server + API against isolated `<db>_ui` database (dropped after) | **24 / 24 PASS** |
| Production build | `cd client && npx ng build` | Angular 22 | PASS, initial bundle 369 kB (was 582 kB, budget 500 kB) |

### Covered cases (API suite)

- **Auth**: register (PostgreSQL row created), login, admin login, self-registration cannot obtain admin role.
- **Uploads**: files upload when chosen and are referenced by ID; wrong file type 400; another user's upload cannot be attached; a used upload cannot be reused; failed submission releases the uploads; unused uploads can be discarded.
- **Submission**: 4 documents stored, status `Payment Pending`, no public file URLs, duplicate submission → 409, applicant blocked from admin API → 403, slip before payment → 400.
- **Document access**: owner 200, other applicant 403, anonymous 401, `/uploads/*` no longer public.
- **Payment**: order for Rs. 1,000, declined → 402 and status unchanged, retry reuses the order, tampered signature → 400, verified → `Submitted` + ID `IEM-YYYY-BT-NNNNNN`, replay idempotent, order after payment → 409.
- **Concurrency**: two simultaneous verifications → one application ID, emails sent once; stale admin edit → 409 (optimistic concurrency).
- **Notifications**: application-ID email and admission-slip email (PDF attached) logged as Sent; status emails for Correction Requested / On Hold / Selected.
- **Admin rules**: Submitted → Selected blocked; reject needs a reason; Selected needs all documents verified; correction needs a rejected document and remarks; Selected is terminal.
- **Correction loop**: resubmit blocked until rejected document replaced; verified document cannot be replaced; replaced document returns to Pending; resubmit → Review.
- **Reports**: stats (counts, fees collected), search by ID, regex input escaped, pagination, CSV export, audit trail of the full journey, status history.

## Defects found during QA (all fixed and re-tested)

| ID | Severity | Defect | Fix |
| --- | --- | --- | --- |
| D-01 | CRITICAL | Public registration accepted `role: "admin"` (privilege escalation) | Registration always creates applicants |
| D-02 | CRITICAL | Uploaded documents were publicly downloadable from `/uploads` | Static route removed; files streamed only via authenticated owner/admin endpoint |
| D-03 | HIGH | Admin dashboard called non-existent endpoints and silently showed mock data | Client service rewritten against real `/api/admin/*` routes, mock fallbacks removed |
| D-04 | HIGH | PostgreSQL marked "disconnected" for requests during start-up / cold start and never retried | Shared lazy init awaited by every query, retry after cooldown |
| D-05 | HIGH | Angular 22 is zoneless + OnPush by default: state set in HTTP callbacks never rendered (payment page stuck on Loading, login errors invisible) | Async component state moved to signals |
| D-06 | HIGH | Infinite change detection (NG0103) from `*ngFor` over a getter re-creating form controls | Preference slots cached per program change, `trackBy` added |
| D-07 | MEDIUM | Concurrent payment verification could return a stale "Payment Pending" view | Application status update is the single atomic gate |
| D-08 | MEDIUM | MongoDB credentials hard-coded in `config/db.js`; JWT signed with a public fallback secret | Fallbacks removed; production refuses to start without `MONGO_URI` / `JWT_SECRET` |
| D-09 | MEDIUM | PostgreSQL TLS certificate not verified (`rejectUnauthorized: false`) | Verification on; pool sized for serverless |
| D-10 | MEDIUM | Wrong file type upload returned 500 | Returns 400 with a clear message |
| D-11 | HIGH | Documents stored on the serverless instance disk (lost between instances); requests could exceed Vercel's 4.5 MB body limit | Private Vercel Blob storage with direct browser uploads; API requests carry no file bytes |

## Open items (configuration, owner: project admin)

| ID | Severity | Item |
| --- | --- | --- |
| B-01 | **BLOCKER** | Vercel `MONGO_URI` is still the example value. Rotate the MongoDB password (the old one is in git history) and set the real connection string. |
| B-02 | **BLOCKER** | Connect a Vercel Blob store to the project (adds `BLOB_READ_WRITE_TOKEN`). Without it, production falls back to the ephemeral serverless disk. |
| B-03 | HIGH | Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` in Vercel, then check with `npm run test:email -- you@example.com` locally. |
| B-04 | MEDIUM | Schedule `POST /api/admin/maintenance/cleanup-uploads` (removes uploads never attached to an application after 24 h), or run it manually from time to time. |
| B-05 | MEDIUM | Razorpay is test-mode mock only. Going live: create orders via Razorpay API and use Razorpay Checkout on the client; signature verification is already Razorpay-compatible. Set a strong `RAZORPAY_KEY_SECRET`. |
| B-06 | LOW | Assumed values to confirm: application fee Rs. 1,000; IEMCET rank 1-200,000 and marks -90 to 360; MBA minimum 55% (source text also says 60%). All in `server/config/program-catalogue.json`. |
| B-07 | LOW | `auth.service.ts` still creates fake sessions when the server is unreachable (offline demo mode); the server rejects them, but the UI briefly looks signed in. |

## Recommendation

`overall_status: PASS`. `recommendation: DEPLOY` after B-01 and B-02 are configured (B-03 for real email). Next agent: @SEC for re-audit of the new payment, document and admin endpoints, then @OPS.
