const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_conversations (
      conversation_id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20) UNIQUE,
      state VARCHAR(50) DEFAULT 'menu',
      context_json TEXT,
      handoff_to_human TINYINT(1) DEFAULT 0,
      assigned_dealer_id INT NULL,
      last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ whatsapp_conversations ready');

  await conn.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      message_id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT,
      direction ENUM('incoming','outgoing') NOT NULL,
      sender VARCHAR(50) DEFAULT NULL,
      body TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_conv (conversation_id)
    )
  `);
  console.log('✓ whatsapp_messages ready');

  await conn.end();
}

main().catch((err) => { console.error('Migration failed:', err.message); process.exit(1); });