import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import pool from '../config/db';
import { sendVerificationEmail, sendOTPEmail, sendPasswordResetConfirmation } from './email';
import {
  getUserByEmail,
  getUserByVerificationToken,
  getUserByEmailAndOtp,
  getUserByEmailAndResetToken,
  createUser,
  updateUserForReregistration,
  updateUserVerification,
  setUserOtp,
  clearOtpAndSetResetToken,
  updatePasswordAndClearReset,
  getUserById,
  updateSessionVersion,
  incrementOtpAttempts,
  getTeacherByUserId,
  createTeacherByUserId,
  activateTeacherByUserId,
  updatePasswordAndVerifyByToken,
  createTeacherAssignment,
  updateTeacherAssignment,
  updateTeacherAssignmentSchedule,
  listAssignmentsByTeacherUserId,
  createAssignment as createAssignmentModel,
  listAssignmentsForTeacher as listAssignmentsForTeacherModel,
  updateAssignment as updateAssignmentModel,
  deleteAssignment as deleteAssignmentModel
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
    return await handleExistingUser(existingUser, name, email, password, role);
  }

  return await handleNewUser(name, email, password, role);
};

const handleExistingUser = async (existingUser: any, name: string, email: string, password: string, role: string) => {
  // Check registration attempts
  const attempts = existingUser.registration_attempts || 0;
  if (attempts >= 3) {
    throw new Error('Too many registration attempts. Please contact support.');
  }

  // If user is already verified/active, don't allow re-registration
  if (existingUser.email_verified) {
    throw new Error('Email already registered and verified');
  }

  // Increment attempts for existing unverified user
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET registration_attempts = $1 WHERE id = $2',
      [attempts + 1, existingUser.id]
    );
  } finally {
    client.release();
  }

  // Update existing user with new data
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await updateUserForReregistration(existingUser.id, name, hashedPassword, role, verificationToken, tokenExpires);

  // Handle teacher record
  if (role === 'teacher') {
    // Delete existing teacher record if any
    await client.query('DELETE FROM teachers WHERE user_id = $1', [existingUser.id]);
    await createTeacherByUserId(existingUser.id);
    console.log('Teacher re-signup pending admin approval:', email);
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
    user: existingUser,
    message: role === 'teacher'
      ? 'Registration successful. Waiting for admin approval.'
      : 'Registration successful. Please check your email to verify your account.'
  };
};

const handleNewUser = async (name: string, email: string, password: string, role: string) => {
  // New user registration
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = generateToken();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await createUser(name, email, hashedPassword, role, verificationToken, tokenExpires, 1); // Start with 1 attempt

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

  // Reset registration attempts on successful verification
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET registration_attempts = 0 WHERE id = $1',
      [user.id]
    );
  } finally {
    client.release();
  }

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
    if (!teacher?.is_active) {
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
  if (user?.role !== 'teacher') {
    throw new Error('Teacher not found');
  }
  await activateTeacherByUserId(userId);

  // Reset registration attempts on approval
  const client = await pool.connect();
  try {
    await client.query(
      'UPDATE users SET registration_attempts = 0 WHERE id = $1',
      [userId]
    );
  } finally {
    client.release();
  }

  if (!user.email_verified && user.verification_token) {
    try {
      await sendVerificationEmail(user.email, user.verification_token);
    } catch {}
  }
  return { message: 'Teacher approved and notified' };
};

