# Product Requirements Document (PRD)
## Project Name: IEM Admission Portal

---

## 1. Scope & Overview

### 1.1 Overview
The **IEM Admission Portal** is a centralized web-based admission management system designed to digitize and streamline the end-to-end admission process. The system encompasses separate **Applicant** and **Administrator** modules for application lifecycle management, document submission and verification, admission fee payment, application tracking, and administrative monitoring.

### 1.2 Scope of Work
The software engineering and operational scope covers:
- **Application Engineering**: Design, develop, test, deploy, and maintain the web portal.
- **Portals & Modules**:
  - **Landing Page**: Public portal featuring admission announcements, prospectus/rulebook download, and pathway selectors for Applicant and Administrator login/signup.
  - **Applicant Portal**: Self-service onboarding, dynamic application builder, draft autosave/edit capability, document repository, fee payment gateway integration, acknowledgment generation, and real-time tracking.
  - **Administrator Portal**: Review queues, multi-tier document verification, application status lifecycle management, metrics dashboard, and analytics/reporting suite.
- **Infrastructure & Platform**: Relational database architecture, scalable cloud/server deployment, robust authentication and role-based security.
- **Third-Party Integrations**: Online payment gateway integration, transactional email (SMTP/API) and SMS notification gateway services.
- **Governance & Support**: System configuration, technical API & user documentation, user support workflows, operational maintenance, and basic post-deployment warranty support.

---

## 2. Product Functions (High-Level Summary)

| Category | Product Function | Description |
| :--- | :--- | :--- |
| **Authentication & Access** | Registration & Identity Management | Self-registration, secure authentication, password recovery (forgot password/OTP), and session/token management. |
| **Application Lifecycle** | Application Creation & Editing | Step-by-step application entry, draft autosave/manual save, validation, and final submission lock. |
| **Data Validation** | Information Management | Management and automated field-level validation of personal, contact, reservation category, and academic qualification records. |
| **Document Processing** | Upload & Document Management | Secure multi-document file uploads with type and size enforcement, preview, replacement, and archival. |
| **Financial Processing** | Fee Payment & Transaction Tracking | Integrated payment gateway checkout, instant status reconciliation, receipt generation, and transaction retry mechanisms. |
| **Tracking & Receipts** | Acknowledgment & Status Tracking | Automatic generation of printable application acknowledgments/receipts and real-time application timeline tracking. |
| **Advisories & Alerts** | Notifications & Guidelines | Dissemination of admission alerts, cutoff notices, deadlines, and procedural guidelines via in-app feeds and SMS/Email. |
| **Administrative Review** | Document & Application Verification | Centralized applicant dossier review, inline document verification, discrepancy flags, and decision workflows. |
| **Lifecycle State Control**| Status Management | Controlled progression across application states (*Draft, Submitted, Under Verification, Accepted, Requiring Correction, Rejected*). |
| **Executive Monitoring** | Admin Analytics Dashboard | Aggregated dashboards displaying real-time metrics on applications received, category distributions, verification funnels, and revenue. |
| **Data Reporting** | Audit & Export Reports | Configurable report generation with export functionality (CSV/Excel/PDF) for merit lists, fee reconciliations, and admission statistics. |

---

## 3. User Characteristics & Personas

### 3.1 Applicant
- **Profile**: Prospective students applying for various academic programs at IEM. May possess varying levels of digital literacy and access the portal via smartphones, tablets, laptops, or cyber café workstations.
- **Capabilities & Privileges**:
  - Register a new account and log in securely.
  - View, complete, save draft, edit, and submit academic admission forms.
  - Upload prescribed documents (mark sheets, ID proofs, certificates, photographs, signatures).
  - Pay mandatory admission/application fees online via multiple payment modes.
  - Monitor real-time status of applications, payments, and document verification.
  - Download and print application forms, acknowledgments, and fee receipts.

