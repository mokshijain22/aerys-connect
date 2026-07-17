// run-migration6.js
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `ALTER TABLE job_cards ADD COLUMN verification_phone VARCHAR(15) NULL`,
    `ALTER TABLE job_cards ADD COLUMN customer_verified_at TIMESTAMP NULL`,
  ];

  for (const sql of statements) {
    console.log('Running:', sql.slice(0, 70) + '...');
    await conn.query(sql);
    console.log('✓ done');
  }

  await conn.end();
  console.log('\nMigration complete!');
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});