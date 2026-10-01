require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const connectDB = require('./config/db');
const { initPostgres } = require('./config/postgres');
const apiRoutes = require('./routes/api');
const errorHandler = require('./middlewares/error.middleware');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Databases: MongoDB Atlas & PostgreSQL
connectDB();
initPostgres();

// Ensure uploads folder and dummy sample marksheet exist
const uploadsDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const sampleMarksheetPath = path.join(uploadsDir, 'sample-marksheet.pdf');
if (!fs.existsSync(sampleMarksheetPath)) {
  fs.writeFileSync(
    sampleMarksheetPath,
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n200\n%%EOF'
  );
}

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

// Serve uploaded marksheets statically
app.use('/uploads', express.static(uploadsDir));

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
  console.log(`=================================================`);
  console.log(`🚀 IEM Admission Server running on port ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}`);
  console.log(`📁 Uploads Directory: ${uploadsDir}`);
  console.log(`=================================================`);
  await seedDefaultAccounts();
});

module.exports = app;
