-- Insert test user for messaging testing
-- Password: testpass123 (same hash as your example)
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
  '$2a$12$0V9r.ovtw4dv8Ms17HLoYeDQD7lngTCqVfz1R1HBCKE55/suHeB.q',
  'Test',
  'User',
  'Other',
  22,
  'Computer Science',
  false,
  'NOT_SEARCHING',
  false
);

