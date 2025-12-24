import jwt from 'jsonwebtoken';
import type { IAuthUser } from '../types.d.ts';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

// Validate secrets exist
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in .env');
}

// Recommended expiration times
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// Generate Access Token (short-lived)
export const generateAccessToken = (user: IAuthUser): string => {
  return jwt.sign(user, JWT_SECRET, {
    expiresIn: JWT_EXPIRY as string,
    algorithm: 'HS256'
  } as any);
};

// Generate Refresh Token (long-lived)
export const generateRefreshToken = (user: IAuthUser): string => {
  return jwt.sign(
    { id: user.id, email: user.email }, 
    JWT_REFRESH_SECRET, 
    {
      expiresIn: JWT_REFRESH_EXPIRY as string,
      algorithm: 'HS256'
    } as any
  );
};

// Verify Access Token
export const verifyAccessToken = (token: string): IAuthUser => {
  try {
    return jwt.verify(token, JWT_SECRET) as IAuthUser;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
};

// Verify Refresh Token
export const verifyRefreshToken = (token: string): { id: string; email: string } => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { id: string; email: string };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

// Generate both tokens at once
export const generateTokens = (user: IAuthUser) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user)
  };
};
