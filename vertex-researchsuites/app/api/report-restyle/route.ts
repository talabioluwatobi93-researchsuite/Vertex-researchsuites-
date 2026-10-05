export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { CITATION_STYLES } from "@/lib/citationStyles";
import type { CitationStyle } from "@/lib/quantBunkerDocx";
import { parseReport, describeReport, buildRestyledDocument, rewriteBatch } from "@/lib/reportRestyle";

const VALID_STYLES = new Set<string>(CITATION_STYLES.map((s) => s.value));
const MAX_BYTES = 4 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// NOTE: wallet charge and user authentication are added in the next step, once the
// existing wallet logic has been read. Do not merge before that.
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // ---- JSON: rewrite one small batch of paragraphs into the chosen writing style
    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body?.phase !== "rewrite") return NextResponse.json({ error: "Unknown phase" }, { status: 400 });
      if (!VALID_STYLES.has(String(body.style))) return NextResponse.json({ error: "Invalid style" }, { status: 400 });
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length < 1 || items.length > 8) return NextResponse.json({ error: "Send 1 to 8 paragraphs per request" }, { status: 400 });
      const clean = items.map((it: any) => ({ id: String(it?.id), text: String(it?.text || "").slice(0, 4000) }));
      const st = String(body.style); // PHASE5B: APA 6/7 are converted in code, no AI
      if (st === "APA6" || st === "APA7") return NextResponse.json({ results: clean.map((it: any) => ({ id: it.id, text: it.text, ok: true })) });
      const results = await rewriteBatch(st, clean);
      return NextResponse.json({ results });
    }

    // ---- multipart: parse the uploaded report, or build the restyled report
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Unsupported request" }, { status: 400 });
    }
    const form = await req.formData();
    const phase = String(form.get("phase") || "");
    const style = String(form.get("style") || "");
    const file: any = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return NextResponse.json({ error: "Please upload a .docx file" }, { status: 400 });
    if (!VALID_STYLES.has(style)) return NextResponse.json({ error: "Please choose a style" }, { status: 400 });
    if (!String(file.name || "").toLowerCase().endsWith(".docx")) return NextResponse.json({ error: "Only .docx Word files are supported" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "This file is too large (maximum 4 MB)" }, { status: 413 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let parsed;
    try {
      parsed = await parseReport(buffer);
    } catch (e: any) {
      console.error("report-restyle: could not read file:", e);
      return NextResponse.json({ error: "Could not read this file. Please upload a valid .docx Word document." }, { status: 422 });
    }
    const info = describeReport(parsed);
    if (info.tableCount === 0) {
      return NextResponse.json({ error: "No tables were found in this document." }, { status: 422 });
    }

    if (phase === "parse") {
      return NextResponse.json(info);
    }

    if (phase === "build") {
      let rewrites: Record<string, string> = {};
      try {
        rewrites = JSON.parse(String(form.get("rewrites") || "{}"));
      } catch {
        rewrites = {};
      }
      const doc = buildRestyledDocument(parsed, style as CitationStyle, rewrites);
      const out = await Packer.toBuffer(doc);
      return new NextResponse(new Uint8Array(out), {
        status: 200,
        headers: {
          "Content-Type": DOCX_MIME,
          "Content-Disposition": 'attachment; filename="restyled-report.docx"',
        },
      });
    }

    return NextResponse.json({ error: "Unknown phase" }, { status: 400 });
  } catch (e: any) {
    console.error("report-restyle failed:", e);
    return NextResponse.json({ error: e?.message || "Restyle failed" }, { status: 500 });
  }
}
