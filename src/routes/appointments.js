const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// List appointments, optionally filtered by date range and/or doctor --
// the dashboard's calendar/day view uses this.
router.get('/', async (req, res) => {
  const { from, to, doctor_id } = req.query;
  const conditions = [];
  const params = [];

  if (from) { params.push(from); conditions.push(`a.starts_at >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`a.starts_at < $${params.length}`); }
  if (doctor_id) { params.push(doctor_id); conditions.push(`a.doctor_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT a.*, c.full_name AS client_name, t.name AS treatment_name, d.full_name AS doctor_name
     FROM appointments a
     JOIN clients c ON c.id = a.client_id
     JOIN treatments t ON t.id = a.treatment_id
     JOIN doctors d ON d.id = a.doctor_id
     ${where}
     ORDER BY a.starts_at`,
    params
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { client_id, doctor_id, treatment_id, starts_at, ends_at, notes } = req.body;
  if (!client_id || !doctor_id || !treatment_id || !starts_at || !ends_at) {
    return res.status(400).json({
      error: 'client_id, doctor_id, treatment_id, starts_at, and ends_at are required.',
    });
  }

  // App-level check first: gives a clear, friendly error in the common case.
  // This alone is NOT sufficient under concurrent requests (see schema.sql) --
  // the EXCLUDE constraint below is what actually guarantees no overlap.
  const conflict = await pool.query(
    `SELECT id FROM appointments
     WHERE doctor_id = $1 AND status <> 'cancelled'
       AND tsrange(starts_at, ends_at) && tsrange($2::timestamptz, $3::timestamptz)`,
    [doctor_id, starts_at, ends_at]
  );
  if (conflict.rows.length > 0) {
    return res.status(409).json({ error: 'This doctor already has an appointment in that time slot.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO appointments (client_id, doctor_id, treatment_id, starts_at, ends_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [client_id, doctor_id, treatment_id, starts_at, ends_at, notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    // 23P01 = exclusion_violation -- the DB constraint caught a race that
    // slipped past the check above (two requests landing at the same instant).
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'This doctor already has an appointment in that time slot.' });
    }
    throw err;
  }
});

router.put('/:id', async (req, res) => {
  const { starts_at, ends_at, status, notes } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE appointments
       SET starts_at = COALESCE($1, starts_at),
           ends_at = COALESCE($2, ends_at),
           status = COALESCE($3, status),
           notes = COALESCE($4, notes)
       WHERE id = $5
       RETURNING *`,
      [starts_at, ends_at, status, notes, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Appointment not found.' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'That change would overlap another appointment for this doctor.' });
    }
    throw err;
  }
});

module.exports = router;
