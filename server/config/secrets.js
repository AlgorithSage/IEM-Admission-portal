// Secret configuration. Production refuses to start without real secrets instead of
// silently falling back to values that are visible in the source code.
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

const required = (name, devFallback) => {
  const value = process.env[name];
  if (value) return value;
  if (isProduction || devFallback === undefined) {
    throw new Error(`Missing required environment variable ${name}. Set it in server/.env or the hosting dashboard.`);
  }
  return devFallback;
};

module.exports = {
  isProduction,
  JWT_SECRET: required('JWT_SECRET', 'dev-only-jwt-secret-not-for-production'),
  MONGO_URI: () => required('MONGO_URI')
};