### 3.2 Administrator
- **Profile**: Members of the IEM Admission Cell, verification officers, academic department heads, and financial administrative staff.
- **Capabilities & Privileges**:
  - Access dedicated Admin back-office interface via role-based access control (RBAC).
  - Search, filter, and inspect applicant profiles and submitted forms.
  - Scrutinize uploaded documents against institutional guidelines and update verification remarks.
  - Approve, reject, or request resubmission/rectification for applications with remarks.
  - Oversee payment transaction logs, reconcile successful/failed transactions, and verify fee clearances.
  - Access summary dashboards for real-time application statistics and admission pipeline metrics.
  - Generate, filter, and export administrative, financial, and merit-related reports.

---

## 4. Constraints

1. **Role-Based Access Control (RBAC)**: Strict segregation of duties and access permissions between Applicant and Administrator domains to ensure confidentiality and data integrity.
2. **Institutional Rule Compliance**: The portal must strictly enforce eligibility criteria, cutoff parameters, application deadlines, fee schedules, status workflows, and document rules formulated by the IEM Admission Department.
3. **Document Specifications**: Upload handling must be restricted strictly to whitelisted file formats (e.g., PDF, JPEG, PNG) and adhere to institutional file size limits (e.g., max 2MB/5MB per file).
4. **Payment Processing**: All fee collections must be routed exclusively through approved, configured payment gateway APIs supporting compliant transaction handshakes and webhook callbacks.
5. **Security & Cryptography**: Mandatory end-to-end transport encryption over HTTPS/TLS across all public and internal routes. Sensitive data and credentials must be salted and hashed.
6. **Platform & Device Responsiveness**: The frontend interface must be fully responsive, cross-browser compatible, and accessible across contemporary modern desktop, tablet, and mobile browsers (Chrome, Edge, Firefox, Safari).

---

## 5. Assumptions and Dependencies

### 5.1 Assumptions
- **Policy & Data Accuracy**: The IEM Admission Department will provide finalized, up-to-date admission schedules, fee tiers, eligibility rules, quota definitions, and document specifications prior to deployment.
- **Administrative Governance**: Institutional authorities maintain correctness and timeliness in publishing updates, cutoffs, and administrative notices.
- **Applicant Truthfulness**: Applicants provide authentic, unaltered, and complete personal, academic, and identity information.
- **Applicant Communication Channels**: Applicants possess active, valid, and accessible email addresses and mobile numbers for OTP verification, password resets, and critical alerts.
- **Applicant Infrastructure**: Applicants have access to compatible browser-enabled devices and standard internet connectivity.
- **Final Decision Authority**: The college administration remains the sole deciding body regarding final seat allocations, admissions, cancellations, and disputes.
- **Deadline Adherence**: Applicants are solely responsible for completing submissions and settling payment transactions prior to announced cut-off deadlines.

### 5.2 Dependencies
- **Admission Department Inputs**: Continuous coordination with IEM authorities for updated criteria, schedules, fee structure changes, and policy modifications.
- **Database Services**: Reliable and high-availability database infrastructure (e.g., PostgreSQL/MySQL) for persistence of user records, application states, document metadata, and financial logs.
- **Payment Gateway Services**: Uninterrupted API availability, webhook delivery, and transaction settlement from the partnered payment gateway provider.
- **Communication Gateway Services**: SLA and delivery reliability of third-party SMS and Transactional Email service providers (e.g., Twilio, SendGrid, AWS SES) for critical alerts, 2FA/OTPs, and password recovery.
- **Network Infrastructure**: High-bandwidth, low-latency network connectivity for concurrent access by applicants and staff during peak admission windows.
- **Human Verification Workflow**: Timely turnaround by authorized administrative and departmental scrutiny teams for document and application clearance.
- **Payment Reconciliation Signals**: Real-time confirmation depends on receiving valid cryptographic signatures and payload status responses from the external payment processor.

---

## 6. System Architecture & Portal Navigation

