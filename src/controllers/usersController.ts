import type { Request, Response } from 'express';

// Get Current User Profile
export const getMyProfileHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    // Fetch fresh user data from database to include profile_picture
    const updatedUser = await (await import('../models/auth')).getUserById(req.user.id);

    // Generate signed URL for profile picture if exists
    let profile_picture_url = updatedUser?.profile_picture;
    if (profile_picture_url) {
      const { storage } = await import('../config/gcpStorage');
      if (storage) {
        const bucketObj = storage.bucket('images-sms');
        const file = bucketObj.file(profile_picture_url);
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4' as const,
          action: 'read' as const,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        profile_picture_url = signedUrl;
      }
    }

    res.status(200).json({
      success: true,
      data: { user: { ...updatedUser, profile_picture: profile_picture_url } }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update User Profile
export const updateProfileHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { name, email } = req.body;
    const userId = req.user.id;

    if (!name && !email) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const pool = (await import('../config/db')).default;

    // Check if email is already taken (if email is being updated)
    if (email) {
      const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
    }

    // Build update query
    let updateFields = [];
    let values = [];
    let paramIndex = 1;

    if (name) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (email) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(email);
    }

    values.push(userId);

    await pool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Fetch updated user
    const updatedUser = await (await import('../models/auth')).getUserById(userId);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: updatedUser }
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Change Password
export const changePasswordHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
    }

    const pool = (await import('../config/db')).default;

    // Get current user with password hash
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = userResult.rows[0];

    // If user doesn't have a password yet, set it directly
    if (!user.password_hash) {
      const bcrypt = await import('bcrypt');
      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
      return res.status(200).json({
        success: true,
        message: 'Password set successfully'
      });
    }

    // Verify current password
    const bcrypt = await import('bcrypt');
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Profile Picture
export const uploadProfilePictureHandler = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = req.user.id;
    const filename = req.file.originalname;
    const path = `profiles/${userId}/${Date.now()}-${filename}`;

    // Upload to GCP
    const { storage } = await import('../config/gcpStorage');
    if (!storage) {
      return res.status(500).json({ success: false, message: 'Storage not configured' });
    }

    const bucketObj = storage.bucket('images-sms');
    const file = bucketObj.file(path);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    // Get signed URL for the profile picture (valid for 7 days)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4' as const,
      action: 'read' as const,
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Update user profile_picture in database
    const pool = (await import('../config/db')).default;
    await pool.query('UPDATE users SET profile_picture = $1 WHERE id = $2', [path, userId]);

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: { path, url: signedUrl }
    });
  } catch (error: any) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
