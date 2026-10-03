const crypto = require('crypto');

/**
 * Razorpay-compatible payment gateway (test-mode mock).
 *
 * Mirrors Razorpay's flow so going live only replaces createOrder() and the client checkout:
 *   1. Server creates an order            -> { id: 'order_...', amount (paise), currency, receipt }
 *   2. Client checkout collects payment    -> { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *   3. Server verifies the signature       -> HMAC_SHA256(order_id + '|' + payment_id, key_secret)
 * In mock mode step 2 is simulated by mockCheckout(), which signs with the same secret.
 */

const MODE = 'mock';
const KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock_key';
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_mock_secret_change_me';

const randomId = (prefix) => `${prefix}_${crypto.randomBytes(7).toString('hex')}`;

const sign = (orderId, paymentId) =>
  crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');

const createOrder = async ({ amountPaise, receipt, currency = 'INR' }) => ({
  id: randomId('order'),
  amount: amountPaise,
  currency,
  receipt,
  status: 'created'
});

/** Simulates the hosted checkout. outcome: 'success' | 'failure' */
const mockCheckout = ({ orderId, outcome }) => {
  if (outcome === 'failure') {
    return { error: { code: 'BAD_REQUEST_ERROR', description: 'Payment declined by bank (simulated).' } };
  }
  const paymentId = randomId('pay');
  return { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sign(orderId, paymentId) };
};

/** Constant-time signature check, exactly as Razorpay recommends. */
const verifySignature = ({ orderId, paymentId, signature }) => {
  if (!orderId || !paymentId || !signature) return false;
  const expected = Buffer.from(sign(orderId, paymentId), 'hex');
  const given = Buffer.from(String(signature), 'hex');
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

module.exports = { MODE, KEY_ID, createOrder, mockCheckout, verifySignature };
