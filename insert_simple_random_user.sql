-- Simple random test user (fixed example)
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
  'randomuser' || (SELECT floor(random() * 99999))::text || '@vt.edu',
  '$2a$12$0V9r.ovtw4dv8Ms17HLoYeDQD7lngTCqVfz1R1HBCKE55/suHeB.q',
  'Random',
  'User',
  'Other',
  23,
  'Computer Science',
  false,
  'SEARCHING',
  false
);

