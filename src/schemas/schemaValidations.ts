import { z } from 'zod';
import { UserRole } from '../constants/userRoles.ts';

// Register validation
export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase')
    .regex(/[a-z]/, 'Password must contain lowercase')
    .regex(/[0-9]/, 'Password must contain number'),
  role: z.enum([UserRole.ADMIN, UserRole.TEACHER, UserRole.STUDENT])
});

export type RegisterInput = z.infer<typeof registerSchema>;

// Login validation
export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password required')
});

export type LoginInput = z.infer<typeof loginSchema>;

// Verify email
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Token required')
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// Request password reset
export const requestPasswordResetSchema = z.object({
  email: z.email('Invalid email address')
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

// Verify OTP
export const verifyOTPSchema = z.object({
  email: z.email('Invalid email address'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits')
});

export type VerifyOTPInput = z.infer<typeof verifyOTPSchema>;

// Reset password
export const resetPasswordSchema = z.object({
  email: z.email('Invalid email address'),
  resetToken: z.string().min(1, 'Reset token required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase')
    .regex(/[a-z]/, 'Password must contain lowercase')
    .regex(/[0-9]/, 'Password must contain number')
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
