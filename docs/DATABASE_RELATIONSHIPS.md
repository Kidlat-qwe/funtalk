# Database Relationships & Enhancement Tables

## Overview
This document shows how the new enhancement tables connect to the existing database schema.

---

## New Tables Added

### 1. **teacheravailabilitytbl** (Teacher Availability)
**Purpose:** Stores teacher's recurring weekly schedule (e.g., Monday 9 AM - 12 PM)

**Relationships:**
- `teacher_id` → `teachertbl.teacher_id` (CASCADE DELETE)
  - When a teacher is deleted, their availability is also deleted

**Connected to:**
- Used by booking system to determine available time slots
- Referenced when schools search for available teachers

---

### 2. **teacheravailabilityexceptionstbl** (Teacher Availability Exceptions)
**Purpose:** Stores blocked dates/holidays when teacher is unavailable

**Relationships:**
- `teacher_id` → `teachertbl.teacher_id` (CASCADE DELETE)
  - When a teacher is deleted, their exceptions are also deleted

**Connected to:**
- Works with `teacheravailabilitytbl` to calculate actual availability
- Used to block specific dates (holidays, personal time off)

---

### 3. **credittransactionstbl** (Credit Transaction Log)
**Purpose:** Complete audit trail for all credit transactions

**Relationships:**
- `user_id` → `userstbl.user_id` (NO ACTION DELETE)
  - Links to the school account
  - Transaction history preserved even if school account is deleted
  
- `appointment_id` → `appointmenttbl.appointment_id` (SET NULL DELETE)
  - Links to appointment if transaction is related to booking
  - History preserved even if appointment is deleted
  
- `created_by` → `userstbl.user_id` (SET NULL DELETE)
  - Links to admin/superadmin who made manual adjustments
  - History preserved even if admin account is deleted

**Connected to:**
- `creditstbl` - Updates balance when transactions occur
- `appointmenttbl` - Records credit deduction when booking is made
- `billingtbl` - Records credit addition when payment is approved

---

### 4. **studentprofilestbl** (Student Profiles) - OPTIONAL
**Purpose:** Student roster management for schools

**Relationships:**
- `school_id` → `userstbl.user_id` (CASCADE DELETE)
  - Links to the school account
  - When school is deleted, all their students are deleted

**Connected to:**
- `appointmenttbl.student_id` (optional foreign key)
  - Links appointments to student profiles
  - Allows schools to reuse student information

---

## Enhanced Constraints

### 5. **Unique Constraint on appointmenttbl**
**Purpose:** Prevents double-booking

**Constraint:**
```sql
UNIQUE (teacher_id, appointment_date, appointment_time)
```

**Effect:**
- Prevents same teacher from being booked at same date/time
- Database-level protection against booking conflicts

---

## Complete Relationship Diagram

```
userstbl (All Users)
├── teachertbl (Teachers)
│   ├── teacheravailabilitytbl (Weekly Schedule)
│   ├── teacheravailabilityexceptionstbl (Blocked Dates)
│   ├── meetingtbl (Meeting Links)
│   └── appointmenttbl (Appointments)
│       ├── appointmenthistorytbl (Status Changes)
│       └── credittransactionstbl (Credit Deductions)
│
├── studentprofilestbl (Student Roster) [OPTIONAL]
│   └── appointmenttbl.student_id (Links to Appointments)
│
├── creditstbl (Current Balance)
│   └── credittransactionstbl (Transaction History)
│
├── billingtbl (Billing Records)
│   ├── invoicetbl (Invoices)
│   └── paymenttbl (Payments)
│       └── paymenthistorytbl (Payment History)
│
└── credittransactionstbl
    ├── Links to userstbl (School)
    ├── Links to appointmenttbl (Booking)
    └── Links to userstbl.created_by (Admin)
```

---

## Data Flow Examples

### Booking Flow with Relationships:
1. **School** (`userstbl`) searches for available teachers
2. System checks `teacheravailabilitytbl` for recurring schedule
3. System checks `teacheravailabilityexceptionstbl` for blocked dates
4. System checks `appointmenttbl` for existing bookings
5. School creates `appointmenttbl` record
6. System creates `credittransactionstbl` record (deduction)
7. System updates `creditstbl.current_balance`
8. System creates `appointmenthistorytbl` record (status: pending)

### Credit Purchase Flow:
1. **School** (`userstbl`) purchases package
2. System creates `billingtbl` record
3. Admin approves payment → creates `paymenttbl` record
4. System creates `credittransactionstbl` record (addition)
5. System updates `creditstbl.current_balance`

### Student Profile Usage (Optional):
1. **School** (`userstbl`) creates `studentprofilestbl` record
2. When booking, school selects student from roster
3. `appointmenttbl.student_id` links to `studentprofilestbl.student_id`
4. Student info auto-populates in appointment form

---

## Foreign Key Summary

| New Table | Foreign Key Column | References | On Delete |
|-----------|-------------------|------------|-----------|
| `teacheravailabilitytbl` | `teacher_id` | `teachertbl.teacher_id` | CASCADE |
| `teacheravailabilityexceptionstbl` | `teacher_id` | `teachertbl.teacher_id` | CASCADE |
| `credittransactionstbl` | `user_id` | `userstbl.user_id` | NO ACTION |
| `credittransactionstbl` | `appointment_id` | `appointmenttbl.appointment_id` | SET NULL |
| `credittransactionstbl` | `created_by` | `userstbl.user_id` | SET NULL |
| `studentprofilestbl` | `school_id` | `userstbl.user_id` | CASCADE |
| `appointmenttbl` | `student_id` | `studentprofilestbl.student_id` | SET NULL |

---

## Indexes Added for Performance

1. `idx_teacheravailabilitytbl_teacher_id` - Fast teacher schedule lookup
2. `idx_teacheravailabilitytbl_day_active` - Fast day-based availability queries
3. `idx_teacheravailabilityexceptionstbl_teacher_date` - Fast exception date lookup
4. `idx_credittransactionstbl_user_id` - Fast transaction history by school
5. `idx_credittransactionstbl_appointment_id` - Fast transaction lookup by appointment
6. `idx_credittransactionstbl_created_at` - Fast date-range queries
7. `idx_studentprofilestbl_school_id` - Fast student roster lookup
8. `idx_studentprofilestbl_school_active` - Fast active student queries
9. `idx_appointmenttbl_teacher_date` - Fast teacher calendar queries
10. `idx_appointmenttbl_user_status` - Fast school appointment queries
11. `idx_appointmenttbl_date_status` - Fast date-range appointment queries

---

## Notes

- All new tables follow the existing naming convention (`*tbl` suffix)
- All foreign keys use the same pattern as existing tables
- CASCADE deletes are used where child data should be removed with parent
- SET NULL is used where history should be preserved
- NO ACTION is used where referential integrity must be maintained

