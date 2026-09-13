const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const pool = require('./db');

const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const clientRoutes = require('./routes/clients');
const treatmentRoutes = require('./routes/treatments');
const appointmentRoutes = require('./routes/appointments');
const doctorRoutes = require('./routes/doctors');

const app = express();

app.use(express.json());

// Sessions are stored in Postgres (not memory) so logins survive a server
// restart or redeploy -- with one small server, that will happen often.
app.use(session({
  store: new pgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 8, // 8 hours -- a clinic shift
  },
}));

// --- Public API: pricing only, no auth ---
app.use('/api/public', publicRoutes);

// --- Auth API: login/logout ---
app.use('/api/auth', authRoutes);

// --- Staff-only APIs (each router applies requireAuth internally) ---
app.use('/api/admin/clients', clientRoutes);
app.use('/api/admin/treatments', treatmentRoutes);
app.use('/api/admin/appointments', appointmentRoutes);
app.use('/api/admin/doctors', doctorRoutes);

// --- Static frontend ---
// public/index.html and public/css/* are the customer-facing pricing page.
// public/admin/* is the staff dashboard shell (its data comes from the
// /api/admin/* routes above, which enforce login independently of this).
app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'login.html'));
});
app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'dashboard.html'));
});
app.use(express.static(path.join(__dirname, '..', 'public')));

// Centralized error handler -- keeps stack traces out of API responses.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

module.exports = app;
