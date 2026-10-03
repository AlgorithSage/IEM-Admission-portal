const mongoose = require('mongoose');

// Notification log: one document per outbound message with its delivery outcome
const notificationSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', index: true },
    channel: { type: String, enum: ['email', 'sms'], default: 'email' },
    type: { type: String, required: true }, // e.g. APPLICATION_ID, ADMISSION_SLIP, STATUS_UPDATE
    to: { type: String, required: true },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    attachments: [{ filename: String, size: Number, _id: false }],
    status: { type: String, enum: ['Pending', 'Sent', 'Failed'], default: 'Pending', index: true },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    transport: { type: String, default: '' }, // smtp | mock
    providerMessageId: { type: String, default: '' },
    sentAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
