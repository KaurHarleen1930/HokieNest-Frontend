// Simple script to generate bcrypt password hash
const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = process.argv[2] || 'testpass123';
  const hash = await bcrypt.hash(password, 12);
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nUse this hash in your INSERT statement:');
  console.log(`'${hash}'`);
}

generateHash().catch(console.error);

