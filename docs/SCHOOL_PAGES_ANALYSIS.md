# School Pages Analysis & Design

## Overview
Based on the system architecture, user requirements, and database schema, the School role represents B2B clients who manage student profiles, book classes with teachers, and monitor student progress. Schools are the primary revenue source and operate as institutional accounts.

## Required Pages

### 1. Dashboard (`/school/dashboard`)
**Purpose:** Central overview for school administrators

**Key Features:**
- **Credit Balance Widget:** Real-time display of `current_balance` from `creditstbl`
- **Quick Stats Cards:**
  - Total Students (from `studentprofilestbl`)
  - Upcoming Classes (count from `appointmenttbl` where `status = 'pending'` or `'approved'`)
  - Completed Classes (count from `appointmenttbl` where `status = 'completed'`)
  - Credits Used This Month (sum from `credittransactionstbl`)
- **Upcoming Appointments Section:**
  - Next 5-10 upcoming classes
  - Display: Date, Time, Teacher Name, Student Name, Status
  - Quick link to view details
- **Recent Activity Feed:**
  - Latest credit transactions
  - Recent class completions
  - New student enrollments
  - Teacher feedback received

**Data Sources:**
- `creditstbl` (balance)
- `appointmenttbl` (classes)
- `studentprofilestbl` (students)
- `credittransactionstbl` (transactions)
- `appointmenthistorytbl` (feedback)

---

### 2. Students (`/school/students`)
**Purpose:** Manage student roster (CRUD operations)

**Key Features:**
- **Student List Table:**
  - Columns: Name, Age, Level, Email, Phone, Parent Name, Parent Contact, Status (Active/Inactive), Actions
  - Inline search by name
  - Filter by level
  - Filter by status (active/inactive)
- **Add New Student Button & Modal:**
  - Fields: `student_name` (required), `student_age`, `student_level`, `student_email`, `student_phone`, `parent_name`, `parent_contact`, `notes`
  - Form validation
- **Edit Student Modal:**
  - Same fields as Add, pre-populated
  - Can toggle `is_active` status
- **Delete Student:**
  - Confirmation dialog
  - Soft delete by setting `is_active = false` (or hard delete if confirmed)
- **View Student Details:**
  - Full profile view
  - Associated appointments list
  - Attendance history
  - Teacher feedback history

**Data Sources:**
- `studentprofilestbl` (CRUD)
- `appointmenttbl` (for associated appointments)

**API Endpoints:**
- `GET /api/students` - List all students for the school
- `GET /api/students/:id` - Get student details
- `POST /api/students` - Create student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Delete student

---

### 3. Bookings (`/school/bookings`)
**Purpose:** Core booking flow - search teachers, view availability, book classes

**Key Features:**

#### A. Teacher Search & Filter
- **Search Bar:** Search by teacher name
- **Filters:**
  - Gender (dropdown)
  - Accent/Nationality (if available in teacher profile)
  - Tags/Specialties (e.g., "Business English", "Kids", "Conversational")
- **Teacher Cards/List:**
  - Display: Profile Picture, Name, Gender, Description, Audio/Video Intro (play buttons)
  - "View Availability" button

#### B. Availability Calendar View
- **Calendar Interface:**
  - Month/week view
  - Show available slots from `teacheravailabilitytbl` (day_of_week, start_time, end_time)
  - Show booked slots (disabled/grayed out)
  - Show blocked exceptions from `teacheravailabilityexceptionstbl`
- **Time Slot Selection:**
  - Click available slot to book
  - Show slot details: Date, Time, Duration

#### C. Booking Modal/Form
When clicking an available slot, open booking form with:
- **Pre-filled:** Teacher Name, Date, Time
- **Student Selection:**
  - Dropdown to select existing student from `studentprofilestbl` (pre-fills: name, age, level)
  - OR "Add New Student" quick form (name, age, level)
- **Material Selection:**
  - Dropdown of available materials from `materialtbl`
  - Filter by material type
- **Additional Fields:**
  - `class_type` (optional)
  - `additional_notes` (optional)
- **Credit Deduction Warning:**
  - Show "This booking will deduct 1 credit from your balance"
  - Display current balance
  - Show balance after booking
- **Submit Button:**
  - Creates appointment with `status = 'pending'`
  - Deducts credit (creates `credittransactionstbl` entry)
  - Shows success message

#### D. My Bookings Table
- **Columns:** Date, Time, Teacher, Student, Material, Status, Actions
- **Filters:**
  - Status (pending, approved, completed, cancelled, no_show)
  - Date range
  - Teacher
  - Student
- **Actions:**
  - View Details
  - Cancel (if status is pending/approved)
  - View Feedback (if completed)

**Data Sources:**
- `teachertbl` (teacher profiles)
- `teacheravailabilitytbl` (availability schedule)
- `teacheravailabilityexceptionstbl` (blocked dates)
- `appointmenttbl` (existing bookings)
- `studentprofilestbl` (students)
- `materialtbl` (materials)
- `creditstbl` (balance check)

**API Endpoints:**
- `GET /api/teachers` - List all active teachers
- `GET /api/teachers/:id` - Get teacher details
- `GET /api/availability/teacher/:teacherId` - Get teacher availability
- `GET /api/availability/teacher/:teacherId/available-slots` - Get available time slots
- `GET /api/appointments` - Get school's bookings
- `POST /api/appointments` - Create booking
- `GET /api/materials` - Get available materials
- `GET /api/credits/balance` - Get credit balance

---

### 4. Packages (`/school/packages`)
**Purpose:** Purchase credit packages (Credits Shop)

**Key Features:**
- **Page Header:**
  - Current Credit Balance widget (prominent display)
  - Quick link to Credits page for transaction history
- **Packages Grid/Cards:**
  - Display all active packages from `packagetbl` in a shop-style layout
  - Card layout showing:
    - Package Name (`package_name`)
    - Package Type (`package_type`) - e.g., "Starter", "Premium", "Enterprise"
    - Credits Value (`credits_value`) - Large, prominent number
    - Price (`price`) - Currency formatted
    - Price per Credit - Calculated value (price / credits_value)
    - "Best Value" badge if applicable
    - "Purchase" button on each card
- **Package Purchase Modal:**
  - Package details summary
  - Billing type selection (if applicable):
    - Invoice (B2B - generates invoice for admin approval)
    - Card (direct payment - if integrated)
    - Bank Transfer (manual payment - generates invoice)
  - Confirmation:
    - Package name
    - Credits to be added
    - Total price
    - Current balance
    - Balance after purchase
  - "Confirm Purchase" button
  - Creates billing record (`billingtbl`) with `status = 'pending'`
  - For invoice/bank transfer: Admin must approve payment to add credits
- **Filters:**
  - Filter by package type
  - Sort by: Price (Low to High, High to Low), Credits (Most, Least), Best Value

**Data Sources:**
- `packagetbl` (available packages)
- `creditstbl` (current balance for display)
- `billingtbl` (billing records creation)

**API Endpoints:**
- `GET /api/billing/packages` - Get all active packages
- `GET /api/credits/balance` - Get current credit balance
- `POST /api/billing/create` - Create billing (purchase package)

**Purchase Flow:**
1. School views available packages
2. Clicks "Purchase" on desired package
3. Selects billing type (Invoice/Card/Bank Transfer)
4. Confirms purchase
5. Billing record created with `status = 'pending'`
6. If Invoice/Bank Transfer: Admin approves → Credits added
7. If Card: Direct payment → Credits added immediately (if integrated)

---

### 5. Credits (`/school/credits`)
**Purpose:** Credit balance management and transaction history

**Key Features:**
- **Balance Summary Card:**
  - Large, prominent display of `current_balance`
  - Last updated timestamp (`last_updated`)
  - Quick link to Packages page to purchase more
- **Transaction History Table:**
  - Columns: Date, Type (Purchase/Deduction/Adjustment), Amount, Balance Before, Balance After, Description, Status
  - Filters:
    - Transaction type (purchase, deduction, adjustment)
    - Date range (start date, end date)
  - Pagination for large datasets
  - Sort by date (newest first)
