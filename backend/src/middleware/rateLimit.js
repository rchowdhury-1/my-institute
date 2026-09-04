const rateLimit = require('express-rate-limit');
const {
  AUTH_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_MAX,
  REGISTER_RATE_LIMIT_MAX,
  PUBLIC_FORM_RATE_LIMIT_MAX,
} = require('../config');

// Keyed by IP + the email in the request body, so one IP can't lock out
// every account behind it, and one email can't be brute-forced from many IPs.
function keyByIpAndEmail(req) {
  return `${req.ip}:${(req.body?.email || '').trim().toLowerCase()}`;
}

const loginRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX,
  keyGenerator: keyByIpAndEmail,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const registerRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: REGISTER_RATE_LIMIT_MAX,
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

// For unauthenticated public write endpoints (contact/application forms)
// that have no other abuse protection.
const publicFormRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: PUBLIC_FORM_RATE_LIMIT_MAX,
  keyGenerator: (req) => req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please try again later.' },
});

module.exports = { loginRateLimiter, registerRateLimiter, publicFormRateLimiter };
