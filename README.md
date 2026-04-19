# My Institute

Online Quran, Arabic & Islamic Studies learning centre — Next.js 14 frontend with an Express/PostgreSQL backend.

## Stack

### Frontend
- **Framework**: Next.js 14 (App Router, TypeScript)
- **Styling**: Tailwind CSS with custom design tokens
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **HTTP**: Axios
- **Email**: Resend
- **Deployment**: Vercel

### Backend (`/backend`)
- **Runtime**: Node.js / Express
- **Database**: PostgreSQL (Neon)
- **Auth**: JWT (access + refresh tokens, httpOnly cookies)
- **Email**: Resend
- **Deployment**: Render

---

## Getting Started

### Frontend

```bash
npm install
cp .env.example .env.local
# fill in .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Backend

```bash
cd backend
npm install
cp .env.example .env
# fill in .env
node index.js
```

Backend runs on [http://localhost:5000](http://localhost:5000). On first start, `initDb()` runs the migration at `backend/migrations/001_init.sql` automatically.

---

## Environment Variables

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g. `http://localhost:5000`) |
| `RESEND_API_KEY` | Resend API key for frontend form email notifications |
| `CONTACT_EMAIL` | Email address to receive form submissions |

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon pooler URL) |
| `JWT_SECRET` | Access token secret — generate with `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Refresh token secret — generate with `openssl rand -hex 32` |
| `RESEND_API_KEY` | Resend API key for verification and notification emails |
| `EMAIL_FROM` | Sender address (e.g. `noreply@yourdomain.com`) |
| `CONTACT_EMAIL` | Admin email for notifications |
| `PORT` | Server port (default `5000`) |
| `CLIENT_URL` | Frontend URL for CORS and email redirects |
| `BACKEND_URL` | Backend public URL for email verification links |

---

## Pages & Routes

### Frontend

| Route | Description |
|---|---|
| `/` | Homepage — Hero, Services, Why Choose Us, Pricing, Testimonials, CTA |
| `/about` | About page |
| `/packages` | Packages & pricing with FAQ |
| `/free-trial` | Free trial booking form (WhatsApp redirect on submit) |
| `/scholarship` | Scholarship application form (WhatsApp redirect on submit) |
| `/donate` | Donations page |
| `/recorded-courses` | Recorded course details |
| `/testimonials` | Video testimonials |
| `/login` | Student / teacher login |
| `/student/dashboard` | Student portal — package, upcoming lessons, history |
| `/teacher/dashboard` | Teacher portal — today's schedule, mark complete, add notes |

### Backend API

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Register (role defaults to `student`; `teacher`/`admin` requires admin JWT) |
| POST | `/auth/login` | — | Login, sets `refreshToken` httpOnly cookie |
| GET | `/auth/verify-email` | — | Email verification |
| POST | `/auth/refresh` | cookie | Refresh access token |
| POST | `/auth/logout` | cookie | Clear refresh token |
| GET | `/auth/me` | Bearer | Current user profile |
| GET | `/students/me` | student | Profile + active package + upcoming lessons |
| GET | `/students/lessons` | student | Full lesson history |
| GET | `/teachers/me` | teacher | Teacher profile |
| GET | `/teachers/lessons` | teacher | Full lesson schedule |
| PATCH | `/teachers/lessons/:id` | teacher | Update lesson status / notes |
| GET | `/admin/students` | admin | All students with packages |
| GET | `/admin/teachers` | admin | All teachers |
| GET | `/admin/free-trials` | admin | Free trial submissions |
| PATCH | `/admin/free-trials/:id` | admin | Update free trial status |
| GET | `/admin/scholarships` | admin | Scholarship applications |
| PATCH | `/admin/scholarships/:id` | admin | Update scholarship status |
| POST | `/admin/lessons` | admin | Schedule a lesson |

---

## Database Schema

Six tables, auto-created on startup from `backend/migrations/001_init.sql`:

- **users** — `id`, `email`, `display_name`, `role` (student/teacher/admin), `phone`, `email_verified`
- **refresh_tokens** — JWT refresh token store
- **lessons** — student ↔ teacher bookings with subject, time, status, notes
- **packages** — student lesson packages (simple/pro/elite)
- **free_trials** — free trial form submissions
- **scholarship_applications** — scholarship form submissions

---

## Auth Flow

1. Register → verification email sent via Resend
2. Verify email → redirect to `/login`
3. Login → access token (15 min) returned in body, refresh token (7 days) set as httpOnly cookie
4. Next.js middleware checks `refreshToken` cookie to protect `/student/*` and `/teacher/*`
5. Dashboard pages attach `Authorization: Bearer <token>` from `localStorage`

---

## Updating Content

All public-facing site content lives in `lib/content.ts`:

- Brand name, email, phone, WhatsApp number, social links
- Services, pricing packages, about text, FAQ answers
- Testimonial YouTube video IDs (replace `PLACEHOLDER_*` with real IDs)

---

## TODO

- [ ] Replace `PLACEHOLDER_*` YouTube video IDs in `lib/content.ts`
- [ ] Update `metadataBase` in `app/layout.tsx` to production domain
- [ ] Update `BASE_URL` in `app/sitemap.ts` to production domain
- [ ] Integrate Stripe on the donations page (`app/donate/DonateClient.tsx`)
- [ ] Add token refresh interceptor to `lib/api.ts` for seamless access token renewal
- [ ] Admin dashboard UI (`/admin`)
