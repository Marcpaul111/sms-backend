import { Request, Response } from 'express';
import pool from '../config/db.ts';

export const getTeachers = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        t.id,
        u.name,
        u.email,
        COALESCE(sub.subject_name, 'Not Assigned') as subject,
        COALESCE(ta.classes_count, 0) as classes,
        COALESCE(ta.students_count, 0) as students,
        CASE WHEN t.is_active THEN 'active' ELSE 'on_leave' END as status
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN (
        SELECT
          ta.teacher_id,
          COUNT(DISTINCT ta.class_id) as classes_count,
          SUM(s.capacity) as students_count,
          (ARRAY_AGG(DISTINCT subj.name))[1] as subject_name
        FROM teacher_assignments ta
        JOIN subjects subj ON ta.subject_id = subj.id
        JOIN sections s ON ta.section_id = s.id
        GROUP BY ta.teacher_id
      ) ta ON t.id = ta.teacher_id
      ORDER BY u.name
    `;

    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch teachers'
    });
  }
};