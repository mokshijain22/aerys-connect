import { pool } from '../../lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const sessionDealerId = (session?.user as any)?.dealer_id || null;

  const {
    customerName, customerPhone, customerAddress,
    modelId, colour, purchaseDate,
    chassisNumber, motorNumber, batterySerialNumber, chargerSerialNumber
  } = body;

  // If the user is a dealer, force their own dealer_id — ignore whatever the client sent
  const dealerId = role === 'dealer' ? sessionDealerId : body.dealerId;

  if (!dealerId) {
    return NextResponse.json({ success: false, error: 'No dealer specified' }, { status: 400 });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Insert or find the customer by phone number
    let customerId: number;
    const [existing]: any = await connection.query(
      'SELECT customer_id FROM customers WHERE phone = ?',
      [customerPhone]
    );

    if (existing.length > 0) {
      customerId = existing[0].customer_id;
    } else {
      const [result]: any = await connection.query(
        'INSERT INTO customers (full_name, phone, address) VALUES (?, ?, ?)',
        [customerName, customerPhone, customerAddress]
      );
      customerId = result.insertId;
    }

    // 2. Get warranty months from the vehicle model
    const [modelRows]: any = await connection.query(
      'SELECT battery_warranty_months, motor_warranty_months, charger_warranty_months FROM vehicle_models WHERE model_id = ?',
      [modelId]
    );
    const model = modelRows[0];

    // 3. Calculate warranty end dates based on purchase date
    const purchase = new Date(purchaseDate);
    const addMonths = (date: Date, months: number) => {
      const d = new Date(date);
      d.setMonth(d.getMonth() + months);
      return d.toISOString().slice(0, 10);
    };

    // 4. Insert the vehicle
    await connection.query(
      `INSERT INTO vehicles (
        customer_id, dealer_id, model_id, colour, purchase_date,
        chassis_number, motor_number, battery_serial_number, charger_serial_number,
        battery_warranty_start, battery_warranty_end,
        motor_warranty_start, motor_warranty_end,
        charger_warranty_start, charger_warranty_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId, dealerId, modelId, colour, purchaseDate,
        chassisNumber, motorNumber, batterySerialNumber, chargerSerialNumber,
        purchaseDate, addMonths(purchase, model.battery_warranty_months),
        purchaseDate, addMonths(purchase, model.motor_warranty_months),
        purchaseDate, addMonths(purchase, model.charger_warranty_months),
      ]
    );

    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role || '';
  const dealerId = (session?.user as any)?.dealer_id || null;
  const customerId = (session?.user as any)?.customer_id || null;

  let query = `
    SELECT v.vehicle_id, c.full_name, c.phone, v.chassis_number, v.colour, v.purchase_date,
           vm.model_name, d.dealer_name
    FROM vehicles v
    JOIN customers c ON v.customer_id = c.customer_id
    LEFT JOIN vehicle_models vm ON v.model_id = vm.model_id
    LEFT JOIN dealers d ON v.dealer_id = d.dealer_id
  `;
  const params: any[] = [];

  if (role === 'dealer') {
    query += ` WHERE v.dealer_id = ?`;
    params.push(dealerId || -1);
  } else if (role === 'customer') {
    query += ` WHERE v.customer_id = ?`;
    params.push(customerId || -1);
  }

  query += ` ORDER BY v.created_at DESC`;

  const [rows] = await pool.query(query, params);
  return NextResponse.json({ success: true, data: rows });
}