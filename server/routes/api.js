const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const applicationRoutes = require('./application.routes');

// Mount sub-routers
router.use('/auth', authRoutes);
router.use('/applications', applicationRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'IEM Admission Portal REST API'
  });
});

module.exports = router;
