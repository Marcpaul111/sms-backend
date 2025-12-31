import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db';
import { sendVerificationEmail, sendOTPEmail, sendPasswordResetConfirmation } from './email';
import {
  getUserByEmail,
  getUserByVerificationToken,
  getUserByEmailAndOtp,
  getUserByEmailAndResetToken,
  createUser,
  updateUserVerification,
  setUserOtp,
  clearOtpAndSetResetToken,
  updatePasswordAndClearReset,
  getUserById,
  updateSessionVersion,
  incrementOtpAttempts
} from '../models/auth';
import {
  getTeacherByUserId,
  createTeacherByUserId,
  activateTeacherByUserId,
  updatePasswordAndVerifyByToken
} from '../models/auth';
import {
  createTeacherAssignment,
  listAssignmentsByTeacherUserId
} from '../models/auth';
import {
  createAssignment as createAssignmentModel,
  listAssignmentsForTeacher as listAssignmentsForTeacherModel
} from '../models/auth';

// Generate random token
const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate OTP
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register with email verification
export const registerUser = async (name: string, email: string, password: string, role: string) => {
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await createUser(name, email, hashedPassword, role, verificationToken, tokenExpires);

  if (role === 'teacher') {
    await createTeacherByUserId(user.id);
    console.log('Teacher signup pending admin approval:', email);
  } else {
    console.log('Dispatching verification email to:', email);
    try {
      await sendVerificationEmail(email, verificationToken);
      console.log('Verification email dispatched to:', email);
    } catch (e) {
      console.error('Verification email failed for:', email, e);
    }
  }

  return {
    user,
    message: role === 'teacher'
      ? 'Registration successful. Waiting for admin approval.'
      : 'Registration successful. Please check your email to verify your account.'
  };
};

// Verify email
export const verifyEmail = async (token: string) => {
  const user = await getUserByVerificationToken(token);
  if (!user) {
    throw new Error('Invalid or expired verification token');
  }

  await updateUserVerification(user.id);

  return { message: 'Email verified successfully' };
};

// Login
export const loginUser = async (email: string, password: string) => {
  const user = await getUserByEmail(email);

  if (!user) {
    throw new Error('Invalid email or password');
  }

  if (!user.email_verified) {
    throw new Error('Please verify your email before logging in');
  }
  if (user.role === 'teacher') {
    const teacher = await getTeacherByUserId(user.id);
    if (!teacher || !teacher.is_active) {
      throw new Error('Waiting for admin approval');
    }
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  const sessionVersion = crypto.randomBytes(16).toString('hex');
  try {
    await updateSessionVersion(user.id, sessionVersion);
  } catch (e) {
    console.error('Failed to update session version', e);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sessionVersion
  };
};

// Request password reset (send OTP)
export const requestPasswordReset = async (email: string) => {
  const user = await getUserByEmail(email);

  if (!user) {
    return { message: 'If email exists, OTP has been sent' };
  }

  const COOLDOWN_MS = 60 * 1000;
  if (user.otp_expires_at) {
    const lastRequestedAt = new Date(user.otp_expires_at).getTime() - 10 * 60 * 1000;
    const now = Date.now();
    const sinceLast = now - lastRequestedAt;
    if (sinceLast < COOLDOWN_MS) {
      const retryAfter = Math.ceil((COOLDOWN_MS - sinceLast) / 1000);
      return { message: `Please wait ${retryAfter}s before requesting another OTP`, rateLimited: true, retryAfter };
    }
  }

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  await setUserOtp(user.id, otp, otpExpires);

  await sendOTPEmail(email, otp);

  return { message: 'OTP sent to your email' };
};

// Verify OTP
export const verifyOTP = async (email: string, otp: string) => {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid or expired OTP');
  }

  // If OTP does not match or expired, increment attempts and enforce limit
  const matched = await getUserByEmailAndOtp(email, otp);
  if (!matched) {
    const attempts = await incrementOtpAttempts(user.id);
    const MAX_ATTEMPTS = 5;
    if (attempts >= MAX_ATTEMPTS) {
      throw new Error('Too many invalid attempts. Please request a new OTP.');
    }
    throw new Error('Invalid or expired OTP');
  }

  const resetToken = generateToken();
  const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

  await clearOtpAndSetResetToken(matched.id, resetToken, resetTokenExpires);

  return { resetToken };
};

