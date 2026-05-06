# MY Institute — Handover Notes

Plain-English guide for running and maintaining the platform.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Logging In as Admin](#2-logging-in-as-admin)
3. [Rotating the Admin Password](#3-rotating-the-admin-password)
4. [Environment Variables](#4-environment-variables)
5. [How to Add a Teacher or Student](#5-how-to-add-a-teacher-or-student)
6. [First Login Experience](#6-first-login-experience)
7. [How to Log a Student Payment](#7-how-to-log-a-student-payment)
8. [How to Add a Session with a Zoom Link](#8-how-to-add-a-session-with-a-zoom-link)
9. [If WhatsApp Notifications Stop Working](#9-if-whatsapp-notifications-stop-working)
10. [Enabling Phase 2B Features](#10-enabling-phase-2b-features)
11. [Known Limitations](#11-known-limitations)
12. [Who Built What](#12-who-built-what)

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

**Option A — via the Neon console (recommended)**

1. Log into [Neon](https://console.neon.tech) and open the MY Institute project.
2. Click **SQL Editor** in the left menu.
3. Run the following query, replacing `YOUR_NEW_PASSWORD` with a strong password:

```sql
UPDATE users
SET password_hash = crypt('YOUR_NEW_PASSWORD', gen_salt('bf', 12))
WHERE email = 'razwanul712@gmail.com';
```

> If `crypt` is not available, ask a developer to run `node seed-admin.js` after updating the password in that file, **then remove the password from the file immediately**.

**Option B — via the backend (developer step)**

SSH into the Render service or open a Render shell, then run:

```bash
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
bcrypt.hash('YOUR_NEW_PASSWORD', 12).then(hash => {
  pool.query('UPDATE users SET password_hash = \$1 WHERE email = \$2', [hash, 'razwanul712@gmail.com'])
    .then(() => { console.log('Done'); pool.end(); });
});
"
```

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
| `RESEND_API_KEY` | Email sending (welcome emails to new teachers/students). Leave blank to disable — credentials are still shown on screen so you can share them manually. |
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

## 5. How to Add a Teacher or Student

Use the admin dashboard — no developer or Render shell access needed.

### Adding a teacher

1. Log in as admin and go to **Manage Teachers** (link in the Supervisor Dashboard → People tab, or go directly to `/admin/teachers`).
2. Click **Add Teacher**.
3. Fill in: full name (required), email address (required), phone number, subject/specialisation, short bio.
4. Either enter a password or click **Generate for me** — a secure random password will be created.
5. Make sure **"Email login details to this teacher"** is checked if you want them to receive their credentials by email.
6. Click **Add Teacher**.

A green banner will appear showing the temporary password — **copy it before navigating away**. The teacher will be asked to set a new password when they first log in.

### Adding a student

1. Go to **Manage Students** (link in the Supervisor Dashboard → People tab, or go directly to `/admin/students`).
2. Click **Add Student**.
3. Fill in: full name, email address, hourly rate (required), and any other optional details.
4. If the student has paid a prepaid bundle upfront, expand **"+ Add a prepaid bundle"** and fill in the bundle label, number of lessons, and expiry date.
5. Click **Add Student**.

### If welcome emails are not being received

Welcome emails require the `RESEND_API_KEY` to be set in Render. If it is not configured, emails are silently skipped — but the temporary password is still shown on screen in the green banner. You can share it manually via WhatsApp or any other method.

To activate emails: add your Resend API key to **Render → Service → Environment → `RESEND_API_KEY`**, then redeploy.

---

## 6. First Login Experience

When a teacher or student logs in for the first time after being added by an admin, they will be taken to a **Set Your Password** page instead of their dashboard. They must enter a new password (at least 8 characters) before they can access anything else.

After setting their password, they are taken straight to their dashboard.

If a teacher or student forgets their temporary password before logging in for the first time, an admin can generate a new one from their card on the Manage Teachers or Manage Students page — click **Reset password**.

> **Note for the admin:** Each teacher/student card shows an amber "Awaiting first login" badge until they complete their first login. This badge disappears once they set their password.

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
4. Fill in: student, teacher, date/time, duration, subject.
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
| **Scholarship & donations** | `NEXT_PUBLIC_FEATURE_SCHOLARSHIP_SPONSORSHIP` | `FEATURE_SCHOLARSHIP_SPONSORSHIP` | Public scholarship application form, donor/sponsor flow, admin applicant management. Pages: `/scholarship`, `/donate`, `/admin/scholarships`. |

When a flag is `false`:
- **Frontend**: navigating to those URLs redirects to the homepage.
- **Backend**: all API calls to those routes return `404 Not found`.

---

## 11. Known Limitations

**Password reset does not immediately log out other devices.**
When an admin resets a teacher or student's password, any existing login sessions for that person remain valid until their access tokens expire naturally (within 15 minutes). There is no forced logout across all devices on password reset. This is a known limitation — strict session invalidation on password reset is a future improvement.

---

## 12. Who Built What

The platform was built by **Razwanul Chowdhury** with AI-assisted development.

**Phase 1 (live at launch)**
- Marketing website (homepage, about, testimonials, packages, free-trial form)
- Student dashboard — sessions, homework, package tracking
- Teacher dashboard — lesson schedule, homework assignment and grading
- Supervisor/admin dashboard — session management, people directory, student payments
- Authentication — email/password, JWT refresh tokens, role-based access
- Transactional email via Resend
- Database on Neon (PostgreSQL), backend on Render, frontend on Vercel

**Phase 2B (built, feature-flagged off)**
- Exam system (teacher creates, student takes with timer)
- Teacher salary tracking
- In-app messaging
- Recorded course catalogue
- Scholarship application and sponsorship flow

**Third-party services used**
- [Vercel](https://vercel.com) — frontend hosting
- [Render](https://render.com) — backend hosting
- [Neon](https://neon.tech) — PostgreSQL database
- [Resend](https://resend.com) — transactional email
- [Sentry](https://sentry.io) — error tracking (optional, configure DSN to activate)
