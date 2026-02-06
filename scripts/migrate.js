const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'aws-0-eu-west-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.jfneiuquoxoesbqmbrvv',
  password: 'pPJR8cHs6fa#eKNg',
  ssl: { rejectUnauthorized: false }
});

const dropSQL = `
-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_bricks_updated_at ON bricks;

-- Drop functions
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS user_org_ids();

-- Drop tables (order matters for foreign keys)
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS brick_assignments CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS bricks CASCADE;
DROP TABLE IF EXISTS corpus_assets CASCADE;
DROP TABLE IF EXISTS corpus_slides CASCADE;
DROP TABLE IF EXISTS document_chunks CASCADE;
DROP TABLE IF EXISTS corpus_documents CASCADE;
DROP TABLE IF EXISTS project_corpus CASCADE;
DROP TABLE IF EXISTS corpus CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS org_members CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
`;

async function run() {
  try {
    console.log('Connecting to Supabase...');
    await client.connect();
    console.log('Connected!');

    // Drop existing tables
    console.log('Dropping existing tables...');
    await client.query(dropSQL);
    console.log('Tables dropped!');

    // Read and execute migration
    const migrationPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await client.query(migrationSQL);
    console.log('Migration complete!');

    await client.end();
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
