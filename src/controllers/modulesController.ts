import { Request, Response } from 'express';
import pool from '../config/db.ts';
import { deleteAllModuleFiles } from '../services/storage';

export const getTeacherModules = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const query = `
      SELECT
        m.id,
        m.title,
        m.description,
        m.subject_id,
        m.class_id,
        m.section_id,
        m.files,
        m.created_at,
        m.updated_at,
        s.name as subject_name,
        c.name as class_name,
        sec.name as section_name
      FROM modules m
      JOIN subjects s ON m.subject_id = s.id
      JOIN classes c ON m.class_id = c.id
      LEFT JOIN sections sec ON m.section_id = sec.id
      JOIN teachers t ON m.teacher_id = t.id
      WHERE t.user_id = $1
      ORDER BY m.created_at DESC
    `;

    const result = await pool.query(query, [user.id]);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get teacher modules error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch modules'
    });
  }
};

export const createModule = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { title, description, subjectId, classId, sectionId } = req.body;

    // Get teacher ID
    const teacherResult = await pool.query(
      'SELECT id FROM teachers WHERE user_id = $1',
      [user.id]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found'
      });
    }

    const teacherId = teacherResult.rows[0].id;

    const result = await pool.query(
      `INSERT INTO modules (teacher_id, subject_id, class_id, section_id, title, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [teacherId, subjectId, classId, sectionId || null, title, description]
    );

    // Fetch the created module with subject and class names
    const moduleResult = await pool.query(
      `SELECT
        m.id,
        m.title,
        m.description,
        m.subject_id,
        m.class_id,
        m.section_id,
        m.files,
        m.created_at,
        m.updated_at,
        s.name as subject_name,
        c.name as class_name,
        sec.name as section_name
      FROM modules m
      JOIN subjects s ON m.subject_id = s.id
      JOIN classes c ON m.class_id = c.id
      LEFT JOIN sections sec ON m.section_id = sec.id
      WHERE m.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({
      success: true,
      data: moduleResult.rows[0]
    });
  } catch (error) {
    console.error('Create module error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create module'
    });
  }
};

export const deleteModule = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    // Check if module belongs to the teacher
    const checkResult = await pool.query(
      `SELECT m.id FROM modules m
       JOIN teachers t ON m.teacher_id = t.id
       WHERE m.id = $1 AND t.user_id = $2`,
      [id, user.id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Module not found or access denied'
      });
    }

    // Delete all module files from storage first
    try {
      await deleteAllModuleFiles(id);
    } catch (storageError) {
      console.error('Failed to delete module files from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    await pool.query('DELETE FROM modules WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Module deleted successfully'
    });
  } catch (error) {
    console.error('Delete module error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete module'
    });
  }
};
