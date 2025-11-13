// Direct script to insert a test user into Supabase for testing messaging
import { supabase } from '../lib/supabase';
import bcrypt from 'bcrypt';

async function insertTestUser() {
  try {
    // Hash password (same as testpass123 for consistency)
    const passwordHash = await bcrypt.hash('testpass123', 12);

    // Insert test user 1
    const testUser1 = {
      email: 'testuser@vt.edu',
      password_hash: passwordHash,
      first_name: 'Test',
      last_name: 'User',
      gender: 'Other',
      age: 22,
      major: 'Computer Science',
      is_admin: false,
      housing_status: 'NOT_SEARCHING',
      suspended: false,
    };

    console.log('Inserting test user 1:', testUser1.email);

    const { data: user1, error: error1 } = await supabase
      .from('users')
      .insert(testUser1)
      .select('user_id, email, first_name, last_name')
      .single();

    if (error1 && !error1.message.includes('duplicate') && !error1.message.includes('unique')) {
      console.error('Error inserting test user 1:', error1);
    } else if (user1) {
      console.log('✅ Test user 1 created:', {
        id: user1.user_id,
        email: user1.email,
        name: `${user1.first_name} ${user1.last_name}`,
      });
    } else {
      console.log('ℹ️  Test user 1 already exists or was skipped');
    }

    // Insert test user 2 (alternative)
    const testUser2 = {
      email: 'john.doe@vt.edu',
      password_hash: passwordHash,
      first_name: 'John',
      last_name: 'Doe',
      gender: 'Male',
      age: 21,
      major: 'Engineering',
      is_admin: false,
      housing_status: 'SEARCHING',
      suspended: false,
    };

    console.log('\nInserting test user 2:', testUser2.email);

    const { data: user2, error: error2 } = await supabase
      .from('users')
      .insert(testUser2)
      .select('user_id, email, first_name, last_name')
      .single();

    if (error2 && !error2.message.includes('duplicate') && !error2.message.includes('unique')) {
      console.error('Error inserting test user 2:', error2);
    } else if (user2) {
      console.log('✅ Test user 2 created:', {
        id: user2.user_id,
        email: user2.email,
        name: `${user2.first_name} ${user2.last_name}`,
      });
    } else {
      console.log('ℹ️  Test user 2 already exists or was skipped');
    }

    // Get the user IDs for reference
    console.log('\n📋 Test Users Available:');
    const { data: allTestUsers } = await supabase
      .from('users')
      .select('user_id, email, first_name, last_name')
      .in('email', ['testuser@vt.edu', 'john.doe@vt.edu']);

    if (allTestUsers && allTestUsers.length > 0) {
      allTestUsers.forEach(user => {
        console.log(`  - User ID: ${user.user_id}, Email: ${user.email}, Name: ${user.first_name} ${user.last_name}`);
      });
    }

    console.log('\n✅ Script completed! You can now use these users for testing messaging.');
  } catch (error) {
    console.error('❌ Failed to insert test users:', error);
    throw error;
  }
}

// Run the script
insertTestUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

