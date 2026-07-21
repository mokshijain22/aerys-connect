const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `CREATE TABLE warehouse_stock (
      part_id INT PRIMARY KEY,
      quantity INT NOT NULL DEFAULT 0,
      FOREIGN KEY (part_id) REFERENCES spare_parts(part_id)
    )`,
    `CREATE TABLE part_dispatches (
      dispatch_id INT AUTO_INCREMENT PRIMARY KEY,
      part_id INT NOT NULL,
      dealer_id INT NOT NULL,
      quantity INT NOT NULL,
      status ENUM('created','in_transit','received') NOT NULL DEFAULT 'created',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      dispatched_at DATETIME NULL,
      received_at DATETIME NULL,
      FOREIGN KEY (part_id) REFERENCES spare_parts(part_id),
      FOREIGN KEY (dealer_id) REFERENCES dealers(dealer_id)
    )`,
    `CREATE INDEX idx_pd_dealer_id ON part_dispatches (dealer_id)`,
    `CREATE INDEX idx_pd_status ON part_dispatches (status)`,
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