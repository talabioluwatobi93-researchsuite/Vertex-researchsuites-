// Intron (docs.voice.intron.io) client helpers. Server-side only: the API key must never reach the browser.
// Async flow: POST /file/v1/upload returns a file_id, then GET /file/v1/status/{file_id} is polled.
// Logs carry field names and sizes only, never transcript text or the key.
import { createHmac, timingSafeEqual } from "node:crypto";

export const INTRON_BASE_URL = "https://infer.voice.intron.io";
// The sync endpoint documents 120 s (its error example says 60 s). The async limit is not documented.
export const INTRON_PART_MAX_SECONDS = 120;

export type IntronState = "processing" | "done" | "failed" | "unknown";

export type IntronOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

export type IntronStatusResult = {
  state: IntronState;
  transcript: string | null;
  durationSeconds: number | null;
  raw: unknown;
};

export class IntronHttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function clip(s: string): string {
  return s.length > 300 ? s.slice(0, 300) : s;
}

function scrub(s: string, apiKey: string): string {
  return apiKey ? s.split(apiKey).join("[key]") : s;
}

// Field names, types and sizes only. Never values.
export function describeShape(v: unknown, depth = 0): string {
  if (v === null) return "null";
  if (typeof v === "string") return "string(" + v.length + ")";
  if (typeof v !== "object") return typeof v;
  if (Array.isArray(v)) {
    if (v.length === 0 || depth >= 4) return "array(" + v.length + ")";
    return "array(" + v.length + ")[" + describeShape(v[0], depth + 1) + "]";
  }
  if (depth >= 4) return "object";
  const rec = v as Record<string, unknown>;
  const keys = Object.keys(rec).slice(0, 30);
  return "{" + keys.map((k) => k + ":" + describeShape(rec[k], depth + 1)).join(",") + "}";
}

async function readJson(res: Response): Promise<{ text: string; json: any }> {
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { text, json };
}

async function timedFetch(f: typeof fetch, url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await f(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function startIntronJob(
  apiKey: string,
  args: { blob: Blob; fileName: string; languageCode: string; diarize: boolean },
  opts: IntronOptions = {}
): Promise<{ fileId: string; raw: unknown }> {
  const f = opts.fetchImpl || fetch;
  const base = opts.baseUrl || INTRON_BASE_URL;
  const form = new FormData();
  form.append("audio_file_name", args.fileName);
  form.append("audio_file_blob", args.blob, args.fileName);
  form.append("use_language_asr_input", args.languageCode);
  form.append("use_category", "file_category_general");
  form.append("use_disable_llm_corrections", "TRUE");
  form.append("use_diarization", args.diarize ? "TRUE" : "FALSE");
  console.log("intron-request: bytes", args.blob.size, "lang", args.languageCode, "diarize", args.diarize);
  const res = await timedFetch(
    f,
    base + "/file/v1/upload",
    { method: "POST", headers: { Authorization: "Bearer " + apiKey }, body: form },
    opts.timeoutMs || 40000
  );
  const { text, json } = await readJson(res);
  if (!res.ok || (json && json.status === "Error")) {
    const reason = clip(scrub(json && typeof json.message === "string" ? json.message : text, apiKey));
    console.error("intron-start rejected:", res.status, reason);
    throw new IntronHttpError("Intron upload failed (HTTP " + res.status + "): " + reason, res.status);
  }
  const fileId = json && json.data && typeof json.data.file_id === "string" ? json.data.file_id : "";
  if (!fileId) {
    console.error("intron-start: no file_id, shape", describeShape(json));
    throw new IntronHttpError("Intron upload gave no file_id", 502);
  }
  console.log("intron-start ok, shape", describeShape(json));
  return { fileId, raw: json };
}

export async function getIntronStatus(apiKey: string, fileId: string, opts: IntronOptions = {}): Promise<IntronStatusResult> {
  const f = opts.fetchImpl || fetch;
  const base = opts.baseUrl || INTRON_BASE_URL;
  const res = await timedFetch(
    f,
    base + "/file/v1/status/" + encodeURIComponent(fileId),
    { method: "GET", headers: { Authorization: "Bearer " + apiKey } },
    opts.timeoutMs || 20000
  );
  const { text, json } = await readJson(res);
  if (!res.ok) {
    const reason = clip(scrub(json && typeof json.message === "string" ? json.message : text, apiKey));
    console.error("intron-status rejected:", res.status, reason);
    throw new IntronHttpError("Intron status failed (HTTP " + res.status + "): " + reason, res.status);
  }
  const data = json && json.data && typeof json.data === "object" ? json.data : null;
  const ps = data && typeof data.processing_status === "string" ? data.processing_status : "";
  let state: IntronState = "unknown";
  if (ps === "FILE_QUEUED" || ps === "FILE_PENDING" || ps === "FILE_PROCESSING") state = "processing";
  else if (ps === "FILE_TRANSCRIBED") state = "done";
  else if (ps === "FILE_PROCESSING_FAILED") state = "failed";
  else if (json && json.status === "Error") state = "failed";
  if (state !== "processing") {
    console.log("intron-status:", state, ps || "(none)", "shape", describeShape(json));
  }
  return {
    state,
    transcript: data && typeof data.audio_transcript === "string" ? data.audio_transcript : null,
    durationSeconds:
      data && typeof data.processed_audio_duration_in_seconds === "number"
        ? data.processed_audio_duration_in_seconds
        : null,
    raw: data,
  };
}

// Proves a user started a given Intron job, so nobody can poll someone else's file_id.
export function signFileToken(secret: string, userId: string, fileId: string): string {
  return createHmac("sha256", secret).update("intron:" + userId + ":" + fileId).digest("hex");
}

export function verifyFileToken(secret: string, userId: string, fileId: string, token: string): boolean {
  const want = Buffer.from(signFileToken(secret, userId, fileId), "hex");
  const got = Buffer.from(typeof token === "string" ? token : "", "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

export function isSafeAudioPath(p: unknown): p is string {
  return (
    typeof p === "string" &&
    p.length > 0 &&
    p.length <= 400 &&
    !/[\u0000-\u001F\\]/.test(p) &&
    !p.includes("..") &&
    !p.startsWith("/")
  );
}

export function isValidPart(start: number, dur: number): boolean {
  return Number.isFinite(start) && Number.isFinite(dur) && start >= 0 && dur > 0 && dur <= INTRON_PART_MAX_SECONDS;
}
