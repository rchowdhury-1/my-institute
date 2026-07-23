# MY Institute

Online Quran, Arabic & Islamic Studies tutoring platform, live at [my-institute.com](https://www.my-institute.com). Built in partnership with Sheikh Mohammad Youssef, who operates the institute; teachers are based in Egypt, students worldwide.

The repo contains two deployables:

| Part | Stack | Hosted on |
|---|---|---|
| Frontend (this directory) | Next.js 14 App Router, TypeScript, Tailwind CSS | Vercel |
| Backend (`/backend`) | Node.js / Express, PostgreSQL (Neon) | Render |

The frontend is both the public marketing site and the logged-in portals (student, teacher, supervisor/admin). The backend is a REST API — see [`backend/README.md`](backend/README.md) for its full documentation. Day-to-day operations (adding users, logging payments, rotating passwords) are covered in plain English in [`HANDOVER.md`](HANDOVER.md).

---

## How the platform works

**Roles.** `student`, `teacher`, `admin`, `supervisor`. All accounts are provisioned by the admin from the dashboard (temp password + WhatsApp share); there is no self-serve signup flow in the UI.

**Weekly schedules → sessions.** The core scheduling model. An admin creates a *weekly schedule* for a student–teacher pair (subject, zoom link, one or more day/time slots, hours balance). Individual `sessions` rows are auto-generated from the schedule on a rolling 4-week window. Generation is **on-demand and idempotent** — it runs lazily inside the session-listing endpoints, so there is no cron dependency; if sessions are missing, the next page load fills the gap. One-off sessions can also be created directly.

**Hours balance.** Each schedule carries `lessons_remaining` — despite the legacy column name, this is a **decimal balance of hours** (`NUMERIC(6,2)`, migration 020). Marking attendance decrements it by the session's `duration_minutes / 60` (a 30-minute session costs 0.5). The balance is an access gate: at ≤ 0 the student's Join button is replaced with a "contact admin to renew" message, and the admin is notified. The field is required (min 0.5, steps of 0.5) when creating a schedule.

**Attendance.** Two-axis check-in (teacher attended? student attended?) with three outcomes: `completed` and `no_show` consume hours; `cancelled_teacher` does not.

**Join window.** A session's Join button is active from **15 minutes before start until 3 hours after start** (`isSessionJoinable` in `lib/datetime.ts`), with clock-skew correction against a `server_time` field in API responses so a mis-set device clock can't lock a teacher out. Sessions remain visible in "upcoming" lists until 3 hours after their *end* (`isSessionStillUpcoming`) — deliberately a separate predicate.

**Timezones.** All instants are stored as UTC (`TIMESTAMPTZ`). Schedule slot times and admin form inputs are interpreted in a single operational timezone, `OPERATIONAL_TZ = 'Africa/Cairo'` (defined in both `backend/src/lib/schedule-generator.js` and `lib/datetime.ts` — the two must stay in sync). Admin time inputs are labelled "Egypt time" with a live UK-time hint; student/teacher-facing times display dual London/Cairo. If `OPERATIONAL_TZ` ever changes, the manual **Regenerate Sessions** GitHub workflow must be run immediately after deploy (see `HANDOVER.md` §22).

**Salaries.** Per-teacher hourly pay rates on the `users` table; `/admin/salaries` shows monthly attended hours × rate.

---

## Pages

### Public site

`/` (homepage), `/about`, `/packages`, `/free-trial`, `/scholarship`, `/donate`, `/recorded-courses`, `/testimonials`, `/community`, `/learn-about-islam`, `/login`. Public forms (free trial, scholarship, contact) submit through Next.js API routes (`app/api/*`) that email via Resend and deep-link to WhatsApp. Site copy is centralised in `lib/content.ts`; the nav also links Mohammad's external Student Exam Portal (`EXAM_PORTAL_URL`).

### Portals

| Route | Who | What |
|---|---|---|
| `/student/dashboard` | student | Hours balance, upcoming lessons, join buttons, exam portal link |
| `/student/sessions` | student | Full session list + calendar tab |
| `/student/homework`, `/student/exams`, `/student/messages` | student | Homework; exams/messages are feature-flagged off |
| `/teacher/dashboard` | teacher | Today's schedule, attendance check-in, calendar tab |
| `/teacher/homework`, `/teacher/exams`, `/teacher/messages`, `/teacher/payments` | teacher | Homework grading; rest feature-flagged |
| `/supervisor` | admin/supervisor | Main operations surface: weekly schedules, sessions with filters/calendar, one-off session forms |
| `/admin/students`, `/admin/teachers` | admin | Account provisioning, deactivate/reactivate, payments |
| `/admin/salaries` | admin | Teacher pay rates and monthly salary view (`/admin/teacher-hours` redirects here) |
| `/admin/newsfeed`, `/admin/cms`, `/admin/scholarships`, `/admin/revert-applications`, `/admin/courses`, `/admin/payments` | admin | Content + application management |

Shared UI lives in `components/` — notably `components/shared/SessionCalendar.tsx` (week/month calendar reused across all three portals).

---

## Getting started

### Frontend

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev                  # http://localhost:3000
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g. `http://localhost:5000`) |
| `RESEND_API_KEY` | Resend key for the public-form email routes |
| `CONTACT_EMAIL` | Recipient for form submissions |

### Backend

```bash
cd backend
npm install
cp .env.example .env         # then fill in values
npm run dev                  # http://localhost:5000 (nodemon)
```

On startup `initDb()` applies every SQL file in `backend/migrations/` that isn't yet recorded in the `migrations_applied` table — migrations run automatically on deploy, there is no separate migrate step. Seed the first admin with `node seed-admin.js` (requires `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars).

Backend env vars, API reference, and implementation notes: [`backend/README.md`](backend/README.md).

---

## Auth model

- Login returns a 15-minute access JWT in the response body (held in `localStorage`) and sets a 7-day refresh token as an httpOnly cookie; refresh tokens are stored server-side and re-check the user's role on each refresh.
- Next.js `middleware.ts` routes users to the right portal from a `userRole` cookie — this is **UI routing only**; every backend endpoint independently enforces `requireAuth` / `requireRole`.
- New accounts get a temp password with `must_change_password` — first login forces `/change-password`.

## Feature flags

Backend route trees for exams, teacher-salary payments, messaging, recorded courses, and scholarship sponsorship are mounted behind env-var flags (`FEATURE_EXAMS`, `FEATURE_TEACHER_SALARY`, `FEATURE_MESSAGING`, `FEATURE_RECORDED_COURSES`, `FEATURE_SCHOLARSHIP_SPONSORSHIP`) and return 404 unless the var is `'true'`. The corresponding frontend pages exist but are dormant while flags are off.

## Testing & CI

- **API/e2e tests** — Playwright specs in `e2e/` (10 files) run against a live backend: `npx playwright test`. Credentials come from `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` env vars (never hardcoded).
- **Unit tests** — `npx tsx lib/datetime.test.ts` covers the join-window, clock-skew, and timezone round-trip logic.
- **CI** — `.github/workflows/api-tests.yml` runs the core API suite (`e2e/reschedule-and-buffer.spec.ts`, 27 tests) against the production backend on push/PR to master, with a Render cold-start warm-up step; the other specs are run locally. `regenerate-sessions.yml` is a manual-only maintenance job for after an `OPERATIONAL_TZ` change.

## Deployment

Vercel (frontend) and Render (backend) both deploy automatically on push to `master`. For changes touching both sides, deploy **backend first** (migrations auto-apply on boot), smoke-test, then frontend. Sentry is wired on both sides, active when `SENTRY_DSN` is set.
