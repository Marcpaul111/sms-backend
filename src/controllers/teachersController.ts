import { Request, Response } from 'express';
import pool from '../config/db.ts';

export const getTeachers = async (req: Request, res: Response) => {
  try {
    const query = `
      SELECT
        t.id,
        t.qualification,
        t.years_of_experience,
        t.phone,
        t.is_active,
        t.created_at,
        u.name,
        u.email
      FROM teachers t
      JOIN users u ON t.user_id = u.id
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