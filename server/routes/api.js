const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const applicationRoutes = require('./application.routes');
const paymentRoutes = require('./payment.routes');
const adminRoutes = require('./admin.routes');
const uploadRoutes = require('./upload.routes');

// Mount sub-routers
router.use('/auth', authRoutes);
router.use('/applications', applicationRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/uploads', uploadRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'IEM Admission Portal REST API'
  });
});

module.exports = router;