### 6.1 Landing Page & Pathway Selector
- **Public Landing Page**: Serves as the primary public entry point.
  - Contains overview of IEM academic programs, important dates, and announcements.
  - Provides direct access to download the **Admission Process Rule Book / Guidelines**.
  - Provides **Sign In** and **Sign Up** action buttons.
- **Pathway Selector**: Clicking Sign In or Sign Up presents a modal/pathway selector allowing the user to designate their entry path:
  1. **Applicant Pathway**: Directs to Applicant Registration, Login, or Password Reset.
  2. **Administrator Pathway**: Directs to Staff/Admin Authentication interface with enhanced access controls.

---

## 7. Functional Requirements (FR)

### Module A: Applicant Module

```
[Applicant Entry] 
       │
       ▼
 [Registration (FR-1) / Auth (FR-2)] ──(Forgot Password)──► [OTP Reset (FR-3)]
       │
       ▼
 [Applicant Dashboard]
       │
       ├──────────────────────────────────────────────┐
       ▼                                              ▼
[Fill / Edit Application]                    [Admission Guidelines (FR-16)]
   • Personal & Contact Info (FR-5)
   • Academic Details (FR-6)
   • Save Draft & Resume (FR-7)
   • Document Uploads (FR-8)
   • Eligibility Validation (FR-9)
       │
       ▼
[Review Application (FR-10)]
       │
       ▼
[Fee Payment Gateway (FR-11)] ──(Failure)──► [Payment Retry (FR-12)]
       │ (Success)
       ▼
[Final Submission & Lock (FR-13)]
       │
       ▼
[Unique Application ID & Ack Receipt (FR-14)]
       │
       ▼
[Track Status & Notifications (FR-15)]
```

#### FR-1: Applicant Registration
- **Requirement**: The system shall allow a new applicant to create an account by providing the required registration information.
- **Sub-Requirements**:
  - `FR-1.1`: The system shall accept the applicant's name, email address, mobile number, and password.
  - `FR-1.2`: The system shall validate the uniqueness and format of the registered email address and mobile number.
  - `FR-1.3`: The system shall create an applicant account after successful validation.
- **Specification**:
  - **Input**: Name, email address, mobile number, password.
  - **Expected Output**: Applicant account created successfully and registration confirmation displayed.
  - **Fields**: Applicant Name, Email Address, Mobile Number, Password.
  - **Constraints / Conditions**: Required fields cannot be empty; email and mobile number must have valid formats; email/mobile must not already be registered; password must satisfy configured security rules.

#### FR-2: Applicant Authentication
- **Requirement**: The system shall authenticate registered applicants before providing access to protected applicant functions.
- **Sub-Requirements**:
  - `FR-2.1`: The system shall authenticate applicants using their registered email/mobile number and password.
  - `FR-2.2`: The system shall deny access when invalid credentials are provided.
  - `FR-2.3`: The system shall maintain an authenticated session until logout or session expiration.
- **Specification**:
  - **Input**: Registered email/mobile number and password.
  - **Expected Output**: Successful authentication and access to the Applicant Dashboard.
  - **Fields**: Email/Mobile Number, Password.
  - **Constraints / Conditions**: Credentials must match the registered account; invalid credentials shall not provide access; protected pages require authentication.

#### FR-3: Password Reset and Account Recovery
- **Requirement**: The system shall allow applicants to recover access to their account when they forget their password.
- **Sub-Requirements**:
  - `FR-3.1`: The system shall send a one-time password (OTP) to the applicant's registered email address or mobile number after identity verification.
  - `FR-3.2`: The system shall validate the OTP before allowing password reset.
  - `FR-3.3`: The system shall allow the applicant to create a new password after successful OTP verification.
- **Specification**:
  - **Input**: Registered email/mobile number, OTP, new password.
  - **Expected Output**: Password successfully reset.
  - **Fields**: Email/Mobile Number, OTP, New Password, Confirm Password.
  - **Constraints / Conditions**: OTP must be valid and within its validity period; new password must satisfy configured password rules; invalid or expired OTP shall be rejected.

#### FR-4: Applicant Session Management
- **Requirement**: The system shall provide authenticated applicants with secure session management.
- **Sub-Requirements**:
  - `FR-4.1`: The system shall allow authenticated applicants to log out of the portal.
  - `FR-4.2`: The system shall terminate the authenticated session after logout.
  - `FR-4.3`: The system shall prevent access to protected applicant functions after session termination.
- **Specification**:
  - **Input**: Logout request.
  - **Expected Output**: Session terminated and user redirected to the login page.
  - **Fields**: Session ID, Applicant ID.
  - **Constraints / Conditions**: Only authenticated sessions can access protected functions; terminated sessions shall not be reused.

#### FR-5: Applicant Personal and Contact Information
- **Requirement**: The system shall allow applicants to enter and manage their personal and contact information.
- **Sub-Requirements**:
  - `FR-5.1`: The system shall allow applicants to enter and update personal information.
  - `FR-5.2`: The system shall allow applicants to enter and update contact information.
  - `FR-5.3`: The system shall validate the provided information before saving it.
- **Specification**:
  - **Input**: Personal and contact information.
  - **Expected Output**: Valid information stored and displayed in the application.
  - **Fields**: Name, Date of Birth, Gender, Address, Email, Mobile Number, etc.
  - **Constraints / Conditions**: Mandatory fields must be completed; fields must follow configured formats and validation rules.

#### FR-6: Academic Information Management
- **Requirement**: The system shall allow applicants to provide and manage their academic information.
- **Sub-Requirements**:
  - `FR-6.1`: The system shall allow applicants to enter academic qualifications and examination details.
  - `FR-6.2`: The system shall allow applicants to update or delete academic information before final submission.
  - `FR-6.3`: The system shall validate academic information according to configured admission rules.
- **Specification**:
  - **Input**: Academic qualification and examination information.
  - **Expected Output**: Validated academic information stored with the application.
  - **Fields**: Examination, Board/University, Year, Marks/Percentage/CGPA, etc.
  - **Constraints / Conditions**: Required academic fields must be completed; values must satisfy configured formats and eligibility rules.

#### FR-7: Application Save and Resume
- **Requirement**: The system shall allow applicants to save incomplete applications and resume them later.
- **Sub-Requirements**:
  - `FR-7.1`: The system shall save entered application information without requiring final submission.
  - `FR-7.2`: The system shall retrieve the latest saved application when the applicant logs in again.
  - `FR-7.3`: The system shall allow applicants to continue editing the saved application until the applicable deadline.
- **Specification**:
  - **Input**: Partially completed application.
  - **Expected Output**: Application saved and available for later editing.
  - **Fields**: Application ID, Applicant ID, Form Data, Last Saved Date/Time.
  - **Constraints / Conditions**: Application must not have been finally submitted; editing is permitted only before the configured deadline.

#### FR-8: Document Management
- **Requirement**: The system shall allow applicants to manage documents required for admission.
- **Sub-Requirements**:
  - `FR-8.1`: The system shall allow applicants to upload required documents.
  - `FR-8.2`: The system shall allow applicants to replace or delete documents before final submission.
  - `FR-8.3`: The system shall validate uploaded documents against configured file requirements.
- **Specification**:
  - **Input**: Document files.
  - **Expected Output**: Valid documents uploaded and associated with the application.
  - **Fields**: Document Type, File Name, File Size, File Format, Upload Date/Time.
  - **Constraints / Conditions**: Only permitted file formats and sizes shall be accepted; required documents must be uploaded before final submission.

#### FR-9: Application Eligibility Validation
- **Requirement**: The system shall validate applicant information against the configured admission eligibility rules.
- **Sub-Requirements**:
  - `FR-9.1`: The system shall validate academic qualifications and required criteria.
  - `FR-9.2`: The system shall identify missing or invalid eligibility information.
  - `FR-9.3`: The system shall display validation messages to the applicant.
