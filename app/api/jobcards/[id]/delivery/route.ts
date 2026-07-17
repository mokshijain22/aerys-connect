import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { auth } from '@/auth';

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
  if (role !== 'dealer' && role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only dealers can confirm delivery' }, { status: 403 });
  }

  try {
    const [jcRows]: any = await pool.query(
      'SELECT dealer_id, status, delivery_otp, otp_generated_at, otp_attempts FROM job_cards WHERE job_card_id = ?',
      [jobCardId]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Job card not found' }, { status: 404 });
    }
    const jc = jcRows[0];

    if (role === 'dealer' && jc.dealer_id !== sessionDealerId) {
      return NextResponse.json({ success: false, error: 'You do not have access to this job card' }, { status: 403 });
    }
    if (jc.status !== 'completed') {
      return NextResponse.json({ success: false, error: 'Job must be completed before delivery can be confirmed' }, { status: 400 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'generate') {
      const otp = generateOtpCode();
      await pool.query(
        `UPDATE job_cards SET delivery_otp = ?, otp_generated_at = NOW(), otp_attempts = 0 WHERE job_card_id = ?`,
        [otp, jobCardId]
      );
      // No SMS/WhatsApp gateway wired up yet — return the OTP directly so the dealer
      // can relay it to the customer in person. Swap this out once WhatsApp notifications ship.
      return NextResponse.json({ success: true, otp });
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
         SET status = 'delivered', delivered_at = NOW(), signature_path = ?,
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