# System Workflow (Funtalk)

This document describes the **end-to-end workflow** of the system by **role** and by **core modules**.  
It is intended as a practical reference for how users move through the app and how data flows between UI and API.

---

## Roles

- **Superadmin**: full platform management (users, billing/invoices, installment billing, logs).
- **Admin**: operational management (depending on your setup, may overlap with superadmin in some endpoints).
- **School**: books classes, consumes credits, receives invoices.
- **Teacher**: manages availability and classes.

---

## Authentication & Session

### Login
- **UI**: `frontend/src/pages/Login.jsx`
- **Flow**
  - User signs in with **email + password**.
  - Firebase auth returns an ID token.
  - Frontend posts the token to backend login.
  - Backend responds with a **JWT** + user profile.
  - Frontend stores:
    - `localStorage.token`
    - `localStorage.user` (contains `userType`, `name`, etc.)
  - Frontend redirects based on `userType`.

### Route protection (UI)
- Each protected page checks localStorage and `userType` on mount.
- If missing/invalid, redirects to `/login`.

### Auth middleware (API)
- **Middleware**: `backend/middleware/auth.js`
- **Flow**
  - JWT verified.
  - User fetched from `userstbl` and validated as `active`.
  - `req.user = { userId, email, name, userType, status }`.

---

## Global UI Behaviors

### Global Alerts
- Browser `alert()` is replaced by a **global modal**:
  - Component: `frontend/src/components/GlobalAlert.jsx`
  - Mounted in: `frontend/src/main.jsx`

### Notifications Bell (Header)
- Component: `frontend/src/components/Header.jsx`
- Reads notifications from API, shows unread badge, and redirects on click.

---

## Navigation Structure (Frontend Routes)

Main router: `frontend/src/App.jsx`

### Superadmin
- `/superadmin/dashboard`
- `/superadmin/users`
- `/superadmin/teachers`
- `/superadmin/teacher-availability`
- `/superadmin/appointment`
- `/superadmin/package`
- `/superadmin/materials`
- `/superadmin/credits`
- `/superadmin/invoices`
- `/superadmin/installment-invoice`
- `/superadmin/payment-logs`

### School
- `/school/dashboard`
- `/school/students`
- `/school/bookings`
- `/school/packages`
- `/school/credits`
- `/school/reports`

### Teacher
- `/teacher/dashboard`
- `/teacher/appointments`
- `/teacher/availability`
- `/teacher/materials`
- `/teacher/profile`

---

## Core Workflows (By Module)

## 1) Users (Superadmin)

### Create user
- **UI**: `superadmin/Users.jsx` (modal form)
- **API**: `POST /api/auth/register`
- **Result**
  - Creates row in `userstbl`.
  - If user is **school**:
    - Creates initial `creditstbl` record.
    - If billing type is **patty**, system creates subscription schedule and first-cycle invoice.

### Edit user
- **UI**: `superadmin/Users.jsx` (edit modal)
- **API**: `GET /api/users/:id` then update endpoint(s) as implemented.

### Delete user
- **UI**: `superadmin/Users.jsx` or Installment Invoice actions
- **API**: `DELETE /api/users/:id`
- **Result**: removes user and related rows (via controller logic and DB constraints).

---

## 2) Appointments / Bookings

### School creates booking
- **UI**: `school/schoolBookings.jsx` (booking flow)
- **API**: `POST /api/appointments/...` (see routes/controllers)
- **Result**
  - Appointment row created.
  - Assigned teacher/time (depending on the UI flow).

### Admin/Superadmin manages appointments
- **UI**: `superadmin/Appointment.jsx`
- **Typical actions**
  - View bookings, approve, reject, update status.

### Teacher views classes
- **UI**: `teacher/teacherAppointments.jsx`
- **Result**
  - Teacher sees assigned bookings and upcoming sessions.

---

## 3) Teacher Availability

### Teacher updates availability
- **UI**: `teacher/teacherAvailability.jsx`
- **API**: `POST/PUT /api/availability/...`
- **Result**
  - Availability stored and used for scheduling/validation (depending on app logic).

### Superadmin views all availability
- **UI**: `superadmin/TeacherAvailability.jsx`

---

## 4) Credits (School)

### Credits balance & transactions
- **UI**: `school/schoolCredits.jsx`
- **API**: `GET /api/credits/...` plus billing-related endpoints
- **Result**
  - Displays `creditstbl.current_balance`
  - Displays transactions from `credittransactionstbl`

---

## 5) Billing / Invoices

### Invoice list (Superadmin)
- **UI**: `superadmin/Invoices.jsx`
- **API**: `GET /api/billing/invoices`
- **Result**
  - Shows invoices from `invoicetbl` joined with user/billing/package data.

### Invoice PDF download
- **UI**: invoice actions menu
- **API**: `GET /api/billing/invoices/:id/pdf`
- **Result**: backend streams a generated PDF.

### Mark invoice paid (Superadmin/Admin)
- **UI**: invoice actions menu (pay modal)
- **API**: `POST /api/billing/:id/approve`
- **Result**
  - Updates invoice status + records payment info/attachments.

---

## 6) Installment Billing (Patty)

### Installment Invoice page (Superadmin)
- **UI**: `superadmin/InstallmentInvoice.jsx`
- **API**: `GET /api/billing/patty-installment-users`
- **What it shows**
  - Patty schools with subscription status, cycle, next due date, last invoice, and **installment progress**.

### Generate installment invoice (manual)
- **UI**: Installment Invoice actions → **Generate invoice** modal
- **API**: `POST /api/billing/subscriptions/run-cycle` with `{ subscriptionId }`
- **Result**
  - Backend generates invoice for the **next available cycle** (skipping cycles that already have invoices).
  - Creates:
    - `billingtbl` row (pending)
    - `invoicetbl` row (pending, with `cycle_start`/`cycle_end`)
    - credits allocation transaction (monthly allocation)

### Installment progress rules (current)
- Progress increases based on **how many invoices exist for the school** (generated invoices),
  not based on “paid”.

---

## 7) Notifications (All roles)

### Viewing notifications
- **UI**: header bell dropdown
- **API**
  - `GET /api/notifications` (includes role-targeted + user-targeted notifications)
  - `GET /api/notifications/unread-count`
  - `POST /api/notifications/:id/read`

### Creating notifications
- System automatically creates notifications on some events (e.g., invoice generation).
- Admin/Superadmin can create a notification:
  - `POST /api/notifications` (admin-only)

---

## Data Entities (High-level)

- `userstbl`: users, roles, status, billing_type
- `creditstbl`, `credittransactionstbl`: credits and ledger
- `billingtbl`: billing records
- `invoicetbl`: invoices (including patty subscription invoices)
- `subscriptionscheduletbl`, `subscriptionplantbl`: patty subscription schedules/plans
- `notificationtbl`: notifications (user-targeted or role-targeted)

---

## Notes / Constraints

- UI pages should remain responsive and consistent with the existing palette.
- Alerts are shown via global modal, not browser dialogs.
- Notifications are actionable: each has an `href` to route the user to the relevant page.

