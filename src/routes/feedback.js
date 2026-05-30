/**
 * Feedback route — collects user feedback from the app and writes it to
 * Cloud Run logs as structured JSON. View with:
 *   gcloud logging read 'jsonPayload.kind="feedback"' --limit=50
 */
const express = require('express');
const logger = require('../utils/logger');

const router = express.Router();

// Lightweight in-process rate limit so a single device can't spam.
// 5 submissions per IP per hour.
const recent = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_PER_WINDOW) {
    recent.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  recent.set(ip, timestamps);
  return false;
}

router.post('/', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ success: false, error: 'Too many feedback submissions. Try again later.' });
  }

  const { message, email, appVersion, device, osVersion } = req.body || {};

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Message is required.' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ success: false, error: 'Message too long (max 4000 chars).' });
  }

  const safeEmail = typeof email === 'string' ? email.slice(0, 200) : null;
  const safeAppVersion = typeof appVersion === 'string' ? appVersion.slice(0, 50) : null;
  const safeDevice = typeof device === 'string' ? device.slice(0, 100) : null;
  const safeOsVersion = typeof osVersion === 'string' ? osVersion.slice(0, 50) : null;

  // Structured log — show up nicely in Cloud Logging.
  logger.info('Feedback received', {
    kind: 'feedback',
    message: message.trim(),
    email: safeEmail,
    appVersion: safeAppVersion,
    device: safeDevice,
    osVersion: safeOsVersion,
    receivedAt: new Date().toISOString(),
  });

  res.json({ success: true });
});

module.exports = router;
