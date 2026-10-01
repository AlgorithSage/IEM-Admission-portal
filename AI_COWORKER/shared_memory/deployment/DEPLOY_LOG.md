# Deployment & Run Log: IEM Admission Portal (MEAN Stack POC)

> **Status**: READY FOR RUNTIME
> **Owner**: @OPS
> **Version**: 1.0

## 1. Local Runtime Specification
- **Node.js Runtime**: v24.20.0
- **NPM Package Manager**: 11.19.0
- **Backend Port**: `5000` (`http://localhost:5000`)
- **Frontend Port**: `4200` (`http://localhost:4200`)
- **Database Engine**: MongoDB (Port 27017 or MongoDB Atlas connection string)
- **File Upload Directory**: `backend/uploads/`

## 2. Seed Data Automation
- `seed.js` script provisions:
  - 1 Demo Admin (`admin@iem.edu.in` / `admin123`)
  - 1 Demo Applicant (`student@gmail.com` / `student123`)
  - 4 Pre-populated admission applications across B.Tech, MBA, MCA, BBA in various lifecycle states (`Submitted`, `Review`, `Selected`).
