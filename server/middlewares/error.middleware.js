// Masks credentials in connection strings before anything is logged
const redact = (text) => String(text).replace(/(\w+:\/\/[^:/\s]+:)[^\s]+@/g, '$1****@');

const errorHandler = (err, req, res, next) => {
  console.error('[Error Middleware]:', redact(err.stack || err.message));

  // Multer-specific errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File upload error: File size exceeds the maximum allowed limit of 5MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: `File upload error: Unexpected upload field "${err.field}".`
      });
    }
    return res.status(400).json({
      success: false,
      message: `File upload error: ${err.message}`
    });
  }

  // Optimistic concurrency conflict (another request saved the document first)
  if (err.name === 'VersionError') {
    return res.status(409).json({
      success: false,
      message: 'This application was changed by someone else. Reload and try again.'
    });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages
    });
  }

  // Mongoose Duplicate Key Error (e.g., duplicate email)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry detected. An account with this email already exists.'
    });
  }

  // Errors raised deliberately with a status (4xx) carry a message meant for the user.
  // Anything else is unexpected: log the details, never send internals (paths, connection strings) to clients.
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  res.status(err.status || 500).json({
    success: false,
    message: 'Something went wrong on our side. Please try again in a moment.'
  });
};

module.exports = errorHandler;
