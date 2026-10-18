export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { Packer } from "docx";
import { CITATION_STYLES } from "@/lib/citationStyles";
import type { CitationStyle } from "@/lib/quantBunkerDocx";
import { parseReport, describeReport, buildRestyledDocument, rewriteBatch } from "@/lib/reportRestyle";
import { adminDb, requireUser } from "@/lib/serverDb";

const VALID_STYLES = new Set<string>(CITATION_STYLES.map((s) => s.value));
const MAX_BYTES = 4 * 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// NOTE: wallet charge and user authentication are added in the next step, once the
// existing wallet logic has been read. Do not merge before that.
async function handle(req: NextRequest, ctx: Ctx) {
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
      await mark(ctx, "delivered");
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
      await mark(ctx, "done");
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
    await mark(ctx, "failed", String((e && e.message) || "error").slice(0, 200));
    return NextResponse.json({ error: e?.message || "Restyle failed" }, { status: 500 });
  }
}


type Ctx = { db: any; userId: string; jobId: string | null };
type Gate = { ok: true; jobId: string | null } | { ok: false; error: string; status: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function mark(ctx: Ctx, event: string, err?: string) {
  if (!ctx.jobId) return;
  try {
    const { data, error } = await ctx.db.rpc("job_mark", {
      p_job: ctx.jobId,
      p_user: ctx.userId,
      p_event: event,
      p_error: err ?? null,
    });
    if (error || (data && (data.error || data.ok === false))) {
      console.error("job_mark " + event + " problem:", error ? error.message : JSON.stringify(data).slice(0, 200));
    }
  } catch (e: any) {
    console.error("job_mark " + event + " threw:", String((e && e.message) || e));
  }
}

async function checkJob(req: Request, db: any, userId: string): Promise<Gate> {
  const { data: p, error: pe } = await db.from("feature_pricing").select("price").eq("feature_name", "report_restyle").maybeSingle();
  if (pe) return { ok: false, error: "Could not check pricing. Please try again.", status: 500 };
  const price = Number((p && p.price) || 0);
  if (!(price > 0)) return { ok: true, jobId: null };
  const jobId = (req.headers.get("x-job-id") || "").trim();
  if (!jobId) return { ok: false, error: "Please accept the package first.", status: 402 };
  if (!UUID_RE.test(jobId)) return { ok: false, error: "This purchase was not found.", status: 403 };
  const { data: j, error: je } = await db.from("feature_jobs").select("id,user_id,feature,status,deadline_at").eq("id", jobId).maybeSingle();
  if (je) return { ok: false, error: "Could not check your purchase. Please try again.", status: 500 };
  if (!j || j.user_id !== userId || j.feature !== "report_restyle") return { ok: false, error: "This purchase was not found.", status: 403 };
  if (j.status !== "open") return { ok: false, error: "This purchase is already used. Please buy again.", status: 402 };
  if (new Date(j.deadline_at).getTime() <= Date.now()) return { ok: false, error: "This purchase has expired. Please buy again.", status: 402 };
  return { ok: true, jobId };
}

export async function POST(req: NextRequest) {
  try {
    const db = adminDb();
    if (!db) return NextResponse.json({ error: "Service is not configured." }, { status: 500 });
    const user = await requireUser(req, db);
    if (!user) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
    const gate = await checkJob(req, db, user.id);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    return await handle(req, { db, userId: user.id, jobId: gate.jobId });
  } catch (e: any) {
    console.error("report-restyle wrapper failed:", e);
    return NextResponse.json({ error: "Restyle failed" }, { status: 500 });
  }
}
