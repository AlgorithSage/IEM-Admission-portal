const mongoose = require('mongoose');

// One in-progress application form per applicant ("Save as draft"). Deleted once the application is submitted.
const draftSchema = new mongoose.Schema(
  {
    owner: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // form values
    // Document slot -> staged upload, so attached files survive across sessions and devices
    documents: { type: mongoose.Schema.Types.Mixed, default: {} },
    step: { type: String, default: '' } // last phase the applicant was on
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model('Draft', draftSchema);
