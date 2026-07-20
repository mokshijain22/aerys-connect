import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';

function warrantyStatus(endDate: string | null) {
  if (!endDate) return 'N/A';
  return new Date(endDate) >= new Date() ? 'Active' : 'Expired';
}

const STATUS_LABEL: Record<string, string> = {
  registered: 'Registered', acknowledged: 'Accepted by dealer',
  technician_assigned: 'Technician assigned', in_progress: 'In progress',
  completed: 'Completed', delivered: 'Delivered', rejected_by_dealer: 'Rejected',
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chassisNumber: string }> }
) {
  const { chassisNumber } = await params;

  if (!chassisNumber) {
    return NextResponse.json({ success: false, error: 'Chassis number required' }, { status: 400 });
  }

  const [rows]: any = await pool.query(
    `SELECT v.vehicle_id, v.chassis_number, v.colour, v.purchase_date,
            vm.model_name,
            v.battery_warranty_end, v.motor_warranty_end, v.charger_warranty_end,
            d.dealer_name, d.phone AS dealer_phone, d.address AS dealer_address, c.city_name
     FROM vehicles v
     LEFT JOIN vehicle_models vm ON v.model_id = vm.model_id
     LEFT JOIN dealers d ON v.dealer_id = d.dealer_id
     LEFT JOIN cities c ON d.city_id = c.city_id
     WHERE v.chassis_number = ? AND v.deleted_at IS NULL
     LIMIT 1`,
    [chassisNumber]
  );

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
  }

  const v = rows[0];

  // Last 5 job cards — status + date only, no complaint text (which might reveal personal details)
  const [historyRows]: any = await pool.query(
    `SELECT job_card_id, status, registered_at, service_completed_at
     FROM job_cards WHERE vehicle_id = ? ORDER BY registered_at DESC LIMIT 5`,
    [v.vehicle_id]
  );

  return NextResponse.json({
    success: true,
    data: {
      chassisNumber: v.chassis_number,
      model: v.model_name ?? 'N/A',
      colour: v.colour,
      purchaseDate: v.purchase_date,
      dealer: v.dealer_name ?? 'N/A',
      dealerPhone: v.dealer_phone ?? null,
      dealerAddress: v.dealer_address ? `${v.dealer_address}, ${v.city_name}` : v.city_name ?? null,
      warranty: {
        battery: warrantyStatus(v.battery_warranty_end),
        motor: warrantyStatus(v.motor_warranty_end),
        charger: warrantyStatus(v.charger_warranty_end),
      },
      serviceHistory: historyRows.map((h: any) => ({
        jobCardId: h.job_card_id,
        status: STATUS_LABEL[h.status] ?? h.status,
        date: h.registered_at,
        completedDate: h.service_completed_at,
      })),
    },
  });
}