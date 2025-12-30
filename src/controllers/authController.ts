import type { Request, Response } from 'express';
import { generateTokens } from '../utils/useJwt.ts';

import {
  registerUser,
  verifyEmail,
  loginUser,
  requestPasswordReset,
  verifyOTP,
  resetPassword,
  getAuthUserById,
  approveTeacher,
  inviteStudent,
  completeSetup
} from '../services/authService.ts';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  requestPasswordResetSchema,
  verifyOTPSchema,
  resetPasswordSchema,
  assignTeacherSchema
} from '../schemas/schemaValidations.ts';
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

export const assignTeacherHandler = async (req: Request, res: Response) => {
  try {
    const v = assignTeacherSchema.safeParse(req.body);
    if (!v.success) {
      return handleValidationError(v.error, res);
    }
    const { teacherUserId, subjectId, classId, sectionId } = v.data;
    const result = await (await import('../services/authService.ts')).assignTeacherToClass(
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
    const rows = await (await import('../services/authService.ts')).getAssignmentsForTeacher(req.user.id);
    res.status(200).json({ success: true, assignments: rows });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createAssignmentHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const { createAssignmentSchema } = await import('../schemas/schemaValidations.ts');
    const v = createAssignmentSchema.safeParse(req.body);
    if (!v.success) {
      return handleValidationError(v.error, res);
    }
    const { subjectId, classId, sectionId, title, description, dueAt, attachments } = v.data;
    const { createAssignment } = await import('../services/authService.ts');
    const result = await createAssignment(
      req.user.id,
      subjectId,
      classId,
      sectionId,
      title,
      description ?? null,
      new Date(dueAt),
      attachments || []
    );
    res.status(201).json({ success: true, message: result.message, id: result.id });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createSignedUploadUrlHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const { createSignedUploadSchema } = await import('../schemas/schemaValidations.ts');
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
    const { createSignedUploadUrl } = await import('../services/storage.ts');
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

// Verify Email
export const verifyEmailHandler = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    const validation = verifyEmailSchema.safeParse({ token });
    if (!validation.success) {
      return handleValidationError(validation.error, res);
    }

    const result = await verifyEmail(validation.data.token);

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
      user: authUser,
      accessToken,
      refreshToken
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
      resetToken: result.resetToken
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
    user: req.user
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

    const { verifyRefreshToken, generateAccessToken } = await import('../utils/useJwt.ts');

    try {
      const decoded = verifyRefreshToken(refreshToken);
      const fullUser = await (await import('../models/auth.ts')).getUserById(decoded.id);
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
        accessToken: newAccessToken
      });
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
