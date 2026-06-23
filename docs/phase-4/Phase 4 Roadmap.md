# MY Institute — Phase 4 Roadmap

## Sub-phase 4.1 — Schema + Session Generation Backend (~1.5 days)

**Goal:** New database tables, attendance columns, schedule CRUD API, and the session generation engine with cron support.

**Dependencies:** None (first sub-phase).

### Tasks

- [x] Write migration `014_weekly_schedules.sql` — create `weekly_schedules` table with JSONB slots (NO unique constraint on student+teacher)
- [x] Write migration `015_sessions_attendance.sql` — add `schedule_id`, `teacher_attended`, `student_attended`, `attendance_marked_at`, `attendance_marked_by` columns; update status CHECK to include `cancelled_teacher`
- [x] Write migration `016_user_pay_rate.sql` — add `pay_rate_per_hour` and `pay_currency` to users
- [x] Write migration `017_drop_lessons.sql` — drop unused `lessons` table (verify empty first via Neon)
- [x] Create `backend/src/lib/schedule-generator.js` — idempotent `generateSessionsForSchedule(schedule)` function with London→UTC conversion and correct idempotency check (`DATE(scheduled_at AT TIME ZONE 'Europe/London') = targetDate AND TO_CHAR(...) = slot.time`, no status exclusion)
- [x] Create `backend/src/routes/weekly-schedules.js` — CRUD routes:
  - `GET /admin/weekly-schedules` — list all (with student/teacher names)
  - `GET /admin/weekly-schedules/:id` — single schedule detail + upcoming sessions
  - `POST /admin/weekly-schedules` — create + immediate generation
  - `PATCH /admin/weekly-schedules/:id` — edit + wipe/regenerate future sessions
  - `DELETE /admin/weekly-schedules/:id` — deactivate (soft delete) + wipe future sessions
  - `POST /admin/weekly-schedules/:id/reactivate` — reactivate + fresh 4-week generation
  - `POST /admin/weekly-schedules/:id/generate` — manual "Generate Now"
