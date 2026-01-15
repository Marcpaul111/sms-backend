import { Request, Response } from 'express';
import pool from '../config/db';

export const getTeacherClasses = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

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

    const classesResult = await pool.query(`
      SELECT
        c.id as class_id,
        c.name as class_name,
        sec.id as section_id,
        sec.name as section_name,
        string_agg(sub.name, ', ') as subjects,
        string_agg(ta.schedule, ', ') as schedules,
        (SELECT COUNT(*) FROM students s
         WHERE s.class_id = c.id AND s.section_id = sec.id AND s.is_active = true) as student_count
      FROM teacher_assignments ta
      JOIN classes c ON ta.class_id = c.id
      JOIN subjects sub ON ta.subject_id = sub.id
      JOIN sections sec ON ta.section_id = sec.id
      WHERE ta.teacher_id = $1
      GROUP BY c.id, c.name, sec.id, sec.name
      ORDER BY c.name, sec.name
    `, [teacherId]);

    res.json({
      success: true,
      data: classesResult.rows
    });
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes'
    });
  }
};

export const getTeacherAssignments = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

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

    const assignmentsResult = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.due_at,
        c.name as class_name,
        sec.name as section_name,
        sub.name as subject_name,
        COUNT(s.id) as total_submissions,
        COUNT(CASE WHEN s.status = 'submitted' THEN 1 END) as graded_submissions
      FROM assignments a
      JOIN classes c ON a.class_id = c.id
      JOIN sections sec ON a.section_id = sec.id
      JOIN subjects sub ON a.subject_id = sub.id
      LEFT JOIN submissions s ON s.assignment_id = a.id
      WHERE a.teacher_id = $1
      GROUP BY a.id, a.title, a.due_at, c.name, sec.name, sub.name
      ORDER BY a.due_at ASC
    `, [teacherId]);

    res.json({
      success: true,
      data: assignmentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments'
    });
  }
};

export const getTeacherSections = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    console.log('getTeacherSections - user:', user);
    if (!user || user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { classId } = req.params;
    console.log('getTeacherSections - classId:', classId);
    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'Class ID is required'
      });
    }

    const teacherResult = await pool.query(
      'SELECT id FROM teachers WHERE user_id = $1',
      [user.id]
    );
    console.log('getTeacherSections - teacherResult:', teacherResult.rows);

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Teacher profile not found'
      });
    }

    const teacherId = teacherResult.rows[0].id;
    console.log('getTeacherSections - teacherId:', teacherId);

    // Check if teacher is assigned to this class
    const assignmentCheck = await pool.query(
      'SELECT 1 FROM teacher_assignments WHERE teacher_id = $1 AND class_id = $2',
      [teacherId, classId]
    );
    console.log('getTeacherSections - assignmentCheck:', assignmentCheck.rows.length);

    if (assignmentCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: not assigned to this class'
      });
    }

    const sectionsResult = await pool.query(`
      SELECT DISTINCT
        s.id,
        s.name,
        s.class_id
      FROM sections s
      WHERE s.class_id = $1
      ORDER BY s.name
    `, [classId]);
    console.log('getTeacherSections - sectionsResult:', sectionsResult.rows);

    res.json({
      success: true,
      data: sectionsResult.rows
    });
  } catch (error) {
    console.error('Error fetching teacher sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections'
    });
  }
};

export const getDashboardMetrics = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const client = await pool.connect();
    let metrics: any = {};

    if (user.role === 'admin') {
      // Admin metrics
      const teachersResult = await client.query(
        'SELECT COUNT(*) as count FROM teachers WHERE is_active = true'
      );
      const totalTeachers = Number.parseInt(teachersResult.rows[0].count);

      const studentsResult = await client.query(
        'SELECT COUNT(*) as count FROM students'
      );
      const totalStudents = Number.parseInt(studentsResult.rows[0].count);

      const classesResult = await client.query(
        'SELECT COUNT(*) as count FROM classes'
      );
      const totalClasses = Number.parseInt(classesResult.rows[0].count);

      const avgPerformance = 78; // Placeholder

      metrics = {
        totalTeachers,
        totalStudents,
        totalClasses,
        avgPerformance
      };
    } else if (user.role === 'teacher') {
      // Teacher metrics - classes taught, students, assignments
      // First get the teacher ID from the teachers table
      const teacherResult = await client.query(
        'SELECT id FROM teachers WHERE user_id = $1',
        [user.id]
      );

      if (teacherResult.rows.length === 0) {
        client.release();
        return res.status(404).json({
          success: false,
          message: 'Teacher profile not found'
        });
      }

      const teacherId = teacherResult.rows[0].id;

      // Count total teacher assignments to match the number of classes shown in the dashboard
      const classesTaughtResult = await client.query(
        `SELECT COUNT(*) as count
         FROM teacher_assignments WHERE teacher_id = $1`,
        [teacherId]
      );
      const classesTaught = Number.parseInt(classesTaughtResult.rows[0].count);

      const studentsTaughtResult = await client.query(
        `SELECT COUNT(DISTINCT s.id) as count
         FROM students s
         WHERE (s.class_id, s.section_id) IN (
           SELECT ta.class_id, ta.section_id 
           FROM teacher_assignments ta 
           WHERE ta.teacher_id = $1
         )
         AND s.is_active = true`,
        [teacherId]
      );
      const studentsTaught = Number.parseInt(studentsTaughtResult.rows[0].count) || 0;

      const assignmentsResult = await client.query(
        'SELECT COUNT(*) as count FROM assignments WHERE teacher_id = $1',
        [teacherId]
      );
      const totalAssignments = Number.parseInt(assignmentsResult.rows[0].count);

      metrics = {
        classesTaught,
        studentsTaught,
        totalAssignments,
        avgPerformance: 85 // Placeholder
      };
    } else if (user.role === 'student') {
      // Student metrics - classes enrolled, pending work, attendance, avg grade
      const studentResult = await client.query(
        'SELECT id FROM students WHERE user_id = $1',
        [user.id]
      );

      if (studentResult.rows.length === 0) {
        client.release();
        return res.status(404).json({
          success: false,
          message: 'Student profile not found'
        });
      }

      const studentId = studentResult.rows[0].id;

      // Classes enrolled - assuming one class per student for now
      const classesEnrolled = 1;

      // Pending work - assignments not submitted
      const pendingWorkResult = await client.query(
        `SELECT COUNT(*) as count
         FROM assignments a
         JOIN students s ON a.class_id = s.class_id AND a.section_id = s.section_id
         WHERE s.id = $1 AND NOT EXISTS (
           SELECT 1 FROM submissions sub WHERE sub.student_id = s.id AND sub.assignment_id = a.id
         )`,
        [studentId]
      );
      const pendingWork = Number.parseInt(pendingWorkResult.rows[0].count);

      const attendance = 96; // Placeholder
      const avgGrade = 2.1; // Placeholder

      metrics = {
        classesEnrolled,
        pendingWork,
        attendance,
        avgGrade
      };
    }

    client.release();

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard metrics'
    });
  }
};

export const getStudentClasses = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const studentResult = await pool.query(
      'SELECT id, class_id, section_id FROM students WHERE user_id = $1',
      [user.id]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const student = studentResult.rows[0];

    const classesResult = await pool.query(`
      SELECT
        c.id as class_id,
        c.name as class_name,
        sec.id as section_id,
        sec.name as section_name,
        string_agg(sub.name, ', ') as subjects,
        string_agg(ta.schedule, ', ') as schedules,
        (SELECT COUNT(*) FROM students s
         WHERE s.class_id = c.id AND s.section_id = sec.id AND s.is_active = true) as student_count
      FROM teacher_assignments ta
      JOIN classes c ON ta.class_id = c.id
      JOIN subjects sub ON ta.subject_id = sub.id
      JOIN sections sec ON ta.section_id = sec.id
      WHERE c.id = $1 AND sec.id = $2
      GROUP BY c.id, c.name, sec.id, sec.name
      ORDER BY c.name, sec.name
    `, [student.class_id, student.section_id]);

    res.json({
      success: true,
      data: classesResult.rows
    });
  } catch (error) {
    console.error('Error fetching student classes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch classes'
    });
  }
};

export const getStudentAssignments = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const studentResult = await pool.query(
      'SELECT id, class_id, section_id FROM students WHERE user_id = $1',
      [user.id]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const student = studentResult.rows[0];
    console.log('getStudentAssignments - student:', student);

    const assignmentsResult = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.description,
        a.due_at,
        c.name as class_name,
        sec.name as section_name,
        sub.name as subject_name,
        s.status as submission_status,
        s.submitted_at,
        s.attachments as submission_attachments
      FROM assignments a
      JOIN classes c ON a.class_id = c.id
      JOIN sections sec ON a.section_id = sec.id
      JOIN subjects sub ON a.subject_id = sub.id
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
      WHERE a.class_id = $2 AND a.section_id = $3
      ORDER BY a.due_at ASC
    `, [student.id, student.class_id, student.section_id]);

    res.json({
      success: true,
      data: assignmentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching student assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assignments'
    });
  }
};

