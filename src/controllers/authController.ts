import pool from '../config/db';
import type { Request, Response } from 'express';
import { generateTokens } from '../utils/useJwt';

import {
  registerUser,
  verifyEmail,
  loginUser,
  requestPasswordReset,
  verifyOTP,
  resetPassword,
  approveTeacher,
  rejectTeacher,
  inviteStudent,
  inviteTeacher,
  completeSetup,
  getPendingTeachers,
  // getAllTeachers,
  toggleTeacherStatus,
  updateIndividualAssignment,
  deleteIndividualAssignment
} from '../services/authService';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  requestPasswordResetSchema,
  verifyOTPSchema,
  resetPasswordSchema,
  assignTeacherSchema
} from '../schemas/schemaValidations';
import { ZodError } from 'zod';

// Cookie options
const SECURE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 15 * 60 * 1000
};

const handleValidationError = (error: ZodError, res: Response) => {
  const errors = error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message
  }));
  return res.status(400).json({
    success: false,
    message: 'Validation error',
    errors
  });
};

// Register
export const register = async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    if (!validation.success) {
      return handleValidationError(validation.error, res);
    }

    const { name, email, password, role } = validation.data;
    const result = await registerUser(name, email, password, role);

    res.status(201).json({
      success: true,
      message: result.message,
      user: result.user
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const approveTeacherHandler = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };
    const result = await approveTeacher(userId);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const rejectTeacherHandler = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };
    const result = await rejectTeacher(userId);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const inviteStudentHandler = async (req: Request, res: Response) => {
  try {
    const { name, email, classId, sectionId, rollNumber } = req.body;
    if (!name || !email || !classId || !sectionId || typeof rollNumber !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    const result = await inviteStudent(name, email, classId, sectionId, rollNumber);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const inviteTeacherHandler = async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }
    const result = await inviteTeacher(name, email);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const completeSetupHandler = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and newPassword are required'
      });
    }
    const result = await completeSetup(token, newPassword);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getPendingTeachersHandler = async (req: Request, res: Response) => {
  try {
    const pendingTeachers = await getPendingTeachers();
    res.status(200).json({ success: true, data: pendingTeachers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllTeachersHandler = async (req: Request, res: Response) => {
  try {
    const teachers = await (await import('../services/authService')).getAllTeachersWithDetails();
    res.status(200).json({ success: true, data: teachers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleTeacherStatusHandler = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as { userId: string };
    const result = await toggleTeacherStatus(userId);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const assignTeacherHandler = async (req: Request, res: Response) => {
  try {
    const v = assignTeacherSchema.safeParse(req.body);
    if (!v.success) {
      return handleValidationError(v.error, res);
    }
    const { teacherUserId, subjectId, classId, sectionId } = v.data;
    const result = await (await import('../services/authService')).assignTeacherToClass(
      teacherUserId,
      subjectId,
      classId,
      sectionId
    );
    res.status(200).json({ success: true, message: result.message, id: (result as any).id });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const myAssignmentsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const rows = await (await import('../services/authService')).listAssignmentsForTeacher(req.user.id);
    res.status(200).json({ success: true, data: rows });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllAssignmentsHandler = async (req: Request, res: Response) => {
  try {
    const assignments = await (await import('../services/authService')).getAllAssignments();
    res.status(200).json({ success: true, data: assignments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAssignmentHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const client = await (await import('../config/db')).default.connect();
    try {
      const result = await client.query('DELETE FROM teacher_assignments WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Assignment not found' });
      }
      res.status(200).json({ success: true, message: 'Assignment deleted successfully' });
    } finally {
      client.release();
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAssignmentScheduleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { schedule } = req.body;
    if (typeof schedule !== 'string') {
      return res.status(400).json({ success: false, message: 'Schedule must be a string' });
    }
    const result = await (await import('../services/authService')).updateAssignmentSchedule(id, schedule);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateAssignmentHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const { teacherUserId, subjectId, classId, sectionId, schedule } = req.body;
    if (!teacherUserId || !subjectId || !classId || !sectionId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const result = await (await import('../services/authService')).updateAssignment(id, teacherUserId, subjectId, classId, sectionId, schedule);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createAssignmentHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const { createAssignmentSchema } = await import('../schemas/schemaValidations');
    const v = createAssignmentSchema.safeParse(req.body);
    if (!v.success) {
      return handleValidationError(v.error, res);
    }
    const { subjectId, classId, sectionId, title, description, dueAt, attachments } = v.data;
    const { createAssignment } = await import('../services/authService');
    const result = await createAssignment(req.user.id, {
      subjectId,
      classId,
      sectionId,
      title,
      description: description ?? null,
      dueAt: new Date(dueAt),
      attachments: attachments || []
    });
    res.status(201).json({ success: true, message: result.message, data: { id: result.id } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateIndividualAssignmentHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const { id } = req.params;
    const { createAssignmentSchema } = await import('../schemas/schemaValidations');
    const v = createAssignmentSchema.safeParse(req.body);
    if (!v.success) {
      return handleValidationError(v.error, res);
    }
    const { subjectId, classId, sectionId, title, description, dueAt, attachments } = v.data;
    const result = await updateIndividualAssignment(id, req.user.id, {
      subjectId,
      classId,
      sectionId,
      title,
      description: description ?? null,
      dueAt: new Date(dueAt),
      attachments: attachments || []
    });
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteIndividualAssignmentHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const { id } = req.params;
    const result = await deleteIndividualAssignment(id, req.user.id);
    res.status(200).json({ success: true, message: result.message });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createSignedUploadUrlHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const { createSignedUploadSchema } = await import('../schemas/schemaValidations');
    const v = createSignedUploadSchema.safeParse(req.body);
    if (!v.success) {
      return handleValidationError(v.error, res);
    }
    const { bucket, context, subjectId, classId, sectionId, assignmentId, filename } = v.data;
    const userId = req.user.id;
    const prefix = context === 'assignment'
      ? `assignments/${classId}/${sectionId}/${subjectId}/${assignmentId}/${userId}/`
      : `submissions/${classId}/${sectionId}/${subjectId}/${assignmentId}/${userId}/`;
    const path = `${prefix}${Date.now()}_${filename}`;
    const { createSignedUploadUrl } = await import('../services/storage');
    const urlData = await createSignedUploadUrl(bucket, path);
    res.status(200).json({
      success: true,
      uploadUrl: urlData.signedUrl,
      path
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const uploadFileHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { bucket, context, subjectId, classId, sectionId, assignmentId } = req.body;
    const userId = req.user.id;
    const filename = req.file.originalname;

    // Validate required fields
    if (!bucket || !context || !subjectId || !classId || !sectionId || !assignmentId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const prefix = context === 'assignment'
      ? `assignments/${classId}/${sectionId}/${subjectId}/${assignmentId}/${userId}/`
      : `submissions/${classId}/${sectionId}/${subjectId}/${assignmentId}/${userId}/`;
    const path = `${prefix}${Date.now()}_${filename}`;

    // Upload file buffer to GCS
    const { storage } = await import('../config/gcpStorage');
    if (!storage) {
      return res.status(500).json({ success: false, message: 'Storage not configured' });
    }

    const bucketObj = storage.bucket(bucket);
    const file = bucketObj.file(path);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      path
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Verify Email
export const verifyEmailHandler = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    const validation = verifyEmailSchema.safeParse({ token });
    if (!validation.success) {
      return handleValidationError(validation.error, res);
    }

    await verifyEmail(validation.data.token);

    // For invited users, redirect to complete setup page
    const frontendUrl = `${process.env.APP_URL || 'http://localhost:3001'}/complete-setup?token=${validation.data.token}`;
    res.redirect(frontendUrl);
  } catch (error: any) {
    // On error, redirect to login with error
    const loginUrl = `${process.env.APP_URL || 'http://localhost:3001'}/login?error=${encodeURIComponent(error.message)}`;
    res.redirect(loginUrl);
  }
};

// Login
export const login = async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    if (!validation.success) {
      return handleValidationError(validation.error, res);
    }

    const { email, password } = validation.data;
    const authUser = await loginUser(email, password);

    const { accessToken, refreshToken } = generateTokens(authUser);

    res.cookie('accessToken', accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.cookie('refreshToken', refreshToken, SECURE_COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: authUser,
        accessToken,
        refreshToken
      }
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: error.message
    });
  }
};

// Request Password Reset
export const requestPasswordResetHandler = async (req: Request, res: Response) => {
  try {
    const validation = requestPasswordResetSchema.safeParse(req.body);
    if (!validation.success) {
      return handleValidationError(validation.error, res);
    }

    const result = await requestPasswordReset(validation.data.email);

    if ((result as any)?.rateLimited) {
      const retryAfter = (result as any)?.retryAfter ?? 60;
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Verify OTP
export const verifyOTPHandler = async (req: Request, res: Response) => {
  try {
    const validation = verifyOTPSchema.safeParse(req.body);
    if (!validation.success) {
      return handleValidationError(validation.error, res);
    }

    const result = await verifyOTP(validation.data.email, validation.data.otp);

    res.status(200).json({
      success: true,
      message: 'OTP verified',
      data: { resetToken: result.resetToken }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Reset Password
export const resetPasswordHandler = async (req: Request, res: Response) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);
    if (!validation.success) {
      return handleValidationError(validation.error, res);
    }

    const { email, resetToken, newPassword } = validation.data;
    const result = await resetPassword(email, resetToken, newPassword);

    res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Logout
export const logout = (req: Request, res: Response) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

// Get Current User
export const getCurrentUser = (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
};

// Add this function alongside your other exports

// Refresh Access Token
export const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token not found'
      });
    }

    const { verifyRefreshToken, generateAccessToken } = await import('../utils/useJwt');

    const decoded = verifyRefreshToken(refreshToken);
    const fullUser = await (await import('../models/auth')).getUserById(decoded.id);
    if (!fullUser) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    if (decoded.sv && fullUser.session_version && decoded.sv !== fullUser.session_version) {
      return res.status(401).json({
        success: false,
        message: 'Session expired due to login from another device'
      });
    }
    const authUser = { id: fullUser.id, email: fullUser.email, role: fullUser.role, sessionVersion: fullUser.session_version };
    const newAccessToken = generateAccessToken(authUser);
    const ACCESS_TOKEN_COOKIE_OPTIONS = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 15 * 60 * 1000
    };
    res.cookie('accessToken', newAccessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
    res.status(200).json({
      success: true,
      message: 'Access token refreshed',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Student: Get my classes
export const myClassesHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    // Get student profile
    const studentResult = await pool.query(
      'SELECT id FROM students WHERE user_id = $1',
      [req.user.id]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Get classes for this student
    const classesResult = await pool.query(`
      SELECT DISTINCT
        c.id as class_id,
        c.name as class_name,
        sec.id as section_id,
        sec.name as section_name,
        sub.id as subject_id,
        sub.name as subject_name,
        sub.code as subject_code,
        ta.schedule,
        u.name as teacher_name
      FROM teacher_assignments ta
      JOIN classes c ON ta.class_id = c.id
      JOIN sections sec ON ta.section_id = sec.id
      JOIN subjects sub ON ta.subject_id = sub.id
      JOIN teachers t ON ta.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE ta.class_id = (SELECT class_id FROM students WHERE id = $1)
        AND ta.section_id = (SELECT section_id FROM students WHERE id = $1)
      ORDER BY c.name, sec.name, sub.name
    `, [studentId]);
    
    res.status(200).json({ success: true, data: classesResult.rows });
  } catch (error: any) {
    console.error('Error fetching student classes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Student: Get my assignments
export const myStudentAssignmentsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    // Get student profile
    const studentResult = await pool.query(
      'SELECT id, class_id, section_id FROM students WHERE user_id = $1',
      [req.user.id]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    
    const { class_id, section_id } = studentResult.rows[0];
    
    // Get assignments for this class/section
    const assignmentsResult = await pool.query(`
      SELECT
        a.id,
        a.title,
        a.description,
        a.due_at,
        a.status,
        c.name as class_name,
        sec.name as section_name,
        sub.name as subject_name,
        u.name as teacher_name,
        COALESCE(s.id, '') as submission_id,
        COALESCE(s.status, '') as submission_status
      FROM assignments a
      JOIN classes c ON a.class_id = c.id
      JOIN sections sec ON a.section_id = sec.id
      JOIN subjects sub ON a.subject_id = sub.id
      JOIN teachers t ON a.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = $1
      WHERE a.class_id = $2 AND a.section_id = $3
      ORDER BY a.due_at ASC
    `, [studentResult.rows[0].id, class_id, section_id]);
    
    res.status(200).json({ success: true, data: assignmentsResult.rows });
  } catch (error: any) {
    console.error('Error fetching student assignments:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Student: Get my results
export const myResultsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    // Get student profile
    const studentResult = await pool.query(
      'SELECT id FROM students WHERE user_id = $1',
      [req.user.id]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Get results (submissions with grades)
    const resultsResult = await pool.query(`
      SELECT
        s.id as submission_id,
        a.id as assignment_id,
        a.title as exam_title,
        a.description,
        sub.name as subject_name,
        c.name as class_name,
        sec.name as section_name,
        s.grade,
        s.max_grade,
        s.status as submission_status,
        s.graded_at,
        s.feedback
      FROM submissions s
      JOIN assignments a ON s.assignment_id = a.id
      JOIN classes c ON a.class_id = c.id
      JOIN sections sec ON a.section_id = sec.id
      JOIN subjects sub ON a.subject_id = sub.id
      WHERE s.student_id = $1 AND s.status = 'graded'
      ORDER BY s.graded_at DESC
      LIMIT 20
    `, [studentId]);
    
    res.status(200).json({ success: true, data: resultsResult.rows });
  } catch (error: any) {
    console.error('Error fetching student results:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
