const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `ALTER TABLE job_cards ADD COLUMN dest_latitude DECIMAL(10,7) NULL`,
    `ALTER TABLE job_cards ADD COLUMN dest_longitude DECIMAL(10,7) NULL`,
    `ALTER TABLE job_cards ADD COLUMN completion_latitude DECIMAL(10,7) NULL`,
    `ALTER TABLE job_cards ADD COLUMN completion_longitude DECIMAL(10,7) NULL`,
    `ALTER TABLE job_cards ADD COLUMN completion_location_captured_at DATETIME NULL`,
  ];

  for (const sql of statements) {
    try {
      console.log('Running:', sql.slice(0, 80) + '...');
      await conn.query(sql);
      console.log('✓ done');
    } catch (err) {
      if (err.errno === 1060) {
        console.log('  (already exists, skipping)');
      } else {
        console.error('  ✗ failed:', err.message);
      }
    }
  }

  await conn.end();
  console.log('\nMigration complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});