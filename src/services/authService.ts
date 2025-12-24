import bcrypt from 'bcrypt';
import crypto from 'crypto';
import pool from '../config/db.ts';
import { sendVerificationEmail, sendOTPEmail, sendPasswordResetConfirmation } from './email.ts';
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
  getUserById
} from '../models/auth.ts';

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

  await sendVerificationEmail(email, verificationToken);

  return {
    user,
    message: 'Registration successful. Please check your email to verify your account.'
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

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role
  };
};

// Request password reset (send OTP)
export const requestPasswordReset = async (email: string) => {
  const user = await getUserByEmail(email);

  if (!user) {
    return { message: 'If email exists, OTP has been sent' };
  }

  const otp = generateOTP();
  const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

  await setUserOtp(user.id, otp, otpExpires);

  await sendOTPEmail(email, otp);

  return { message: 'OTP sent to your email' };
};

// Verify OTP
export const verifyOTP = async (email: string, otp: string) => {
  const user = await getUserByEmailAndOtp(email, otp);

  if (!user) {
    throw new Error('Invalid or expired OTP');
  }

  const resetToken = generateToken();
  const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

  await clearOtpAndSetResetToken(user.id, resetToken, resetTokenExpires);

  return { resetToken };
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
    email: user.email,
    role: user.role
  };
};
