import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

function warrantyStatus(endDate: string | null) {
  if (!endDate) return 'N/A';
  return new Date(endDate) >= new Date() ? 'Active' : 'Expired';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chassisNumber: string }> }
) {
  const { chassisNumber } = await params;

  if (!chassisNumber) {
    return NextResponse.json({ success: false, error: 'Chassis number required' }, { status: 400 });
  }

  const [rows]: any = await pool.query(
    `SELECT v.chassis_number, v.colour, v.purchase_date,
            vm.model_name,
            v.battery_warranty_end, v.motor_warranty_end, v.charger_warranty_end,
            d.dealer_name
     FROM vehicles v
     LEFT JOIN vehicle_models vm ON v.model_id = vm.model_id
     LEFT JOIN dealers d ON v.dealer_id = d.dealer_id
     WHERE v.chassis_number = ? AND v.deleted_at IS NULL
     LIMIT 1`,
    [chassisNumber]
  );

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
  }

  const v = rows[0];

  // Only non-sensitive fields go in the public response.
  // No customer name/phone/address, no serial numbers.
  return NextResponse.json({
    success: true,
    data: {
      chassisNumber: v.chassis_number,
      model: v.model_name ?? 'N/A',
      colour: v.colour,
      purchaseDate: v.purchase_date,
      dealer: v.dealer_name ?? 'N/A',
      warranty: {
        battery: warrantyStatus(v.battery_warranty_end),
        motor: warrantyStatus(v.motor_warranty_end),
        charger: warrantyStatus(v.charger_warranty_end),
      },
    },
  });
}