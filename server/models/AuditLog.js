const mongoose = require('mongoose');

// Audit trail (D8): append-only record of every state-changing action
const auditLogSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },
    actorId: { type: mongoose.Schema.Types.Mixed },
    actorRole: { type: String, enum: ['applicant', 'admin', 'system'], required: true },
    action: { type: String, required: true },
    fromStatus: { type: String },
    toStatus: { type: String },
    details: { type: String, default: '' }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/** Records an audit entry. Never throws: auditing must not break the main operation. */
const audit = async (entry) => {
  try {
    await AuditLog.create(entry);
  } catch (err) {
    console.error('[Audit] Failed to record entry:', err.message, entry.action);
  }
};

module.exports = { AuditLog, audit };