- [x] Create `backend/src/routes/cron.js` — `POST /cron/generate-sessions` protected by `CRON_SECRET`, with legacy session logging
- [x] Create `PATCH /sessions/:id/attendance` route in sessions.js
- [x] Extend `GET /admin/teacher-hours` to include `pay_rate_per_hour`, `pay_currency`, computed salary
- [x] Add `PATCH /admin/teachers/:id/pay-rate` route in admin.js
- [x] Add `CRON_SECRET` to `.env.example`
- [x] Register new routes in `backend/index.js`
- [x] Write API tests (execution pending deployment):
  - Schedule CRUD (create, edit, delete, reactivate)
  - Session generation idempotency (call twice, no duplicates)
  - DST transition test (slot spanning clock change)
  - Teacher conflict during generation (skip, don't fail)
  - Rescheduled session non-regeneration (dedicated test)
  - Cancelled session non-regeneration
  - Multiple slots per day
  - Attendance marking (all 3 state transitions)
  - Teacher time window enforcement (403 outside window)
  - Cron endpoint with wrong secret (401)
  - Salary calculation with known inputs

### Definition of Done

- All 4 migrations apply cleanly on a fresh Neon branch
- `POST /admin/weekly-schedules` creates a schedule and generates 4 weeks of sessions
- Multiple schedules for same student+teacher pair allowed (no UNIQUE constraint)
- `PATCH /admin/weekly-schedules/:id` wipes and regenerates correctly
- `DELETE /admin/weekly-schedules/:id` deactivates and wipes; reactivate regenerates
- `POST /cron/generate-sessions` fills gaps idempotently
- `PATCH /sessions/:id/attendance` transitions status correctly
- Teacher conflict detection works during generation
- Cancelled/completed/no_show/rescheduled sessions are never wiped on edit
- Rescheduled sessions don't cause false re-generation (verified by dedicated test)
- All tests pass against production

### Manual Verification

1. Apply migrations on Neon dev branch
2. Create a schedule via API: student + teacher, Mon+Wed slots
3. Verify 8 sessions created (4 weeks × 2 slots)
4. Edit the schedule to change Wednesday to Thursday — verify Wed sessions deleted, Thu sessions created
5. Mark attendance on a session — verify status transitions
6. Call cron endpoint — verify no duplicates created
7. Deactivate schedule — verify future sessions deleted
8. Reactivate schedule — verify fresh 4-week generation
9. Create a second schedule for same student+teacher with different subject — verify allowed
10. Reschedule a generated session, then call generate — verify original slot NOT re-created

---

## Sub-phase 4.2 — Schedule UI (~2 days)

**Goal:** Frontend for creating, viewing, editing, deactivating, and reactivating weekly schedules. Legacy session migration tool with active prompting.

**Dependencies:** 4.1 complete (backend routes exist).

### Tasks

- [ ] Create "Add Weekly Schedule" modal component matching Mohammad's design:
  - Student dropdown (to be replaced with typeahead in 4.4)
  - Teacher dropdown
  - Subject/Note free-text input
  - Default duration dropdown (30/60/90/120)
  - 7-day grid with checkbox + time picker + duration override per day
  - Lessons remaining numeric input
  - Save / Cancel buttons
  - **On save for existing student**: detect legacy scheduled sessions and prompt: "We found N existing future sessions for this student. Choose: keep them as one-offs, or delete them and let the schedule generate fresh sessions."
- [ ] Add "Schedules" tab to supervisor dashboard (`app/supervisor/page.tsx`)
- [ ] Active schedule list: cards with student name, teacher name, subject, slot summary, lessons remaining, edit/deactivate buttons
- [ ] **Archived schedules section**: collapsed by default, toggle to show, with reactivate button per row
- [ ] Edit schedule flow: open modal pre-filled, save triggers wipe/regenerate with confirmation
- [ ] Deactivate confirmation modal: *"This will remove N future sessions. The schedule will be moved to Archived. You can reactivate it later if needed."*
- [ ] Reactivate button: triggers reactivation + fresh 4-week generation
- [ ] "Generate Now" button per active schedule (fallback if cron fails)
- [ ] **Legacy session warning banner**: on supervisor dashboard load, if sessions with `schedule_id IS NULL AND status = 'scheduled' AND scheduled_at > now()` exist, show yellow banner: *"N legacy sessions exist that aren't linked to a schedule. Review under Schedules → Legacy Sessions."*
- [ ] Legacy Sessions section under Schedules tab: list of unlinked scheduled sessions with Keep/Delete per session
- [ ] Recurring badge on session cards (sessions with `schedule_id` show small recurring icon)
- [ ] Student detail page (`/admin/students`) — show active schedule summary per student

### Definition of Done

- Admin can create a weekly schedule from the supervisor dashboard
- Sessions appear in the Sessions tab immediately after schedule creation
- Creating a schedule for a student with legacy sessions triggers the keep/delete prompt
- Edit schedule wipes and regenerates with visual confirmation
- Deactivate removes future sessions, moves schedule to Archived section with confirmation modal
- Reactivate generates fresh sessions
- Generate Now works as fallback
- Legacy session warning banner shows when applicable
- Archived schedules section is collapsed by default, togglable
- Session cards show recurring vs one-off badges

### Manual Verification

1. Log in as admin, go to Schedules tab
2. Create a schedule for a test student — verify sessions appear in Sessions tab
3. If student has legacy sessions, verify the keep/delete prompt appears
4. Edit the schedule (change a day) — verify old sessions gone, new ones present
5. Deactivate — verify confirmation shows N sessions, future sessions removed, schedule in Archived
6. Expand Archived section, reactivate — verify fresh sessions generated
7. Click "Generate Now" — verify it fills gaps
8. Check session cards for recurring badge vs no badge
9. Verify legacy warning banner shows (and hides once all legacy sessions resolved)

---

## Sub-phase 4.3 — Attendance + Salary Page (~2 days)

**Goal:** Replace Mark Complete with attendance tracking. Build teacher salary page. Redirect teacher-hours to salaries.

**Dependencies:** 4.1 complete (attendance route exists). 4.2 not required.

### Tasks

- [ ] Teacher dashboard: replace "Mark Completed" button with attendance flow
  - "Mark Attendance" button (visible 15 min before → 24h after session)
  - Step 1: "I attended" / "I didn't attend"
  - Step 2: "Student attended" / "Student didn't attend" (only if teacher attended)
  - Attendance status indicators on session cards (checkmarks)
  - Outside time window: show informational message
- [ ] Supervisor dashboard: add attendance override on session cards
  - Admin can mark attendance at any time
  - Shows current attendance state (teacher ✓/✗, student ✓/✗)
- [ ] Create `/admin/salaries` page (`app/admin/salaries/page.tsx`)
  - Month selector (same pattern as teacher-hours: left/right arrows, month display)
  - Summary bar: total salary across all teachers for the month
  - Per-teacher rows: name, sessions attended, total hours, pay rate, calculated salary, no-shows, teacher cancellations
  - "Set Pay Rate" button: inline edit or modal for pay_rate and currency
  - If pay_rate is null: show "Set rate" prompt
- [ ] Server-side redirect from `/admin/teacher-hours` → `/admin/salaries`
- [ ] Add link to salaries page in supervisor dashboard People tab (replace Teacher Hours link)
- [ ] Auto-notification: if session unmarked 24h after scheduled_at, notify admins

### Definition of Done

- Teacher sees attendance buttons instead of Mark Complete
- Attendance correctly transitions session status (completed, no_show, cancelled_teacher)
- Teacher cannot mark attendance outside the time window
- Admin can override attendance at any time
- Salary page shows correct calculations per teacher per month
- Pay rate is editable from the salary page
- `/admin/teacher-hours` redirects to `/admin/salaries`
- Unmarked sessions trigger admin notification after 24h

### Manual Verification

1. Log in as teacher, find a session starting within 15 min — verify attendance buttons visible
2. Mark "I attended" + "Student attended" — verify status → completed
3. Mark "I attended" + "Student didn't attend" — verify status → no_show
4. Mark "I didn't attend" — verify status → cancelled_teacher
5. Try to mark attendance on a session > 24h in the future — verify blocked
6. Log in as admin, go to /admin/salaries — verify hours and salary calculation
7. Set a pay rate for a teacher — verify salary updates
8. Navigate to /admin/teacher-hours — verify redirect to /admin/salaries

---

## Sub-phase 4.4 — Polish + Cleanup (~1 day)

**Goal:** Typeahead search, operational monitoring, test fixes, table cleanup.

**Dependencies:** 4.1-4.3 complete.

### Tasks

- [ ] Create `<UserSearchInput />` component — typeahead filtering by display_name
  - Debounced input, case-insensitive substring match
  - Shows name + email in dropdown
  - Replaces student/teacher dropdowns in: schedule modal, legacy session form, package assignment
- [ ] Vercel Analytics — add `@vercel/analytics` package, insert `<Analytics />` in layout.tsx
- [ ] Sentry — set `SENTRY_DSN` env var in Render (backend already conditional on it)
- [ ] UptimeRobot — configure free-tier monitor: ping `GET /health` every 5 min, email alerts to razwanul712@gmail.com
- [ ] Fix test flakiness — replace counter-based time offsets in `e2e/reschedule-and-buffer.spec.ts` with random offsets in a safe range
- [ ] Apply migration 017 — drop `lessons` table (after Neon verification)
- [ ] Add Render Cron Job — configure `POST /cron/generate-sessions` at Sunday 23:00 UTC
- [ ] Write and **execute** new Playwright API tests for Phase 4 features (see Testing Strategy in System Design)
- [ ] Update HANDOVER.md with Phase 4 documentation (schedules, attendance, salary, monitoring)

### Definition of Done

- Typeahead works everywhere student/teacher selection exists
- Vercel Analytics collecting data
- Sentry capturing backend errors
- UptimeRobot pinging /health with email alerts
- Tests pass reliably without flakiness
- lessons table dropped
- Cron job running on Render
- HANDOVER.md updated with sections on schedules, attendance, salary

### Manual Verification

1. Open schedule modal — type partial student name, verify typeahead filters
2. Check Vercel Analytics dashboard — verify page views appearing
3. Trigger a backend error — verify it appears in Sentry
4. Stop Render service briefly — verify UptimeRobot sends alert email
5. Run full test suite — verify no flaky failures
6. Verify `SELECT * FROM lessons` returns error (table dropped)
7. Wait for Sunday 23:00 UTC (or trigger manually) — verify cron generates sessions
