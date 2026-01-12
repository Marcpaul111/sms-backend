import { Request, Response } from 'express';
import pool from '../config/db';

export const getStudents = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { classId, sectionId } = req.query;
    
    let query = `
      SELECT
        s.id,
        s.user_id,
        s.roll_number,
        s.guardian_name,
        s.guardian_phone,
        s.created_at,
        s.is_active,
        u.name,
        u.email,
        u.profile_picture,
        c.id as class_id,
        c.name as class_name,
        sec.id as section_id,
        sec.name as section_name,
        (
          SELECT json_agg(sub.id ORDER BY sub.name)
          FROM student_subjects ss
          JOIN subjects sub ON ss.subject_id = sub.id
          WHERE ss.student_id = s.id
        ) as subject_ids
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
      JOIN sections sec ON s.section_id = sec.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];

    if (user.role === 'teacher') {
      // Teachers can only see students in their assigned classes
      conditions.push(`s.class_id IN (
        SELECT ta.class_id
        FROM teacher_assignments ta
        JOIN teachers t ON ta.teacher_id = t.id
        WHERE t.user_id = $1
      )`);
      params.push(user.id);
    }

    // Filter by classId if provided
    if (classId) {
      conditions.push(`s.class_id = $${params.length + 1}`);
      params.push(classId);
    }

    // Filter by sectionId if provided
    if (sectionId) {
      conditions.push(`s.section_id = $${params.length + 1}`);
      params.push(sectionId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY c.name, sec.name, s.roll_number';

    const result = await pool.query(query, params);
    
    // Convert subject_ids array from NULL to empty array
    const data = result.rows.map(row => ({
      ...row,
      subject_ids: row.subject_ids || []
    }));
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students'
    });
  }
};

export const updateStudentStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'is_active must be a boolean'
      });
    }

    const result = await pool.query(
      'UPDATE students SET is_active = $1 WHERE id = $2 RETURNING *',
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Update student status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update student status'
    });
  }
};

export const updateStudent = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { name, email, roll_number, guardian_name, guardian_phone, class_id, section_id, subject_ids, is_active } = req.body;

    // Check if student exists and teacher has access to current student
    let accessQuery = 'SELECT s.id, s.class_id, s.section_id FROM students s WHERE s.id = $1';
    const accessParams: any[] = [id];

    if (user.role === 'teacher') {
      accessQuery += `
        AND s.class_id IN (
          SELECT ta.class_id
          FROM teacher_assignments ta
          JOIN teachers t ON ta.teacher_id = t.id
          WHERE t.user_id = $2
        )
      `;
      accessParams.push(user.id);
    }

    const accessCheck = await pool.query(accessQuery, accessParams);
    if (accessCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or access denied'
      });
    }

    const currentStudent = accessCheck.rows[0];

    // If updating class, check if teacher has access to the new class
    if (user.role === 'teacher' && class_id) {
      const newAccessQuery = `
        SELECT 1 FROM teacher_assignments ta
        JOIN teachers t ON ta.teacher_id = t.id
        WHERE t.user_id = $1 AND ta.class_id = $2
      `;
      const newAccessCheck = await pool.query(newAccessQuery, [user.id, class_id]);

      if (newAccessCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: you can only assign students to classes you teach'
        });
      }
    }

    // Update user info if provided
    if (name || email) {
      const userUpdateFields: string[] = [];
      const userUpdateParams: any[] = [];
      let paramIndex = 1;

      if (name) {
        userUpdateFields.push('name = $' + paramIndex);
        userUpdateParams.push(name);
        paramIndex++;
      }
      if (email) {
        userUpdateFields.push('email = $' + paramIndex);
        userUpdateParams.push(email);
        paramIndex++;
      }

      userUpdateParams.push(id);

      const userUpdateQuery = `
        UPDATE users
        SET ${userUpdateFields.join(', ')}
        WHERE id = $${paramIndex}
      `;

      await pool.query(userUpdateQuery, userUpdateParams);
    }

    // Update student info if provided
    const shouldUpdateStudent = roll_number !== undefined || guardian_name || guardian_phone || class_id || section_id || is_active !== undefined;
    
    if (shouldUpdateStudent) {
      const studentUpdateFields: string[] = [];
      const studentUpdateParams: any[] = [];
      let paramIndex = 1;

      if (roll_number !== undefined) {
        studentUpdateFields.push('roll_number = $' + paramIndex);
        studentUpdateParams.push(roll_number);
        paramIndex++;
      }
      if (guardian_name !== undefined) {
        studentUpdateFields.push('guardian_name = $' + paramIndex);
        studentUpdateParams.push(guardian_name);
        paramIndex++;
      }
      if (guardian_phone !== undefined) {
        studentUpdateFields.push('guardian_phone = $' + paramIndex);
        studentUpdateParams.push(guardian_phone);
        paramIndex++;
      }
      if (class_id) {
        studentUpdateFields.push('class_id = $' + paramIndex);
        studentUpdateParams.push(class_id);
        paramIndex++;
      }
      if (section_id) {
        studentUpdateFields.push('section_id = $' + paramIndex);
        studentUpdateParams.push(section_id);
        paramIndex++;
      }
      if (is_active !== undefined) {
        studentUpdateFields.push('is_active = $' + paramIndex);
        studentUpdateParams.push(is_active);
        paramIndex++;
      }

      studentUpdateParams.push(id);

      const studentUpdateQuery = `
        UPDATE students
        SET ${studentUpdateFields.join(', ')}
        WHERE id = $${paramIndex}
      `;

      await pool.query(studentUpdateQuery, studentUpdateParams);
    }

    // Update student subjects if provided
    if (subject_ids && Array.isArray(subject_ids)) {
      // Delete existing subjects
      await pool.query('DELETE FROM student_subjects WHERE student_id = $1', [id]);
      
      // Insert new subjects
      if (subject_ids.length > 0) {
        const placeholders = subject_ids.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
        const insertParams: any[] = [];
        subject_ids.forEach((subjId: string) => {
          insertParams.push(id, subjId);
        });
        await pool.query(
          `INSERT INTO student_subjects (student_id, subject_id) VALUES ${placeholders}`,
          insertParams
        );
      }
    }

    // Return updated student data
    const result = await pool.query(`
      SELECT
        s.id,
        s.user_id,
        s.roll_number,
        s.guardian_name,
        s.guardian_phone,
        s.created_at,
        s.is_active,
        s.class_id,
        s.section_id,
        u.name,
        u.email,
        u.profile_picture,
        c.name as class_name,
        sec.name as section_name,
        (
          SELECT json_agg(sub.id ORDER BY sub.name)
          FROM student_subjects ss
          JOIN subjects sub ON ss.subject_id = sub.id
          WHERE ss.student_id = s.id
        ) as subject_ids
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
      JOIN sections sec ON s.section_id = sec.id
      WHERE s.id = $1
    `, [id]);
    
    // Convert subject_ids array from NULL to empty array
    const data = result.rows.map(row => ({
      ...row,
      subject_ids: row.subject_ids || []
    }));
    
    res.json({
      success: true,
      data: data[0]
    });
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update student'
    });
  }
};

export const deleteStudent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Soft delete by setting is_active to false
    const result = await pool.query(
      'UPDATE students SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      message: 'Student deactivated successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete student'
    });
  }
};
