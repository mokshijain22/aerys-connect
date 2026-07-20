const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `ALTER TABLE dealers ADD COLUMN gstin VARCHAR(15) NULL`,
    `ALTER TABLE job_cards ADD COLUMN labour_cost DECIMAL(10,2) DEFAULT 200`,
    `ALTER TABLE job_cards ADD COLUMN invoice_number VARCHAR(30) NULL`,
    `ALTER TABLE job_cards ADD COLUMN invoice_generated_at TIMESTAMP NULL`,
    `CREATE TABLE invoices (
      invoice_id INT NOT NULL AUTO_INCREMENT,
      job_card_id INT NOT NULL,
      invoice_number VARCHAR(30) NOT NULL,
      parts_total DECIMAL(10,2) NOT NULL DEFAULT 0,
      labour_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      gst_rate DECIMAL(5,2) NOT NULL DEFAULT 18.00,
      gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (invoice_id),
      UNIQUE KEY (invoice_number),
      UNIQUE KEY (job_card_id),
      CONSTRAINT fk_invoice_jobcard FOREIGN KEY (job_card_id) REFERENCES job_cards(job_card_id)
    )`,
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
  console.error('Migration failed:', err.message);
  process.exit(1);
});
