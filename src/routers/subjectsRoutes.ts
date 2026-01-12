import { Router } from 'express';
import pool from '../config/db.ts';
import { verifyTokenMiddleware } from '../middleware/auth.ts';
import { authorize } from '../middleware/rbac.ts';

const router = Router();

// Get all subjects
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, code, description, created_at as "createdAt" FROM subjects ORDER BY name');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subjects' });
  }
});

// Create subject (admin only)
router.post('/', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { name, code, description } = req.body;

  if (!name || !code) {
    return res.status(400).json({ success: false, message: 'Subject name and code are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO subjects (name, code, description) VALUES ($1, $2, $3) RETURNING id, name, code, description, created_at as "createdAt"',
      [name, code, description]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating subject:', error);
    if ((error as any).code === '23505') { // unique violation
      res.status(400).json({ success: false, message: 'Subject code already exists' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to create subject' });
    }
  }
});

// Get subject by ID
router.get('/:id', verifyTokenMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT id, name, code, description, created_at as "createdAt" FROM subjects WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching subject:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch subject' });
  }
});

// Update subject (admin only)
router.put('/:id', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, code, description } = req.body;

  try {
    const result = await pool.query(
      'UPDATE subjects SET name = $1, code = $2, description = $3 WHERE id = $4 RETURNING id, name, code, description, created_at as "createdAt"',
      [name, code, description, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating subject:', error);
    if ((error as any).code === '23505') { // unique violation
      res.status(400).json({ success: false, message: 'Subject code already exists' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update subject' });
    }
  }
});

// Delete subject (admin only)
router.delete('/:id', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }
    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ success: false, message: 'Failed to delete subject' });
  }
});

export default router;