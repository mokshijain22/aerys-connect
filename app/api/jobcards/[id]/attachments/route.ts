import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/app/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { auth } from "@/auth";
export const dynamic = 'force-dynamic';

// GET: list all attachments for a job card
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM job_card_attachments WHERE job_card_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 });
  }
}

// POST: upload a new photo for a job card (max 5 per job card)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const session = await auth();
    const uploadedBy = session?.user?.id;

    if (!uploadedBy) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [[countRow]]: any = await pool.query(
      `SELECT COUNT(*) AS total FROM job_card_attachments WHERE job_card_id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (countRow.total >= 5) {
      return NextResponse.json({ error: "Maximum 5 photos allowed per job card" }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const stage = (formData.get("stage") as string) || "complaint";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      return NextResponse.json({ error: "Only image or video files are allowed" }, { status: 400 });
    }

    const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
    const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `File too large. Max ${isVideo ? '50MB for videos' : '10MB for images'}.` },
        { status: 400 }
      );
    }

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "jobcards",
      id
    );
    await mkdir(uploadDir, { recursive: true });

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const finalName = `${timestamp}_${safeName}`;
    const filePath = path.join(uploadDir, finalName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const dbFilePath = `/uploads/jobcards/${id}/${finalName}`;

    const [result] = await pool.query(
      `INSERT INTO job_card_attachments (job_card_id, file_path, file_type, stage, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, dbFilePath, file.type || "unknown", stage, uploadedBy]
    );

    return NextResponse.json({
      attachment_id: (result as any).insertId,
      job_card_id: id,
      file_path: dbFilePath,
      file_type: file.type || "unknown",
      stage,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}