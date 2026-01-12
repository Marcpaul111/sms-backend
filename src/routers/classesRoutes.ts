import { Router } from 'express';
import pool from '../config/db.ts';
import { verifyTokenMiddleware } from '../middleware/auth.ts';
import { authorize } from '../middleware/rbac.ts';

const router = Router();

// Get all classes
router.get('/', verifyTokenMiddleware, async (req, res) => {
  try {
    const classesResult = await pool.query(`
      SELECT c.*, COUNT(s.id) as student_count
      FROM classes c
      LEFT JOIN students s ON c.id = s.class_id
      GROUP BY c.id
      ORDER BY c.name
    `);

    const classesWithSections = await Promise.all(
      classesResult.rows.map(async (classRow) => {
        const sectionsResult = await pool.query(`
          SELECT id, name
          FROM sections
          WHERE class_id = $1
          ORDER BY name
        `, [classRow.id]);

        return {
          ...classRow,
          sections: sectionsResult.rows
        };
      })
    );

    res.json({ success: true, data: classesWithSections });
  } catch (error) {
    console.error('Error fetching classes:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch classes' });
  }
});

// Create class (admin only)
router.post('/', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Class name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO classes (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating class:', error);
    if ((error as any).code === '23505') { // unique violation
      res.status(400).json({ success: false, message: 'Class name already exists' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to create class' });
    }
  }
});

// Get class by ID
router.get('/:id', verifyTokenMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM classes WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch class' });
  }
});

// Update class (admin only)
router.put('/:id', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  try {
    const result = await pool.query(
      'UPDATE classes SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating class:', error);
    res.status(500).json({ success: false, message: 'Failed to update class' });
  }
});

// Delete class (admin only)
router.delete('/:id', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM classes WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Error deleting class:', error);
    res.status(500).json({ success: false, message: 'Failed to delete class' });
  }
});

// Create section (admin only)
router.post('/:classId/sections', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { classId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Section name is required' });
  }

  try {
    // Check if class exists
    const classResult = await pool.query('SELECT id FROM classes WHERE id = $1', [classId]);
    if (classResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const result = await pool.query(
      'INSERT INTO sections (name, class_id) VALUES ($1, $2) RETURNING *',
      [name, classId]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating section:', error);
    if ((error as any).code === '23505') { // unique violation
      res.status(400).json({ success: false, message: 'Section name already exists in this class' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to create section' });
    }
  }
});

// Update section (admin only)
router.put('/:classId/sections/:sectionId', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { classId, sectionId } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'Section name is required' });
  }

  try {
    const result = await pool.query(
      'UPDATE sections SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND class_id = $3 RETURNING *',
      [name, sectionId, classId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating section:', error);
    if ((error as any).code === '23505') { // unique violation
      res.status(400).json({ success: false, message: 'Section name already exists in this class' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to update section' });
    }
  }
});

// Delete section (admin only)
router.delete('/:classId/sections/:sectionId', verifyTokenMiddleware, authorize('admin'), async (req, res) => {
  const { classId, sectionId } = req.params;

  try {
    const result = await pool.query('DELETE FROM sections WHERE id = $1 AND class_id = $2 RETURNING *', [sectionId, classId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    console.error('Error deleting section:', error);
    res.status(500).json({ success: false, message: 'Failed to delete section' });
  }
});

export default router;