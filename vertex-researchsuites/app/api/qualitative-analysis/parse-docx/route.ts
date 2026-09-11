import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await mammoth.extractRawText({ buffer });

    if (!result.value || !result.value.trim()) {
      return NextResponse.json({ error: "Could not extract any text from this .docx file." }, { status: 500 });
    }

    return NextResponse.json({ text: result.value });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Could not read this .docx file." },
      { status: 500 }
    );
  }
}
