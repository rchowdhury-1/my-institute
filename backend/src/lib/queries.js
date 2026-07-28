async function getDisplayName(pool, userId) {
  const result = await pool.query('SELECT display_name FROM users WHERE id=$1', [userId]);
  return result.rows[0]?.display_name;
}

/**
 * Looks up a user by id and role='teacher'. Returns the row (id,
 * display_name) or null — the caller decides the response (400 vs 404,
 * exact message) since that varies by call site.
 */
async function assertTeacherExists(pool, teacherId, { requireActive = false } = {}) {
  const query = requireActive
    ? "SELECT id, display_name FROM users WHERE id = $1 AND role = 'teacher' AND is_active = true"
    : "SELECT id, display_name FROM users WHERE id = $1 AND role = 'teacher'";
  const result = await pool.query(query, [teacherId]);
  return result.rows[0] || null;
}

/**
 * True if the teacher already has a scheduled session overlapping the
 * given window. Verbatim port of the tstzrange overlap check duplicated
 * across admin.js and reschedule.js.
 */
async function hasTeacherConflict(pool, { teacherId, scheduledAt, durationMinutes, excludeSessionId = null }) {
  const query = excludeSessionId
    ? `SELECT id FROM sessions
       WHERE teacher_id = $1
         AND status = 'scheduled'
         AND id <> $2
         AND tstzrange(scheduled_at, scheduled_at + duration_minutes * interval '1 minute')
          && tstzrange($3::timestamptz, $3::timestamptz + $4 * interval '1 minute')`
    : `SELECT id FROM sessions
       WHERE teacher_id = $1
         AND status = 'scheduled'
         AND tstzrange(scheduled_at, scheduled_at + duration_minutes * interval '1 minute')
          && tstzrange($2::timestamptz, $2::timestamptz + $3 * interval '1 minute')`;
  const params = excludeSessionId
    ? [teacherId, excludeSessionId, scheduledAt, durationMinutes]
    : [teacherId, scheduledAt, durationMinutes];
  const result = await pool.query(query, params);
  return result.rows.length > 0;
}

/**
 * Runs an on-demand session-generation function without letting a failure
 * block the request it's embedded in — logs and swallows instead.
 */
async function safeGenerate(fn, tag = 'generation') {
  try {
    await fn();
  } catch (genErr) {
    console.error(`[${tag}] on-demand generation failed (non-blocking):`, genErr);
  }
}

/**
 * Builds a dynamic SQL SET-clause + params list from a { column: value }
 * map, skipping any entry whose value is `undefined` (present-but-null
 * values ARE included, matching every call site's own COALESCE/null
 * semantics). Placeholder numbering starts at startIndex so callers can
 * prepend fixed params (e.g. userId) before the dynamic ones.
 *
 * @param {Object} fields - column name -> value (undefined entries skipped)
 * @param {number} startIndex - first $N placeholder number to use
 * @returns {{ setClauses: string[], params: any[], nextParamIdx: number }}
 */
function buildUpdateClause(fields, startIndex) {
  const setClauses = [];
  const params = [];
  let paramIdx = startIndex;

  for (const [column, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    setClauses.push(`${column} = $${paramIdx++}`);
    params.push(value);
  }

  return { setClauses, params, nextParamIdx: paramIdx };
}

module.exports = { getDisplayName, assertTeacherExists, hasTeacherConflict, safeGenerate, buildUpdateClause };
