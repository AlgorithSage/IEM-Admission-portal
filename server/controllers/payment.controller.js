const Payment = require('../models/Payment');
const { audit } = require('../models/AuditLog');
const { APPLICATION_FEE } = require('../config/admission.rules');
const gateway = require('../services/paymentGateway.service');
const { findApplicationForUser, completePayment, httpError } = require('../services/workflow.service');
const { serializeApplication } = require('../services/presenter');

const PAYMENT_METHODS = ['UPI', 'Card', 'Net Banking'];

const loadPayable = async (user) => {
  const app = await findApplicationForUser(user);
  if (!app) throw httpError(404, 'Submit the application form before paying.');
  return app;
};

// @desc    Create (or reuse) a gateway order for the application fee
// @route   POST /api/payments/order
// @access  Private (Applicant)
const createOrder = async (req, res, next) => {
  try {
    const app = await loadPayable(req.user);
    if (app.status !== 'Payment Pending') {
      return res.status(409).json({ success: false, message: 'The application fee has already been paid.', application: serializeApplication(app) });
    }

    // Reuse an open order so retries do not pile up orders
    let order = await Payment.findOne({ application: app._id, status: { $in: ['created', 'failed'] } }).sort({ createdAt: -1 });
    if (!order) {
      const gwOrder = await gateway.createOrder({ amountPaise: APPLICATION_FEE * 100, receipt: `app_${app._id}` });
      order = await Payment.create({
        application: app._id,
        applicant: req.user.id,
        mode: gateway.MODE,
        orderId: gwOrder.id,
        amount: gwOrder.amount,
        currency: gwOrder.currency,
        receipt: gwOrder.receipt
      });
    }

    res.status(200).json({
      success: true,
      order: { orderId: order.orderId, amount: order.amount, currency: order.currency, keyId: gateway.KEY_ID, mode: gateway.MODE },
      methods: PAYMENT_METHODS,
      applicant: { name: app.fullName, email: app.email, contact: app.phone }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Simulated hosted checkout (test mode only); returns what Razorpay's checkout would hand the browser
// @route   POST /api/payments/mock-checkout
// @access  Private (Applicant)
const mockCheckout = async (req, res, next) => {
  try {
    const { orderId, method, outcome } = req.body || {};
    if (!PAYMENT_METHODS.includes(method)) throw httpError(400, 'Choose a valid payment method.');
    const app = await loadPayable(req.user);
    const order = await Payment.findOne({ orderId, application: app._id });
    if (!order) throw httpError(404, 'Payment order not found.');

    const result = gateway.mockCheckout({ orderId, outcome: outcome === 'failure' ? 'failure' : 'success' });
    if (result.error) {
      if (order.status !== 'paid') {
        order.set({ status: 'failed', failureReason: result.error.description, method });
        order.attempts += 1;
        await order.save();
      }
      await audit({ application: app._id, actorId: req.user.id, actorRole: 'applicant', action: 'PAYMENT_FAILED', details: `${orderId}: ${result.error.description}` });
      return res.status(402).json({ success: false, message: result.error.description, error: result.error });
    }
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify the gateway signature, mark paid, issue the application ID and send emails
// @route   POST /api/payments/verify
// @access  Private (Applicant)
const verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature, method } = req.body || {};
    const app = await loadPayable(req.user);
    const order = await Payment.findOne({ orderId, application: app._id });
    if (!order) throw httpError(404, 'Payment order not found.');

    if (!gateway.verifySignature({ orderId, paymentId, signature })) {
      await audit({ application: app._id, actorId: req.user.id, actorRole: 'applicant', action: 'PAYMENT_SIGNATURE_INVALID', details: orderId });
      throw httpError(400, 'Payment could not be verified. If money was debited it will be refunded automatically.');
    }

    const { application, alreadyProcessed, emails } = await completePayment({
      app,
      order,
      paymentId,
      signature,
      method: PAYMENT_METHODS.includes(method) ? method : '',
      actorId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: alreadyProcessed ? 'Payment was already confirmed.' : 'Payment successful.',
      emails: emails || null,
      application: serializeApplication(application)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createOrder, mockCheckout, verifyPayment };
