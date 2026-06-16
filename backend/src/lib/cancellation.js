const BUFFER_HOURS = 12;

/**
 * Check whether a student is allowed to cancel or request-reschedule a session.
 * Admin/teacher are exempt — this only applies to students.
 *
 * @param {object} session  — must have scheduled_at (ISO string or Date)
 * @returns {{ allowed: boolean, reason?: string }}
 */
function canStudentCancel(session) {
  if (session.status !== 'scheduled') {
    return { allowed: false, reason: 'Session is not active' };
  }
  const hoursUntil = (new Date(session.scheduled_at).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil < BUFFER_HOURS) {
    return {
      allowed: false,
      reason: 'Too close to session start. Please message the admin on WhatsApp to request changes.',
    };
  }
  return { allowed: true };
}

module.exports = { canStudentCancel, BUFFER_HOURS };
