import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: Request) {
  try {
    const { sessionId, fileType } = await req.json();
    if (!sessionId || !fileType) {
      return NextResponse.json({ error: "Missing sessionId or fileType" }, { status: 400 });
    }
    if (fileType !== "dataset" && fileType !== "report") {
      return NextResponse.json({ error: "fileType must be 'dataset' or 'report'" }, { status: 400 });
    }

    const fileName = fileType === "dataset" ? "dataset-raw.docx" : "report-full.docx";
    const path = `${sessionId}/${fileName}`;

    const { data: existing } = await supabaseAdmin.storage.from("quant-bunker").list(sessionId);
    const fileExists = existing?.some((f) => f.name === fileName);

    if (!fileExists) {
      return NextResponse.json({ error: "File not ready yet", notReady: true }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from("quant-bunker")
      .createSignedUrl(path, 300);

    if (error || !data) {
      return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
    }

    return NextResponse.json({ success: true, url: data.signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to get download URL" }, { status: 500 });
  }
}