- **Specification**:
  - **Input**: Applicant personal, academic, and eligibility information.
  - **Expected Output**: Eligibility validation result and applicable error/warning messages.
  - **Fields**: Qualification, Marks/Percentage/CGPA, Year, Category, etc.
  - **Constraints / Conditions**: Validation rules shall be based on admission criteria configured by the admission authority.

#### FR-10: Application Review Before Submission
- **Requirement**: The system shall allow applicants to review their completed application before final submission.
- **Sub-Requirements**:
  - `FR-10.1`: The system shall display entered personal, contact, academic, and document information.
  - `FR-10.2`: The system shall identify incomplete or invalid mandatory information.
  - `FR-10.3`: The system shall require the applicant to confirm the application before final submission.
- **Specification**:
  - **Input**: Completed application.
  - **Expected Output**: Application summary and submission confirmation.
  - **Fields**: Personal Details, Contact Details, Academic Details, Documents, Payment Status.
  - **Constraints / Conditions**: Mandatory information must be complete and valid before submission confirmation is enabled.

#### FR-11: Admission Fee Payment
- **Requirement**: The system shall allow applicants to pay the applicable admission fee through the configured online payment gateway.
- **Sub-Requirements**:
  - `FR-11.1`: The system shall display the applicable admission fee before payment.
  - `FR-11.2`: The system shall redirect or connect the applicant to the configured payment gateway.
  - `FR-11.3`: The system shall receive and record the payment result.
- **Specification**:
  - **Input**: Application ID, Applicant ID, Payment Amount, Payment Details.
  - **Expected Output**: Payment result and transaction status.
  - **Fields**: Transaction ID, Application ID, Amount, Payment Date/Time, Payment Status.
  - **Constraints / Conditions**: Payment shall be processed through the configured gateway; successful payment must be associated with the correct application.

#### FR-12: Payment Retry and Transaction Management
- **Requirement**: The system shall manage unsuccessful payment attempts and allow applicants to retry payment.
- **Sub-Requirements**:
  - `FR-12.1`: The system shall record failed or unsuccessful payment attempts.
  - `FR-12.2`: The system shall provide a retry option for unsuccessful payments.
  - `FR-12.3`: The system shall update the payment status after each subsequent transaction attempt.
- **Specification**:
  - **Input**: Existing application and payment transaction.
  - **Expected Output**: Updated transaction status.
  - **Fields**: Transaction ID, Application ID, Amount, Attempt Number, Status.
  - **Constraints / Conditions**: Retry shall be available only for unsuccessful/pending payments; successful transactions shall not be unnecessarily duplicated.

#### FR-13: Final Application Submission
- **Requirement**: The system shall allow an applicant to finally submit an application after satisfying all required submission conditions.
- **Sub-Requirements**:
  - `FR-13.1`: The system shall verify completion of mandatory application information and required documents.
  - `FR-13.2`: The system shall verify the required payment status before final submission.
  - `FR-13.3`: The system shall lock the application against further applicant modification after successful submission.
- **Specification**:
  - **Input**: Completed application, documents, payment status.
  - **Expected Output**: Application successfully submitted.
  - **Fields**: Application ID, Submission Date/Time, Payment Status, Application Status.
  - **Constraints / Conditions**: Mandatory information, required documents, eligibility validation, and required payment conditions must be satisfied.

#### FR-14: Application ID and Acknowledgement
- **Requirement**: The system shall generate a unique Application ID and acknowledgement after successful final submission.
- **Sub-Requirements**:
  - `FR-14.1`: The system shall generate a unique Application ID for the submitted application.
  - `FR-14.2`: The system shall generate an acknowledgement containing relevant submission information.
  - `FR-14.3`: The system shall send the acknowledgement to the applicant's registered email address.
