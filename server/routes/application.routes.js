const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/application.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// Applicant Endpoints
router.post(
  '/',
  verifyToken,
  upload.single('marksheet'),
  applicationController.submitApplication
);

router.get(
  '/my-application',
  verifyToken,
  applicationController.getMyApplication
);

// Admin-Only Endpoints
router.get(
  '/admin/stats',
  verifyToken,
  requireRole('admin'),
  applicationController.getAdminStats
);

router.get(
  '/',
  verifyToken,
  requireRole('admin'),
  applicationController.getAllApplications
);

router.patch(
  '/:id/status',
  verifyToken,
  requireRole('admin'),
  applicationController.updateApplicationStatus
);

// Detail Endpoint
router.get(
  '/:id',
  verifyToken,
  applicationController.getApplicationById
);

module.exports = router;
