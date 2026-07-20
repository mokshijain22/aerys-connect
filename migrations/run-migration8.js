const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `CREATE TABLE IF NOT EXISTS technician_locations (
      location_id BIGINT AUTO_INCREMENT PRIMARY KEY,
      technician_id INT NOT NULL,
      job_card_id INT NULL,
      latitude DECIMAL(10, 7) NOT NULL,
      longitude DECIMAL(10, 7) NOT NULL,
      accuracy_meters DECIMAL(8, 2) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_technician (technician_id)
    )`,
    `CREATE INDEX idx_tl_job_card_id ON technician_locations (job_card_id)`,
  ];

  for (const sql of statements) {
    try {
      console.log('Running:', sql.slice(0, 70) + '...');
      await conn.query(sql);
      console.log('✓ done');
    } catch (err) {
      if (err.errno === 1060 || err.errno === 1061 || err.errno === 1050) {
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