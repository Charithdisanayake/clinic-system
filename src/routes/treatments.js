const path = require('path');
const fs = require('fs/promises');
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth); // every route below requires a logged-in doctor

// Best-effort delete of a previously uploaded file. Never let a missing or
// already-deleted file block the surrounding request -- it's just cleanup.
async function deleteImageFile(imagePath) {
  if (!imagePath) return;
  const filename = path.basename(imagePath); // ignore any directory component from the DB value
  try {
    await fs.unlink(path.join(UPLOAD_DIR, filename));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Failed to delete treatment image file:', err);
  }
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM treatments ORDER BY category, display_order, name`
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { category, name, description, price_cents, duration_minutes, display_order } = req.body;
  if (!category || !name || price_cents == null || !duration_minutes) {
    return res.status(400).json({ error: 'category, name, price_cents, and duration_minutes are required.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO treatments (category, name, description, price_cents, duration_minutes, display_order)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 0)) RETURNING *`,
    [category, name, description || null, price_cents, duration_minutes, display_order]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { category, name, description, price_cents, duration_minutes, active, display_order } = req.body;
  const { rows } = await pool.query(
    `UPDATE treatments
     SET category = COALESCE($1, category),
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         price_cents = COALESCE($4, price_cents),
         duration_minutes = COALESCE($5, duration_minutes),
         active = COALESCE($6, active),
         display_order = COALESCE($7, display_order),
         updated_at = now()
     WHERE id = $8
     RETURNING *`,
    [category, name, description, price_cents, duration_minutes, active, display_order, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Treatment not found.' });
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  // Soft-delete by deactivating rather than hard DELETE -- past appointments
  // reference treatment_id, and deleting the row would orphan that history.
  const { rows } = await pool.query(
    `UPDATE treatments SET active = false, updated_at = now() WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Treatment not found.' });
  res.json({ ok: true });
});

// Upload (or replace) a treatment's photo. multer's fileFilter/limits in
// ../middleware/upload.js already reject non-images and oversized files
// before this handler even runs.
router.post('/:id/image', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file received.' });

  const { rows: existingRows } = await pool.query('SELECT image_path FROM treatments WHERE id = $1', [req.params.id]);
  if (!existingRows[0]) {
    await deleteImageFile(req.file.filename); // orphaned upload, clean it up
    return res.status(404).json({ error: 'Treatment not found.' });
  }

  const newImagePath = `/uploads/treatments/${req.file.filename}`;
  const { rows } = await pool.query(
    `UPDATE treatments SET image_path = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [newImagePath, req.params.id]
  );

  await deleteImageFile(existingRows[0].image_path); // remove the old file now that the swap succeeded
  res.json(rows[0]);
});

router.delete('/:id/image', async (req, res) => {
  const { rows } = await pool.query('SELECT image_path FROM treatments WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Treatment not found.' });

  await deleteImageFile(rows[0].image_path);
  const { rows: updated } = await pool.query(
    `UPDATE treatments SET image_path = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
    [req.params.id]
  );
  res.json(updated[0]);
});

module.exports = router;
