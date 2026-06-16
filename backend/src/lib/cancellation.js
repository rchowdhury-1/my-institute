const BUFFER_HOURS = 12;

/**
 * Check whether a student is allowed to cancel or request-reschedule a session.
 * Admin/teacher are exempt — this only applies to students.
 *
 * @param {object} session  — must have scheduled_at (ISO string or Date) and status
 * @returns {{ allowed: boolean, reason?: string, code?: string }}
 */
function canStudentCancel(session) {
  if (session.status !== 'scheduled') {
    return { allowed: false, reason: 'Session is not active', code: 'SESSION_NOT_SCHEDULED' };
  }

  const hoursUntil = (new Date(session.scheduled_at).getTime() - Date.now()) / 3_600_000;

  if (hoursUntil < 0) {
    return {
      allowed: false,
      reason: 'This session has already passed.',
      code: 'SESSION_PAST',
    };
  }

  if (hoursUntil < BUFFER_HOURS) {
    return {
      allowed: false,
      reason: 'Too close to session start. Please message the admin on WhatsApp to request changes.',
      code: 'CANCELLATION_BUFFER',
    };
  }

  return { allowed: true };
}

module.exports = { canStudentCancel, BUFFER_HOURS };