- **Specification**:
  - **Input**: Successfully submitted application.
  - **Expected Output**: Unique Application ID and acknowledgement.
  - **Fields**: Application ID, Applicant Name, Submission Date/Time, Payment Status, Application Status.
  - **Constraints / Conditions**: Application ID must be unique; acknowledgement shall be generated only after successful submission.

#### FR-15: Application Status Tracking and Notifications
- **Requirement**: The system shall allow applicants to track their application status and receive important application notifications.
- **Sub-Requirements**:
  - `FR-15.1`: The system shall display the current application status to the applicant.
  - `FR-15.2`: The system shall notify applicants of important events through configured communication services.
  - `FR-15.3`: The system shall notify applicants when corrections or further actions are required.
- **Specification**:
  - **Input**: Application ID / authenticated applicant session.
  - **Expected Output**: Current status and applicable notification.
  - **Fields**: Application Status, Notification Type, Message, Date/Time.
  - **Constraints / Conditions**: Only the corresponding applicant shall access their application status; notifications shall be generated for configured events.

#### FR-16: Admission Guidelines
- **Requirement**: The system shall provide applicants with access to the latest admission process guidelines.
- **Sub-Requirements**:
  - `FR-16.1`: The system shall display admission guidelines through the Applicant Dashboard.
  - `FR-16.2`: The system shall provide the latest version of the published guidelines.
  - `FR-16.3`: The system shall allow applicants to access the guidelines before and during the application process.
- **Specification**:
  - **Input**: Applicant request to view guidelines.
  - **Expected Output**: Current admission guidelines displayed.
  - **Fields**: Guideline Title, Content, Version, Publication Date.
  - **Constraints / Conditions**: Only authorized and published guidelines shall be displayed.

---

### Module B: Administrator Module

```
[Admin Entry] ──► [Admin Authentication & RBAC (FR-17)]
                         │
                         ▼
                [Admin Dashboard (FR-20)]
                         │
     ┌───────────────────┼────────────────────┐
     ▼                   ▼                    ▼
[Review Queue (FR-18)] [Status Control (FR-19)] [Reports & Audit (FR-20)]
 • Scrutinize forms     • Under Verification   • Metrics & Stats
 • Verify documents     • Request Correction   • Export Reports (CSV/PDF)
 • Record remarks       • Accept / Reject      • Immutable Audit Log
```

#### FR-17: Administrator Authentication and Access Control
- **Requirement**: The system shall authenticate authorized administrators and restrict administrative functions to authorized users.
- **Sub-Requirements**:
  - `FR-17.1`: The system shall authenticate administrators using valid administrative credentials.
  - `FR-17.2`: The system shall deny unauthorized access to administrative functions.
  - `FR-17.3`: The system shall enforce role-based access to administrative operations where applicable.
- **Specification**:
  - **Input**: Administrator credentials.
  - **Expected Output**: Authenticated administrator access.
  - **Fields**: Admin ID, Username/Email, Password, Role.
  - **Constraints / Conditions**: Only authorized administrators may access the Admin Dashboard and administrative functions.

#### FR-18: Application and Document Review
- **Requirement**: The system shall allow authorized administrators to review submitted applications and uploaded documents.
- **Sub-Requirements**:
  - `FR-18.1`: The system shall allow administrators to view applicant and application information.
  - `FR-18.2`: The system shall allow administrators to verify uploaded documents and record their verification status.
  - `FR-18.3`: The system shall allow administrators to identify missing, invalid, or inconsistent information and documents.
- **Specification**:
  - **Input**: Submitted application and uploaded documents.
  - **Expected Output**: Application/document verification status.
  - **Fields**: Application ID, Applicant ID, Document Type, Verification Status, Remarks.
  - **Constraints / Conditions**: Only submitted applications available for administrative review shall be processed; review actions shall be restricted to authorized administrators.

