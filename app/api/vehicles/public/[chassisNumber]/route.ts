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

  const { searchParams } = new URL(request.url);
  const phoneAttempt = (searchParams.get('phone') || '').trim();

  const [rows]: any = await pool.query(
    `SELECT v.vehicle_id, v.chassis_number, v.colour, v.purchase_date,
            vm.model_name,
            v.battery_warranty_end, v.motor_warranty_end, v.charger_warranty_end,
            d.dealer_name, d.phone AS dealer_phone, d.address AS dealer_address, c.city_name,
            cu.phone AS owner_phone
     FROM vehicles v
     LEFT JOIN vehicle_models vm ON v.model_id = vm.model_id
     LEFT JOIN dealers d ON v.dealer_id = d.dealer_id
     LEFT JOIN cities c ON d.city_id = c.city_id
     LEFT JOIN customers cu ON v.customer_id = cu.customer_id
     WHERE v.chassis_number = ? AND v.deleted_at IS NULL
     LIMIT 1`,
    [chassisNumber]
  );

  if (rows.length === 0) {
    return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
  }

  const v = rows[0];

  // Owner verification via QR: scanning the QR only ever reveals the model
  // and chassis number. Warranty, dealer contact, and service history stay
  // locked until the visitor enters the registered owner's mobile number —
  // this stops a random person who finds/steals the vehicle (or the QR
  // sticker itself) from pulling the owner's service history and contact info.
  const verified = !!phoneAttempt && !!v.owner_phone && phoneAttempt === v.owner_phone;

  const basePayload = {
    chassisNumber: v.chassis_number,
    model: v.model_name ?? 'N/A',
    verified,
  };

  if (!verified) {
    return NextResponse.json({
      success: true,
      data: {
        ...basePayload,
        requiresVerification: true,
        error: phoneAttempt ? 'Mobile number does not match our records' : undefined,
      },
    });
  }

  // Last 5 job cards — full digital job card summary (complaint, symptom,
  // technician, and parts cost). Only shown once the owner is verified above.
  const [historyRows]: any = await pool.query(
    `SELECT jc.job_card_id, jc.status, jc.registered_at, jc.service_completed_at,
            jc.complaint_text, jc.symptom_type, jc.service_type,
            tu.full_name AS technician_name,
            (SELECT SUM(jcpu.quantity * sp.unit_price)
             FROM job_card_parts_used jcpu
             JOIN spare_parts sp ON jcpu.part_id = sp.part_id
             WHERE jcpu.job_card_id = jc.job_card_id) AS parts_cost
     FROM job_cards jc
     LEFT JOIN technicians t ON jc.technician_id = t.technician_id
     LEFT JOIN users tu ON t.user_id = tu.user_id
     WHERE jc.vehicle_id = ? ORDER BY jc.registered_at DESC LIMIT 5`,
    [v.vehicle_id]
  );

  return NextResponse.json({
    success: true,
    data: {
      ...basePayload,
      requiresVerification: false,
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
        complaintText: h.complaint_text,
        symptomType: h.symptom_type,
        serviceType: h.service_type,
        technicianName: h.technician_name,
        partsCost: h.parts_cost,
      })),
    },
  });
}