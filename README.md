# Clinic System

A small web system for a skin & aesthetic clinic:
- **Public pricing page** (`/`) — anyone can view treatments and prices, no login.
- **Staff dashboard** (`/admin/login.html`) — doctors log in to manage clients,
  treatment pricing, and appointments.

Built as **Approach A** from the design discussion: a single Express server
enforcing authorization in application code (route middleware), backed by
one PostgreSQL database. No microservices, no queues, no cache layer --
none of that is justified at this scale (single clinic, <20 appointments/day).

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Create a Postgres database, then copy `.env.example` to `.env` and fill
   in `DATABASE_URL` and a random `SESSION_SECRET`.
3. Apply the schema:
   ```
   psql "$DATABASE_URL" -f db/schema.sql
   psql "$DATABASE_URL" -f db/seed.sql
   ```
4. Create a doctor login (prompts for a password, hashes it properly):
   ```
   node scripts/create-doctor.js "Dr. Amaya Silva" amaya@example-clinic.com
   ```
5. Start the server:
   ```
   npm start
   ```
   Visit `http://localhost:3000` for the pricing page and
   `http://localhost:3000/admin/login.html` for staff login.

## Project layout

```
db/schema.sql          Tables + the constraint that blocks double-booking
db/seed.sql             Sample treatments for local dev
scripts/create-doctor.js  CLI to add a staff login safely
src/db.js               Postgres connection pool
src/middleware/auth.js  requireAuth -- the single choke point for the
                         public/staff data boundary
src/routes/public.js     GET /api/public/treatments -- the ONLY unauthenticated route
src/routes/auth.js       login / logout / session check
src/routes/clients.js    staff-only client CRUD
src/routes/treatments.js staff-only pricing CRUD
src/routes/appointments.js staff-only scheduling, with overlap checks
src/routes/doctors.js    staff-only doctor listing (for the appointment form)
src/app.js               wires it all together, mounts static frontend
public/index.html        public pricing page
public/admin/*.html      staff login + dashboard
```

## Treatment images

Staff can upload a photo per treatment from the dashboard (Treatments &
Pricing tab -> "Add photo" / "Replace"). It shows up as a thumbnail next to
that treatment on the public pricing page.

- **If you already ran `db/schema.sql` before this feature existed**, apply
  the migration once: `psql "your-connection-string" -f db/migrations/001_add_treatment_images.sql`.
  Fresh installs don't need this -- `schema.sql` already includes the column.
- Files are validated server-side (JPEG/PNG/WEBP only, 5MB max) and saved
  with a randomly generated filename to `public/uploads/treatments/` --
  never trust a browser-supplied filename or extension.
- Uploaded files are **not** committed to git (see `.gitignore`) and are
  **not** included when you zip/deploy this project manually -- if you
  move servers, copy `public/uploads/` over separately, or better, move to
  object storage (S3/R2) once you outgrow a single server.
- Replacing or removing a photo deletes the old file from disk so orphaned
  images don't pile up.

## Security notes (read this before deploying)

This is the part that matters more than performance at this scale:

1. **Public/private boundary.** Every route that touches `clients` or
   `appointments` goes through `requireAuth` in `src/middleware/auth.js`.
   The public route (`src/routes/public.js`) selects columns by name, never
   `SELECT *`, so an internal column added later can't leak onto the
   pricing page by accident. If you add a new route, mount it under
   `/api/admin/*` and make sure its router calls `router.use(requireAuth)`.
2. **Double-booking.** Prevented twice: the appointment route checks for
   overlaps before inserting (fast feedback), and `db/schema.sql` adds a
   Postgres `EXCLUDE` constraint that makes an overlapping insert physically
   impossible, even if two requests race each other. Don't remove the
   constraint even if the app-level check feels sufficient in testing.
3. **Sessions live in Postgres**, not memory, via `connect-pg-simple` --
   restarting the server (a deploy, a crash) won't silently log everyone in
   as "session not found" or, worse, break auth in a way that fails open.
4. **Passwords** are hashed with bcrypt (cost factor 12), never stored or
   logged in plaintext. Use `scripts/create-doctor.js` to create accounts --
   don't hand-write password hashes into SQL.
5. **Before going live**: set `COOKIE_SECURE=true` in `.env` (requires
   HTTPS), put the app behind a reverse proxy (Caddy or nginx) for TLS, and
   take regular backups of the Postgres database -- client and appointment
   data lives only there.

## What's intentionally NOT built

- No customer self-booking (per your requirements -- customers call/WhatsApp).
- No email/SMS reminders -- add later if needed; not core to the brief.
- No multi-location support -- schema and auth assume one clinic.
