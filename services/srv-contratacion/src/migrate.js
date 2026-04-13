// Railway DB Migration - runs DDL scripts on startup
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log('Running database migration...');

  const sqlFiles = [
    '../sql/00-init.sql',
    '../sql/01-contratacion.sql',
    '../sql/01b-workflow.sql',
    '../sql/02-usuarios.sql',
    '../sql/03-reportes.sql',
    '../sql/04-seed.sql',
  ];

  for (const file of sqlFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP: ${file} (not found)`);
      continue;
    }
    try {
      const sql = fs.readFileSync(filePath, 'utf8');
      await pool.query(sql);
      console.log(`  OK: ${file}`);
    } catch (err) {
      // Ignore "already exists" errors
      if (err.message.includes('already exists') || err.message.includes('duplicate')) {
        console.log(`  SKIP: ${file} (already exists)`);
      } else {
        console.error(`  ERROR: ${file} - ${err.message}`);
      }
    }
  }

  // Verify
  const tables = await pool.query("SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('contratacion','usuarios','reportes') AND table_type='BASE TABLE'");
  console.log(`Migration complete. Tables: ${tables.rows[0].count}`);

  await pool.end();
}

module.exports = { migrate };
