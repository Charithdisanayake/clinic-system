const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const { rows } = await pool.query(
    'SELECT id, full_name, password_hash FROM doctors WHERE email = $1',
    [email]
  );
  const doctor = rows[0];

  // Deliberately identical response whether the email doesn't exist or the
  // password is wrong -- don't leak which one it was.
  if (!doctor) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const passwordMatches = await bcrypt.compare(password, doctor.password_hash);
  if (!passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Regenerate the session on login to prevent session fixation.
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Login failed, try again.' });
    req.session.doctorId = doctor.id;
    req.session.doctorName = doctor.full_name;
    res.json({ id: doctor.id, fullName: doctor.full_name });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.session.doctorId, fullName: req.session.doctorName });
});

module.exports = router;
