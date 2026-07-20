import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const [rows]: any = await pool.query(
      'SELECT company_name, email, phone, address, city, state FROM company_settings WHERE id = 1'
    );
    return NextResponse.json({ success: true, data: rows[0] || {} });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';

  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }
  if (role !== 'super_admin') {
    return NextResponse.json({ success: false, error: 'Only super admin can update company settings' }, { status: 403 });
  }

  const { companyName, email, phone, address, city, state } = await request.json();

  try {
    await pool.query(
      `UPDATE company_settings
       SET company_name = ?, email = ?, phone = ?, address = ?, city = ?, state = ?
       WHERE id = 1`,
      [companyName || null, email || null, phone || null, address || null, city || null, state || null]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}