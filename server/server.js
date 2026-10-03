require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const connectDB = require('./config/db');
const { initPostgres } = require('./config/postgres');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middlewares/error.middleware');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// Warm up database connections. Failures are logged, not thrown: an unhandled rejection here would
// crash the whole serverless function. Each API request retries the connection (see middleware below).
connectDB().catch(() => {}); // connectDB already logged the (redacted) reason
initPostgres();

// Upload storage location (documents are streamed only through the authenticated API)
const { uploadDir: uploadsDir } = require('./middlewares/upload.middleware');

// Global Middlewares - CORS supporting Vercel deployments & local dev
const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:5000',
  'https://iem-admission-portal.vercel.app',
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : [])
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Ensure MongoDB is connected for API requests (guarantees connection on serverless cold starts)
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('[API Database Middleware Error]:', err.message);
    next(err);
  }
});

// Mount REST API
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'IEM Admission Portal REST API Gateway',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      applications: '/api/applications'
    }
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Helper to seed default demo accounts if not present
const seedDefaultAccounts = async () => {
  try {
    const adminEmail = 'admin@iem.edu.in';
    const applicantEmail = 'aarav.sharma@gmail.com';

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await User.create({
        name: 'Admission Scrutiny Officer',
        email: adminEmail,
        password: 'adminpassword123',
        phone: '+91 98300 00001',
        role: 'admin'
      });
      console.log(`[Seed] Created default Admin account: ${adminEmail}`);
    }

    const existingApplicant = await User.findOne({ email: applicantEmail });
    if (!existingApplicant) {
      await User.create({
        name: 'Aarav Sharma',
        email: applicantEmail,
        password: 'password123',
        phone: '+91 98301 23456',
        role: 'applicant'
      });
      console.log(`[Seed] Created default Applicant account: ${applicantEmail}`);
    }
  } catch (err) {
    // Database might be offline; silent bypass for offline development
  }
};

// Start Server
app.listen(PORT, async () => {
  console.log(`IEM Admission API listening on port ${PORT} (uploads: ${uploadsDir})`);
  await seedDefaultAccounts();
});

module.exports = app;