#### FR-19: Application Status and Correction Management
- **Requirement**: The system shall allow authorized administrators to manage application status and request corrections when required.
- **Sub-Requirements**:
  - `FR-19.1`: The system shall allow administrators to update application status to configured states such as Under Verification, Accepted, Rejected, or Requiring Correction.
  - `FR-19.2`: The system shall allow administrators to record remarks when requesting corrections or rejecting an application.
  - `FR-19.3`: The system shall notify the applicant when a status change or correction request requires applicant action.
- **Specification**:
  - **Input**: Application ID, New Status, Remarks.
  - **Expected Output**: Updated application status and applicable applicant notification.
  - **Fields**: Application ID, Previous Status, New Status, Remarks, Admin ID, Date/Time.
  - **Constraints / Conditions**: Only authorized administrators may change status; status transitions must follow configured rules; correction requests must contain appropriate remarks.

#### FR-20: Administrative Dashboard, Reports and Audit Management
- **Requirement**: The system shall provide administrators with application monitoring, reporting, and audit capabilities.
- **Sub-Requirements**:
  - `FR-20.1`: The system shall display application and payment statistics through the Admin Dashboard.
  - `FR-20.2`: The system shall allow administrators to generate admission-related reports.
  - `FR-20.3`: The system shall maintain audit records of important administrative actions.
- **Specification**:
  - **Input**: Application, payment, and administrative activity data.
  - **Expected Output**: Dashboard statistics, generated reports, and audit records.
  - **Fields**: Total Applications, Completed Applications, Incomplete Applications, Registered Applicants, Pending/Completed Payments, Admin ID, Action, Date/Time.
  - **Constraints / Conditions**: Statistics and reports must be based on stored system records; audit records shall be retained for important administrative actions and shall not be modifiable by unauthorized users.

---

## 8. Non-Functional Requirements (NFR)

### NFR-1: Performance and Server Load Management
- **Requirement**: The system shall provide timely responses and efficiently manage server load under normal and peak admission-period usage.
- **Sub-Requirements**:
  - `NFR-1.1`: The system shall respond to at least 95% of user requests within 3 seconds under normal load.
  - `NFR-1.2`: The system shall use CDN caching for suitable static resources such as CSS, JavaScript, images, and other cacheable assets to reduce origin-server load and improve response time.
  - `NFR-1.3`: The system shall use load balancing to distribute incoming requests across available application-server instances and prevent excessive load on a single server.
- **Specification**:
  - **Input**: User requests, static resources, application data, and database requests.
  - **Expected Output**: Timely responses and balanced distribution of application traffic.
  - **Fields**: Response Time, Concurrent Users, Request Rate, CDN Cache Status, Server Load, Server Instance.
  - **Constraints / Conditions**: CDN caching shall be limited to suitable non-sensitive resources. Authenticated, applicant-specific, and payment-related data shall not be publicly cached. Load balancing shall distribute traffic only among healthy and available application-server instances.

### NFR-2: Security and Access Control
- **Requirement**: The system shall protect applicant, administrator, application, document, and payment-related information from unauthorized access.
- **Sub-Requirements**:
  - `NFR-2.1`: The system shall enforce authentication for protected applicant and administrator functions.
  - `NFR-2.2`: The system shall enforce role-based access control (RBAC) to restrict administrative functions to authorized personnel.
  - `NFR-2.3`: The system shall protect data transmission using HTTPS/TLS and securely store authentication credentials.
- **Specification**:
  - **Input**: Login credentials, user requests, application data, and account data.
  - **Expected Output**: Authorized access to permitted resources and denial of unauthorized requests.
  - **Fields**: User ID, Role, Authentication Credentials, Session Information.
  - **Constraints / Conditions**: Passwords shall not be stored in plaintext; protected information shall only be accessible to authorized users; communication containing sensitive information shall use secure protocols.

