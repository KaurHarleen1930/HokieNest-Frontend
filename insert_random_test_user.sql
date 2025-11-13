-- Insert random test user for messaging testing
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
  'randomuser' || floor(random() * 10000) || '@vt.edu',
  '$2a$12$0V9r.ovtw4dv8Ms17HLoYeDQD7lngTCqVfz1R1HBCKE55/suHeB.q',
  (ARRAY['John', 'Jane', 'Alex', 'Sarah', 'Mike', 'Emily', 'Chris', 'Jordan', 'Taylor', 'Morgan'])[floor(random() * 10) + 1],
  (ARRAY['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore'])[floor(random() * 10) + 1],
  (ARRAY['Male', 'Female', 'Other'])[floor(random() * 3) + 1],
  floor(random() * 10 + 18)::int,
  (ARRAY['Computer Science', 'Engineering', 'Business', 'Biology', 'Psychology', 'Mathematics', 'Economics', 'Physics'])[floor(random() * 8) + 1],
  false,
  (ARRAY['NOT_SEARCHING', 'SEARCHING', 'FOUND'])[floor(random() * 3) + 1],
  false
);

