/**
 * Email guard — suppresses sends to test addresses and rate-limits all sends.
 */

// ─── Test recipient detection ──────────────────────────────────────────────

const TEST_DOMAINS = [
  '@test.local',
  '@phase33test.local',
  '@phase34test.local',
  '@phase35test.local',
  '@phase36test.local',
  '@example.com',
  '@mailinator.com',
  '@example.local',
];

const TEST_PATTERNS = [
  '+emailtest@',
  '+smoketest@',
  '+phase',
  'smoketest-',
  '_phase',
  '_test_',
  'playwright-',
];

function isTestRecipient(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.toLowerCase().trim();
  if (TEST_DOMAINS.some(d => lower.endsWith(d))) return true;
  if (TEST_PATTERNS.some(p => lower.includes(p))) return true;
  return false;
}

// ─── Circuit breaker ───────────────────────────────────────────────────────

const WINDOW_MS = 60_000; // 60 seconds
const MAX_SENDS = 20;
const sendTimestamps = [];

function checkCircuitBreaker() {
  const now = Date.now();
  // Remove entries older than the window
  while (sendTimestamps.length > 0 && sendTimestamps[0] < now - WINDOW_MS) {
    sendTimestamps.shift();
  }
  if (sendTimestamps.length >= MAX_SENDS) {
    return false; // breaker tripped
  }
  sendTimestamps.push(now);
  return true; // ok to send
}

/**
 * Call before every Resend send. Returns { allowed: true } or { allowed: false, reason }.
 */
function shouldSendEmail(to) {
  if (isTestRecipient(to)) {
    console.log(`[EMAIL SUPPRESSED] Test recipient: ${to}`);
    return { allowed: false, reason: 'test_recipient', suppressed: true, recipient: to };
  }
  if (!checkCircuitBreaker()) {
    console.error(`[EMAIL CIRCUIT BREAKER] Refused send to ${to} — over ${MAX_SENDS} sends in ${WINDOW_MS / 1000}s`);
    return { allowed: false, reason: 'circuit_breaker', recipient: to };
  }
  return { allowed: true };
}

module.exports = { isTestRecipient, shouldSendEmail };