### NFR-3: Availability and Reliability
- **Requirement**: The system shall remain available and reliably preserve application and transaction data during the active admission period.
- **Sub-Requirements**:
  - `NFR-3.1`: The system shall maintain at least 99.5% availability during the active admission period.
  - `NFR-3.2`: The system shall preserve successfully saved application and transaction records during temporary service interruptions.
  - `NFR-3.3`: The system shall recover from expected application or service failures without corrupting stored data.
- **Specification**:
  - **Input**: Application data, payment transactions, and system requests.
  - **Expected Output**: Continuous system operation and preservation of stored records.
  - **Fields**: Availability, Application Records, Payment Records, Recovery Status.
  - **Constraints / Conditions**: Availability depends on the configured hosting infrastructure and the availability of external services such as the payment gateway and Email/SMS service.

### NFR-4: Usability and Accessibility
- **Requirement**: The system shall provide a clear, consistent, and responsive interface for applicants and administrators.
- **Sub-Requirements**:
  - `NFR-4.1`: The system shall provide consistent navigation and clearly labelled controls throughout the portal.
  - `NFR-4.2`: The system shall provide a responsive interface suitable for desktop, tablet, and mobile screens.
  - `NFR-4.3`: The system shall provide clear validation and error messages to help users identify and correct invalid inputs.
- **Specification**:
  - **Input**: User interactions and form data.
  - **Expected Output**: Clear interface, navigation, validation feedback, and accessible system functions.
  - **Fields**: Forms, Buttons, Menus, Error Messages, Notifications.
  - **Constraints / Conditions**: The interface shall maintain consistent layout, terminology, and navigation across the Applicant and Administrator modules.

### NFR-5: Maintainability and Scalability
- **Requirement**: The system shall be designed to support future maintenance, modification, and increases in system usage.
- **Sub-Requirements**:
  - `NFR-5.1`: The system shall use a modular architecture that allows individual components to be modified without unnecessarily affecting other components.
  - `NFR-5.2`: The system shall maintain structured source code and technical documentation to support future maintenance.
  - `NFR-5.3`: The system shall support scaling of application and database resources as the number of applicants and transactions increases.
- **Specification**:
  - **Input**: Software updates, configuration changes, and increasing user/application volume.
  - **Expected Output**: A maintainable system capable of supporting future changes and increased workload.
  - **Fields**: Application Modules, APIs, Database, Configuration, Documentation.
  - **Constraints / Conditions**: Changes shall be tested before deployment; modifications shall preserve existing application and payment records; additional server resources shall be deployable when system demand increases.

---

## 9. Traceability Matrix Summary

| Requirement ID | Module | Primary Entity / Workflow | Key Dependencies |
| :--- | :--- | :--- | :--- |
| **Landing & Pathway** | Core / Public | Public Landing Page, Rule Book, Pathway Selector | UI Routing, Rule Book Assets |
| **FR-1 to FR-4** | Applicant | Identity, Authentication, OTP Recovery, Sessions | Database, Email/SMS Gateway |
| **FR-5 to FR-7** | Applicant | Personal, Academic Profile & Draft Save/Resume | Database Persistence |
| **FR-8 to FR-10**| Applicant | Document Vault, Eligibility Checker, Summary Review | File Storage, Validation Engine |
| **FR-11 to FR-12**| Applicant | Fee Checkout, Status Webhook, Retry Mechanism | Payment Gateway API |
| **FR-13 to FR-16**| Applicant | Lock Submission, Ack PDF/Email, Timeline Tracking | Notification Service, PDF Gen |
| **FR-17** | Admin | Admin RBAC & Secure Auth | Database, Token Service |
| **FR-18 to FR-19**| Admin | Review Queue, Document Scrutiny, Correction Flow | Notification Service, DB |
| **FR-20** | Admin | Dashboard KPIs, Audit Logs, Report Exports | Analytics Query Engine |
| **NFR-1 to NFR-5**| Cross-Cutting | Performance, Security, Reliability, Usability, Scale | CDN, Load Balancer, SSL, DB |
