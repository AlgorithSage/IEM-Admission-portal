const express = require('express');
const router = express.Router();
const controller = require('../controllers/upload.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

const applicantOnly = [verifyToken, requireRole('applicant')];

// Blob's server-to-server completion callback carries no user token; handleUpload verifies its signature.
// Every other request to this route (token issuance) must come from a logged-in applicant.
const blobAuth = (req, res, next) =>
  req.body && req.body.type === 'blob.upload-completed' ? next() : verifyToken(req, res, () => requireRole('applicant')(req, res, next));

router.get('/config', verifyToken, controller.getConfig);
router.post('/', ...applicantOnly, upload.single('file'), controller.uploadLocal);
router.post('/blob-token', blobAuth, controller.blobToken);
router.post('/blob-confirm', ...applicantOnly, controller.confirmBlob);
router.delete('/:id', ...applicantOnly, controller.discardUpload);

module.exports = router;
