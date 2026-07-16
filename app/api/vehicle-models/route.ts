// app/api/vehicle-models/route.ts
import { NextResponse } from 'next/server';
import { pool } from '@/app/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query(
      `SELECT model_id, model_name 
       FROM vehicle_models 
       WHERE deleted_at IS NULL
       ORDER BY model_name ASC`
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching vehicle models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicle models' },
      { status: 500 }
    );
  }
}