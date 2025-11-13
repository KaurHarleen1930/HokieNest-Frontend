-- Insert a test user for testing listing/messaging functionality
-- Password: testpass123 (bcrypt hash)

INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  gender,
  age,
  major,
  is_admin,
  housing_status,
  suspended
) VALUES (
  'testuser@vt.edu',
  '$2a$12$0V9r.ovtw4dv8Ms17HLoYeDQD7lngTCqVfz1R1HBCKE55/suHeB.q', -- Password: testpass123 (same hash as example)
  'Test',
  'User',
  'Other',
  22,
  'Computer Science',
  false,
  'NOT_SEARCHING',
  false
)
ON CONFLICT (email) DO NOTHING;

-- You can also insert with a different email if testuser@vt.edu already exists
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  gender,
  age,
  major,
  is_admin,
  housing_status,
  suspended
) VALUES (
  'john.doe@vt.edu',
  '$2a$12$0V9r.ovtw4dv8Ms17HLoYeDQD7lngTCqVfz1R1HBCKE55/suHeB.q', -- Password: testpass123
  'John',
  'Doe',
  'Male',
  21,
  'Engineering',
  false,
  'SEARCHING',
  false
)
ON CONFLICT (email) DO NOTHING;

