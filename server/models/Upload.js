const mongoose = require('mongoose');

// A file the applicant uploaded but has not attached to an application yet.
// Attaching (submit / replace) marks it consumed; stale unconsumed uploads are cleaned up.
const uploadSchema = new mongoose.Schema(
  {
    owner: { type: String, required: true, index: true },
    storage: { type: String, enum: ['local', 'blob'], required: true },
    key: { type: String, required: true }, // local file name or blob URL
    pathname: { type: String, default: '' }, // blob pathname
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    consumedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Upload', uploadSchema);
