const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `ALTER TABLE job_cards ADD COLUMN part_category VARCHAR(50) NULL`,
    `ALTER TABLE job_cards ADD COLUMN symptom_type VARCHAR(100) NULL`,
    `CREATE TABLE job_card_attachments (
      attachment_id INT NOT NULL AUTO_INCREMENT,
      job_card_id INT NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_type VARCHAR(100) NULL,
      stage VARCHAR(20) NOT NULL DEFAULT 'complaint',
      uploaded_by INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,
      PRIMARY KEY (attachment_id),
      CONSTRAINT fk_jc_attach_jobcard FOREIGN KEY (job_card_id) REFERENCES job_cards(job_card_id)
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