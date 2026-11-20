# ForgeFit - Gym Membership Management System (MERN)

Gym management app with a public ForgeFit landing page, a protected member dashboard, and a protected administrator portal for members, membership plans, payments and a live dashboard.

- **Frontend:** React 18, Vite, React Router, Axios, Recharts, Lucide React, plain CSS
- **Backend:** Node.js, Express 4, Mongoose 8, JWT, bcryptjs, helmet, express-rate-limit
- **Database:** MongoDB

## 1. Prerequisites

- Node.js 18.11 or newer
- MongoDB, either local (Community Server) or a free MongoDB Atlas cluster

## 2. MongoDB setup

**Local:** install MongoDB Community Server and make sure the service is running (default `mongodb://127.0.0.1:27017`).
The database `forgefit` is created automatically on first write.

**Atlas:** create a free cluster, add a database user, allow your IP, then put the connection string in
`backend/.env` as `MONGODB_URI` (include a database name, e.g. `.../forgefit?retryWrites=true&w=majority`).

## 3. Install

```bash
cd backend
npm install
cd ../frontend
npm install
```

## 4. Configure the backend

`backend/.env` is already provided with a random `JWT_SECRET` and a generated admin password.
To start fresh, copy `backend/.env.example` to `backend/.env` and edit it. Key settings:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | 32+ character secret used to sign tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | credentials used by the seed script |
| `CLIENT_ORIGIN` | allowed frontend origin(s) for CORS |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Optional server-side Razorpay credentials for verified online membership checkout; development requires test-mode keys |

**Never commit `.env`** (it is in `.gitignore`).

## 5. Create the admin (seed)

```bash
cd backend
npm run seed          # creates the admin + the 4 default plans (Monthly, Quarterly, Half-Yearly, Yearly)
npm run seed:demo     # optional: also adds 12 User-backed sample member profiles and payments
node seed.js --reset-password   # reset the admin password to ADMIN_PASSWORD from .env
```

The password is bcrypt-hashed before it is stored. No credentials exist anywhere in the frontend code.

## 6. Run

```bash
# terminal 1
cd backend
npm run dev        # or: npm start       -> http://localhost:5000

# terminal 2
cd frontend
npm run dev        #                      -> http://localhost:5173
```

Open **http://localhost:5173/** for the public home page. Visitors can create an account with their name, email, phone number and password; registration accounts are stored in the MongoDB `users` collection with a hashed password, creation timestamp and account status. Administrators can review registration-only accounts in the **Registered Member Accounts** section of `/members`. Existing gym member profiles are stored with their login account in `users.memberProfile`; their original `members` documents remain as an unchanged backup. Members can use **Sign In** to access `/account`, which displays their membership and both migrated and new payment history. The member login page's **Forgot Password?** option directs members to contact their gym administrator; automated email resets are not configured.

The administrator login is intentionally not linked from public pages. Administrators can sign in at `/admin/login` or use the shared `/member-login` page; both accept the `ADMIN_EMAIL` / `ADMIN_PASSWORD` values configured in `backend/.env` and route administrators to `/admin/dashboard`. Members can sign in at `/member-login` and are sent to `/account`. Member accounts do not have administrator access. The old `/login`, `/dashboard`, and `/admin` routes remain compatibility redirects.
In development Vite proxies `/api` to `http://localhost:5000`, so the browser needs no extra CORS setup.

The backend health check at `http://localhost:5000/api/health` performs a MongoDB ping and returns HTTP 503 if the database is unavailable.

Member migration is repeatable and non-destructive. Run `npm run migrate:members` in `backend/` for a dry run, then `npm run migrate:members -- --apply` to copy Member profiles into `users`. It never edits or deletes documents in `members`, and it merges a matching email into the existing User without replacing that User's account fields or password. Migrated profiles without a password remain unable to sign in until an administrator sets one.

Production build of the frontend: `cd frontend && npm run build` (output in `frontend/dist`).
For a deployed backend, set `VITE_API_URL` to its full URL before building (see `frontend/.env.example`).
The currency (default `INR`) is set with `VITE_CURRENCY`.

## 7. Public pages and admin portal

