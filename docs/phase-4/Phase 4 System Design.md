# MY Institute — Phase 4 System Design

---

## 0. Vault Discipline Protocol

**This protocol is permanent. Read it at the start of every Phase 4 session. Follow it strictly.**

### Session Start (every Phase 4 session — mandatory)

Open every Claude Code session for Phase 4 by reading, in this order:

1. **MY Institute — Phase 4 Roadmap.md** — current sub-phase, last completed task, next task
2. **MY Institute — Phase 4 System Design.md** — architecture, locked decisions
3. **MY Institute — Mohammad Change Log.md** — recent decisions, open questions
4. **HANDOVER.md** from the repo — what's actually shipped

Then state in 2-3 sentences:
- Current sub-phase (e.g. "4.2 — Schedule UI")
- Last completed task (e.g. "PATCH /admin/weekly-schedules route shipped and tested")
- Next task to start (e.g. "Schedules tab on supervisor dashboard")

If anything is unclear or contradictory between the vault and the codebase, flag it before starting work. Don't guess.

### Session End (every Phase 4 session — mandatory, non-negotiable)

Before declaring a session done, you MUST:

1. **Tick completed checkboxes** in MY Institute — Phase 4 Roadmap.md
2. **Update System Design** if any architecture decisions changed mid-build — even small ones (column added, validation rule changed, edge case handled differently)
3. **Add a dated entry to Change Log** if any product decisions were made — either by the user in chat or by implementing something a specific way
4. **Update HANDOVER.md** for permanent changes (new tables, new conventions, new operational requirements)
5. **Confirm the vault state** in one paragraph before declaring the session done.

If you skip the session-end protocol, the next session starts stale and the vault-based workflow breaks. This is non-negotiable.

### Chat-Driven Decisions

When the user makes a decision in chat that affects the build, even mid-session — record it in the Change Log **immediately**, not at session end. This is how transient chat decisions become persistent.

### Drift Check (when triggered by user)

When the user sends "Run vault audit" — re-read all three vault docs plus HANDOVER.md and the actual codebase. Report any inconsistency or stale information. Don't fix it; just identify it. The user decides what to do.

### Source of Truth Hierarchy

When information conflicts, follow this hierarchy:

