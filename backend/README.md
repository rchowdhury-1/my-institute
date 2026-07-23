# MY Institute — Backend API

Express REST API for the MY Institute tutoring platform. Deployed on Render, backed by Neon PostgreSQL. Consumed by the Next.js frontend in the repo root — see the [root README](../README.md) for the platform overview and [`../HANDOVER.md`](../HANDOVER.md) for day-to-day operations.

## Overview

- **Runtime:** Node.js 18+ / Express 4
- **Database:** PostgreSQL via `pg` (Neon pooler URL)
- **Auth:** JWT — 15-min access tokens (Bearer header) + 7-day refresh tokens (httpOnly cookie, stored server-side in `refresh_tokens`)
- **Email:** Resend (verification, credentials, notifications) with a circuit breaker (`src/lib/email-guard.js`, max 20 sends/60s) as a runaway-loop backstop
- **Errors:** Sentry (active only when `SENTRY_DSN` is set); global handler returns generic 500s, never stack traces

## Running locally

```bash
cd backend
npm install
cp .env.example .env   # fill in values
npm run dev            # nodemon, http://localhost:5000
```

`GET /health` reports server + DB status.

### Migrations

`initDb()` runs before the server listens: it applies every `backend/migrations/*.sql` file not yet recorded in the `migrations_applied` table, in filename order. There is no separate migrate command — a deploy applies pending migrations automatically. 20 migrations to date; `migrations_applied` is the source of truth for what has run.

### Seeding the first admin

```bash
SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... node seed-admin.js
```

