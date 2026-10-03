const mongoose = require('mongoose');

// Payment master (D5): one document per gateway order, including failed attempts
const paymentSchema = new mongoose.Schema(
  {
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    applicant: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    gateway: { type: String, default: 'razorpay' },
    mode: { type: String, enum: ['mock', 'live'], default: 'mock' },
    orderId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: 'INR' },
    receipt: { type: String, required: true },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created', index: true },
    paymentId: { type: String, default: '' },
    method: { type: String, default: '' },
    signature: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    attempts: { type: Number, default: 0 },
    paidAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
