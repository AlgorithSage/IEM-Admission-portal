const multer = require('multer');
const path = require('path');
const fs = require('fs');

const os = require('os');

// Ensure upload directory exists
const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadDir = isServerless
  ? path.join(os.tmpdir(), 'uploads')
  : path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('[Upload Middleware] Failed to create upload dir:', err.message);
}

// Multer Disk Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const prefix = file.fieldname.replace(/[^a-zA-Z0-9_]/g, '') || 'document';
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  }
});

// Allowed MIME types whitelist
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error('Invalid file format. Only PDF, JPG and PNG files are allowed.'), { status: 400 }), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 1 // one document per request
  },
  fileFilter: fileFilter
});

// Exposed so stored files can be resolved and streamed through the authenticated API
upload.uploadDir = uploadDir;

module.exports = upload;
