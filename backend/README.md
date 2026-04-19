# FreelancerCRM — Backend API

Node.js + Express REST API powering the FreelancerCRM application. Handles authentication, client/project/invoice management, Stripe payments, PDF generation, and email delivery.

---

## Overview

- **Runtime:** Node.js with Express
- **Database:** PostgreSQL via `pg` (connection pooling via Supabase Transaction Pooler)
- **Auth:** JWT access tokens (15 min) + refresh tokens (7 days, httpOnly cookie)
- **Payments:** Stripe Checkout + webhook signature verification
- **Email:** Resend with HTML emails and PDF attachments
- **PDF:** PDFKit — generates styled A4 invoices in memory

---

## Running Locally

### Prerequisites

- Node.js 18+
- A PostgreSQL database (Supabase free tier recommended)

### Steps

```bash
cd backend
cp .env.example .env
# Fill in your .env values
npm install
npm run dev
```

Server starts on `http://localhost:5000` (or `PORT` from `.env`).

On startup, `initDb()` runs `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements automatically — no separate migration step needed.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Port to listen on. Defaults to 5000 |
| `NODE_ENV` | Yes | `development` or `production`. Controls SSL and cookie settings |
| `DATABASE_URL` | Yes | Full PostgreSQL connection string. Use Supabase Transaction Pooler URL on port **6543** |
| `JWT_SECRET` | Yes | Secret for signing JWT access tokens. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `REFRESH_SECRET` | Yes | Secret for signing refresh tokens. Generate separately from JWT_SECRET |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |
| `RESEND_API_KEY` | Yes | Resend API key (`re_...`) |
| `EMAIL_FROM` | No | Sender address. Defaults to `onboarding@resend.dev` |
| `BACKEND_URL` | Yes | Full URL of this server — no trailing slash. Used in verification email links |
| `CLIENT_URL` | Yes | Full frontend URL — no trailing slash. Used for CORS and post-verification redirects |

---

## Database Schema

All tables are created automatically on first startup via `initDb()` in `src/db.js`.

### `users`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `name` | TEXT | Required |
| `email` | TEXT | Unique |
| `password_hash` | TEXT | bcrypt hash |
| `created_at` | TEXT | ISO timestamp |
| `email_verified` | BOOLEAN | Defaults to `false`. Must be `true` to log in |
| `verification_token` | TEXT | Cleared after email is verified |

### `refresh_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `token` | TEXT | Unique. The JWT refresh token value |
| `user_id` | TEXT | FK → users |
| `expires_at` | TEXT | ISO timestamp |
| `created_at` | TEXT | ISO timestamp |

### `clients`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `user_id` | TEXT | FK → users (cascade delete) |
| `name` | TEXT | Required |
| `email` | TEXT | Optional |
| `phone` | TEXT | Optional |
| `company` | TEXT | Optional |
| `notes` | TEXT | Optional |
| `created_at` | TEXT | ISO timestamp |

### `projects`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `user_id` | TEXT | FK → users (cascade delete) |
| `client_id` | TEXT | FK → clients (set null on delete) |
| `title` | TEXT | Required |
| `description` | TEXT | Optional |
| `status` | TEXT | `not_started` / `in_progress` / `completed` |
| `rate` | NUMERIC | Optional |
| `rate_type` | TEXT | `hourly` or `fixed` |
| `deadline` | TEXT | ISO date string, optional |
| `created_at` | TEXT | ISO timestamp |

### `invoices`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `user_id` | TEXT | FK → users (cascade delete) |
| `client_id` | TEXT | FK → clients (set null on delete) |
| `project_id` | TEXT | FK → projects (set null on delete) |
| `invoice_number` | TEXT | Auto-generated: `INV-YYYYMM-XXXX` |
| `status` | TEXT | `draft` / `sent` / `paid` / `overdue` |
| `due_date` | TEXT | ISO date string, optional |
| `total` | NUMERIC | Computed from line items on create/update |
| `created_at` | TEXT | ISO timestamp |

### `invoice_items`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `invoice_id` | TEXT | FK → invoices (cascade delete) |
| `description` | TEXT | Required |
| `quantity` | NUMERIC | Required |
| `unit_price` | NUMERIC | Required |

### `payments`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT | UUID primary key |
| `invoice_id` | TEXT | FK → invoices (cascade delete) |
| `amount` | NUMERIC | Amount paid in USD |
| `stripe_session_id` | TEXT | Stripe Checkout session ID |
| `paid_at` | TEXT | ISO timestamp |

---

## API Reference

All protected routes require an `Authorization: Bearer <accessToken>` header.

---