- `/` — public ForgeFit home page with product overview and navigation.
- `/admin/login` — hidden administrator sign-in.
- `/admin/dashboard` — protected administrator dashboard.
- `/login` — compatibility redirect to `/admin/login`.
- `/register` — public member account registration.
- `/member-login` — shared member and administrator sign-in.
- `/account` — protected member dashboard with active plans, linked membership details, payment history and profile.
- `/members`, `/plans`, `/payments` — protected administration modules.

## 8. API overview

All routes except the documented sign-in/registration endpoints and `GET /api/health` require `Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login` (admin), `POST /api/auth/member/register`, `POST /api/auth/member/login`, `GET /api/auth/me`, `GET /api/auth/member/dashboard` (member-scoped) |
| Dashboard | `GET /api/dashboard` |
| Members | `GET/POST /api/members`, `GET/PUT/DELETE /api/members/:id`, `GET /api/members/:id/payments`, `POST /api/members/:id/reset-password`, `PATCH /api/members/:id/account-status`, `GET /api/members/registered-users`, `GET /api/members/registered-users/:id`, `POST /api/members/registered-users/:id/reset-password`, `PATCH /api/members/registered-users/:id/account-status` (admin-only) |
| Plans | `GET /api/plans/available` (member-scoped active plans), `GET/POST /api/plans`, `GET/PUT/DELETE /api/plans/:id`, `PATCH /api/plans/:id/status` |
| Payments | `GET/POST /api/payments`, `GET/PUT/DELETE /api/payments/:id` |
| Member payments | `POST /api/auth/member/payments` (manual pending submission), `POST /api/auth/member/payments/order` and `/verify` (Razorpay order and server-side verification), `GET /api/auth/member/dashboard` (own payment/receipt history) |

List endpoints support `search`, `status`, `page`, `limit` (members also `plan`; payments also `member`).

## 9. Business rules

- **Expiry** is always calculated by the server: start date + plan duration in months (31 Jan + 1 month = 28/29 Feb). It is recalculated when the plan or start date changes.
- **Member status:** `Active` becomes `Expired` automatically once the expiry date has passed. An admin can mark a member `Inactive` (suspended).
- **Member test credentials:** Administrators can reset a selected member's password from its details page. Temporary passwords are available only outside production and shown once; they are bcrypt-hashed before storage.
- **Member storage:** `users` is the primary store for login accounts and member profiles. `members` remains an unchanged backup for migrated records; `User.memberProfile.sourceMember` maps each migrated profile to its original Member document. Historical payments retain their original Member reference and are returned alongside User-linked payments.
- **Revenue** counts only payments with status `Paid`. `Pending` and `Failed` are excluded everywhere.
- **Admin payments are recorded manually.** Member online checkout uses Razorpay only when server-side credentials are configured. The backend verifies the signature and confirms a captured payment before saving it as `Paid`, activating the membership, and issuing a unique receipt. In development, only Razorpay test-mode credentials are accepted.
- **Demo QR:** selecting the QR option also shows the existing dummy QR image for 15 seconds. The demo image and its countdown do not initiate or verify a payment; only a verified Razorpay result can mark an online purchase as paid.
- **Membership receipts:** verified member payments store receipt number and member/plan/date snapshots. Members can download PDF receipts from the checkout success panel or their own payment history; the dashboard API scopes those records to the signed-in member.
- **Payment methods & details:** Cash, UPI (UPI ID), Card (type, name on card, last 4 digits), Bank Transfer (bank, account holder, last 4 digits) and Other (description). Details are stored in MongoDB in `payments.paymentDetails`. Full card/account numbers, CVV, expiry and PINs are never collected or stored.
- **Member-submitted payments** (member dashboard -> Payment Details -> *Make a payment*, for accounts linked to a membership) are saved as `Pending` with `source: "Member"`; the amount always comes from the plan price on the server. An admin confirms receipt by editing the payment to `Paid`.
- **Plans** cannot be deleted while any member is assigned to them (deactivate instead). Inactive plans cannot be assigned to new members.
- **Deleting a member** keeps their payment records (name/ID snapshots) so revenue history stays correct.
- Duplicate member emails, plan names and transaction references are rejected.
- Login is rate-limited (20 attempts / 15 min / IP) and gives the same error for unknown email and wrong password.

## 10. Project structure

```
backend/   server.js, seed.js, src/{config,controllers,middleware,models,routes,utils}
frontend/  src/{components,pages,services,context,hooks,utils}
```
