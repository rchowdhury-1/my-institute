# MY Institute — Mohammad Change Log

Record of every feature, change, and decision Mohammad has requested or approved.

---

## 1. Initial Bug List (from Mohammad's original message)

These were the issues Mohammad reported after first seeing the platform. All resolved in Phases 1-3.7 except items carried to Phase 4.

| # | Issue | Status | Phase |
|---|-------|--------|-------|
| 1 | Student name search needed (dropdowns hard to use) | Open — scheduled for Phase 4.4 | 4.4 |
| 2 | Bulk lesson creation / recurring schedules | Open — core of Phase 4.1-4.2 | 4.1 |
| 3 | Teacher salary page needed | Open — scheduled for Phase 4.3 | 4.3 |
| 4 | Teacher attendance check-in (not just "mark complete") | Open — scheduled for Phase 4.3 | 4.3 |
| 5 | Timezone clarification on session times | Partially resolved — dual BST+Cairo display shipped in Phase 3. Open question: per-user timezone or keep dual display? | 3 / TBD |
| 6 | Analytics / visitor tracking | Open — Vercel Analytics scheduled for Phase 4.4 | 4.4 |
| 7 | Temp password lost after creation | Fixed — persistent credential panel with copy + WhatsApp share | 3.7 |
| 8 | Silent error catches in admin pages | Fixed — 6 catch blocks now show inline errors | 3.7 |
| 9 | FreeTrialForm WhatsApp opening on failure | Fixed — moved from finally to success branch | 3.7 |
| 10 | WhatsApp number hardcoded in multiple places | Fixed — centralised to BRAND.whatsapp / brand.js | 3.7 |
| 11 | Session status allowing invalid values | Fixed — CHECK constraint added (migration 012) | 3.7 |
| 12 | Homework query performance | Fixed — indexes on student_id and teacher_id (migration 013) | 3.7 |

---

## 2. Phase 4 Feature Requests

These are the features Mohammad explicitly requested or approved for Phase 4, prior to launch.

### 2.1 Weekly Recurring Schedules (core feature)
**Requested:** June 2026
**Context:** Mohammad showed a UI mockup of how he wants to set up student schedules. One schedule per student-teacher pair per subject, with multiple day/time slots. Sessions auto-generate weekly.
**Decision:** Rolling 4-week window with Sunday cron. Render Cron Job at $7/month accepted.

### 2.2 Student Name Search / Typeahead
**Requested:** June 2026
**Context:** With 10+ students, scrolling through a dropdown is slow. Wants to type a name and filter.
**Decision:** Client-side typeahead component replacing dropdowns in schedule modal, session form, and package assignment.

### 2.3 Bulk Lesson Creation
**Requested:** June 2026
**Status:** Subsumed into weekly schedules (2.1). The schedule system auto-generates sessions, making manual bulk creation unnecessary.

### 2.4 Teacher Salary Page
**Requested:** June 2026
**Context:** Mohammad manually calculates teacher pay by counting hours. Wants an automated salary view.
**Decision:** New /admin/salaries page replaces /admin/teacher-hours (with redirect). Per-teacher pay rate stored on users table. Monthly view showing hours × rate = salary.

### 2.5 Teacher Attendance Check-in
**Requested:** June 2026
**Context:** "Mark Complete" doesn't capture whether the student actually showed up. Mohammad needs to know about no-shows for billing.
**Decision:** Two-axis attendance: teacher attended (yes/no) + student attended (yes/no). Three outcomes: completed, no_show, cancelled_teacher. Replaces Mark Complete.

### 2.6 Timezone Clarification
**Requested:** June 2026
**Partially resolved:** Dual BST + Cairo timezone display shipped in Phase 3.
**Open question:** Is dual display sufficient, or does Mohammad want per-user timezone settings? See Open Questions below.

### 2.7 Analytics / Visitor Tracking
**Requested:** June 2026
**Decision:** Vercel Analytics (free tier). No custom event tracking needed for now.

---

