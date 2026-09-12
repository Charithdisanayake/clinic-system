const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Only id and name -- never expose password_hash or email here.
router.get('/', async (req, res) => {
  const { rows } = await pool.query(`SELECT id, full_name FROM doctors ORDER BY full_name`);
  res.json(rows);
});

module.exports = router;
