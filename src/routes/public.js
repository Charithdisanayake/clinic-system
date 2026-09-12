const express = require('express');
const pool = require('../db');

const router = express.Router();

// The ONLY unauthenticated data route in the whole app. It selects
// specific columns by name (never `SELECT *`) so that adding an internal
// column to `treatments` later -- e.g. a supplier cost -- can't silently
// leak onto the public pricing page.
router.get('/treatments', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, category, name, description, price_cents, duration_minutes
     FROM treatments
     WHERE active = true
     ORDER BY category, display_order, name`
  );
  res.json(rows);
});

module.exports = router;
