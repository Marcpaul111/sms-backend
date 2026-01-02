import { Request, Response } from 'express';
import pool from '../config/db.ts';

export const getStudents = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query = `
      SELECT
        s.id,
        s.roll_number,
        s.guardian_name,
        s.guardian_phone,
        s.created_at,
        u.name,
        u.email,
        c.name as class_name,
        sec.name as section_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN classes c ON s.class_id = c.id
      JOIN sections sec ON s.section_id = sec.id
    `;
    const params: any[] = [];

    if (user.role === 'teacher') {
      // Teachers can only see students in their assigned classes
      query += `
        WHERE s.class_id IN (
          SELECT ta.class_id
          FROM teacher_assignments ta
          JOIN teachers t ON ta.teacher_id = t.id
          WHERE t.user_id = $1
        )
      `;
      params.push(user.id);
    }

    query += ' ORDER BY c.name, sec.name, s.roll_number';

    const result = await pool.query(query, params);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch students'
    });
  }
};