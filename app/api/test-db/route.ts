import { pool } from '../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS state_count FROM states');
    return NextResponse.json({ success: true, data: rows });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}