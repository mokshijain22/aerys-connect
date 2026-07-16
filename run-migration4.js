const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'aerys_service_connect',
  });

  // Indexes for columns that are heavily filtered/joined on but currently unindexed.
  // These are the queries behind: analytics ratings, dealer leaderboard, job cards list,
  // job card detail + reviews, warranty claims list, homepage stats.
  const statements = [
    // job_card_reviews — joined on job_card_id constantly, filtered by reviewer_role
    `CREATE INDEX idx_jcr_job_card_id ON job_card_reviews (job_card_id)`,
    `CREATE INDEX idx_jcr_reviewer_role ON job_card_reviews (reviewer_role)`,

    // job_cards — filtered/sorted by these on nearly every page (list, analytics, homepage)
    `CREATE INDEX idx_jc_registered_at ON job_cards (registered_at)`,
    `CREATE INDEX idx_jc_status ON job_cards (status)`,
    `CREATE INDEX idx_jc_dealer_id ON job_cards (dealer_id)`,
    `CREATE INDEX idx_jc_technician_id ON job_cards (technician_id)`,
    `CREATE INDEX idx_jc_vehicle_id ON job_cards (vehicle_id)`,
    `CREATE INDEX idx_jc_service_completed_at ON job_cards (service_completed_at)`,
    `CREATE INDEX idx_jc_dealer_status ON job_cards (dealer_id, status)`,

    // warranty_claims — status filtering for eligibility checks + claims list
    `CREATE INDEX idx_wc_status ON warranty_claims (status)`,
    `CREATE INDEX idx_wc_job_card_id ON warranty_claims (job_card_id)`,
    `CREATE INDEX idx_wc_vehicle_id ON warranty_claims (vehicle_id)`,
    `CREATE INDEX idx_wc_submitted_at ON warranty_claims (submitted_at)`,

    // vehicles — dealer/customer filtering on nearly every vehicles/jobcards query
    `CREATE INDEX idx_v_dealer_id ON vehicles (dealer_id)`,
    `CREATE INDEX idx_v_customer_id ON vehicles (customer_id)`,

    // job_card_parts_used / dealer_stock — used in every analytics revenue query
    `CREATE INDEX idx_jcpu_job_card_id ON job_card_parts_used (job_card_id)`,
    `CREATE INDEX idx_jcpu_part_id ON job_card_parts_used (part_id)`,

    // job_card_attachments / warranty_claim_attachments — fetched per job card / claim detail
    `CREATE INDEX idx_jca_job_card_id ON job_card_attachments (job_card_id)`,
    `CREATE INDEX idx_wca_claim_id ON warranty_claim_attachments (claim_id)`,

    // job_card_technician_history — looked up per job card on every technician response
    `CREATE INDEX idx_jcth_job_card_id ON job_card_technician_history (job_card_id)`,
    `CREATE INDEX idx_jcth_technician_id ON job_card_technician_history (technician_id)`,
  ];

  for (const sql of statements) {
    try {
      console.log('Running:', sql.slice(0, 80) + '...');
      await conn.query(sql);
      console.log('✓ done');
    } catch (err) {
      // 1061 = duplicate key name -> index already exists, safe to skip
      if (err.errno === 1061) {
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