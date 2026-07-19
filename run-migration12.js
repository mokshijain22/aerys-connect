const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `CREATE TABLE IF NOT EXISTS sos_alerts (
      sos_id INT NOT NULL AUTO_INCREMENT,
      raised_by_user_id INT NOT NULL,
      raised_by_role VARCHAR(20) NOT NULL,
      job_card_id INT NULL,
      dealer_id INT NULL,
      reason VARCHAR(30) NOT NULL,
      note VARCHAR(300) NULL,
      latitude DECIMAL(10,7) NULL,
      longitude DECIMAL(10,7) NULL,
      status ENUM('open','resolved') NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL,
      resolved_by INT NULL,
      PRIMARY KEY (sos_id)
    )`,
    `CREATE INDEX idx_sos_status ON sos_alerts (status)`,
    `CREATE INDEX idx_sos_dealer ON sos_alerts (dealer_id)`,
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