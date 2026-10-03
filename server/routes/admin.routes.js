const express = require('express');
const router = express.Router();
const controller = require('../controllers/admin.controller');
const uploads = require('../controllers/upload.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

// Every admin endpoint is enforced server-side; Angular guards are UX only
router.use(verifyToken, requireRole('admin'));
router.get('/stats', controller.getStats);
router.get('/report.csv', controller.exportReport);
router.get('/applications', controller.listApplications);
router.get('/applications/:id', controller.getApplicationDetail);
router.patch('/applications/:id/status', controller.updateStatus);
router.patch('/applications/:id/documents/:docKey', controller.verifyDocument);
router.post('/maintenance/cleanup-uploads', uploads.cleanupStaleUploads);

module.exports = router;
