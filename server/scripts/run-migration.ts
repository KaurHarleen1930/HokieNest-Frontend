// Script to run the make_connection_id_nullable migration
import { supabase } from '../lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('🔄 Running migration: make_connection_id_nullable.sql');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../src/migrations/make_connection_id_nullable.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📄 Migration SQL:');
    console.log(migrationSQL);
    console.log('\n');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 100)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct query if RPC doesn't work
          console.log('RPC failed, trying direct query...');
          // Note: Supabase client doesn't support raw SQL directly
          // We'll need to use the REST API or provide instructions
          console.error('❌ Cannot execute raw SQL directly through Supabase client.');
          console.error('Please run the migration manually in Supabase SQL Editor.');
          throw error;
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    console.error('\n📝 Please run the SQL manually in Supabase SQL Editor:');
    console.error('1. Go to your Supabase dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Copy and paste the contents of: server/src/migrations/make_connection_id_nullable.sql');
    console.error('4. Click "Run"');
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
 .catch((error) => {
    console.error('\n❌ Script failed');
    process.exit(1);
  });

