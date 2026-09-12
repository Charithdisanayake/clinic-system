const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // clients are never visible to unauthenticated requests

router.get('/', async (req, res) => {
  const search = req.query.search;
  if (search) {
    const { rows } = await pool.query(
      `SELECT * FROM clients
       WHERE full_name ILIKE $1 OR phone ILIKE $1 OR email ILIKE $1
       ORDER BY full_name`,
      [`%${search}%`]
    );
    return res.json(rows);
  }
  const { rows } = await pool.query(`SELECT * FROM clients ORDER BY full_name`);
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM clients WHERE id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Client not found.' });

  // Include their appointment history in one call -- the dashboard always
  // wants both together, so this saves a second round trip.
  const { rows: appts } = await pool.query(
    `SELECT a.id, a.starts_at, a.ends_at, a.status, a.notes,
            t.name AS treatment_name, d.full_name AS doctor_name
     FROM appointments a
     JOIN treatments t ON t.id = a.treatment_id
     JOIN doctors d ON d.id = a.doctor_id
     WHERE a.client_id = $1
     ORDER BY a.starts_at DESC`,
    [req.params.id]
  );
  res.json({ ...rows[0], appointments: appts });
});

router.post('/', async (req, res) => {
  const { full_name, phone, email, notes } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required.' });
  const { rows } = await pool.query(
    `INSERT INTO clients (full_name, phone, email, notes) VALUES ($1, $2, $3, $4) RETURNING *`,
    [full_name, phone || null, email || null, notes || null]
  );
  res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { full_name, phone, email, notes } = req.body;
  const { rows } = await pool.query(
    `UPDATE clients
     SET full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         email = COALESCE($3, email),
         notes = COALESCE($4, notes),
         updated_at = now()
     WHERE id = $5
     RETURNING *`,
    [full_name, phone, email, notes, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Client not found.' });
  res.json(rows[0]);
});

module.exports = router;
