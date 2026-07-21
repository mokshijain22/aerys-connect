import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { auth } from '@/auth';
import { notifyCustomerForJobCard } from '@/app/lib/notifications';

export const dynamic = 'force-dynamic';

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jobCardId = Number(id);

  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'dealer' && role !== 'super_admin' && role !== 'technician') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  try {
    const [jcRows]: any = await pool.query(
      `SELECT jc.dealer_id, jc.technician_id, jc.status, jc.delivery_otp, jc.otp_generated_at, jc.otp_attempts,
              jc.verification_phone, jc.customer_verified_at,
              c.phone AS customer_phone
       FROM job_cards jc
       JOIN vehicles v ON jc.vehicle_id = v.vehicle_id
       JOIN customers c ON v.customer_id = c.customer_id
       WHERE jc.job_card_id = ?`,
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    const jc = jcRows[0];

    if (role === 'dealer' && jc.dealer_id !== sessionDealerId) {
      return NextResponse.json({ success: false, error: 'You do not have access to this job card' }, { status: 403 });
    }
    if (role === 'technician') {
      const sessionUserId = (session?.user as any)?.id || null;
      const [techRows]: any = await pool.query(
        'SELECT technician_id FROM technicians WHERE user_id = ? AND deleted_at IS NULL',
        [sessionUserId]
      );
      const myTechnicianId = techRows[0]?.technician_id ?? null;
      if (!myTechnicianId || jc.technician_id !== myTechnicianId) {
        return NextResponse.json({ success: false, error: 'This job card is not assigned to you' }, { status: 403 });
      }
    }
    if (jc.status !== 'completed') {
      return NextResponse.json({ success: false, error: 'Job must be completed before delivery can be confirmed' }, { status: 400 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'deliver') {
      if (role !== 'dealer' && role !== 'super_admin') {
        return NextResponse.json({ success: false, error: 'Only dealers can mark a job as delivered' }, { status: 403 });
      }
      if (!jc.customer_verified_at) {
        return NextResponse.json({ success: false, error: 'Customer has not verified OTP yet' }, { status: 400 });
      }
      await pool.query(
        `UPDATE job_cards SET status = 'delivered', delivered_at = NOW() WHERE job_card_id = ?`,
        [jobCardId]
      );

      // Best-effort: invoice-ready + feedback request over WhatsApp/in-app bell.
      // Never let a notification failure block the delivery confirmation.
      try {
        const [[invRow]]: any = await pool.query(
          `SELECT invoice_number, total_amount FROM invoices WHERE job_card_id = ?`,
          [jobCardId]
        );
        if (invRow) {
          await notifyCustomerForJobCard(
            jobCardId,
            'Invoice Ready',
            `Your invoice ${invRow.invoice_number} (Rs. ${Number(invRow.total_amount).toFixed(2)}) is ready. You can download it from your service history.`
          );
        }
        await notifyCustomerForJobCard(
          jobCardId,
          'How was your service?',
          `Your vehicle has been delivered. We'd love your feedback — please rate your recent service.`
        );
      } catch (notifyErr: any) {
        console.error('Delivery notification failed:', notifyErr.message);
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'generate') {
      const { phoneChoice, manualPhone } = body;

      let verificationPhone = jc.customer_phone;
      if (phoneChoice === 'manual') {
        if (!manualPhone || !/^\d{10}$/.test(manualPhone)) {
          return NextResponse.json({ success: false, error: 'Enter a valid 10-digit phone number' }, { status: 400 });
        }
        verificationPhone = manualPhone;
      }

      const otp = generateOtpCode();
      await pool.query(
        `UPDATE job_cards
         SET delivery_otp = ?, otp_generated_at = NOW(), otp_attempts = 0,
             verification_phone = ?, customer_verified_at = NULL
         WHERE job_card_id = ?`,
        [otp, verificationPhone, jobCardId]
      );
      // No SMS/WhatsApp gateway wired up yet — return the OTP directly so it can be
      // shown to the customer in person. Swap this out once SMS notifications ship.
      return NextResponse.json({ success: true, otp, verificationPhone });
    }

    if (action === 'confirm') {
      const { otp, signatureDataUrl } = body;

      if (!otp || !signatureDataUrl) {
        return NextResponse.json({ success: false, error: 'OTP and signature are required' }, { status: 400 });
      }
      if (!jc.delivery_otp || !jc.otp_generated_at) {
        return NextResponse.json({ success: false, error: 'No OTP has been generated for this job card yet' }, { status: 400 });
      }
      if (jc.otp_attempts >= 5) {
        return NextResponse.json({ success: false, error: 'Too many incorrect attempts. Generate a new OTP.' }, { status: 400 });
      }

      const otpAgeMinutes = (Date.now() - new Date(jc.otp_generated_at).getTime()) / 60000;
      if (otpAgeMinutes > 10) {
        return NextResponse.json({ success: false, error: 'OTP has expired. Generate a new one.' }, { status: 400 });
      }

      if (String(otp).trim() !== String(jc.delivery_otp)) {
        await pool.query(`UPDATE job_cards SET otp_attempts = otp_attempts + 1 WHERE job_card_id = ?`, [jobCardId]);
        return NextResponse.json({ success: false, error: 'Incorrect OTP' }, { status: 400 });
      }

      // Save the signature image
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'jobcards', id, 'signature');
      await mkdir(uploadDir, { recursive: true });
      const base64Data = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
      const fileName = `signature_${Date.now()}.png`;
      const filePath = path.join(uploadDir, fileName);
      await writeFile(filePath, Buffer.from(base64Data, 'base64'));
      const dbSignaturePath = `/uploads/jobcards/${id}/signature/${fileName}`;

      await pool.query(
        `UPDATE job_cards
         SET signature_path = ?, customer_verified_at = NOW(),
             delivery_otp = NULL, otp_generated_at = NULL, otp_attempts = 0
         WHERE job_card_id = ?`,
        [dbSignaturePath, jobCardId]
      );

      return NextResponse.json({ success: true, signaturePath: dbSignaturePath });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}