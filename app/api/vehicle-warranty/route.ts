import { pool } from '@/app/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const REQUIRED_DOCS: Record<string, string[]> = {
  battery: ['Original invoice copy', 'Job card with fault description', 'Photos of battery defect', 'Chassis number proof'],
  motor: ['Original invoice copy', 'Job card with fault description', 'Photos of motor defect', 'Chassis number proof'],
  charger: ['Original invoice copy', 'Job card with fault description', 'Chassis number proof'],
};

// A component is eligible for a new claim if it's still in warranty
// AND there's no existing claim for it that's still open (not resolved/rejected)
const OPEN_STATUSES = ['submitted', 'dealer_approved', 'company_approved'];

export async function GET(request: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionCustomerId = (session?.user as any)?.customer_id || null;

  if (role !== 'dealer' && role !== 'super_admin' && role !== 'customer') {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const chassisNumber = searchParams.get('chassisNumber');

  if (!chassisNumber) {
    return NextResponse.json({ success: false, error: 'chassisNumber required' }, { status: 400 });
  }

  const [vehicleRows]: any = await pool.query(
    `SELECT
      v.vehicle_id, v.chassis_number, v.customer_id,
      v.battery_warranty_end, v.motor_warranty_end, v.charger_warranty_end,
      v.battery_warranty_end >= CURDATE() AS battery_in_warranty,
      v.motor_warranty_end >= CURDATE() AS motor_in_warranty,
      v.charger_warranty_end >= CURDATE() AS charger_in_warranty
    FROM vehicles v
    WHERE v.chassis_number = ? AND v.deleted_at IS NULL`,
    [chassisNumber]
  );

  if (vehicleRows.length === 0) {
    return NextResponse.json({ success: false, error: 'Vehicle not found' }, { status: 404 });
  }

  const vehicle = vehicleRows[0];

  if (role === 'customer' && vehicle.customer_id !== sessionCustomerId) {
    return NextResponse.json({ success: false, error: 'This vehicle is not registered under your account' }, { status: 403 });
  }

  const [claimRows]: any = await pool.query(
    `SELECT claim_id, claim_number, component, warranty_status_at_claim, status, submitted_at, resolved_at, remarks
     FROM warranty_claims
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY submitted_at DESC`,
    [vehicle.vehicle_id]
  );

  const components = ['battery', 'motor', 'charger'] as const;
  const inWarranty: Record<string, boolean> = {
    battery: !!vehicle.battery_in_warranty,
    motor: !!vehicle.motor_in_warranty,
    charger: !!vehicle.charger_in_warranty,
  };

  const eligibility = components.reduce((acc, component) => {
    const hasOpenClaim = claimRows.some(
      (c: any) => c.component === component && OPEN_STATUSES.includes(c.status)
    );
    acc[component] = {
      eligible: inWarranty[component] && !hasOpenClaim,
      reason: !inWarranty[component]
        ? 'Warranty expired'
        : hasOpenClaim
        ? 'An open claim already exists for this component'
        : 'Eligible for claim',
      requiredDocuments: REQUIRED_DOCS[component],
    };
    return acc;
  }, {} as Record<string, any>);

  return NextResponse.json({
    success: true,
    data: {
      chassisNumber: vehicle.chassis_number,
      warranty: {
        battery: { end: vehicle.battery_warranty_end, active: inWarranty.battery },
        motor: { end: vehicle.motor_warranty_end, active: inWarranty.motor },
        charger: { end: vehicle.charger_warranty_end, active: inWarranty.charger },
      },
      eligibility,
      previousClaims: claimRows,
    },
  });
}