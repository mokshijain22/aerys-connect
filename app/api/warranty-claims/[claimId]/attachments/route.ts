import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
export const dynamic = 'force-dynamic';

// GET: list all attachments for a claim
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await params;

  try {
 
    const [rows] = await pool.query(
      `SELECT * FROM warranty_claim_attachments WHERE claim_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [claimId]
    );
    
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 });
  }
}

// POST: upload a new file for a claim
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await params;

  try {
    const session = await auth();
    const uploadedBy = session?.user?.id;

    if (!uploadedBy) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Build folder path: public/uploads/warranty-claims/<claim_id>/
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "warranty-claims",
      claimId
    );
    await mkdir(uploadDir, { recursive: true });

    // Sanitize filename and make it unique
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const finalName = `${timestamp}_${safeName}`;
    const filePath = path.join(uploadDir, finalName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Path stored in DB, relative to /public, so it's directly usable in <img src="">
    const dbFilePath = `/uploads/warranty-claims/${claimId}/${finalName}`;

    const [result] = await pool.query(
      `INSERT INTO warranty_claim_attachments (claim_id, file_path, file_type, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [claimId, dbFilePath, file.type || "unknown", uploadedBy]
    );

    return NextResponse.json({
      attachment_id: (result as any).insertId,
      claim_id: claimId,
      file_path: dbFilePath,
      file_type: file.type || "unknown",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}