### Auth — `/auth`

#### `POST /auth/register`

Register a new user. Sends a verification email — user cannot log in until verified.

**Auth required:** No

**Request body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "mypassword123"
}
```

**Response `201`:**
```json
{
  "message": "Registration successful. Please check your email to verify your account."
}
```

**Errors:** `400` missing fields or password too short, `409` email already registered

---

#### `GET /auth/verify-email?token=<token>`

Verifies the user's email using the token from the verification email. Redirects to the frontend login page with `?verified=true` or `?verified=invalid`.

**Auth required:** No

---

#### `POST /auth/login`

Log in with email and password. Returns an access token and sets a refresh token cookie.

**Auth required:** No

**Request body:**
```json
{
  "email": "jane@example.com",
  "password": "mypassword123"
}
```

**Response `200`:**
```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "uuid",
    "name": "Jane Smith",
    "email": "jane@example.com"
  }
}
```

Sets `refreshToken` httpOnly cookie (7 days).

**Errors:** `401` invalid credentials, `403` email not verified

---

#### `POST /auth/refresh`

Exchange the refresh token cookie for a new access token.

**Auth required:** No (uses httpOnly cookie automatically)

**Response `200`:**
```json
{
  "accessToken": "<new-jwt>"
}
```

**Errors:** `401` missing, invalid, or expired refresh token

---

#### `POST /auth/logout`

Invalidates the refresh token and clears the cookie.

**Auth required:** No

**Response `200`:**
```json
{ "message": "Logged out" }
```

---

#### `GET /auth/me`

Get the currently authenticated user's profile.

**Auth required:** Yes

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

---

#### `PUT /auth/profile`

Update the authenticated user's name and/or email.

**Auth required:** Yes

**Request body:**
```json
{
  "name": "Jane Updated",
  "email": "jane.updated@example.com"
}
```

**Response `200`:**
```json
{
  "user": {
    "id": "uuid",
    "name": "Jane Updated",
    "email": "jane.updated@example.com",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

**Errors:** `409` email already in use by another account

---

#### `PUT /auth/password`

Change the authenticated user's password.

**Auth required:** Yes

**Request body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

**Response `200`:**
```json
{ "message": "Password updated" }
```

**Errors:** `401` current password incorrect, `400` new password too short

---

### Clients — `/clients`

All routes require auth. Users only see and modify their own clients.

#### `GET /clients`

**Response `200`:**
```json
{
  "clients": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "Acme Corp",
      "email": "contact@acme.com",
      "phone": "+1 555 0100",
      "company": "Acme Corp",
      "notes": "Key account",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### `POST /clients`

**Request body:**
```json
{
  "name": "Acme Corp",
  "email": "contact@acme.com",
  "phone": "+1 555 0100",
  "company": "Acme Corp",
  "notes": "Key account"
}
```

Only `name` is required. All other fields are optional.

**Response `201`:**
```json
{ "client": { ...clientObject } }
```

---

#### `PUT /clients/:id`

Same body as POST. All fields required in body (pass existing values to preserve them).

**Response `200`:**
```json
{ "client": { ...clientObject } }
```

**Errors:** `404` not found or not owned by user

---

#### `DELETE /clients/:id`

**Response `200`:**
```json
{ "message": "Client deleted" }
```

**Errors:** `404` not found or not owned by user

---

### Projects — `/projects`

All routes require auth.

#### `GET /projects`

Returns all projects with joined `client_name` and `client_company`.

**Response `200`:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "title": "Website Redesign",
      "status": "in_progress",
      "client_name": "Acme Corp",
      "client_company": "Acme Corp",
      "rate": 100,
      "rate_type": "hourly",
      "deadline": "2024-03-01",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### `GET /projects/:id`

Returns a single project with joined client details.

**Response `200`:**
```json
{ "project": { ...projectObject, "client_email": "..." } }
```

---

#### `POST /projects`

**Request body:**
```json
{
  "title": "Website Redesign",
  "client_id": "uuid",
  "description": "Full redesign of marketing site",
  "status": "not_started",
  "rate": 100,
  "rate_type": "hourly",
  "deadline": "2024-03-01"
}
```

Only `title` is required. `status` defaults to `not_started`.

**Response `201`:**
```json
{ "project": { ...projectObject } }
```

---

#### `PUT /projects/:id`

Same body as POST. Used for both full edits and drag-and-drop status changes.

**Response `200`:**
```json
{ "project": { ...projectObject } }
```

---

#### `DELETE /projects/:id`

**Response `200`:**
```json
{ "message": "Project deleted" }
```

---

### Invoices — `/invoices`

All routes require auth.

#### `GET /invoices`

Returns all invoices with joined `client_name` and `project_title`.

**Response `200`:**
```json
{
  "invoices": [
    {
      "id": "uuid",
      "invoice_number": "INV-202401-0001",
      "status": "sent",
      "total": 1500.00,
      "due_date": "2024-02-01",
      "client_name": "Acme Corp",
      "project_title": "Website Redesign",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### `GET /invoices/:id`

Returns full invoice with all client details and line items array.

**Response `200`:**
```json
{
  "invoice": {
    "id": "uuid",
    "invoice_number": "INV-202401-0001",
    "status": "sent",
    "total": 1500.00,
    "client_name": "Acme Corp",
    "client_email": "contact@acme.com",
    "items": [
      {
        "id": "uuid",
        "description": "Frontend development",
        "quantity": 10,
        "unit_price": 150.00
      }
    ]
  }
}
```

---

#### `POST /invoices`

Creates invoice and all line items in a single database transaction.

**Request body:**
```json
{
  "client_id": "uuid",
  "project_id": "uuid",
  "due_date": "2024-02-01",
  "status": "draft",
  "items": [
    { "description": "Frontend development", "quantity": 10, "unit_price": 150 }
  ]
}
```

`items` is required and must have at least one entry. `total` is computed automatically.

**Response `201`:**
```json
{ "invoice": { ...fullInvoiceWithItems } }
```

---

#### `PUT /invoices/:id`

Updates invoice. If `items` is provided, replaces all line items (delete + re-insert in transaction). Total is recomputed.

**Request body:** Same as POST.

**Response `200`:**
```json
{ "invoice": { ...fullInvoiceWithItems } }
```

---

#### `DELETE /invoices/:id`

**Response `200`:**
```json
{ "message": "Invoice deleted" }
```

---

#### `GET /invoices/:id/pdf`

Generates and streams a styled PDF invoice.

**Response:** Binary PDF with headers:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="invoice-INV-202401-0001.pdf"
```

---

#### `POST /invoices/:id/send`

Generates the PDF and sends it to the client's email address via Resend. If the invoice is still in `draft` status, it is automatically updated to `sent`.

**Auth required:** Yes

**Response `200`:**
```json
{ "message": "Invoice sent successfully" }
```

**Errors:** `400` client has no email address, `404` invoice not found

---

### Billing — `/billing`

#### `POST /billing/create-checkout`

Creates a Stripe Checkout session for a specific invoice.

**Auth required:** Yes

**Request body:**
```json
{ "invoice_id": "uuid" }
```

**Response `200`:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_test_..."
}
```

**Errors:** `400` invoice already paid, `404` invoice not found

---

#### `POST /billing/webhook`

Stripe webhook endpoint. Verifies the `stripe-signature` header and processes `checkout.session.completed` events to mark invoices as paid and record payments.

**Auth required:** No (uses Stripe signature verification)

> **Important:** This route must be registered **before** `express.json()` in `index.js` because it requires the raw request body for signature verification.

**Response `200`:**
```json
{ "received": true }
```

---

### Dashboard — `/dashboard`

#### `GET /dashboard/stats`

Returns aggregated statistics and recent activity for the authenticated user.

**Auth required:** Yes

**Response `200`:**
```json
{
  "totalClients": 12,
  "activeProjects": 3,
  "outstandingInvoices": 4500.00,
  "totalRevenue": 28000.00,
  "monthlyRevenue": [
    { "month": "Nov", "revenue": 3200 },
    { "month": "Dec", "revenue": 5100 },
    { "month": "Jan", "revenue": 4800 }
  ],
  "recentClients": [...],
  "recentProjects": [...],
  "recentInvoices": [...]
}
```

`monthlyRevenue` always returns the last 6 months with `0` for months with no payments.

---

### Health Check

#### `GET /health`

**Auth required:** No

**Response `200`:**
```json
{ "status": "ok" }
```

---

## Key Implementation Notes

- **Webhook route registration order:** `express.raw()` for `/billing/webhook` must be registered before `express.json()`. Reversing this breaks Stripe signature verification.
- **Multi-step writes:** Invoice create/update uses `pool.connect()` / `BEGIN` / `COMMIT` / `ROLLBACK` to ensure line items and invoice are written atomically.
- **User isolation:** Every query that reads or modifies data is scoped with `WHERE user_id = $1` using `req.userId` from the JWT middleware.
- **New columns:** Added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `initDb()` so existing deployments are not broken on redeploy.
- **Stripe lazy init:** `getStripe()` initialises the client on demand — avoids crashing at startup if the key is missing in development.
