const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `ALTER TABLE warranty_claims ADD COLUMN is_flagged TINYINT(1) NOT NULL DEFAULT 0`,
    `CREATE INDEX idx_wc_is_flagged ON warranty_claims (is_flagged)`,
  ];

  for (const sql of statements) {
    try {
      console.log('Running:', sql.slice(0, 70) + '...');
      await conn.query(sql);
      console.log('✓ done');
    } catch (err) {
      if (err.errno === 1060 || err.errno === 1061) {
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