const crypto = require('crypto');

/**
 * Shared app-token check for the mobile app.
 *
 * When THINKPACK_APP_TOKEN is set in the environment, every request must carry
 * the same value in the X-App-Token header. When unset, the middleware is a
 * no-op — so deploying this is safe before the app update ships; flip it on by
 * setting the env var once clients send the header.
 *
 * This is NOT real auth (the token ships inside the APK and is extractable),
 * but it stops drive-by abuse of the cost-bearing AI endpoints by anyone who
 * discovers the Cloud Run URL.
 */
// Env is fixed for the life of the process — compute the expected buffer once.
const expectedToken = process.env.THINKPACK_APP_TOKEN || '';
const expectedBuf = expectedToken ? Buffer.from(expectedToken) : null;

function requireAppToken(req, res, next) {
  if (!expectedBuf) return next();

  const providedBuf = Buffer.from(String(req.headers['x-app-token'] || ''));
  const matches = expectedBuf.length === providedBuf.length
    && crypto.timingSafeEqual(expectedBuf, providedBuf);

  if (!matches) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireAppToken };
