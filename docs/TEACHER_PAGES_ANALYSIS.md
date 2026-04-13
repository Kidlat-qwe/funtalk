# Teacher Dashboard Pages Analysis

## Current Sidebar Menu Structure
Based on `frontend/src/components/Sidebar.jsx`, teachers currently have:
- `/teacher/dashboard` - Dashboard
- `/teacher/schedule` - Schedule
- `/teacher/classes` - My Classes
- `/teacher/availability` - Availability

## Required Pages Analysis

### 1. **Dashboard** (`/teacher/dashboard`) ✅ REQUIRED
**Purpose:** Main landing page showing overview and today's classes

**Features Needed:**
- **Today's Classes** section - Shows appointments scheduled for today
  - Quick access to "Launch Class" button
  - Student name, time, material
  - Status indicator (Upcoming, In Progress, Completed)
- **Upcoming Classes** - Next 7 days appointments
- **Past Classes** - Recently completed classes
- **Quick Stats** - Total classes this month, completion rate, etc.

**Backend API Support:**
- ✅ `/api/appointments` - GET (filters by teacher_id automatically)
- ✅ `/api/appointments/:id` - GET appointment details

---

### 2. **Appointments/Classes** (`/teacher/appointments` or `/teacher/classes`) ✅ REQUIRED
**Purpose:** View and manage all appointments

**Features Needed:**
- **View All Appointments** - Calendar/list view
  - Filter by status (pending, approved, completed, cancelled, no_show)
  - Filter by date range
  - Search by student name or school
- **Appointment Details Modal:**
  - Student name, age, level
  - School information
  - Material to be used
  - Additional notes from school
  - Meeting link (if generated)
- **Actions:**
  - **Launch Class** button - Opens meeting link
  - **Mark Status** - Complete or No Show
  - **Add Feedback** - Post-class performance notes (saved to appointmentHistory)
  - **View Student Profile** - Access student_level and additional_notes

**Backend API Support:**
- ✅ `/api/appointments` - GET (already filters by teacher_id)
- ✅ `/api/appointments/:id` - GET appointment details
- ✅ `/api/appointments/:id/feedback` - POST feedback
- ✅ `/api/appointments/:id` - PUT update status

**Recommendation:** Use `/teacher/appointments` for clarity (aligns with sidebar "My Classes")

---

### 3. **Schedule/Availability** (`/teacher/schedule` or `/teacher/availability`) ✅ REQUIRED
**Purpose:** Manage weekly availability and exceptions

**Features Needed:**
- **Weekly Schedule View:**
  - Set recurring weekly availability (e.g., Monday 9 AM - 12 PM)
  - Visual calendar showing available slots
  - Toggle availability on/off
- **Exceptions Management:**
  - Block specific dates (holidays)
  - Block specific time slots on specific dates
  - View all exceptions
- **Actions:**
  - Add/Edit/Delete weekly availability slots
  - Add/Remove date exceptions

**Backend API Support:**
- ✅ `/api/availability/teacher/:teacherId` - GET availability
- ✅ `/api/availability` - POST (create availability - Teacher only)
- ✅ `/api/availability/:id` - PUT/DELETE (update/delete availability - Teacher only)
- ✅ `/api/availability/exceptions` - POST (add exception - Teacher only)
- ✅ `/api/availability/exceptions/:id` - DELETE (remove exception - Teacher only)

**Recommendation:** Use `/teacher/availability` (already in sidebar)

---

### 4. **Materials** (`/teacher/materials`) ⚠️ RECOMMENDED WITH BACKEND CHANGE
**Purpose:** Teachers can add and manage their own teaching materials

**Current Status:**
- ❌ `materialtbl` does NOT have `teacher_id` column
- ❌ Materials are currently global (all teachers can see all materials)
- ❌ `/api/materials` POST is Admin-only

**Features Needed:**
- **View All Materials:**
  - See global materials (from admin)
  - See personal materials (created by teacher)
- **Create Personal Materials:**
  - Material name, type, file upload
  - Only visible to that teacher
- **Actions:**
  - Add/Edit/Delete personal materials
  - Use materials when providing class feedback

**Backend Changes Needed:**
1. Add `teacher_id` column to `materialtbl` (nullable - null = global/admin material)
2. Update `/api/materials` POST to allow teachers to create materials
3. Filter GET `/api/materials` to show global + teacher's own materials

**Database Schema Change:**
```sql
ALTER TABLE materialtbl 
ADD COLUMN teacher_id INTEGER REFERENCES userstbl(user_id) ON DELETE CASCADE;
```

**Alternative Approach (No DB Change):**
- Teachers can't create materials
- Teachers can only view and select from existing materials
- Use existing `/api/materials` GET endpoint

**Recommendation:** 
- **Short-term:** Don't add materials page yet, use existing global materials
- **Long-term:** Add `teacher_id` to `materialtbl` and create materials management page

---

## Recommended Page Structure

### Priority 1 (Essential):
1. ✅ **Dashboard** (`/teacher/dashboard`) - Today's classes overview
2. ✅ **Appointments** (`/teacher/appointments`) - All appointments management
3. ✅ **Availability** (`/teacher/availability`) - Schedule management

### Priority 2 (Recommended):
4. ⚠️ **Materials** (`/teacher/materials`) - ONLY if backend supports teacher-owned materials

---

## Sidebar Menu Recommendation

Update `Sidebar.jsx` teacher menu to:
```javascript
case 'teacher':
  return [
    { path: '/teacher/dashboard', label: 'Dashboard', icon: '...' },
    { path: '/teacher/appointments', label: 'My Classes', icon: '...' }, // Changed from '/teacher/classes'
    { path: '/teacher/availability', label: 'Availability', icon: '...' },
    // { path: '/teacher/materials', label: 'My Materials', icon: '...' }, // Optional - only if backend supports
  ];
```

---

## Summary

**Pages to Implement:**
1. **Dashboard** - Overview with today's classes
2. **Appointments** - Full appointment management (view, launch class, add feedback, mark status)
3. **Availability** - Weekly schedule and exceptions management
4. **Materials** - Optional, requires backend changes

**Key Workflows:**
- **Class Execution:** Dashboard → Click "Launch Class" → Open meeting link
- **Post-Class:** Appointments → Mark Complete → Add Feedback
- **Schedule Management:** Availability → Set weekly slots → Add exceptions for holidays
