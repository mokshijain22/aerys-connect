const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  const statements = [
    `ALTER TABLE technicians ADD COLUMN skills VARCHAR(255) NULL COMMENT 'comma-separated part_category values this technician can handle; NULL = generalist, handles everything'`,
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