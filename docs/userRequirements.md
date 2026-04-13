User Role: SUPERADMIN
The owner/developer of the platform. Has full access.

1.1 System Management

Create and manage internal Admin accounts.

Configure global system settings (default credit rates, supported currencies).

View system-wide audit logs (who deleted what appointment, payment errors).

1.2 Financial Oversight

View total revenue reports across all Schools.

Manually override credit balances (add/remove credits) for any School for support/refund purposes.

2. User Role: ADMIN
The operational staff managing the day-to-day business.

2.1 School Onboarding (B2B Sales)

Create School Accounts: Admins create the account for the School (schools usually cannot self-sign-up in strict B2B models).

Contract Management: Assign specific "Price Packages" to specific Schools (e.g., School A gets a discount rate).

2.2 Teacher Management

Vetting: Review teacher applications, watch video_intro, and verify docs (certifications).

Activation: Toggle teacher status from 'Pending' to 'Active'.

Scheduling Override: Ability to cancel a class on behalf of a teacher in emergencies.

2.3 Financial Operations

Invoice Generation: Generate manual invoices for Schools that pay via Bank Transfer (common in B2B) instead of Credit Card.

Payment Approval: Manually mark a billingTbl record as 'Paid' once the bank transfer is received to release credits.

3. User Role: SCHOOL (The Client)
The core customer. This account represents an institution, not a person.

3.1 Credit Management

Purchase Credits: Buy bulk credits (Packages) via the portal.

Balance View: Always see real-time current_balance (from creditsTbl).

3.2 Student Management

Student Roster: Create/Edit/Delete profiles for their students.

Note: Students do not log in. The School manages their "existence" in the system.

3.3 Booking Flow (The Critical Path)

Search: Filter teachers by gender, accent/nationality, or tags (e.g., "Business English", "Kids").

Book Slot: Select an available time slot on a Teacher's calendar.

Assign Student: During booking, input the specific Student's details (Name, Age, Level) into the appointment form.

Material Selection: Choose what materialTbl content the teacher should use for this specific student.

3.4 Reporting

Attendance: View which of their students attended or missed classes.

Teacher Feedback: Read the "After Class Report" written by the teacher about the student's progress.

4. User Role: TEACHER
The service provider.

4.1 Availability Management

Set Schedule: Open specific time slots (e.g., Monday 9 AM - 12 PM) using a visual calendar.

Exceptions: Block out specific dates for holidays.

4.2 Class Execution

Dashboard: View a list of "Today's Classes" with the Student Name and Material clearly displayed.

Launch Class: One-click button to open the meeting_link.

Student Profile Access: View the student_level and additional_notes provided by the School before the class starts.

4.3 Post-Class Actions

Mark Status: Mark the appointment as Completed or Student No Show.

Feedback: Write a required performance note (saved to appointmentHistory or a feedback column) so the School knows how the student performed.

3. Operational Data Flow (The "Happy Path")
Acquisition: Admin creates an account for "Tokyo High School".

Purchase: "Tokyo High School" logs in, requests an invoice for $5,000. Admin approves payment. System adds 500 Credits to "Tokyo High School".

Scheduling: "Tokyo High School" looks at Teacher Sarah's calendar. They book Tuesday 10:00 AM.

Assignment: The School enters student "John Doe (Age 12)" into the booking form. 1 Credit is deducted from the School's wallet.

Execution: On Tuesday, Teacher Sarah sees "Class with John Doe". She clicks "Start Class".

Completion: Class ends. Sarah marks it "Completed" and writes "John improved his pronunciation."

Review: "Tokyo High School" sees the report and shares it with John's parents offline.

4. Database Adjustment for B2B Logic
The SQL I provided previously actually handles this well, but to be 100% precise for your developers, ensure the appointmentTbl usage follows this logic:

appointmentTbl.user_id: This holds the ID of the School, NOT the student.

appointmentTbl.student_name: The name of the actual student attending.

appointmentTbl.student_level: The level of that specific student.

This avoids creating thousands of User Accounts for students who never actually log into the system.