export const getStudentResults = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const studentResult = await pool.query(
      'SELECT id FROM students WHERE user_id = $1',
      [user.id]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const studentId = studentResult.rows[0].id;
    console.log('getStudentResults - studentId:', studentId);

    const resultsResult = await pool.query(`
      SELECT
        s.id,
        a.title as assignment_title,
        a.description,
        a.due_at,
        s.submitted_at,
        s.attachments as submission_attachments,
        c.name as class_name,
        sec.name as section_name,
        sub.name as subject_name
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN classes c ON a.class_id = c.id
      JOIN sections sec ON a.section_id = sec.id
      JOIN subjects sub ON a.subject_id = sub.id
      WHERE s.student_id = $1 AND s.status = 'graded'
      ORDER BY s.submitted_at DESC
      LIMIT 10
    `, [studentId]);

    res.json({
      success: true,
      data: resultsResult.rows
    });
  } catch (error) {
    console.error('Error fetching student results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch results'
    });
  }
};

export const getStudentModules = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const studentResult = await pool.query(
      'SELECT * FROM students WHERE user_id = $1',
      [user.id]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const student = studentResult.rows[0];
    console.log('getStudentModules - student full record:', student);

    const subjectsResult = await pool.query(
      'SELECT subject_id FROM student_subjects WHERE student_id = $1',
      [student.id]
    );
    const subjectIds = subjectsResult.rows.map(row => row.subject_id);
    console.log('getStudentModules - student subjects:', subjectIds);

    if (subjectIds.length === 0) {
      console.log('getStudentModules - no subjects found for student');
      return res.json({
        success: true,
        data: []
      });
    }

    const modulesResult = await pool.query(`
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
        sec.name as section_name,
        u.name as teacher_name
      FROM modules m
      JOIN subjects s ON m.subject_id = s.id
      JOIN classes c ON m.class_id = c.id
      LEFT JOIN sections sec ON m.section_id = sec.id
      JOIN teachers t ON m.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE m.class_id = $1 
        AND (m.section_id = $2 OR m.section_id IS NULL)
        AND m.subject_id = ANY($3::uuid[])
      ORDER BY m.created_at DESC
    `, [student.class_id, student.section_id, subjectIds]);

    console.log('getStudentModules - modules found:', modulesResult.rows.length);

    res.json({
      success: true,
      data: modulesResult.rows
    });
  } catch (error) {
    console.error('Error fetching student modules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch modules'
    });
  }
};
