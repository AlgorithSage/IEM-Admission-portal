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
// Health check: API and both databases (no secrets in the response)
router.get('/health', async (req, res) => {
  const mongoose = require('mongoose');
  const { postgresStatus } = require('../config/postgres');
  const postgres = await postgresStatus().catch((e) => ({ connected: false, error: e.message }));
  const mongodb = { connected: mongoose.connection.readyState === 1, database: mongoose.connection.name || null };
  res.status(200).json({
    status: postgres.connected && mongodb.connected ? 'OK' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    service: 'IEM Admission Portal REST API',
    databases: { postgres, mongodb }
  });
});

module.exports = router;
