const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // every route below requires a logged-in doctor

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

module.exports = router;