Credentials come from env vars only — nothing is hardcoded. The seeded admin has `must_change_password` set.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string (pooler URL) |
| `JWT_SECRET` | Yes | Access-token secret — `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Yes | Refresh-token secret — generate separately |
| `CLIENT_URL` | Yes | Frontend URL — CORS allow-list + email redirects |
| `FRONTEND_URL` | No | Additional CORS origin (e.g. the www domain) |
| `BACKEND_URL` | Yes | This server's public URL — used in verification links |
| `RESEND_API_KEY` | No | Resend key; without it, emails are disabled (logged at boot). Sender address is hardcoded in `src/email.js` (`noreply@my-institute.com`) |
| `CONTACT_EMAIL` | No | Admin recipient for notification emails |
| `WHATSAPP_NUMBER` | No | Institute WhatsApp number (fallback in `src/lib/brand.js`) |
| `PORT` | No | Defaults to `5000` |
| `SENTRY_DSN` | No | Enables Sentry error tracking |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | seed only | Required by `seed-admin.js` |
| `FEATURE_EXAMS`, `FEATURE_TEACHER_SALARY`, `FEATURE_MESSAGING`, `FEATURE_RECORDED_COURSES`, `FEATURE_SCHOLARSHIP_SPONSORSHIP` | No | Feature flags — the route tree 404s unless set to `'true'` |

## Auth & authorization

`src/middleware/auth.js` provides `requireAuth` (verifies the Bearer token) and `requireRole(...roles)`. Every protected router mounts them; ownership checks (a teacher can only touch their own sessions/students, a student their own data) are enforced per-handler in the session, homework, and reschedule flows. Roles: `student`, `teacher`, `admin`, `supervisor`. Refresh re-reads the role from the DB, so a demoted user loses privilege within 15 minutes.

## API reference

Feature-flagged mounts are marked ⚑ — they 404 unless their flag is `'true'`.

### `/auth`
| Method | Route | Description |
|---|---|---|
| POST | `/auth/register` | Registration — public callers get `student`; `teacher`/`admin`/`supervisor` requires an admin JWT |
| POST | `/auth/login` | Login → access token in body, refresh cookie set |
| GET | `/auth/verify-email` | Email verification link target |
| POST | `/auth/refresh` | New access token from refresh cookie |
| POST | `/auth/logout` | Revoke refresh token |
| POST | `/auth/change-password` | Change own password (clears `must_change_password`) |
| GET | `/auth/me` | Current user profile |

### `/students`, `/teachers` (self-service)
| Method | Route | Description |
|---|---|---|
| GET | `/students/me` | Profile + `schedules_summary` (hours balance) + upcoming lessons |
| GET | `/students/lessons` | Full session history (includes `server_time` for clock-skew correction) |
| GET | `/students/payments` | Own payment records |
| GET | `/teachers/me` | Teacher profile |
| GET | `/teachers/students` | The teacher's students |
| GET | `/teachers/lessons` | Full schedule (includes `server_time`) |
| PATCH | `/teachers/lessons/:id` | Update lesson status / notes |

### `/sessions`
| Method | Route | Description |
|---|---|---|
| GET | `/sessions` | List sessions (role-scoped; triggers on-demand generation) |
| POST | `/sessions` | Create a one-off session (admin/supervisor) |
| PATCH | `/sessions/:id` | Edit session (time, zoom link override) |
| DELETE | `/sessions/:id` | Delete (nullifies reschedule children first) |
| PATCH | `/sessions/:id/cancel` | Cancel |
| PATCH | `/sessions/:id/reschedule` | Direct reschedule |
| PATCH | `/sessions/:id/attendance` | Two-axis attendance check-in — **decrements the schedule's hours balance** by `duration_minutes / 60` on `completed` / `no_show` |
| PATCH | `/sessions/:id/complete` | Legacy (deprecated, pre-attendance; decrements package counters only) |

### `/admin/weekly-schedules`
| Method | Route | Description |
|---|---|---|
| GET | `/` , `/:id` | List / detail (triggers on-demand generation) |
| POST | `/` | Create schedule — `lessons_remaining` (hours) is **required**, min 0.5, steps of 0.5 |
| PATCH | `/:id` | Edit (slot/zoom changes wipe + regenerate future sessions) |
| DELETE | `/:id` | Deactivate (soft — archived, future sessions wiped) |
| POST | `/:id/reactivate` | Reactivate + regenerate |
| POST | `/:id/generate` | Manual generation for one schedule |

### `/admin`
Account provisioning and operations. Students/teachers: list, create (temp password returned once), `PATCH /:id` (edit, deactivate/reactivate via `is_active`), `POST /:id/reset-password`; `PATCH /teachers/:id/pay-rate`. Plus packages (`POST/PATCH /packages`), student payments (`GET/POST /payments/student`), free trials and scholarship applications (list + status PATCH), revert applications, sessions overview (`GET /sessions`, `POST /lessons`, `PATCH /sessions/:id`), newsfeed CRUD, and salary data (`GET /teacher-hours`).

### `/reschedule-requests`
Student-proposed reschedules: `POST /` (propose), `GET /` (list, role-scoped), `PATCH /:id/approve`, `PATCH /:id/reject`, `DELETE /:id` (withdraw). One pending request per session (partial unique index).

### `/cron`
| Method | Route | Description |
|---|---|---|
| POST | `/cron/generate-sessions` | Manual generation sweep (admin/supervisor JWT) |
| POST | `/cron/regenerate-all` | Wipe + regenerate future sessions for **all** active schedules — destructive; only needed after an `OPERATIONAL_TZ` change (run via the "Regenerate Sessions" GitHub workflow) |

Despite the name, no cron job calls these — generation is on-demand (see below).

### Other mounts
- `/homework` — create, list, submissions, `POST /:id/submit`, `PATCH /:id/grade`
- `/notifications` — list, `PATCH /:id/read`, `PATCH /read-all`
- `/newsfeed` (public read), `/cms` (homepage sections; admin write)
- `/scholarship-apply`, `/revert-apply` — public form intake (unauthenticated POST)
- ⚑ `/exams` — create/list/assign/start/submit/results (`FEATURE_EXAMS`)
- ⚑ `/payments` — teacher salary statements (`FEATURE_TEACHER_SALARY`)
- ⚑ `/messages` — conversations/DMs (`FEATURE_MESSAGING`)
- ⚑ `/courses` — recorded courses + enrollment (`FEATURE_RECORDED_COURSES`)
- ⚑ `/scholarships` — sponsor matching (`FEATURE_SCHOLARSHIP_SPONSORSHIP`)

## Key implementation notes

**Session generation** (`src/lib/schedule-generator.js`). Sessions materialize from weekly-schedule slots over a rolling 4-week window. Generation runs lazily inside `GET /sessions` and the weekly-schedule reads — idempotent (dedup by schedule + slot-local date/time), self-healing, no scheduler infrastructure. Per-slot `duration` overrides the schedule default and is stamped onto `sessions.duration_minutes`.

**`OPERATIONAL_TZ`** (top of `schedule-generator.js`, currently `'Africa/Cairo'`). Slot wall-clock times and the dedup query are anchored to this zone; storage is always UTC `TIMESTAMPTZ`. The frontend has a matching constant in `lib/datetime.ts` — **change both together**, then run `POST /cron/regenerate-all` immediately after deploy, or on-demand generation will duplicate every future session at the shifted instants.

**Hours balance.** `weekly_schedules.lessons_remaining` is `NUMERIC(6,2)` **hours** (legacy column name kept deliberately — renaming would break the deployed frontend's API contract). The attendance handler decrements by `duration_minutes / 60`, clamped at 0; hitting 0 notifies the admin, ≤ 2 hours triggers a renewal reminder.

**pg NUMERIC parsing.** `src/db.js` registers a global type parser converting `NUMERIC` columns to JS numbers (node-postgres returns them as strings by default). All numeric API fields are real JSON numbers; a CI test guards this.

**Notifications** (`src/lib/notify.js`) fan out in-app rows (and email where configured) on session/schedule events. Generation errors inside listing routes are caught and logged rather than failing the request — surfaced via Sentry when configured.

**Schema.** 25 tables. Money is `DECIMAL`, statuses have CHECK constraints, FKs index every hot path; `sessions.rescheduled_from` is `ON DELETE SET NULL` (migration 019). The legacy `lessons` table was dropped in migration 017.

## Tests

The Playwright specs in `../e2e/` exercise this API directly (auth, schedules, sessions, attendance, reschedules, homework, admin flows). They run against a live backend URL (`API_URL`) with credentials from `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` env vars; CI runs the core suite (`reschedule-and-buffer.spec.ts`) against production on every push to master.