export const rejectTeacher = async (userId: string) => {
  const user = await getUserById(userId);
  if (user?.role !== 'teacher') {
    throw new Error('Teacher not found');
  }

  const client = await pool.connect();
  try {
    // Delete the teacher record to allow re-application
    await client.query('DELETE FROM teachers WHERE user_id = $1', [userId]);
    return { message: 'Teacher application rejected. User can reapply.' };
  } finally {
    client.release();
  }
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

export const inviteTeacher = async (name: string, email: string) => {
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('Teacher email already exists');
  }
  const tempPassword = crypto.randomBytes(16).toString('hex');
  const hashed = await bcrypt.hash(tempPassword, 10);
  const token = generateToken();
  const tokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const user = await createUser(name, email, hashed, 'teacher', token, tokenExpires);
  await createTeacherByUserId(user.id);
  await activateTeacherByUserId(user.id); // Automatically approve invited teachers
  await sendVerificationEmail(email, token);
  return { message: 'Teacher invited successfully', userId: user.id };
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
  sectionId: string,
  schedule?: string
) => {
  const teacher = await getTeacherByUserId(teacherUserId);
  if (!teacher) {
    throw new Error('Teacher not found');
  }
  const result = await createTeacherAssignment(teacherUserId, subjectId, classId, sectionId, schedule);
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

export const updateAssignmentSchedule = async (assignmentId: string, schedule: string) => {
  const id = await updateTeacherAssignmentSchedule(assignmentId, schedule);
  if (!id) {
    throw new Error('Assignment not found');
  }
  return { message: 'Schedule updated successfully' };
};

export const updateAssignment = async (
  assignmentId: string,
  teacherUserId: string,
  subjectId: string,
  classId: string,
  sectionId: string,
  schedule?: string
) => {
  const id = await updateTeacherAssignment(assignmentId, teacherUserId, subjectId, classId, sectionId, schedule);
  if (!id) {
    throw new Error('Assignment not found');
  }
  return { message: 'Assignment updated successfully' };
};

export const getAllAssignments = async () => {
  const client = await pool.connect();
  try {
    const r = await client.query(`
      SELECT
        ta.id,
        u.name as teacher_name,
        u.email as teacher_email,
        subj.name as subject_name,
        subj.code as subject_code,
        c.name as class_name,
        sec.name as section_name,
        ta.assigned_at,
        ta.schedule,
        COUNT(s.id) as student_count
      FROM teacher_assignments ta
      JOIN teachers t ON ta.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      JOIN subjects subj ON ta.subject_id = subj.id
      JOIN classes c ON ta.class_id = c.id
      JOIN sections sec ON ta.section_id = sec.id
      LEFT JOIN students s ON ta.class_id = s.class_id AND ta.section_id = s.section_id
      GROUP BY ta.id, u.name, u.email, subj.name, subj.code, c.name, sec.name, ta.assigned_at, ta.schedule
      ORDER BY ta.assigned_at DESC
    `);
    return r.rows;
  } finally {
    client.release();
  }
};

export const createAssignment = async (
  teacherUserId: string,
  options: {
    subjectId: string;
    classId: string;
    sectionId: string;
    title: string;
    description: string | null;
    dueAt: Date;
    attachments: string[];
  }
) => {
  const { subjectId, classId, sectionId, title, description, dueAt, attachments } = options;
  const teacher = await getTeacherByUserId(teacherUserId);
  if (!teacher?.is_active) {
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

export const updateIndividualAssignment = async (
  assignmentId: string,
  teacherUserId: string,
  options: {
    subjectId: string;
    classId: string;
    sectionId: string;
    title: string;
    description: string | null;
    dueAt: Date;
    attachments: string[];
  }
) => {
  const teacher = await getTeacherByUserId(teacherUserId);
  if (!teacher?.is_active) {
    throw new Error('Teacher not found or not active');
  }
  const { subjectId, classId, sectionId, title, description, dueAt, attachments } = options;
  const row = await updateAssignmentModel(assignmentId, teacherUserId, subjectId, classId, sectionId, title, description || null, dueAt, attachments || []);
  return { id: row.id, message: 'Assignment updated' };
};

export const deleteIndividualAssignment = async (assignmentId: string, teacherUserId: string) => {
  const teacher = await getTeacherByUserId(teacherUserId);
  if (!teacher?.is_active) {
    throw new Error('Teacher not found or not active');
  }

  // Get assignment details including attachments before deleting
  const client = await pool.connect();
  try {
    const assignmentResult = await client.query(
      'SELECT attachments FROM assignments WHERE id = $1 AND teacher_id = $2',
      [assignmentId, teacher.id]
    );

    if (assignmentResult.rows.length === 0) {
      throw new Error('Assignment not found or access denied');
    }

    const attachments = assignmentResult.rows[0].attachments || [];

    // Delete all attachment files from storage
    const { deleteAssignmentAttachment } = await import('./storage');
    for (const attachmentPath of attachments) {
      try {
        await deleteAssignmentAttachment(assignmentId, attachmentPath);
      } catch (error) {
        console.error('Error deleting attachment:', attachmentPath, error);
        // Continue with other files even if one fails
      }
    }

    // Delete the assignment record
    const row = await deleteAssignmentModel(assignmentId, teacherUserId);
    if (!row) {
      throw new Error('Assignment not found or access denied');
    }

    return { message: 'Assignment deleted' };
  } finally {
    client.release();
  }
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


export const getPendingTeachers = async () => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT
        u.id as user_id,
        u.name,
        u.email,
        u.created_at as applied_date,
        t.id as teacher_id
       FROM users u
       JOIN teachers t ON u.id = t.user_id
       WHERE u.role = 'teacher' AND t.is_active = FALSE
       ORDER BY u.created_at DESC`
    );
    return r.rows;
  } finally {
    client.release();
  }
};

export const getAllTeachers = async () => {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT
        u.id as user_id,
        u.name,
        u.email,
        u.created_at as applied_date,
        t.id as teacher_id,
        t.is_active
       FROM users u
       JOIN teachers t ON u.id = t.user_id
       WHERE u.role = 'teacher'
       ORDER BY u.created_at DESC`
    );
    return r.rows;
  } finally {
    client.release();
  }
};

export const getAllTeachersWithDetails = async () => {
  const client = await pool.connect();
  try {
    // First get basic teacher info
    const teachersQuery = await client.query(`
      SELECT
        u.id as user_id,
        u.name,
        u.email,
        u.created_at as applied_date,
        t.id as teacher_id,
        t.is_active
      FROM users u
      JOIN teachers t ON u.id = t.user_id
      WHERE u.role = 'teacher'
      ORDER BY u.created_at DESC
    `);

    // Then get subjects for each teacher
    const subjectsQuery = await client.query(`
      SELECT
        t.user_id,
        s.id,
        s.name,
        s.code
      FROM teacher_assignments ta
      JOIN teachers t ON ta.teacher_id = t.id
      JOIN subjects s ON ta.subject_id = s.id
      ORDER BY t.user_id, s.name
    `);

    // Then get classes for each teacher
    const classesQuery = await client.query(`
      SELECT
        t.user_id,
        c.id,
        c.name
      FROM teacher_assignments ta
      JOIN teachers t ON ta.teacher_id = t.id
      JOIN classes c ON ta.class_id = c.id
      ORDER BY t.user_id, c.name
    `);

    // Then get student counts for each teacher
    const studentCountsQuery = await client.query(`
      SELECT
        t.user_id,
        COUNT(DISTINCT s.id) as student_count
      FROM teacher_assignments ta
      JOIN teachers t ON ta.teacher_id = t.id
      LEFT JOIN students s ON ta.class_id = s.class_id AND ta.section_id = s.section_id
      GROUP BY t.user_id
    `);

    // Process the data
    const teachers = teachersQuery.rows;
    const subjectsMap = new Map();
    const classesMap = new Map();
    const studentCountsMap = new Map();

    // Group subjects by user_id
    subjectsQuery.rows.forEach(row => {
      if (!subjectsMap.has(row.user_id)) {
        subjectsMap.set(row.user_id, []);
      }
      subjectsMap.get(row.user_id).push({
        id: row.id,
        name: row.name,
        code: row.code
      });
    });

    // Group classes by user_id
    classesQuery.rows.forEach(row => {
      if (!classesMap.has(row.user_id)) {
        classesMap.set(row.user_id, []);
      }
      classesMap.get(row.user_id).push({
        id: row.id,
        name: row.name
      });
    });

    // Map student counts by user_id
    studentCountsQuery.rows.forEach(row => {
      studentCountsMap.set(row.user_id, Number.parseInt(row.student_count) || 0);
    });

    // Combine all data
    return teachers.map(teacher => ({
      ...teacher,
      subjects: subjectsMap.get(teacher.user_id) || [],
      classes: classesMap.get(teacher.user_id) || [],
      student_count: studentCountsMap.get(teacher.user_id) || 0
    }));

  } finally {
    client.release();
  }
};

export const toggleTeacherStatus = async (userId: string) => {
  const client = await pool.connect();
  try {
    // First, get current status
    const current = await client.query(
      'SELECT is_active FROM teachers WHERE user_id = $1',
      [userId]
    );
    if (current.rows.length === 0) {
      throw new Error('Teacher not found');
    }
    const newStatus = !current.rows[0].is_active;
    await client.query(
      'UPDATE teachers SET is_active = $1 WHERE user_id = $2',
      [newStatus, userId]
    );
    return { message: `Teacher ${newStatus ? 'activated' : 'deactivated'} successfully` };
  } finally {
    client.release();
  }
};
