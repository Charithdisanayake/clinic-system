-- Clinic system schema
-- Run with: psql "$DATABASE_URL" -f db/schema.sql

-- Needed for the exclusion constraint that blocks double-booking below.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------
-- doctors: the only accounts that can log in. Customers never get one.
-- ---------------------------------------------------------------------
CREATE TABLE doctors (
    id            SERIAL PRIMARY KEY,
    full_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- treatments: the public pricing menu. Publicly readable, staff-writable.
-- ---------------------------------------------------------------------
CREATE TABLE treatments (
    id               SERIAL PRIMARY KEY,
    category         TEXT NOT NULL,           -- e.g. 'Facials', 'Injectables'
    name             TEXT NOT NULL,
    description      TEXT,
    price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    active           BOOLEAN NOT NULL DEFAULT true,  -- inactive = hidden from public page
    display_order    INTEGER NOT NULL DEFAULT 0,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- clients: never exposed publicly. Staff-only, always.
-- ---------------------------------------------------------------------
CREATE TABLE clients (
    id         SERIAL PRIMARY KEY,
    full_name  TEXT NOT NULL,
    phone      TEXT,
    email      TEXT,
    notes      TEXT,               -- skin history, allergies, preferences
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- appointments: the double-booking risk lives here.
-- ---------------------------------------------------------------------
CREATE TABLE appointments (
    id            SERIAL PRIMARY KEY,
    client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    doctor_id     INTEGER NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
    treatment_id  INTEGER NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
    starts_at     TIMESTAMPTZ NOT NULL,
    ends_at       TIMESTAMPTZ NOT NULL,
    status        TEXT NOT NULL DEFAULT 'booked'
                    CHECK (status IN ('booked', 'completed', 'cancelled', 'no_show')),
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

-- The app layer already checks for overlapping appointments before
-- inserting (see src/routes/appointments.js), but that check-then-insert
-- has a race window if two requests land at once. This constraint is the
-- backstop that makes double-booking impossible at the data layer,
-- regardless of what the application code does or forgets to do.
-- Cancelled appointments don't count, since a doctor's slot is free again.
ALTER TABLE appointments
    ADD CONSTRAINT no_overlapping_appointments
    EXCLUDE USING gist (
        doctor_id WITH =,
        tsrange(starts_at, ends_at) WITH &&
    )
    WHERE (status <> 'cancelled');

CREATE INDEX idx_appointments_doctor_time ON appointments (doctor_id, starts_at);
CREATE INDEX idx_appointments_client ON appointments (client_id);
CREATE INDEX idx_treatments_active ON treatments (active, category, display_order);
