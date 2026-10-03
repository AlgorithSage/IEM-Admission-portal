const express = require('express');
const router = express.Router();
const controller = require('../controllers/payment.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');

router.use(verifyToken, requireRole('applicant'));
router.post('/order', controller.createOrder);
router.post('/mock-checkout', controller.mockCheckout);
router.post('/verify', controller.verifyPayment);

module.exports = router;