export const approveTeacher = async (userId: string) => {
  const user = await getUserById(userId);
  if (!user || user.role !== 'teacher') {
    throw new Error('Teacher not found');
  }
  await activateTeacherByUserId(userId);
  if (!user.email_verified && user.verification_token) {
    try {
      await sendVerificationEmail(user.email, user.verification_token);
    } catch {}
  }
  return { message: 'Teacher approved and notified' };
};

export const inviteStudent = async (
  name: string,
  email: string,
  classId: string,
  sectionId: string,
  rollNumber: number
) => {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('Student email already exists');
  }
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const hashed = await bcrypt.hash(tempPassword, 10);
  const token = generateToken();
  const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const user = await createUser(name, email, hashed, 'student', token, tokenExpires);
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO students (user_id, roll_number, class_id, section_id)
       VALUES ($1, $2, $3, $4)`,
      [user.id, rollNumber, classId, sectionId]
    );
  } finally {
    client.release();
  }
  await sendVerificationEmail(email, token);
  return { message: 'Student invited', userId: user.id };
};

export const completeSetup = async (token: string, newPassword: string) => {
  const user = await getUserByVerificationToken(token);
  if (!user) {
    throw new Error('Invalid or expired token');
  }
  const hashed = await bcrypt.hash(newPassword, 10);
  await updatePasswordAndVerifyByToken(user.id, hashed);
  return { message: 'Account setup completed' };
};

export const assignTeacherToClass = async (
  teacherUserId: string,
  subjectId: string,
  classId: string,
  sectionId: string
) => {
  const teacher = await getTeacherByUserId(teacherUserId);
  if (!teacher) {
    throw new Error('Teacher not found');
  }
  const result = await createTeacherAssignment(teacherUserId, subjectId, classId, sectionId);
  if (!result.id) {
    return { message: 'Assignment already exists' };
  }
  return { message: 'Teacher assigned successfully', id: result.id };
};

export const getAssignmentsForTeacher = async (teacherUserId: string) => {
  const teacher = await getTeacherByUserId(teacherUserId);
  if (!teacher) {
    throw new Error('Teacher not found');
  }
  const rows = await listAssignmentsByTeacherUserId(teacherUserId);
  return rows;
};

export const createAssignment = async (
  teacherUserId: string,
  subjectId: string,
  classId: string,
  sectionId: string,
  title: string,
  description: string | null,
  dueAt: Date,
  attachments: string[]
) => {
  const teacher = await getTeacherByUserId(teacherUserId);
  if (!teacher || !teacher.is_active) {
    throw new Error('Teacher not found or not active');
  }
  const row = await createAssignmentModel(teacherUserId, subjectId, classId, sectionId, title, description || null, dueAt, attachments || []);
  try {
    const payload = JSON.stringify({
      type: 'assignment_created',
      teacherUserId,
      subjectId,
      classId,
      sectionId,
      title,
      id: row.id
    });
    await (await import('../config/db')).default.query(`SELECT pg_notify('user_events', $1)`, [payload]);
  } catch {}
  return { id: row.id, message: 'Assignment created' };
};

export const listAssignmentsForTeacher = async (teacherUserId: string) => {
  const teacher = await getTeacherByUserId(teacherUserId);
  if (!teacher) {
    throw new Error('Teacher not found');
  }
  const rows = await listAssignmentsForTeacherModel(teacherUserId);
  return rows;
};
// Reset password
export const resetPassword = async (email: string, resetToken: string, newPassword: string) => {
  const user = await getUserByEmailAndResetToken(email, resetToken);

  if (!user) {
    throw new Error('Invalid or expired reset token');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await updatePasswordAndClearReset(user.id, hashedPassword);

  await sendPasswordResetConfirmation(email);

  return { message: 'Password reset successful' };
};

export const getAuthUserById = async (id: string) => {
  const user = await getUserById(id);
  if (!user) {
    throw new Error('User not found');
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
};
