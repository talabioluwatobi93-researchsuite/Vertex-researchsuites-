// Small client for the Replicate speaker-diarization model. Plain fetch, no extra package.
// The token is read by the routes from the environment and is never logged or returned.
import { parseSegments } from "@/lib/diarizePlan";
import type { Seg } from "@/lib/diarizePlan";

export const REPLICATE_API = "https://api.replicate.com/v1";
// Version string copied from the model's API tab (collectiveai-team/speaker-diarization-3).
const DEFAULT_VERSION =
  "collectiveai-team/speaker-diarization-3:6e29843b8c1b751ec384ad96d3566af2392046465152fef3cc22ad701090b64c";
const PRED_ID = /^[A-Za-z0-9]{1,64}$/;

export class ReplicateHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ReplicateHttpError";
    this.status = status;
  }
}

async function call(token: string, method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(REPLICATE_API + path, {
      method,
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { json = null; }
    if (!res.ok) {
      const d = json && typeof json === "object" ? (json as { detail?: unknown }).detail : undefined;
      throw new ReplicateHttpError(res.status, typeof d === "string" ? d.slice(0, 200) : "request failed");
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

// Starts one diarization job. audioUrl must be a link Replicate can fetch (a short-lived signed link).
export async function startDiarization(token: string, audioUrl: string, maxSpeakers?: number): Promise<{ id: string }> {
  const input: Record<string, unknown> = { audio: audioUrl };
  if (maxSpeakers !== undefined) input.max_speakers = maxSpeakers;
  const version = process.env.REPLICATE_DIARIZATION_VERSION || DEFAULT_VERSION;
  const json = (await call(token, "POST", "/predictions", { version, input })) as { id?: unknown } | null;
  const id = json && typeof json.id === "string" ? json.id : "";
  if (!PRED_ID.test(id)) throw new ReplicateHttpError(502, "unexpected reply");
  return { id };
}

export type PredictionView = { status: string; output: unknown; error: string };

export async function getPrediction(token: string, id: string): Promise<PredictionView> {
  if (!PRED_ID.test(id)) throw new ReplicateHttpError(400, "bad id");
  const json = (await call(token, "GET", "/predictions/" + id)) as { status?: unknown; output?: unknown; error?: unknown } | null;
  let output: unknown = json ? json.output : null;
  if (typeof output === "string") { try { output = JSON.parse(output); } catch { output = null; } }
  return {
    status: json && typeof json.status === "string" ? json.status : "unknown",
    output,
    error: json && typeof json.error === "string" ? json.error.slice(0, 200) : "",
  };
}

export function mapStatus(status: string): "processing" | "done" | "failed" {
  if (status === "succeeded" || status === "successful") return "done";
  if (status === "failed" || status === "canceled" || status === "cancelled" || status === "aborted") return "failed";
  return "processing";
}

export function segmentsOf(output: unknown): Seg[] {
  return parseSegments(output);
}
