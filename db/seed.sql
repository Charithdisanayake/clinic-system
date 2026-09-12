-- Sample data for local development.
--
-- No doctor account is seeded here on purpose -- a bcrypt hash pasted into
-- a text file isn't tied to any real password. Instead, run this after
-- applying schema.sql:
--
--   node scripts/create-doctor.js "Dr. Amaya Silva" amaya@example-clinic.com
--
-- It will prompt for a password, hash it properly, and insert the row.

INSERT INTO treatments (category, name, description, price_cents, duration_minutes, display_order) VALUES
('Facials', 'Signature Hydrating Facial', 'Deep hydration facial for dry or dull skin.', 12000, 60, 1),
('Facials', 'Deep Cleanse Facial', 'Extraction-focused facial for congested skin.', 9500, 45, 2),
('Injectables', 'Anti-Wrinkle Injections (1 area)', 'Botulinum toxin treatment, single area.', 25000, 30, 1),
('Injectables', 'Dermal Filler (1ml)', 'Hyaluronic acid filler, per syringe.', 45000, 45, 2),
('Skin Resurfacing', 'Chemical Peel - Light', 'Superficial peel for brightening.', 15000, 40, 1),
('Skin Resurfacing', 'Microneedling', 'Collagen-induction therapy for texture and scarring.', 20000, 60, 2),
('Laser', 'Laser Hair Removal - Small Area', 'e.g. upper lip, underarms.', 8000, 20, 1),
('Laser', 'Laser Hair Removal - Large Area', 'e.g. full legs, back.', 22000, 60, 2);
