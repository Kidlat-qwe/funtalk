import { query, getClient } from '../config/database.js';

const DURATION_MINUTES_TO_CREDITS = { 25: 1, 50: 2, 75: 3, 100: 4 };

/** Credits charged when a class is marked completed (matches school booking duration options). */
const getCreditsToChargeForAppointment = (additionalNotes) => {
  const m = String(additionalNotes ?? '').match(/Duration:\s*(\d+)\s*mins/i);
  if (!m) return 1;
  const mins = Number(m[1]);
  return DURATION_MINUTES_TO_CREDITS[mins] ?? 1;
};

/**
 * @desc    Get all appointments with filters
 * @route   GET /api/appointments
 * @access  Private
 */
export const getAppointments = async (req, res) => {
  try {
    const { status, teacherId, startDate, endDate } = req.query;
    
    let sqlQuery = `
      SELECT 
        a.appointment_id,
        a.user_id,
        a.teacher_id,
        a.meeting_id,
        a.material_id,
        a.appointment_date,
        a.appointment_time,
        a.class_type,
        a.student_name,
        a.student_age,
        a.student_level,
        a.additional_notes,
        a.status,
        a.approved_by,
        a.created_at,
        a.student_id,
        u.name as school_name,
        u.email as school_email,
        t.fullname as teacher_name,
        t.email as teacher_email,
        t.profile_picture as teacher_profile_picture,
        t.video_intro as teacher_video_intro,
        t.audio_intro as teacher_audio_intro,
        t.docs as teacher_docs,
        t.description as teacher_description,
        m.meeting_link,
        m.meeting_platform,
        mat.material_name,
        sp.student_name as profile_student_name,
        approver.name as approved_by_name
      FROM appointmenttbl a
      LEFT JOIN userstbl u ON a.user_id = u.user_id
      LEFT JOIN teachertbl t ON a.teacher_id = t.teacher_id
      LEFT JOIN meetingtbl m ON a.meeting_id = m.meeting_id
      LEFT JOIN materialtbl mat ON a.material_id = mat.material_id
      LEFT JOIN studentprofilestbl sp ON a.student_id = sp.student_id
      LEFT JOIN userstbl approver ON a.approved_by = approver.user_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    // Apply filters
    if (status) {
      sqlQuery += ` AND a.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (teacherId) {
      sqlQuery += ` AND a.teacher_id = $${paramIndex}`;
      params.push(teacherId);
      paramIndex++;
    }
    
    if (startDate) {
      sqlQuery += ` AND a.appointment_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate) {
      sqlQuery += ` AND a.appointment_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    // For superadmin, show all appointments
    // For other roles, filter by their user_id or teacher_id
    if (req.user.userType !== 'superadmin') {
      if (req.user.userType === 'school' || req.user.userType === 'admin') {
        sqlQuery += ` AND a.user_id = $${paramIndex}`;
        params.push(req.user.userId);
        paramIndex++;
      } else if (req.user.userType === 'teacher') {
        sqlQuery += ` AND a.teacher_id = $${paramIndex}`;
        params.push(req.user.userId);
        paramIndex++;
      }
    }
    
    sqlQuery += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;
    
    const result = await query(sqlQuery, params);
    
    res.status(200).json({
      success: true,
      data: {
        appointments: result.rows,
        count: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointments',
      error: error.message,
    });
  }
};

/**
 * @desc    Get appointment by ID
 * @route   GET /api/appointments/:id
 * @access  Private
 */
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        a.*,
        u.name as school_name,
        u.email as school_email,
        t.fullname as teacher_name,
        t.email as teacher_email,
        t.profile_picture as teacher_profile_picture,
        t.video_intro as teacher_video_intro,
        t.audio_intro as teacher_audio_intro,
        t.docs as teacher_docs,
        t.description as teacher_description,
        m.meeting_link,
        m.meeting_platform,
        mat.material_name,
        sp.student_name as profile_student_name,
        approver.name as approved_by_name
      FROM appointmenttbl a
      LEFT JOIN userstbl u ON a.user_id = u.user_id
      LEFT JOIN teachertbl t ON a.teacher_id = t.teacher_id
      LEFT JOIN meetingtbl m ON a.meeting_id = m.meeting_id
      LEFT JOIN materialtbl mat ON a.material_id = mat.material_id
      LEFT JOIN studentprofilestbl sp ON a.student_id = sp.student_id
      LEFT JOIN userstbl approver ON a.approved_by = approver.user_id
      WHERE a.appointment_id = $1
    `;
    
    const result = await query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        appointment: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new appointment
 * @route   POST /api/appointments
 * @access  Private (School/Admin/Superadmin)
 */
export const createAppointment = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const {
      teacherId,
      appointmentDate,
      appointmentTime,
      duration,
      studentName,
      studentAge,
      studentLevel,
      materialId,
      classType,
      materialType,
      teacherRequirements,
      additionalNotes,
      studentId,
      schoolId, // For admin/superadmin to book on behalf of school
    } = req.body;
    
    // Determine the user_id (school who's booking)
    const bookingUserId = schoolId || req.user.userId;
    const normalizedRequirements = Array.isArray(teacherRequirements)
      ? teacherRequirements.filter((item) => typeof item === 'string' && item.trim())
      : [];
    const normalizedMaterialType = ['teacher_provided', 'student_provided', 'free_talk'].includes(materialType)
      ? materialType
      : null;
    const normalizedDuration = ['25', '50', '75', '100'].includes(String(duration || ''))
      ? String(duration)
      : null;
    const normalizedClassType = ['one_on_one', 'group', 'vip'].includes(classType)
      ? classType
      : null;

    const resolvedTeacherId = teacherId ? Number(teacherId) : null;
    const requiresTeacherOnCreate = req.user.userType !== 'school';
    if (requiresTeacherOnCreate && !resolvedTeacherId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Teacher assignment is required.',
      });
    }
    
    if (resolvedTeacherId) {
      // Check if teacher exists
      const teacherCheck = await client.query(
        'SELECT teacher_id FROM teachertbl WHERE teacher_id = $1',
        [resolvedTeacherId]
      );
      
      if (teacherCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Teacher not found',
        });
      }
      
      // Check for time slot conflict (unique constraint)
      const conflictCheck = await client.query(
        `SELECT appointment_id FROM appointmenttbl 
         WHERE teacher_id = $1 AND appointment_date = $2 AND appointment_time = $3 
         AND status NOT IN ('cancelled', 'no_show')`,
        [resolvedTeacherId, appointmentDate, appointmentTime]
      );
      
      if (conflictCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'This time slot is already booked for this teacher',
        });
      }
    }
    
    // Insert appointment
    const insertQuery = `
      INSERT INTO appointmenttbl (
        user_id, teacher_id, meeting_id, material_id,
        appointment_date, appointment_time, class_type,
        student_name, student_age, student_level,
        additional_notes, status, student_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const metadataLines = [];
    if (normalizedDuration) metadataLines.push(`Duration: ${normalizedDuration} mins`);
    if (normalizedMaterialType) metadataLines.push(`Material Type: ${normalizedMaterialType.replaceAll('_', ' ')}`);
    if (normalizedRequirements.length > 0) {
      metadataLines.push(`Teacher Requirements: ${normalizedRequirements.join(', ')}`);
    }
    const mergedAdditionalNotes = [
      additionalNotes ? String(additionalNotes).trim() : '',
      ...metadataLines,
    ]
      .filter(Boolean)
      .join('\n');

    const values = [
      bookingUserId,
      resolvedTeacherId,
      null, // meeting_id - assigned later
      normalizedMaterialType === 'student_provided' ? (materialId || null) : null,
      appointmentDate,
      appointmentTime,
      normalizedClassType,
      studentName,
      studentAge || null,
      studentLevel || null,
      mergedAdditionalNotes || null,
      'pending', // Default status
      studentId || null,
    ];
    
    const result = await client.query(insertQuery, values);
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      message: 'Appointment created successfully',
      data: {
        appointment: result.rows[0],
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating appointment:', error);
    
    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'This time slot is already booked for this teacher',
      });
    }

    // School/superadmin can create pending bookings before a teacher is assigned — DB must allow NULL teacher_id
    if (error.code === '23502' && error.column === 'teacher_id') {
      return res.status(500).json({
        success: false,
        message:
          'Cannot save booking: teacher_id is required by the database but this booking has no teacher yet. Run the migration docs/migrations/appointment_teacher_id_nullable.sql (ALTER COLUMN teacher_id DROP NOT NULL), then retry.',
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating appointment',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

/**
 * @desc    Update appointment status
 * @route   PUT /api/appointments/:id/status
 * @access  Private (Teacher/Admin)
 */
export const updateAppointmentStatus = async (req, res) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status, changeReason, teacherId, meetingLink, meetingPlatform } = req.body;
    
    // Get current appointment (lock row for credit deduction + status update)
    const currentAppt = await client.query(
      `SELECT status, meeting_id, user_id, additional_notes
       FROM appointmenttbl WHERE appointment_id = $1 FOR UPDATE`,
      [id]
    );
    
    if (currentAppt.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }
    
    const oldStatus = currentAppt.rows[0].status;
    let nextTeacherId = null;
    let nextMeetingId = null;

    if (status === 'completed' && oldStatus !== 'completed') {
      const existingDeduction = await client.query(
        `SELECT transaction_id FROM credittransactionstbl
         WHERE appointment_id = $1 AND transaction_type = 'deduction'`,
        [id]
      );
      if (existingDeduction.rows.length === 0) {
        const schoolUserId = currentAppt.rows[0].user_id;
        const creditsToCharge = getCreditsToChargeForAppointment(currentAppt.rows[0].additional_notes);

        let balanceRow = await client.query(
          'SELECT current_balance FROM creditstbl WHERE user_id = $1 FOR UPDATE',
          [schoolUserId]
        );
        if (balanceRow.rows.length === 0) {
          await client.query(
            'INSERT INTO creditstbl (user_id, current_balance) VALUES ($1, 0)',
            [schoolUserId]
          );
          balanceRow = await client.query(
            'SELECT current_balance FROM creditstbl WHERE user_id = $1 FOR UPDATE',
            [schoolUserId]
          );
        }
        const before = Number(balanceRow.rows[0]?.current_balance || 0);
        if (before < creditsToCharge) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            message: `Insufficient credits to mark this class completed. Required: ${creditsToCharge}, available: ${before}.`,
          });
        }
        const after = before - creditsToCharge;
        await client.query(
          'UPDATE creditstbl SET current_balance = $1, last_updated = CURRENT_TIMESTAMP WHERE user_id = $2',
          [after, schoolUserId]
        );
        await client.query(
          `INSERT INTO credittransactionstbl (
             user_id, appointment_id, transaction_type, amount, balance_before, balance_after, description, created_by
           ) VALUES ($1, $2, 'deduction', $3, $4, $5, $6, $7)`,
          [
            schoolUserId,
            Number(id),
            creditsToCharge,
            before,
            after,
            `Class completed — appointment_id=${id}`,
            req.user?.userId || null,
          ]
        );
      }
    }

    if (status === 'approved') {
      if (!teacherId) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Teacher is required when approving an appointment',
        });
      }
      if (!meetingLink) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Meeting link is required when approving an appointment',
        });
      }

      const teacherCheck = await client.query(
        'SELECT teacher_id FROM teachertbl WHERE teacher_id = $1',
        [Number(teacherId)]
      );
      if (teacherCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Teacher not found',
        });
      }

      nextTeacherId = Number(teacherId);
      const existingMeetingId = currentAppt.rows[0].meeting_id;

      if (existingMeetingId) {
        const updatedMeeting = await client.query(
          `UPDATE meetingtbl
           SET teacher_id = $1, meeting_link = $2, meeting_platform = COALESCE($3, meeting_platform)
           WHERE meeting_id = $4
           RETURNING meeting_id`,
          [nextTeacherId, meetingLink, meetingPlatform || 'other', existingMeetingId]
        );
        nextMeetingId = updatedMeeting.rows[0]?.meeting_id || existingMeetingId;
      } else {
        const insertedMeeting = await client.query(
          `INSERT INTO meetingtbl (teacher_id, meeting_link, meeting_platform)
           VALUES ($1, $2, $3)
           RETURNING meeting_id`,
          [nextTeacherId, meetingLink, meetingPlatform || 'other']
        );
        nextMeetingId = insertedMeeting.rows[0].meeting_id;
      }
    }
    
    // Update appointment status
    const updateQuery = `
      UPDATE appointmenttbl
      SET status = $1,
          approved_by = $2,
          teacher_id = COALESCE($3, teacher_id),
          meeting_id = COALESCE($4, meeting_id)
      WHERE appointment_id = $5
      RETURNING *
    `;
    
    const approverId = status === 'approved' ? req.user.userId : null;
    const result = await client.query(updateQuery, [status, approverId, nextTeacherId, nextMeetingId, id]);
    
    // Record status change in history
    if (oldStatus !== status) {
      await client.query(
        `INSERT INTO appointmenthistorytbl (
          appointment_id, old_status, new_status, change_reason, changed_by
        )
        VALUES ($1, $2, $3, $4, $5)`,
        [id, oldStatus, status, changeReason || null, req.user.userId]
      );
    }
    
    await client.query('COMMIT');
    
    res.status(200).json({
      success: true,
      message: 'Appointment status updated successfully',
      data: {
        appointment: result.rows[0],
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating appointment status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating appointment status',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

/**
 * @desc    Update appointment details
 * @route   PUT /api/appointments/:id
 * @access  Private (School/Admin)
 */
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      appointmentDate,
      appointmentTime,
      studentName,
      materialId,
      additionalNotes,
    } = req.body;
    
    // Check if appointment exists
    const apptCheck = await query(
      'SELECT appointment_id, user_id FROM appointmenttbl WHERE appointment_id = $1',
      [id]
    );
    
    if (apptCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (appointmentDate !== undefined) {
      updates.push(`appointment_date = $${paramIndex}`);
      values.push(appointmentDate);
      paramIndex++;
    }
    
    if (appointmentTime !== undefined) {
      updates.push(`appointment_time = $${paramIndex}`);
      values.push(appointmentTime);
      paramIndex++;
    }
    
    if (studentName !== undefined) {
      updates.push(`student_name = $${paramIndex}`);
      values.push(studentName);
      paramIndex++;
    }
    
    if (materialId !== undefined) {
      updates.push(`material_id = $${paramIndex}`);
      values.push(materialId || null);
      paramIndex++;
    }
    
    if (additionalNotes !== undefined) {
      updates.push(`additional_notes = $${paramIndex}`);
      values.push(additionalNotes || null);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }
    
    values.push(id);
    const updateQuery = `
      UPDATE appointmenttbl
      SET ${updates.join(', ')}
      WHERE appointment_id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(updateQuery, values);
    
    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      data: {
        appointment: result.rows[0],
      },
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating appointment',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete/Cancel appointment
 * @route   DELETE /api/appointments/:id
 * @access  Private (School/Admin)
 */
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(
      'DELETE FROM appointmenttbl WHERE appointment_id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Appointment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting appointment',
      error: error.message,
    });
  }
};

/**
 * @desc    Get appointment history
 * @route   GET /api/appointments/:id/history
 * @access  Private
 */
export const getAppointmentHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    const historyQuery = `
      SELECT 
        h.*,
        u.name as changed_by_name
      FROM appointmenthistorytbl h
      LEFT JOIN userstbl u ON h.changed_by = u.user_id
      WHERE h.appointment_id = $1
      ORDER BY h.changed_at DESC
    `;
    
    const result = await query(historyQuery, [id]);
    
    res.status(200).json({
      success: true,
      data: {
        history: result.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching appointment history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching appointment history',
      error: error.message,
    });
  }
};

/**
 * @desc    Add teacher feedback
 * @route   POST /api/appointments/:id/feedback
 * @access  Private (Teacher)
 */
export const addFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;
    
    // Check if appointment exists and belongs to this teacher
    const apptCheck = await query(
      'SELECT appointment_id, teacher_id FROM appointmenttbl WHERE appointment_id = $1',
      [id]
    );
    
    if (apptCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found',
      });
    }
    
    // Update appointment history with feedback
    await query(
      `INSERT INTO appointmenthistorytbl (
        appointment_id, teacher_feedback, changed_by
      )
      VALUES ($1, $2, $3)`,
      [id, feedback, req.user.userId]
    );
    
    res.status(200).json({
      success: true,
      message: 'Feedback added successfully',
    });
  } catch (error) {
    console.error('Error adding feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding feedback',
      error: error.message,
    });
  }
};
