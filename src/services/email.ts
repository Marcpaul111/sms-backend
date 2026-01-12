import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const APP_URL = process.env.APP_URL || 'http://localhost:3001';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const safeSend = async (payload: any) => {
  if (!resend) {
    console.log('Email send simulated:', {
      to: payload.to,
      subject: payload.subject
    });
    return { simulated: true };
  }
  return await resend.emails.send(payload);
};

const sendWithFallback = async (payload: any) => {
  const first = await safeSend(payload);
  const error = (first as any)?.error;
  const message = error?.message as string | undefined;
  if (message && /domain is not verified/i.test(message)) {
    const retry = await safeSend({ ...payload, from: 'onboarding@resend.dev' });
    return { result: retry, usedFallback: true };
  }
  return { result: first, usedFallback: false };
};

export const sendVerificationEmail = async (email: string, token: string) => {
  try {
    const verificationLink = `${APP_URL}/complete-setup?token=${token}`;
    console.log('Verification link:', verificationLink);

    const { result, usedFallback } = await sendWithFallback({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to School SMS!</h2>
          <p>Thank you for signing up. Please verify your email address by clicking the link below:</p>
          <a href="${verificationLink}" style="display: inline-block; background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Verify Email
          </a>
          <p>Or copy and paste this link in your browser:</p>
          <p>${verificationLink}</p>
          <p style="color: #666; font-size: 12px;">This link expires in 24 hours.</p>
        </div>
      `
    });

    const id = (result as any)?.data?.id;
    const error = (result as any)?.error;
    if (error) {
      console.error('Resend error:', error);
      throw new Error(error?.message || 'Resend failed');
    }
    console.log(
      `✓ Verification email sent to ${email}`,
      id ? `(id=${id})` : '(simulated)',
      usedFallback ? '(fallback sender used)' : ''
    );
  } catch (error) {
    console.error('❌ Failed to send verification email:', error);
    throw error;
  }
};

export const sendOTPEmail = async (email: string, otp: string) => {
  try {
    const { result, usedFallback } = await sendWithFallback({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Use the OTP below to proceed:</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 4px; text-align: center; margin: 20px 0;">
            <h1 style="letter-spacing: 2px; margin: 0; color: #007bff;">${otp}</h1>
          </div>
          <p style="color: #666;">This OTP will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request a password reset, please ignore this email.</p>
        </div>
      `
    });

    const id = (result as any)?.data?.id;
    const error = (result as any)?.error;
    if (error) {
      console.error('Resend error:', error);
      throw new Error(error?.message || 'Resend failed');
    }
    console.log(
      `✓ OTP email sent to ${email}`,
      id ? `(id=${id})` : '(simulated)',
      usedFallback ? '(fallback sender used)' : ''
    );
  } catch (error) {
    console.error('❌ Failed to send OTP email:', error);
    throw error;
  }
};

export const sendPasswordResetConfirmation = async (email: string) => {
  try {
    const { result, usedFallback } = await sendWithFallback({
      from: FROM_EMAIL,
      to: email,
      subject: 'Password Reset Successful',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Successful</h2>
          <p>Your password has been successfully reset. You can now login with your new password.</p>
          <a href="${APP_URL}/login" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Go to Login
          </a>
          <p style="color: #999; font-size: 12px;">If you didn't make this change, please contact support immediately.</p>
        </div>
      `
    });

    const id = (result as any)?.data?.id;
    const error = (result as any)?.error;
    if (error) {
      console.error('Resend error:', error);
      throw new Error(error?.message || 'Resend failed');
    }
    console.log(
      `✓ Confirmation email sent to ${email}`,
      id ? `(id=${id})` : '(simulated)',
      usedFallback ? '(fallback sender used)' : ''
    );
  } catch (error) {
    console.error('❌ Failed to send confirmation email:', error);
    throw error;
  }
};
