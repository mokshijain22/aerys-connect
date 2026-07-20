import { pool } from './db';

export async function generateInvoiceForJobCard(jobCardId: number) {
  // check invoice already exists
  const [existing]: any = await pool.query(
    'SELECT invoice_number FROM invoices WHERE job_card_id = ?',
    [jobCardId]
  );
  if (existing.length > 0) {
    return existing[0].invoice_number;
  }

  const [jcRows]: any = await pool.query(
    'SELECT job_card_id, labour_cost FROM job_cards WHERE job_card_id = ?',
    [jobCardId]
  );
  if (jcRows.length === 0) throw new Error('Job card not found');

  const labourCost = Number(jcRows[0].labour_cost) || 0;

  const [partRows]: any = await pool.query(
    `SELECT jcp.quantity, sp.unit_price
     FROM job_card_parts_used jcp
     JOIN spare_parts sp ON jcp.part_id = sp.part_id
     WHERE jcp.job_card_id = ?`,
    [jobCardId]
  );

  const partsTotal = partRows.reduce(
    (sum: number, p: any) => sum + Number(p.quantity) * Number(p.unit_price || 0),
    0
  );

  const subtotal = partsTotal + labourCost;
  const gstRate = 18.0;
  const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + gstAmount) * 100) / 100;

  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String(jobCardId).padStart(6, '0')}`;

  try {
    await pool.query(
      `INSERT INTO invoices (job_card_id, invoice_number, parts_total, labour_cost, subtotal, gst_rate, gst_amount, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobCardId, invoiceNumber, partsTotal, labourCost, subtotal, gstRate, gstAmount, totalAmount]
    );
  } catch (err: any) {
    // Duplicate invoice attempt: two requests raced to generate an invoice
    // for the same job card. The UNIQUE KEY on job_card_id caught it —
    // fetch and return the invoice that won the race instead of erroring out.
    if (err && err.code === 'ER_DUP_ENTRY') {
      const [raceWinner]: any = await pool.query(
        'SELECT invoice_number FROM invoices WHERE job_card_id = ?',
        [jobCardId]
      );
      if (raceWinner.length > 0) {
        return raceWinner[0].invoice_number;
      }
    }
    throw err;
  }

  await pool.query(
    `UPDATE job_cards SET invoice_number = ?, invoice_generated_at = NOW() WHERE job_card_id = ?`,
    [invoiceNumber, jobCardId]
  );

  return invoiceNumber;
}