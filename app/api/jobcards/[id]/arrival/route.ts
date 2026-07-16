import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
export const dynamic = 'force-dynamic';

// POST: technician uploads mandatory "I've arrived" photo
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    const role = (session?.user as any)?.role || '';
    const sessionUserId = (session?.user as any)?.id || null;

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (role !== 'technician') {
      return NextResponse.json({ error: "Only technicians can log arrival" }, { status: 403 });
    }

    const [techRows]: any = await pool.query(
      'SELECT technician_id FROM technicians WHERE user_id = ? AND deleted_at IS NULL',
      [sessionUserId]
    );
    const myTechnicianId = techRows[0]?.technician_id ?? null;
    if (!myTechnicianId) {
      return NextResponse.json({ error: "Technician profile not found" }, { status: 403 });
    }

    const [jcRows]: any = await pool.query(
      'SELECT technician_id, status, arrived_at FROM job_cards WHERE job_card_id = ?',
      [id]
    );
    if (jcRows.length === 0) {
      return NextResponse.json({ error: "Job card not found" }, { status: 404 });
    }
    if (jcRows[0].technician_id !== myTechnicianId) {
      return NextResponse.json({ error: "This job card is not assigned to you" }, { status: 403 });
    }
    if (jcRows[0].status !== 'in_progress') {
      return NextResponse.json({ error: "Job card must be in progress to log arrival" }, { status: 400 });
    }
    if (jcRows[0].arrived_at) {
      return NextResponse.json({ error: "Arrival already logged for this job card" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Arrival photo is required" }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", "jobcards", id);
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const finalName = `${timestamp}_${safeName}`;
    const filePath = path.join(uploadDir, finalName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const dbFilePath = `/uploads/jobcards/${id}/${finalName}`;

    await pool.query(
      `INSERT INTO job_card_attachments (job_card_id, file_path, file_type, stage, uploaded_by, created_at)
       VALUES (?, ?, ?, 'arrival', ?, NOW())`,
      [id, dbFilePath, file.type || "unknown", sessionUserId]
    );

    await pool.query(
      `UPDATE job_cards SET arrived_at = NOW() WHERE job_card_id = ?`,
      [id]
    );

    return NextResponse.json({ success: true, file_path: dbFilePath });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "Failed to log arrival" }, { status: 500 });
  }
}