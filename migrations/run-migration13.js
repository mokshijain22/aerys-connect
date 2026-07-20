const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `CREATE TABLE IF NOT EXISTS company_settings (
      id INT PRIMARY KEY DEFAULT 1,
      company_name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(20),
      address VARCHAR(500),
      city VARCHAR(100),
      state VARCHAR(100),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT single_row CHECK (id = 1)
    )`,
    `INSERT IGNORE INTO company_settings (id) VALUES (1)`,
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