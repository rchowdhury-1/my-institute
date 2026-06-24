# MY Institute — Handover Notes

Plain-English guide for running and maintaining the platform.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Logging In as Admin](#2-logging-in-as-admin)
3. [Rotating the Admin Password](#3-rotating-the-admin-password)
4. [Environment Variables](#4-environment-variables)
5. [How to Add a Teacher](#5-how-to-add-a-teacher)
6. [First Login Experience](#6-first-login-experience)
6.5. [How to Add a Student](#65-how-to-add-a-student)
7. [How to Log a Student Payment](#7-how-to-log-a-student-payment)
8. [How to Add a Session with a Zoom Link](#8-how-to-add-a-session-with-a-zoom-link)
9. [If WhatsApp Notifications Stop Working](#9-if-whatsapp-notifications-stop-working)
10. [Enabling Phase 2B Features](#10-enabling-phase-2b-features)
11. [Resetting a User's Password](#11-resetting-a-users-password)
12. [How to Add a Community Post](#12-how-to-add-a-community-post)
13. [How to Manage Homepage Entries](#13-how-to-manage-homepage-entries)
14. [How to Handle Revert Application Inquiries](#14-how-to-handle-revert-application-inquiries)
15. [Checking Teacher Hours for Salary](#15-checking-teacher-hours-for-salary)
16. [Known Limitations](#16-known-limitations)
17. [Who Built What](#17-who-built-what)

---

## 1. System Overview

The platform has two parts that run separately:

- **Website / dashboard** — hosted on [Vercel](https://vercel.com). This is what users see in their browser.
- **Backend / API** — hosted on [Render](https://render.com). This handles data, logins, emails, and the database.
- **Database** — hosted on [Neon](https://neon.tech). PostgreSQL. The backend connects to it automatically.

The live website is at: **https://my-institute-eight.vercel.app**

---

## 2. Logging In as Admin

1. Go to `/login` on the live site.
2. Email: `razwanul712@gmail.com`
3. Password: see Step 3 below — the default `changeme123` **must be rotated before going live**.

After logging in you will be taken to the Supervisor Dashboard at `/supervisor`.

---

## 3. Rotating the Admin Password

**Do this before going live.** The default password is `changeme123`.

**Via the Neon console (recommended)**

1. Log into [Neon](https://console.neon.tech) and open the MY Institute project.
2. Click **SQL Editor** in the left menu.
3. Run the following query, replacing `YOUR_NEW_PASSWORD` with a strong password:

```sql
UPDATE users
SET password_hash = crypt('YOUR_NEW_PASSWORD', gen_salt('bf', 12))
WHERE email = 'razwanul712@gmail.com';
```

> If `crypt` is not available, ask a developer to enable the `pgcrypto` extension: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`

---

## 4. Environment Variables

### Vercel (frontend)

Go to **Vercel → Project → Settings → Environment Variables**.

| Variable | Purpose | Example value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL of the Render backend | `https://my-institute-backend.onrender.com` |
| `NEXT_PUBLIC_SITE_URL` | Your live domain | `https://my-institute-eight.vercel.app` |
| `RESEND_API_KEY` | Email sending | `re_abc123…` |
| `CONTACT_EMAIL` | Where form emails land | `myinstitute2026@gmail.com` |
| `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (optional) | `https://abc@sentry.io/123` |
| `NEXT_PUBLIC_FEATURE_EXAMS` | Enable exam system | `false` |
| `NEXT_PUBLIC_FEATURE_TEACHER_SALARY` | Enable teacher salary tracking | `false` |
| `NEXT_PUBLIC_FEATURE_RECORDED_COURSES` | Enable recorded courses | `false` |
| `NEXT_PUBLIC_FEATURE_MESSAGING` | Enable in-app messaging | `false` |
| `NEXT_PUBLIC_FEATURE_SCHOLARSHIP_SPONSORSHIP` | Enable scholarship & donation pages | `false` |

After changing any variable, trigger a **Redeploy** in Vercel for it to take effect.

### Render (backend)

Go to **Render → Service → Environment**.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `JWT_SECRET` | Signs access tokens (keep secret, 64+ chars) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens (keep secret, 64+ chars) |
| `RESEND_API_KEY` | Required for sending welcome emails to teachers and students from `noreply@my-institute.com`. Domain verified (SPF/DKIM/DMARC). If absent, account creation still succeeds and the temp password is shown on screen — share it manually. |
| `CONTACT_EMAIL` | Admin notification email |
| `CLIENT_URL` | Exact URL of the Vercel frontend (CORS) |
| `NODE_ENV` | Set to `production` |
| `SENTRY_DSN` | Error tracking (optional) |
| `FEATURE_EXAMS` | `false` (or `true` when ready) |
| `FEATURE_TEACHER_SALARY` | `false` |
| `FEATURE_MESSAGING` | `false` |
| `FEATURE_RECORDED_COURSES` | `false` |
| `FEATURE_SCHOLARSHIP_SPONSORSHIP` | `false` |

---

## 5. How to Add a Teacher

1. Log in as admin.
2. Click **Manage Teachers** in the People tab on the supervisor dashboard, or navigate directly to `/admin/teachers`.
3. Click **Add Teacher** (top right).
4. Fill in name and email (required). Phone, specialisation, and bio are optional and can be skipped.
5. Either type a temporary password or click **Generate for me**.
6. Tick **"Email login details to this teacher"** if you want them to receive the password by email automatically.
7. Click **Add Teacher**.
8. The temporary password is shown once in the green banner — **copy it now** if you will need to share it manually.
9. The teacher will be asked to change their password on first login.

---

## 6. First Login Experience

When a teacher or student logs in for the first time after being added by an admin, they will be taken to a **Set Your Password** page instead of their dashboard. They must enter a new password (at least 8 characters) before they can access anything else.

After setting their password, they are taken straight to their dashboard.

If a teacher or student forgets their temporary password before logging in for the first time, an admin can generate a new one from their card on the Manage Teachers or Manage Students page — see [Section 11](#11-resetting-a-users-password).

> **Note for the admin:** Each teacher/student card shows an amber "Awaiting first login" badge until they complete their first login. This badge disappears once they set their password.

---

## 6.5. How to Add a Student

1. Log in as admin.
2. Click **Manage Students** in the People tab on the supervisor dashboard, or navigate directly to `/admin/students`.
3. Click **Add Student** (top right).
4. Fill in name, email, and hourly rate (defaults to £10). Currency defaults to GBP.
5. Tick **"This student is on a legacy (grandfathered) rate"** if they were agreed at a different rate before October 2025.
6. Optionally: assign a teacher from the dropdown, add a guardian/parent name, or add a prepaid lesson bundle (bundle label, total lessons, and expiry date — all three must be filled in together).
7. Either type a temporary password or click **Generate for me**.
8. Click **Add Student**.
9. The temporary password is shown once in the green banner — **copy it now** if you will need to share it manually.
10. The student will be asked to change their password on first login.

---

## 7. How to Log a Student Payment

Payments are recorded manually in the admin dashboard.

1. Log in as admin and go to the admin area.
2. Navigate to **Payments → Student Payments** tab.
3. Click **Log Payment**.
4. Select the student, enter the amount, currency, payment method (e.g. "Bank transfer"), and any notes.
5. Click **Log Payment**.

The student will see this in their **Sessions** page under **Payment History**.

---

## 8. How to Add a Session with a Zoom Link

1. Log in as admin/supervisor.
2. Go to the **Supervisor Dashboard**.
3. Under the **Sessions** tab, click **Add Session**.
4. Fill in: student, teacher, date/time, duration (30 / 60 / 90 / 120 min), subject.
5. Paste the Zoom meeting URL into the **Zoom link** field.
6. Click **Create Session**.

The student will see a **Join Class** button on their Sessions page when the session time approaches.

**To update the Zoom link on an existing session**, a developer needs to call:

```
PATCH /sessions/:id
{ "zoom_link": "https://zoom.us/j/..." }
```

(A UI for this can be added to the supervisor dashboard later.)

---

## 9. If WhatsApp Notifications Stop Working

The platform does **not** send automatic WhatsApp messages. Instead, it builds a pre-filled WhatsApp link that staff or students click to open a chat. No API key or webhook is involved.

**If a link stops working:**
- Check that the WhatsApp number in the backend code is still correct. It is set as `ADMIN_WHATSAPP` in `backend/src/routes/courses.js` and `backend/src/routes/scholarships.js`.
- The number format must be international without `+` or spaces: e.g. `447700900000`.
- Update the number in both files and redeploy the Render service.

---

## 10. Enabling Phase 2B Features

The following features are built and tested but disabled in production. They are gated by environment variables so no code needs to change — just flip the flag.

### How to enable

1. Go to **Vercel → Project → Settings → Environment Variables** and set the relevant `NEXT_PUBLIC_FEATURE_*` flag to `true`.
2. Go to **Render → Service → Environment** and set the matching `FEATURE_*` flag to `true`.
3. Redeploy both services.

### Feature map

| Feature | Vercel flag | Render flag | What it unlocks |
|---|---|---|---|
| **Exam system** | `NEXT_PUBLIC_FEATURE_EXAMS` | `FEATURE_EXAMS` | Teachers create exams; students take them with a timer and see their results. Pages: `/student/exams`, `/teacher/exams`. |
| **Teacher salary tracking** | `NEXT_PUBLIC_FEATURE_TEACHER_SALARY` | `FEATURE_TEACHER_SALARY` | Admin generates monthly salary statements per teacher based on completed sessions. Teacher can view their own payment history. Pages: `/teacher/payments`, admin Payments → Teacher tab. |
| **Messaging** | `NEXT_PUBLIC_FEATURE_MESSAGING` | `FEATURE_MESSAGING` | In-app messaging between students, teachers, and supervisors. Pages: `/student/messages`, `/teacher/messages`. |
| **Recorded courses** | `NEXT_PUBLIC_FEATURE_RECORDED_COURSES` | `FEATURE_RECORDED_COURSES` | Public course catalogue with video lessons. Admin can manage courses. Pages: `/recorded-courses`, `/admin/courses`. |
| **Scholarship sponsorship** | `NEXT_PUBLIC_FEATURE_SCHOLARSHIP_SPONSORSHIP` | `FEATURE_SCHOLARSHIP_SPONSORSHIP` | Admin scholarship applicant management and sponsorship flow. Page: `/admin/scholarships`. Note: the public `/scholarship`, `/donate`, and `/community` pages are always on and not behind this flag. |

When a flag is `false`:
- **Frontend**: navigating to those URLs redirects to the homepage.
- **Backend**: all API calls to those routes return `404 Not found`.

---

## 11. Resetting a User's Password

1. Go to `/admin/teachers` or `/admin/students`.
2. Find the user's card and click **Reset password**.
3. Click **Yes** to confirm.
4. The new temporary password is shown once in the banner — **copy it now**.
5. Tick **"Also email this user"** if you want them to receive it by email.
6. Share the password with the user — they will be asked to change it on next login.

---

## 12. How to Add a Community Post

1. Log in as admin or supervisor.
2. Navigate to **Manage Community** from the People tab, or go to `/admin/newsfeed`.
3. Click **Add Post**.
4. Choose a type: Quote of the Month, Honour List, or General Update.
5. Fill in the title and body (required). Optionally paste a public image URL (e.g. from imgur.com).
6. Tick **Show on homepage** if you want this post to appear in the "From Our Community" section on the homepage (max 3 shown, newest first).
7. Click **Publish post**.
8. To edit or delete a post later, use the Edit/Delete buttons on each post card.

**Public page:** All posts are visible at `/community` (linked from the header as "Community").

---

## 13. How to Manage Homepage Entries

The homepage "From Our Community" section is automatic:
- It shows the 3 most recent posts with **Show on homepage** ticked.
- If fewer than 3 are ticked, it shows whatever exists (1 or 2).
- If none are ticked, the section is hidden entirely.

To add/remove posts from the homepage:
1. Go to `/admin/newsfeed`.
2. Click **Edit** on a post.
3. Tick or untick **Show on homepage**.
4. Click **Save**.

---

## 14. How to Handle Revert Application Inquiries

When a new Muslim fills in the form at `/learn-about-islam`:
1. Their application is saved to the database.
2. A WhatsApp message is sent to Mohammad's phone (+20 106 782 7621) with the applicant's details.
3. The applicant sees a success message on the page.

To view and manage applications:
1. Go to `/admin/revert-applications` (accessible from the supervisor dashboard → People tab → **Revert Applications**).
2. Each application shows the person's name, email, phone, country, and story.
3. Use the status dropdown to track progress: **New → Contacted → Enrolled → Archived**.

---

## 15. Checking Teacher Hours for Salary

1. Log in as admin or supervisor.
2. Click **Teacher Hours** from the People tab on the supervisor dashboard, or navigate directly to `/admin/teacher-hours`.
3. The current month is shown by default. Use the left/right arrows to navigate to previous or future months.
4. Each teacher row shows:
   - **Total hours** (large emerald number) — this is the number to use for salary calculation.
   - **Completed sessions** — how many sessions were marked as completed that month.
   - **Cancelled / Rescheduled** — shown for context but **not** counted toward paid hours.
5. The summary bar at the top shows the total hours across all teachers for the month.

> **Note:** There is currently no per-teacher hourly pay rate in the system. To auto-calculate salary amounts, a teacher pay rate field would need to be added in a future update. For now, multiply the hours shown by each teacher's agreed rate manually.

---

## 16. How Reschedule Requests Work

Students can no longer reschedule sessions directly. Instead, they submit a **reschedule request** proposing a new time. Either you (admin) or the teacher can approve or reject it.

**How it works:**
1. The student clicks "Request Reschedule" on their session card, picks a new date and time, and submits.
2. You and the teacher both get an in-app notification (check the bell icon in the header).
3. On the **Supervisor Dashboard** (Sessions tab), pending requests appear at the top with Approve/Reject buttons. The teacher also sees them on their dashboard.
4. **To approve:** click Approve. The system creates a new session at the proposed time and marks the old one as rescheduled. The student gets a notification.
5. **To reject:** click Reject, optionally type a reason, then Confirm. The student gets a notification with the reason.
6. After approving or rejecting, a green **"Send WhatsApp to student"** button appears so you can message them directly.

**Rules:**
- Students cannot request a reschedule within **12 hours** of the session start. If they need a last-minute change, they must message you on WhatsApp.
- Only one pending request per session at a time. The student must cancel their pending request before submitting a new one.
- The system checks that the teacher is available at the proposed time — if there's a conflict, you'll see an error and should reject the request.

---

## 17. Cancellation Buffer + Admin Session Editing

**12-hour cancellation buffer:**
Students cannot cancel or request-reschedule a session within 12 hours of its start time. Instead, they see a "WhatsApp Mohammad" button. This protects against last-minute no-shows. Admin, supervisor, and teachers can still cancel at any time.

**Admin session editing:**
On the Supervisor Dashboard (Sessions tab), each scheduled session has an edit (pencil) icon. Click it to open a modal where you can change:
- **Date & time** — the system checks for teacher conflicts
- **Duration** — 30/60/90/120 minutes
- **Subject** — Quran, Arabic, or Islamic Studies
- **Teacher** — reassign to a different teacher (both old and new teacher are notified)
- **Zoom link** — update the meeting URL
- **Notes** — admin-only notes (no notification sent for notes-only changes)

After saving, all affected users (student, teacher) receive ONE in-app notification summarising all changes. If the time was changed, a green "WhatsApp student" button appears so you can message them directly.

**`last_modified_by` tracking:**
Every admin edit records who made the change in the `last_modified_by` column on the sessions table. To check who last modified a session, query Neon:
```sql
SELECT s.id, s.last_modified_by, u.display_name
FROM sessions s LEFT JOIN users u ON u.id = s.last_modified_by
WHERE s.id = '<session-id>';
```

**Legacy direct reschedule:**
The old direct-reschedule API (`PATCH /sessions/:id/reschedule`) is now restricted to admin/supervisor only. Students must use the reschedule request flow (see section 16).

---

## 18. Notifications, WhatsApp, and Homework Policy

**In-app notifications:**
The bell icon in the header shows notifications for these events:
| Event | Who gets notified |
|-------|------------------|
| Session created | Student + teacher |
| Session cancelled | Counterparty + admins |
| Session rescheduled (by admin) | Student + teacher + admins |
| Reschedule requested (by student) | Teacher + admins |
| Reschedule approved | Student + the other party (teacher or admins) |
| Reschedule rejected | Student + the other party |
| Admin edits session | Student + teacher (+ old teacher if reassigned) |
| Homework assigned | Student |
| Homework graded | Student |

All session times in notifications use the dual-timezone format: "Mon 22 Jun · 14:00 BST · 16:00 Cairo".

**WhatsApp buttons:**
After approving/rejecting a reschedule request or editing a session time, a green "WhatsApp student" button appears inline. It opens WhatsApp with a pre-filled message including the session time. These are manual — no automated messaging.

**Homework assignment policy:**
Teachers can only assign homework to students they have at least one session with. Admin/supervisor can assign to any student. This prevents accidental homework to the wrong student.

**In-app messaging:**
Still feature-flagged off (`FEATURE_MESSAGING` on Render, `NEXT_PUBLIC_FEATURE_MESSAGING` on Vercel). Both flags must be `false`/unset. See Phase 2B items below for what needs fixing before shipping.

**Automated tests (CI):**
21 API-level Playwright tests run automatically on every push to master and daily at 8 AM UTC via GitHub Actions (`.github/workflows/api-tests.yml`). Tests execute against the production backend.

**DO NOT DELETE the test student account** `playwright-student@phase35test.local` (display name: "rizwantest", ID: `3de0a33b-...`). It is used by the Playwright test suite. Deleting it will break CI.

**Test coverage scope:**
- API-level tests: 21 tests covering reschedule requests, cancellation buffer, admin edit, legacy route gate, homework auth, notification format. These run in CI and catch backend regressions.
- Frontend rendering (modals, WhatsApp buttons, buffer UX): tested manually. No automated browser-level tests.
- Race conditions and concurrency: tested only manually. Serial API tests cannot verify concurrent behaviour.
- Full browser-level Playwright coverage: Phase 4 item if needed. Requires CI with a running dev server.

**Deferred items (Phase 2B):**
- Messaging: fix receiver_id validation, add relationship checks, build supervisor conversation UI
- Exams: POST /exams/:id/assign ownership check, GET /exams/:id/results access control
- Admin route FK existence validation (student_id/teacher_id on create endpoints)
- Course enrollment: feature-flagged off, req.userId fix shipped in Phase 2.5

---

## 19. Known Limitations

- **Password reset does not immediately log out other devices.** When an admin resets a teacher or student's password, any existing login sessions for that person remain valid until their access tokens expire naturally (within 15 minutes). There is no forced logout across all devices on password reset. Strict session invalidation is a future improvement.

- **Welcome email rendering tested in Gmail only.** Outlook and iCloud rendering should be verified before adding teachers or students who use those providers.

- **Lesson durations are limited to 30, 60, 90, or 120 minutes.** If longer or custom durations are needed in future, the dropdown in the session creation form can be extended.

- **The `seed-admin.js` script is preserved for emergency recovery only.** Use the admin UI (`/admin/teachers`, `/admin/students`) for all normal account creation — do not run seed scripts in production unless recovering from data loss.

---

## 20. Email Sending — Test Suppression & Rate Limits

**Recipient guard** (`backend/src/lib/email-guard.js`):
Every email send checks the recipient address before calling Resend. Addresses matching test patterns are silently suppressed with a log line `[EMAIL SUPPRESSED]`. Suppressed patterns include:
- Domains: `@test.local`, `@phase*test.local`, `@example.com`, `@mailinator.com`
- Local parts containing: `playwright-`, `+emailtest`, `+smoketest`, `_test_`, `_phase`

Legitimate addresses (real Gmail, Outlook, etc.) go through normally.

**Circuit breaker** (same file):
If more than 20 emails are sent within 60 seconds, all further sends are refused with `[EMAIL CIRCUIT BREAKER]` until the window clears. This prevents any bug or test loop from exhausting the Resend quota.

**Resend free-tier limit:** 100 emails/day. If real student onboarding exceeds this, upgrade to Resend paid plan (~$20/month for 50k emails). Update `RESEND_API_KEY` in Render environment variables when rotating the key.

**When adding new test addresses:** use one of the suppressed patterns (e.g. `newtest@phase35test.local`) to ensure emails are never sent to test accounts.

---

## 21. Production Polish (Phase 3.7)

Final pre-launch fixes applied:
- **Temp password always visible**: When creating a user or resetting a password, the admin sees a persistent panel with the credentials, email status (sent/failed/suppressed), and a "Share via WhatsApp" button. The password is never lost.
- **Email status reporting**: Backend now returns `email_sent`, `email_status`, and `email_error` on all create/reset routes. Frontend shows warnings when email fails.
- **FreeTrialForm bug fixed**: WhatsApp no longer opens when the form submission fails (was in a `finally` block, now in success branch only).
- **Silent catches eliminated**: 6 admin page catch blocks that silently swallowed errors now show inline error messages or alerts.
- **Session status CHECK constraint**: Migration 012 adds `CHECK (status IN ('scheduled','completed','cancelled','rescheduled','no_show'))` to prevent invalid status values.
- **Homework indexes**: Migration 013 adds indexes on `homework.student_id` and `homework.teacher_id`.
- **WhatsApp number centralised**: All 7 hardcoded instances replaced with `BRAND.whatsapp` (frontend) or `brand.js` (backend).

---

## 22. Weekly Schedules (Phase 4)

Mohammad sets up **weekly recurring schedules** instead of creating sessions one-by-one. Sessions are auto-generated on a rolling 4-week window.

### How to create a schedule

1. Log in as admin/supervisor.
2. Go to the **Supervisor Dashboard** → **Schedules** tab.
3. Click **Add Schedule**.
4. Search for a student (typeahead) and teacher.
5. Enter subject, default duration, and check the days with start times.
6. Optionally set "Lessons remaining" — this gates student access (see Section 23). Sessions still generate regardless, but students with balance 0 cannot join.
7. Optionally paste a **Zoom link** — all generated sessions inherit this link. Students see "Join Session" / "Join Class" buttons automatically. Each session's link can be overridden later via the session edit modal if needed.
8. Click **Create Schedule**. Sessions for the next 4 weeks are generated immediately.

### How schedules work

- **On-demand generation**: Sessions are auto-generated whenever anyone loads a session list (`GET /sessions`) or views schedules in the admin dashboard. Generation is idempotent — most loads are instant no-ops. This replaces the previous cron-based approach.
- **On edit**: If you change the days/times or teacher, all future `scheduled` sessions are deleted and regenerated.
- **Deactivate**: Moves the schedule to "Archived" and removes future sessions. Can be reactivated later.
- **Generate Now**: Button on each schedule card to manually trigger generation.
- **Slot times are London time** (`Europe/London`). The system converts to UTC automatically, including across DST changes.
- **Manual trigger**: `POST /cron/generate-sessions` (requires admin/supervisor JWT auth) can be called to force generation for all schedules.

### 24-hour session accessibility window

Sessions remain in the "upcoming" view on student and teacher dashboards until **24 hours after their scheduled end** (`scheduled_at + duration_minutes + 24h`). This matches Mohammad's requirement: session links stay active so late students can still join, and sessions aren't hidden the instant they start.

The `isSessionStillUpcoming()` utility in `lib/datetime.ts` and `backend/src/lib/datetime.js` centralises this logic. The `bufferHours` parameter defaults to 24 but can be overridden per call if needed.

Destructive operations (deleting future sessions on schedule edit/deactivation, teacher deactivation checks) use strict `scheduled_at > NOW()` — they are not buffered.

### Legacy sessions

Sessions created before Phase 4 have `schedule_id = NULL`. They continue to work normally. A yellow warning banner appears on the Schedules tab if any exist.

---

## 23. Attendance Tracking (Phase 4)

Replaces the old "Mark Completed" button on the teacher dashboard.

### How teachers mark attendance

1. A **Mark Attendance** button appears on session cards from 15 minutes before the session until 24 hours after.
2. Step 1: "Did you attend?" — Yes / No.
3. If Yes → Step 2: "Did the student attend?" — Yes (Completed) / No (No-Show).
4. If teacher says No → session is marked `cancelled_teacher` immediately.

### Status mapping

| Teacher attended | Student attended | Session status |
|---|---|---|
| Yes | Yes | `completed` |
| Yes | No | `no_show` |
| No | — | `cancelled_teacher` |

### Admin override

On the Supervisor Dashboard (Sessions tab), past sessions without attendance show a **Mark Attendance** button. Admin can mark at any time (no time window restriction).

### Lessons remaining (access gate)

`lessons_remaining` on the schedule **gates student access** to sessions:
- **Decrement on `completed`**: teacher and student both attended — lesson consumed.
- **Decrement on `no_show`**: teacher attended but student didn't — lesson slot was consumed.
- **No decrement on `cancelled_teacher`**: teacher didn't attend — lesson not consumed.
- **Balance = 0**: student sees "Your lesson balance is 0. Please contact admin to renew" + WhatsApp button instead of "Join Session". Schedule continues generating sessions but student cannot join.
- **Balance = null**: no limit set — student can always join.
- **Admin notified** when balance hits 0 (notification fires once on the decrement).
- Supervisor dashboard shows colour-coded badges: green (5+), amber (1-4), red (0), grey (null).
- If session is legacy (no schedule), `packages.sessions_remaining` is decremented (existing behaviour).

### Student-facing display priority

The student dashboard and sessions page show a single "lessons remaining" number resolved from:
1. **Active schedules** (sum of `weekly_schedules.lessons_remaining` where `is_active = true`) — used when the student has any active schedule with `lessons_remaining` set
2. **Package fallback** (`packages.sessions_remaining`) — used when no active schedules exist but a package does
3. **None** — no schedules and no package

This is computed at the backend in `GET /students/me` as `schedules_summary.active_lessons_remaining` with a `source` field for debugging. The frontend reads this single resolved field — no priority logic in the frontend. The `package` field remains in the response for billing context (package name, expiry date).

---

## 24. Teacher Salaries (Phase 4)

### Salary page

Navigate to `/admin/salaries` (linked from Supervisor Dashboard → People tab → "Teacher Salaries").

- **Month selector**: left/right arrows to navigate months.
- **Per-teacher row**: sessions attended, total hours, pay rate, calculated salary, no-shows, teacher cancellations.
- **Pay rate editor**: click the rate or "Set pay rate" to edit. Supports GBP, USD, EUR, EGP.
- **Formula**: `salary = total_hours × pay_rate_per_hour`

`/admin/teacher-hours` redirects to `/admin/salaries`.

### Setting pay rates

Via the salary page inline editor, or via API:
```
PATCH /admin/teachers/:id/pay-rate
{ "pay_rate_per_hour": 15.00, "pay_currency": "GBP" }
```

---

## 25. Monitoring (Phase 4)

- **Vercel Analytics**: Installed (`@vercel/analytics`). Page views collected automatically.
- **Sentry**: Backend conditional on `SENTRY_DSN` env var. Set it in Render to activate error tracking.
- **UptimeRobot**: Configure free-tier monitor to ping `GET /health` every 5 min. Also keeps Render warm (no cold starts).

---

## 26. Who Built What

The platform was built by **Razwanul Chowdhury** with AI-assisted development.

**Phase 1 (live at launch)**
- Marketing website (homepage, about, testimonials, packages, free-trial form)
- Student dashboard — sessions, homework, package tracking
- Teacher dashboard — lesson schedule, homework assignment and grading
- Supervisor/admin dashboard — session management, people directory, student payments
- Admin management pages — `/admin/teachers` and `/admin/students` with full CRUD
- Authentication — email/password, JWT refresh tokens, role-based access
- Transactional email via Resend (sends from `noreply@my-institute.com`, domain verified)
- Database on Neon (PostgreSQL), backend on Render, frontend on Vercel

**Phase 2B (built, feature-flagged off)**
- Exam system (teacher creates, student takes with timer)
- Teacher salary tracking
- In-app messaging
- Recorded course catalogue
- Scholarship application and sponsorship flow

**Phase 4 (pre-launch workflow)**
- Weekly recurring schedules with 4-week rolling session generation
- Attendance tracking (replaces Mark Complete) — teacher + student attended, no-show, teacher cancelled
- Teacher salary page with per-teacher pay rate and monthly calculation
- Student/teacher typeahead search (replaces dropdowns)
- On-demand session generation (replaces cron — sessions auto-generate on page load)
- Vercel Analytics integration
- 13 new API tests (schedule CRUD, generation, attendance, salary)

**Third-party services used**
- [Vercel](https://vercel.com) — frontend hosting
- [Render](https://render.com) — backend hosting
- [Neon](https://neon.tech) — PostgreSQL database
- [Resend](https://resend.com) — transactional email
- [Sentry](https://sentry.io) — error tracking (optional, configure DSN to activate)

---

## 27. Phase 4.5 — Architecture Patches (shipped)

**4.5.1 — Lessons remaining as access gate:**
- `lessons_remaining` now gates student access to sessions (previously tracking-only)
- Student with balance 0 sees "contact admin to renew" + WhatsApp button instead of "Join Session"
- Decrements on `completed` AND `no_show` (not `cancelled_teacher`)
- Admin notified when balance hits 0
- Colour-coded badges in supervisor dashboard (green 5+, amber 1-4, red 0)

**4.5.2 — On-demand generation (replaces cron):**
- Sessions auto-generate when any user loads `GET /sessions` or admin views schedules
- Generation is idempotent — most calls are instant no-ops
- No Render Cron Job needed (saves $7/month)
- No CRON_SECRET needed
- Manual trigger stays as `POST /cron/generate-sessions` with JWT auth

---

## 28. Calendar Views (Phase 5.1)

A reusable `<SessionCalendar />` component (`components/shared/SessionCalendar.tsx`) provides week and month calendar views. Read-only display — no drag-to-reschedule.

### Where it appears

- **Student** (`/student/sessions`): List/Calendar toggle at page header. Calendar shows sessions with teacher names.
- **Teacher** (`/teacher/dashboard`): List/Calendar toggle at page header. Calendar shows sessions with student names.
- **Supervisor** (Sessions tab): List/Calendar toggle alongside "Add Session" button. Teacher filter dropdown selects a specific teacher or shows all. Used for visual conflict awareness.

### Features

- **Week view**: 7-column Mon–Sun grid with session pills per day cell
- **Month view**: standard calendar grid, max 3 sessions per cell, "+N more" overflow
- **Status colours**: blue (scheduled), green (completed), grey (cancelled), amber (rescheduled), red (no-show), orange (teacher cancelled)
- **Dual timezone**: each session shows London time + Cairo time
- **Navigation**: prev/next buttons, "Today" button, week/month toggle
- **Accessibility**: aria-labels on all session pills with full context (date, time, status, subject, name)
- **Status legend**: colour-coded pills shown below the controls

---

## 29. Supervisor Session Filters and Grouping (Phase 5.2)

The supervisor Sessions tab now has filtering and week-based grouping.

### Filter bar

Above the session list, a filter bar provides:
- **Teacher dropdown**: filter to a specific teacher's sessions
- **Student search**: typeahead filter by student name (reuses `UserSearchInput`)
- **Status toggles**: pill buttons for each status (scheduled, completed, cancelled, rescheduled, no-show, teacher cancelled). Click to toggle on/off.
- **Clear button**: resets all filters (shown only when filters are active)
- **Session count**: shows how many sessions match current filters

### Week grouping

Sessions are grouped by ISO week (Mon–Sun):
- Current week is highlighted with a green dot and bold label
- Future weeks shown chronologically
- Past sessions collapsed under a "Past sessions (N)" toggle

### URL persistence

Filters persist in URL search params: `?teacher=uuid&student=uuid&status=scheduled,completed`. Refreshing the page restores filters. URL updates on every filter change.

### Calendar integration

The List/Calendar view toggle applies filters to both views. In calendar mode, an additional teacher dropdown lets you focus on a specific teacher's schedule for conflict awareness.
