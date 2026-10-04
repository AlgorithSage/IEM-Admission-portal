const express = require('express');
const router = express.Router();
const controller = require('../controllers/application.controller');
const drafts = require('../controllers/draft.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

// Applicant (JSON; files are uploaded beforehand via /api/uploads and referenced by upload ID)
router.post('/', verifyToken, requireRole('applicant'), controller.submitApplication);
router.get('/my-application', verifyToken, controller.getMyApplication);
router.get('/my-draft', verifyToken, requireRole('applicant'), drafts.getDraft);
router.put('/my-draft', verifyToken, requireRole('applicant'), drafts.saveDraft);
router.put('/my-application/documents/:docKey', verifyToken, requireRole('applicant'), controller.replaceDocument);
router.post('/my-application/resubmit', verifyToken, requireRole('applicant'), controller.resubmitApplication);

// Owner or admin
router.get('/:id/documents/:docKey', verifyToken, controller.streamDocument);
router.get('/:id/slip', verifyToken, controller.downloadSlip);

module.exports = router;