## 3. Recent Design Decisions

### 3.1 Weekly Schedule UI Pattern
**Date:** June 2026
**Decision:** Modal with 7-day grid (checkboxes + time pickers). Matches the UI Mohammad described.
**Details:** Select student → select teacher → set subject/note → set default duration → check days and set times → set lessons remaining → save.

### 3.2 Lessons Remaining as Manual Counter
**Date:** June 2026
**Decision:** `lessons_remaining` is a simple integer on the schedule, manually set by admin. No topup audit trail. Decrements on completed sessions. NOT a gate — sessions generate regardless of the counter value. Mohammad handles renewal conversations manually.

### 3.3 Session Generation Model
**Date:** June 2026
**Decision:** Rolling 4-week window. Cron every Sunday 23:00 UTC. Immediate generation on schedule save. Wipe/regenerate on edit. Render Cron Job ($7/month) accepted as infrastructure cost.

### 3.4 Soft Migration of 49 Existing Sessions — Active Prompting
**Date:** June 2026, refined 2026-06-23
**Decision:** Don't auto-delete or auto-migrate. Legacy sessions get a yellow warning banner on supervisor dashboard. When creating a schedule for a student with legacy sessions, admin is prompted to keep or delete them. Cron logs skipped generations from legacy sessions. Mohammad reviews manually.

### 3.5 No UNIQUE Constraint on student_id + teacher_id
**Date:** 2026-06-23
**Decision:** Allow multiple active schedules per student-teacher pair. Subject stays at schedule level (not per-slot). Reasoning: a student might study Quran with Teacher A on Mondays and Arabic with the same Teacher A on Wednesdays — these should be two separate schedules with two separate lesson counters. Mohammad rarely produces duplicates; if he does, that's his judgement call.

### 3.6 Slot Times Stored as London Time
**Date:** 2026-06-23
**Decision:** Slot `time` field in JSONB interpreted as Europe/London timezone. Converted to UTC at session generation time using date-fns-tz. DST handled automatically. This matches Mohammad's mental model (he's UK-based).

### 3.7 /admin/salaries Replaces /admin/teacher-hours
**Date:** 2026-06-23
**Decision:** Salary page is a superset of teacher-hours. /admin/teacher-hours redirects to /admin/salaries. HANDOVER references and bookmarks still work.

### 3.8 Deactivated Schedules Are Archivable and Reactivatable
**Date:** 2026-06-23
**Decision:** Deactivated schedules stay in DB (is_active=false), shown under collapsed "Archived" section on Schedules tab. Can be reactivated, which triggers fresh 4-week generation. Deactivation confirmation shows count of sessions to be removed.

### 3.9 Cancelled/Rescheduled Sessions Not Regenerated
**Date:** 2026-06-23
**Decision:** Idempotency check does NOT exclude any status. Any session at a given schedule+date+time blocks regeneration. Cancelled slots stay cancelled until the next week's natural occurrence. Rescheduled sessions keep their original scheduled_at with status='rescheduled', blocking regeneration at the original slot.

### 3.10 Idempotency Check Uses London-Timezone Date+Time Matching
**Date:** 2026-06-23
**Decision:** The correct idempotency SQL is:
```sql
SELECT id FROM sessions
WHERE schedule_id = $1
  AND DATE(scheduled_at AT TIME ZONE 'Europe/London') = $target_date
  AND TO_CHAR(scheduled_at AT TIME ZONE 'Europe/London', 'HH24:MI') = $slot_time
```
No status exclusion. Handles DST correctly by matching in London timezone space.

---

## 4. Open Questions Pending Mohammad's Answer

### 4.1 Per-User Timezone Display
**Question:** Is the hardcoded dual BST+Cairo display sufficient for all students? If a student is in a third timezone (e.g., Pakistan, Malaysia), would Mohammad want their local time shown too?
**Status:** Awaiting Mohammad's input. Not blocking Phase 4 — can be added later without schema changes. Slot storage as London time is confirmed (Decision 3.6).
