const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      phone VARCHAR(20) NULL,
      channel ENUM('whatsapp','sms','in_app') DEFAULT 'in_app',
      title VARCHAR(255),
      message VARCHAR(500),
      job_card_id INT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_created (created_at)
    )
  `);
  console.log('✓ notifications table ready');

  await conn.end();
}

main().catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });