// Script to insert a test user for testing messaging functionality
import { supabase } from '../lib/supabase';
import bcrypt from 'bcrypt';

async function insertTestUser() {
  try {
    // Generate a random test user
    const testUser = {
      email: `testuser${Date.now()}@vt.edu`,
      password_hash: await bcrypt.hash('testpass123', 12),
      first_name: 'Test',
      last_name: 'User',
      is_admin: false,
      gender: 'Other',
      age: 22,
      major: 'Computer Science',
    };

    console.log('Inserting test user:', testUser.email);

    const { data, error } = await supabase
      .from('users')
      .insert(testUser)
      .select('user_id, email, first_name, last_name, is_admin')
      .single();

    if (error) {
      console.error('Error inserting test user:', error);
      throw error;
    }

    console.log('✅ Test user created successfully!');
    console.log('User ID:', data.user_id);
    console.log('Email:', data.email);
    console.log('Name:', `${data.first_name} ${data.last_name}`);
    console.log('Role:', data.is_admin ? 'admin' : 'student');
    console.log('\nYou can now use this user ID for testing messaging functionality.');
    
    return data;
  } catch (error) {
    console.error('Failed to insert test user:', error);
    throw error;
  }
}

// Run the script
insertTestUser()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

