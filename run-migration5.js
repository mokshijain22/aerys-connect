const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `ALTER TABLE job_cards ADD COLUMN delivery_otp VARCHAR(6) NULL`,
    `ALTER TABLE job_cards ADD COLUMN otp_generated_at TIMESTAMP NULL`,
    `ALTER TABLE job_cards ADD COLUMN otp_attempts INT NOT NULL DEFAULT 0`,
    `ALTER TABLE job_cards ADD COLUMN signature_path VARCHAR(255) NULL`,
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