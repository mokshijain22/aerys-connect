const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `CREATE TABLE part_returns (
      return_id INT AUTO_INCREMENT PRIMARY KEY,
      dealer_id INT NOT NULL,
      part_id INT NOT NULL,
      quantity INT NOT NULL,
      reason VARCHAR(255) NOT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      reported_by INT NULL,
      reported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL,
      FOREIGN KEY (dealer_id) REFERENCES dealers(dealer_id),
      FOREIGN KEY (part_id) REFERENCES spare_parts(part_id)
    )`,
    `CREATE INDEX idx_pr_dealer_id ON part_returns (dealer_id)`,
    `CREATE INDEX idx_pr_status ON part_returns (status)`,
  ];

  for (const sql of statements) {
    console.log('Running:', sql.slice(0, 60) + '...');
    await conn.query(sql);
    console.log('✓ done');
  }

  await conn.end();
  console.log('\nMigration complete!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});