1. **User's most recent message in chat** (highest authority for new decisions)
2. **Vault docs** (current state of plan and design)
3. **HANDOVER.md** (what's actually shipped — operational truth)
4. **Codebase itself** (literal current state)

If vault and codebase disagree, the codebase wins and the docs need updating.

### Memory Tool Usage

Prefer the vault over Claude Code's memory system. If memory and the vault disagree, the vault wins and the memory is updated. The vault is portable; memory is session-scoped.

### Sub-Phase Pause Behaviour

After completing each sub-phase (4.1, 4.2, 4.3, 4.4) — even if the next sub-phase is "obvious next" — **STOP**. Update the vault per the session-end protocol. Wait for explicit user approval to start the next sub-phase. Do not chain sub-phases.

Within a sub-phase, you may complete consecutive tasks without pausing as long as they're in the Roadmap and have clear acceptance criteria. If a task surprises you (edge case unclear, dependency missing, decision needed), pause and ask.

### Production Data Safety (carries forward from Phase 3)

- Mohammad's production data is real-looking. Treat as real until proven otherwise.
- No destructive operations (DELETE on users, sessions, schedules) without explicit per-operation approval.
- Test data isolated: use `@phase4test.local` suffix or `_PHASE4_TEST_` prefix on any test records.
- Clean up test records at end of each test run.
- Email guard already in place — still verify Resend dashboard shows no unexpected sends after a test cycle.
- Don't log in as Mohammad or modify his account.
- Deploy backend first, smoke test, then frontend — never both at once.

---

## 1. Why Phase 4 Exists

Mohammad doesn't want to create sessions one-by-one. He wants to set a **weekly recurring schedule** per student (e.g. "Amira has Quran with Ustadh Khalid every Monday 4pm and Thursday 6pm") and have sessions auto-generated on a rolling basis.

This is a pre-launch decision. Launching without it means Mohammad manually creates every session every week — unsustainable for 10+ students. Better to pause 2-3 days now and ship the right model.

Phase 4 also bundles: attendance tracking (replaces Mark Complete), teacher salary page, student name search typeahead, and operational setup (Sentry, UptimeRobot, Vercel Analytics).

---

## 2. New Data Model

### 2.1 `weekly_schedules` table (Migration 014)

```sql
CREATE TABLE weekly_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL DEFAULT 'quran',
  default_duration INTEGER NOT NULL DEFAULT 60,
  slots           JSONB NOT NULL DEFAULT '[]',
  lessons_remaining INTEGER,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ws_student ON weekly_schedules(student_id);
CREATE INDEX idx_ws_teacher ON weekly_schedules(teacher_id);
CREATE INDEX idx_ws_active ON weekly_schedules(is_active) WHERE is_active = true;
```

**No UNIQUE constraint on (student_id, teacher_id).** A student may have multiple active schedules with the same teacher for different subjects (e.g. Quran on Mondays, Arabic on Wednesdays — two separate schedules with two separate lesson counters). Mohammad rarely produces duplicates; if he does, that's his judgement call.

**`slots` JSONB structure:**

```json
[
  { "day": "mon", "time": "16:00", "duration": 60 },
  { "day": "thu", "time": "18:00", "duration": 60 }
]
```

- `day`: lowercase three-letter day code (`mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`)
- `time`: 24-hour `HH:MM` string — interpreted as **London time** (`Europe/London` IANA). Converted to UTC at session generation time using `date-fns-tz`. DST handled automatically.
- `duration`: per-slot override; falls back to `default_duration` if omitted

**`lessons_remaining`**: nullable integer. Manually maintained by admin. NOT a gate — sessions generate regardless. Used purely for admin visibility ("this student has 4 lessons left on their package").

### 2.2 Sessions table changes (Migration 015)

```sql
-- Link sessions to the schedule that generated them
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES weekly_schedules(id) ON DELETE SET NULL;

-- Attendance tracking columns
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS teacher_attended BOOLEAN;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS student_attended BOOLEAN;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS attendance_marked_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS attendance_marked_by UUID REFERENCES users(id);

-- Update status constraint to allow 'cancelled_teacher'
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show', 'cancelled_teacher'));

-- Index for schedule-based lookups
CREATE INDEX idx_sessions_schedule ON sessions(schedule_id) WHERE schedule_id IS NOT NULL;
```

### 2.3 Teacher pay rate (Migration 016)

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_rate_per_hour NUMERIC(10,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pay_currency TEXT NOT NULL DEFAULT 'GBP';
```

### 2.4 Drop `lessons` table (Migration 017)

```sql
-- Original lessons table from migration 001 is unused.
-- All session tracking uses the `sessions` table (migration 002+).
-- Verify empty before applying: SELECT COUNT(*) FROM lessons;
DROP TABLE IF EXISTS lessons;
```

---

## 3. Session Generation Logic

### 3.1 Core algorithm — `generateSessionsForSchedule(schedule)`

```
function generateSessionsForSchedule(schedule):
  if not schedule.is_active: return { created: 0 }

  horizon = today + 28 days  // 4-week rolling window
  created = 0
  skipped = 0
  conflicts = []

  for each slot in schedule.slots:
    // Find all dates matching this day-of-week from today to horizon
    dates = getMatchingDates(slot.day, today, horizon)

    for each targetDate in dates:
      // Convert slot.time (London time) to UTC for this specific date
      sessionTimeUTC = convertLondonToUTC(targetDate, slot.time)

      // Skip if in the past
      if sessionTimeUTC < now: continue

      // Idempotency check — has a session already been generated for this
      // schedule + date + slot combination?
      existing = SELECT id FROM sessions
                 WHERE schedule_id = schedule.id
                   AND DATE(scheduled_at AT TIME ZONE 'Europe/London') = targetDate
                   AND TO_CHAR(scheduled_at AT TIME ZONE 'Europe/London', 'HH24:MI') = slot.time
                   AND status != 'rescheduled'
      if existing: skipped++; continue

      // Overlap check: teacher busy?
      conflict = check tstzrange overlap for schedule.teacher_id at sessionTimeUTC
      if conflict:
        conflicts.push("Teacher conflict on {targetDate} at {slot.time}")
        skipped++
        continue

      // Create session
      INSERT INTO sessions (
        id, student_id, teacher_id, scheduled_at, duration_minutes,
        subject, schedule_id, rate_at_creation, currency_at_creation
      ) VALUES (...)

      created++

  return { created, skipped, conflicts }
```

**Key properties:**
- **Idempotent**: safe to call multiple times — date+time+schedule check prevents duplicates
- **Rescheduled sessions don't block regeneration**: The idempotency check excludes `status = 'rescheduled'`. A rescheduled session at the original slot has `status='rescheduled'` and is invisible to the check. However, the NEW session (at the rescheduled time) has a different `scheduled_at` and won't match the original slot. Net result: the original slot appears empty and WOULD be regenerated — which is wrong. **Fix**: the rescheduled row still has its original `schedule_id` and the original `scheduled_at` (the old time). Actually, looking at the reschedule logic in sessions.js: the old session is updated to `status='rescheduled'` and keeps its original `scheduled_at`. A new session is created with the new time. So the old row DOES match `schedule_id + DATE + TIME` but is excluded by `status != 'rescheduled'`. This means the slot would be re-generated. **The correct fix**: also check for any session with `rescheduled_from` pointing to a session that was at this slot. Simpler approach: don't exclude `status='rescheduled'` — let the rescheduled row block regeneration. Updated idempotency check:

```sql
SELECT id FROM sessions
WHERE schedule_id = $1
  AND DATE(scheduled_at AT TIME ZONE 'Europe/London') = $target_date
  AND TO_CHAR(scheduled_at AT TIME ZONE 'Europe/London', 'HH24:MI') = $slot_time
```

This way: scheduled blocks (correct), cancelled blocks (correct — don't regenerate), completed blocks (correct), no_show blocks (correct), rescheduled blocks (correct — the slot was used, student just moved the time). The ONLY status that should allow regeneration is... none. Every status means "this slot was occupied." This is the correct semantic.

- **Cancelled sessions stay cancelled**: a cancelled session matches the idempotency check, so the slot is not regenerated within the current 4-week window. The next cycle naturally creates the next week's occurrence.
- **Conflict-tolerant**: logs teacher conflicts but doesn't abort the batch
- **Rate snapshot**: captures student's hourly_rate at generation time (existing pattern from `POST /sessions`)

### 3.2 Trigger points

| Event | Action |
|-------|--------|
| Schedule created | Generate immediately for next 4 weeks |
| Schedule edited (slots or teacher changed) | Delete future `scheduled` sessions for this schedule_id, then regenerate |
| Schedule deactivated | Delete future `scheduled` sessions, no regeneration |
| Schedule reactivated | Set `is_active = true`, generate immediately for next 4 weeks |
| Sunday 23:00 UTC cron | Run for ALL active schedules — fills any gaps in the 4-week window |

### 3.3 "Wipe and regenerate" on edit

```sql
DELETE FROM sessions
WHERE schedule_id = $1
  AND status = 'scheduled'
  AND scheduled_at > NOW();
```

This only deletes future sessions with status `scheduled`. Completed, cancelled, no_show, etc. are preserved.

### 3.4 Deactivated schedules behaviour

- Deactivated schedules remain in DB with `is_active = false`
- Supervisor Schedules tab shows them under a collapsed **"Archived schedules"** section (hidden by default, toggle to show)
- Mohammad can **reactivate** a deactivated schedule (button on the archived row); reactivation sets `is_active = true` and triggers a fresh 4-week generation
- Confirmation modal on deactivation: *"This will remove N future sessions. The schedule will be moved to Archived. You can reactivate it later if needed."*

### 3.5 Cron job

- **Timing**: Sunday 23:00 UTC (Monday morning Cairo time)
- **Infrastructure**: Render Cron Job ($7/month) — hits `POST /cron/generate-sessions`
- **Auth**: Cron endpoint protected by a shared secret (`CRON_SECRET` env var), not JWT
- **Endpoint logic**: Loads all active schedules, calls `generateSessionsForSchedule` for each, returns summary
- **Legacy session logging**: cron logs "Skipped X potential generations due to existing legacy sessions" to signal if duplicates are sneaking through
- **Fallback**: Admin can click "Generate Now" button on the schedules page to trigger manually

```
POST /cron/generate-sessions
Header: x-cron-secret: <CRON_SECRET>
Response: { generated: 42, schedules_processed: 8, skipped: 3, errors: [] }
```

---

## 4. Attendance Flow

### 4.1 State transitions

```
                    ┌─ teacher_attended: true  ─┐
                    │  student_attended: true    │──▶ status = 'completed'
                    │                           │
 Session            ├─ teacher_attended: true  ─┤
 (scheduled)  ──▶   │  student_attended: false  │──▶ status = 'no_show'
                    │                           │
                    └─ teacher_attended: false  ─┘──▶ status = 'cancelled_teacher'
```

If `teacher_attended = false`, `student_attended` is irrelevant — status is `cancelled_teacher`.

### 4.2 Time window

- **Teacher can mark**: from 15 minutes before `scheduled_at` to 24 hours after `scheduled_at`
- **Admin/supervisor**: can mark at any time (override)
- **Auto-notification**: if session is still `scheduled` 24 hours after `scheduled_at` and attendance is unmarked, notify admins

### 4.3 API

```
PATCH /sessions/:id/attendance
Auth: teacher (own sessions only), admin, supervisor
Body: {
  teacher_attended: boolean,
  student_attended: boolean
}
Response: { session: { ...updated session } }
```

**Replaces**: the existing `PATCH /sessions/:id/complete` route (kept for backward compat during transition — internally maps to teacher_attended=true, student_attended=true).

### 4.4 Lessons remaining decrement

When attendance is marked and status transitions to `completed`:
- If the session has a `schedule_id`, decrement `weekly_schedules.lessons_remaining` (if not null and > 0)
- If no `schedule_id` (legacy session), decrement from `packages.sessions_remaining` (existing logic)
- Renewal notification fires at ≤ 2 remaining (existing pattern)

---

## 5. Teacher Salary Calculation

### 5.1 Data source

```sql
SELECT
  u.id AS teacher_id,
  u.display_name,
  u.pay_rate_per_hour,
  u.pay_currency,
  COALESCE(SUM(s.duration_minutes) FILTER (WHERE s.teacher_attended = true), 0) AS total_minutes,
  COUNT(s.id) FILTER (WHERE s.teacher_attended = true) AS sessions_attended,
  COUNT(s.id) FILTER (WHERE s.status = 'no_show') AS student_no_shows,
  COUNT(s.id) FILTER (WHERE s.status = 'cancelled_teacher') AS teacher_cancellations
FROM users u
LEFT JOIN sessions s
  ON s.teacher_id = u.id
  AND s.scheduled_at >= $1    -- month start
  AND s.scheduled_at < $2     -- month end
WHERE u.role = 'teacher' AND u.is_active = true
GROUP BY u.id, u.display_name, u.pay_rate_per_hour, u.pay_currency
ORDER BY u.display_name ASC
```

### 5.2 Salary formula

```
total_hours = total_minutes / 60
salary = total_hours × pay_rate_per_hour
```

Display: "£240.00 (16 hours × £15/hr)"

### 5.3 Page location

`/admin/salaries` — replaces `/admin/teacher-hours`. Server-side redirect from `/admin/teacher-hours` → `/admin/salaries` so HANDOVER references and bookmarks still work.

---

## 6. Integration Points with Existing Systems

### 6.1 Notifications

Auto-generated sessions trigger notifications using the existing `notify()` function:
- **On generation**: no per-session notification (would spam). Instead, notify teacher once: "8 sessions generated for the next 4 weeks"
- **On schedule create**: notify student + teacher that a recurring schedule has been set up
- **On schedule edit**: notify student + teacher of the change
- **On attendance marked**: notify student ("Your teacher marked attendance for your session on {date}")
- **Unmarked attendance (24h)**: notify admins ("Session on {date} still has no attendance record")

### 6.2 Supervisor dashboard

- Sessions tab: no change — auto-generated sessions appear like any other session
- New "Schedules" tab: list active schedules with quick edit/deactivate, archived schedules collapsed below
- Session cards gain attendance status indicators (checkmarks for teacher/student attended)
- Admin override button for attendance on each session card

### 6.3 Teacher dashboard

- Session cards: "Mark Complete" button replaced with "Mark Attendance" flow
- Two-step: "I attended" / "I didn't attend", then "Student attended" / "Student didn't attend"
- Only visible within the time window (15 min before → 24h after)

### 6.4 Student dashboard

- Sessions page: shows auto-generated sessions exactly like manual ones
- Package card: `lessons_remaining` from the schedule (if exists) shown alongside legacy package info

### 6.5 Existing safety systems (unchanged)

- Email guard + circuit breaker: no change (no emails from session generation)
- 12-hour cancellation buffer: still applies to auto-generated sessions
- Reschedule request flow: still works for auto-generated sessions
- Playwright test suite: unaffected (tests use individual session creation)

---

## 7. Migration Approach for Existing 49 Sessions

**Soft migration with active prompting — not passive.**

1. All 49 existing sessions remain as-is. They have `schedule_id = NULL` (no schedule owns them).
2. **Warning banner**: On supervisor dashboard load, if any sessions with `schedule_id IS NULL AND status = 'scheduled' AND scheduled_at > now()` exist, show a yellow warning banner: *"N legacy sessions exist that aren't linked to a schedule. Review under Schedules → Legacy Sessions before next week's cron run."*
3. **Schedule creation prompt**: When creating a new schedule for a student, the modal detects existing legacy scheduled sessions for that student and prompts: *"We found N existing future sessions for this student. Choose: keep them as one-offs alongside this schedule, or delete them and let the schedule generate fresh sessions."*
4. Legacy sessions don't decrement `lessons_remaining` on schedules — they decrement `packages.sessions_remaining` as before.
5. **Cron logging**: When the cron runs, it logs "Skipped X potential generations due to existing legacy sessions" to signal if duplicates are sneaking through.

---

## 8. Testing Strategy

Each piece is tested and **executed** (not just written). Tests use the existing API_URL pattern against production with email guard suppression.

### 8.1 Schema migrations
- Tested via Neon MCP queries before/after application
- Verify column existence, constraint values, index presence

### 8.2 Session generation
Unit/API tests covering:
- **DST transition**: create schedule with London time slot, generate sessions spanning a DST change, verify UTC times are correct on both sides
- **Teacher conflict**: create a one-off session, then a schedule at the same slot — verify generator skips conflicting dates
- **Rescheduled session non-regeneration**: create schedule, generate session, reschedule that session away from its original time — verify cron does NOT re-create at the original slot (dedicated test)
- **Multiple slots per day**: schedule with two slots on same day (e.g. Mon 10:00 and Mon 14:00) — verify both generate independently
- **Idempotency**: call generate twice — verify no duplicates
- **Cancelled session non-regeneration**: cancel an auto-generated session — verify cron does not recreate it

### 8.3 Attendance flow
API-level tests for all state transitions:
- teacher_attended=true + student_attended=true → completed
- teacher_attended=true + student_attended=false → no_show
- teacher_attended=false → cancelled_teacher
- Teacher blocked outside time window (403)
- Admin can mark at any time (200)
- Lessons remaining decrement on completion

### 8.4 Salary calculation
API test with known input/output:
- Set teacher pay rate, mark sessions as completed for a known month
- Query teacher-hours endpoint, verify hours + salary match expected values

---

## 9. Risk Areas

1. **DST transitions**: Slot times stored as London time. `date-fns-tz` handles conversion to UTC correctly across DST boundaries. Manual testing needed for the week of clock change (last Sunday of October and March).

2. **Teacher conflicts during generation**: If teacher A has a one-off session at 4pm Monday and also a recurring schedule at 4pm Monday, the generator skips that week. Edge case: if the one-off is cancelled later, next cron run fills the gap only if the one-off has no `schedule_id` (legacy session doesn't block the schedule's idempotency check since it has a different/null schedule_id).

3. **Idempotency for rescheduled sessions**: A rescheduled session keeps its original `scheduled_at` with `status='rescheduled'`. The idempotency check (no status exclusion) correctly sees this row and does NOT regenerate at the original slot. Covered by a dedicated unit test.

4. ~~**UNIQUE(student_id, teacher_id) constraint**~~ **RESOLVED 2026-06-23**: Constraint dropped. Multiple schedules per student-teacher pair are allowed. Subject stays at schedule level.

5. **Lessons remaining decrement timing**: If admin marks attendance retroactively for 5 old sessions at once, lessons_remaining drops by 5 instantly. Correct behavior but could surprise. Documented.

6. **Render Cron Job cost**: $7/month. Approved 2026-06-23. Also eliminates cold starts.

7. **Scale**: With 20 students × 3 slots × 4 weeks = 240 sessions per cron run. Individual INSERTs with conflict checking. Fine for this scale. If >100 students, batch INSERT with ON CONFLICT needed.