- **Transaction Details:**
  - Click transaction to view details
  - Show associated appointment (if deduction)
  - Show billing record (if purchase)
  - Show invoice link (if applicable)

**Data Sources:**
- `creditstbl` (balance)
- `credittransactionstbl` (transaction history)
- `billingtbl` (billing records - for purchase transactions)
- `appointmenttbl` (appointments - for deduction transactions)

**API Endpoints:**
- `GET /api/credits/balance` - Get current balance
- `GET /api/credits/transactions` - Get transaction history with filters
- `GET /api/billing` - Get billing records (for purchase history)

---

### 6. Reports (`/school/reports`)
**Purpose:** View attendance, teacher feedback, and student progress reports

**Key Features:**

#### A. Attendance Report
- **Summary Cards:**
  - Total Classes Scheduled
  - Completed Classes
  - Cancelled Classes
  - No-Show Classes
  - Attendance Rate %
- **Attendance Table:**
  - Columns: Date, Student Name, Teacher, Class Time, Status (Completed/Cancelled/No-Show), Actions
  - Filters:
    - Date range
    - Student
    - Teacher
    - Status

#### B. Teacher Feedback Section
- **Feedback List:**
  - Display feedback from `appointmenthistorytbl.teacher_feedback`
  - Show: Date, Student Name, Teacher, Class, Feedback Text
  - Search/filter by student, teacher, date
- **Feedback Detail View:**
  - Full feedback text
  - Associated class details
  - Student progress notes

#### C. Student Progress Reports
- **Per-Student View:**
  - Select student from dropdown
  - Show:
    - Total classes attended
    - Classes per month (graph/chart)
    - Average class frequency
    - List of all classes with teacher feedback
    - Progress over time

#### D. Export Options
- Export attendance report (CSV/PDF)
- Export feedback report
- Export student progress report

**Data Sources:**
- `appointmenttbl` (class data)
- `appointmenthistorytbl` (feedback, status changes)
- `credittransactionstbl` (class deductions)

**API Endpoints:**
- `GET /api/appointments` - Get all school appointments with filters
- `GET /api/appointments/:id/history` - Get appointment history/feedback

---

## User Flow: Booking Process

1. **School logs in** → Dashboard shows credit balance and upcoming classes
2. **Navigate to Bookings** → See list of teachers with search/filters
3. **Click "View Availability"** on a teacher → Calendar shows available slots
4. **Click an available slot** → Booking modal opens
5. **Select student** (existing or create new) → Pre-fills student details
6. **Select material** → Choose teaching material
7. **Review credit deduction** → Confirm balance and deduction amount
8. **Submit booking** → Appointment created with `status = 'pending'`
9. **Admin/Superadmin approves** → Status changes to `'approved'`
10. **Class happens** → Teacher marks as `'completed'` and adds feedback
11. **School views feedback** → In Reports page

---

## Implementation Priority

### Phase 1 (Core Functionality):
1. **Dashboard** - Overview and quick access
2. **Students** - Manage student roster
3. **Bookings** - Core booking functionality (teacher search, availability, booking form)

### Phase 2 (Financial & Reporting):
4. **Packages** - Purchase credit packages (shop interface)
5. **Credits** - Balance management and transaction history
6. **Reports** - Attendance and feedback viewing

---

## Technical Notes

- **Credit Deduction:** When a booking is created, a credit transaction should be recorded immediately (even if appointment is pending). This ensures schools have sufficient credits before booking.
- **Status Flow:** `pending` → `approved` (by admin) → `completed` (by teacher) or `cancelled`
- **Student Management:** Students don't log in. Schools manage their profiles entirely.
- **Booking Constraints:** Check teacher availability, prevent double-booking, verify credit balance before allowing booking.

---

## UI/UX Considerations

- **Responsive Design:** All pages must work on mobile, tablet, and desktop
- **Hamburger Menu:** Floating button on mobile (like teacher pages)
- **Loading States:** Show spinners during API calls
- **Error Handling:** Clear error messages for failed bookings (insufficient credits, slot unavailable)
- **Success Feedback:** Confirmations for successful bookings, student creation, etc.
- **Credit Balance Visibility:** Always visible in header or sidebar for quick reference
