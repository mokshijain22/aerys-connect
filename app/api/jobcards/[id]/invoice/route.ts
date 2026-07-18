import { pool } from '../../../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobCardId = Number(id);

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;
  const sessionCustomerId = (session?.user as any)?.customer_id || null;
  const sessionUserId = (session?.user as any)?.id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const [jcRows]: any = await pool.query(
      `SELECT jc.job_card_id, jc.dealer_id, jc.technician_id, jc.complaint_text, jc.service_type,
              jc.registered_at, jc.delivered_at, jc.labour_cost,
              v.chassis_number, v.vehicle_id,
              vm.model_name,
              c.full_name AS customer_name, c.phone AS customer_phone, c.customer_id,
              d.dealer_name, d.address AS dealer_address, d.phone AS dealer_phone, d.gstin
       FROM job_cards jc
       JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
       LEFT JOIN vehicle_models vm ON v.model_id = vm.model_id
       JOIN customers c ON v.customer_id = c.customer_id
       JOIN dealers d ON jc.dealer_id = d.dealer_id
       WHERE jc.job_card_id = ?`,
      [jobCardId]
    );

    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    const jc = jcRows[0];

    // access control
    if (role === 'dealer' && jc.dealer_id !== sessionDealerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (role === 'customer' && jc.customer_id !== sessionCustomerId) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }
    if (role === 'technician') {
      const [techRows]: any = await pool.query(
        'SELECT technician_id FROM technicians WHERE user_id = ?',
        [sessionUserId]
      );
      const myTechId = techRows[0]?.technician_id;
      if (jc.technician_id !== myTechId) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }
    }

    const [invRows]: any = await pool.query(
      'SELECT * FROM invoices WHERE job_card_id = ?',
      [jobCardId]
    );
    if (invRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invoice not generated yet' }, { status: 404 });
    }
    const invoice = invRows[0];

    const [partRows]: any = await pool.query(
      `SELECT sp.part_name, sp.part_code, jcp.quantity, sp.unit_price
       FROM job_card_parts_used jcp
       JOIN spare_parts sp ON jcp.part_id = sp.part_id
       WHERE jcp.job_card_id = ?`,
      [jobCardId]
    );

    // Build PDF into a buffer
    const pdfBuffer: Buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text(jc.dealer_name, { continued: false });
      doc.fontSize(9).fillColor('#555').text(jc.dealer_address || '');
      doc.text(`Phone: ${jc.dealer_phone || '-'}`);
      if (jc.gstin) doc.text(`GSTIN: ${jc.gstin}`);
      doc.moveDown();

      doc.fillColor('#000').fontSize(14).text('TAX INVOICE', { align: 'right' });
      doc.fontSize(9).fillColor('#555').text(`Invoice No: ${invoice.invoice_number}`, { align: 'right' });
      doc.text(`Date: ${new Date(invoice.generated_at).toLocaleDateString('en-IN')}`, { align: 'right' });
      doc.moveDown();

      doc.fillColor('#000').fontSize(11).text('Bill To:');
      doc.fontSize(9).fillColor('#555').text(jc.customer_name);
      doc.text(`Phone: ${jc.customer_phone || '-'}`);
      doc.text(`Vehicle: ${jc.model_name || ''} (${jc.chassis_number})`);
      doc.moveDown();

      doc.fillColor('#000').fontSize(11).text('Service Details:');
      doc.fontSize(9).fillColor('#555').text(`Complaint: ${jc.complaint_text}`);
      doc.text(`Service type: ${jc.service_type === 'paid' ? 'Paid Service' : 'Warranty Claim'}`);
      doc.text(`Registered: ${new Date(jc.registered_at).toLocaleDateString('en-IN')}`);
      if (jc.delivered_at) doc.text(`Delivered: ${new Date(jc.delivered_at).toLocaleDateString('en-IN')}`);
      doc.moveDown();

      // Parts table
      doc.fillColor('#000').fontSize(11).text('Parts Used:');
      doc.moveDown(0.3);
      const tableTop = doc.y;
      doc.fontSize(9).fillColor('#000');
      doc.text('Part', 50, tableTop, { width: 200 });
      doc.text('Qty', 260, tableTop, { width: 60 });
      doc.text('Unit Price', 330, tableTop, { width: 80 });
      doc.text('Amount', 420, tableTop, { width: 80 });
      doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();

      let y = tableTop + 22;
      if (partRows.length === 0) {
        doc.fontSize(9).fillColor('#888').text('No parts used', 50, y);
        y += 20;
      } else {
        for (const p of partRows) {
          const amount = Number(p.quantity) * Number(p.unit_price || 0);
          doc.fillColor('#333').text(p.part_name, 50, y, { width: 200 });
          doc.text(String(p.quantity), 260, y, { width: 60 });
          doc.text(`Rs. ${Number(p.unit_price || 0).toFixed(2)}`, 330, y, { width: 80 });
          doc.text(`Rs. ${amount.toFixed(2)}`, 420, y, { width: 80 });
          y += 18;
        }
      }

      doc.moveTo(50, y + 5).lineTo(500, y + 5).stroke();
      y += 15;

      doc.fontSize(9).fillColor('#000');
      doc.text('Parts Total:', 330, y, { width: 100 });
      doc.text(`Rs. ${Number(invoice.parts_total).toFixed(2)}`, 420, y, { width: 80 });
      y += 16;
      doc.text('Labour Cost:', 330, y, { width: 100 });
      doc.text(`Rs. ${Number(invoice.labour_cost).toFixed(2)}`, 420, y, { width: 80 });
      y += 16;
      doc.text('Subtotal:', 330, y, { width: 100 });
      doc.text(`Rs. ${Number(invoice.subtotal).toFixed(2)}`, 420, y, { width: 80 });
      y += 16;
      doc.text(`GST (${Number(invoice.gst_rate)}%):`, 330, y, { width: 100 });
      doc.text(`Rs. ${Number(invoice.gst_amount).toFixed(2)}`, 420, y, { width: 80 });
      y += 16;
      doc.moveTo(330, y + 3).lineTo(500, y + 3).stroke();
      y += 10;
      doc.fontSize(11).fillColor('#000').text('Total:', 330, y, { width: 100 });
      doc.text(`Rs. ${Number(invoice.total_amount).toFixed(2)}`, 420, y, { width: 80 });

      doc.fontSize(8).fillColor('#999').text(
        'This is a system-generated invoice.',
        50,
        750,
        { align: 'center', width: 500 }
      );

      doc.end();
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}