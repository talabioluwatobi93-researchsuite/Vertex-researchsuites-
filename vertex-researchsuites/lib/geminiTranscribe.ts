// Server-side helper: upload ONE audio part to the Gemini Files API, transcribe it
// with gemini-3.5-transcribe (speaker labels + word timestamps), then delete the
// uploaded copy. The API key never leaves the server and is never logged.
import { extractWords, type Word } from "./voiceStitch";

export const GEMINI_BASE = "https://generativelanguage.googleapis.com";
export const GEMINI_TRANSCRIBE_MODEL = "models/gemini-3.5-transcribe";

export type GeminiPartResult = { words: Word[]; text: string };

export type GeminiOptions = {
  /** BCP-47 codes. Omit or leave empty to auto-detect and handle code-switching. */
  languageCodes?: string[];
  baseUrl?: string;
  /** Optional Api-Revision header value; only sent when provided. */
  apiRevision?: string;
  fetchImpl?: typeof fetch;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(f: typeof fetch, url: string, init: RequestInit, retries = 1): Promise<Response> {
  let res = await f(url, init);
  for (let i = 0; i < retries && (res.status === 429 || res.status === 503); i++) {
    await sleep(2000);
    res = await f(url, init);
  }
  return res;
}

async function uploadFile(key: string, blob: Blob, mimeType: string, base: string, f: typeof fetch) {
  const start = await send(f, `${base}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(blob.size),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: "voice-part" } }),
  });
  if (!start.ok) throw new Error(`Gemini upload start failed (${start.status})`);
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini upload start returned no upload address");

  const up = await f(uploadUrl, {
    method: "POST",
    headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: blob,
  });
  if (!up.ok) throw new Error(`Gemini upload failed (${up.status})`);
  const json: any = await up.json();
  const file = json?.file;
  if (!file?.uri) throw new Error("Gemini upload returned no file reference");
  const name: string = file.name || (String(file.uri).match(/files\/[^/?#]+/) || [""])[0];
  if (!name) throw new Error("Gemini upload returned no file name");
  return { name, uri: file.uri as string, state: file.state };
}

async function waitActive(key: string, name: string, base: string, f: typeof fetch) {
  for (let i = 0; i < 20; i++) {
    const r = await f(`${base}/v1beta/${name}`, { headers: { "x-goog-api-key": key } });
    if (!r.ok) throw new Error(`Gemini file check failed (${r.status})`);
    const j: any = await r.json();
    const s = j?.state && typeof j.state === "object" ? j.state.name : j?.state;
    if (!s || s === "ACTIVE") return;
    if (s === "FAILED") throw new Error("Gemini could not process the audio file");
    await sleep(1000);
  }
  throw new Error("Gemini file was not ready in time");
}

async function deleteFile(key: string, name: string, base: string, f: typeof fetch) {
  try {
    await f(`${base}/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": key } });
  } catch {
    // best effort; Google also removes uploaded files automatically after 48 hours
  }
}

export async function transcribePart(
  key: string,
  blob: Blob,
  mimeType: string,
  opts: GeminiOptions = {}
): Promise<GeminiPartResult> {
  const base = opts.baseUrl || GEMINI_BASE;
  const f = opts.fetchImpl || fetch;
  const file = await uploadFile(key, blob, mimeType, base, f);
  try {
    await waitActive(key, file.name, base, f);

    const transcription_config: Record<string, unknown> = {
      mode: { type: "verbatim", diarization_mode: "speaker", timestamp_granularities: ["word"] },
    };
    if (opts.languageCodes && opts.languageCodes.length > 0) {
      transcription_config.language_codes = opts.languageCodes;
    }

    try {
      console.log("gemini-request:", JSON.stringify({
        partBytes: blob.size,
        mimeType,
        config: transcription_config,
      }));
    } catch {}
    const res = await send(f, `${base}/v1beta/interactions`, {
      method: "POST",
      headers: {
        "x-goog-api-key": key,
        "Content-Type": "application/json",
        ...(opts.apiRevision ? { "Api-Revision": opts.apiRevision } : {}),
      },
      body: JSON.stringify({
        model: GEMINI_TRANSCRIBE_MODEL,
        input: [{ type: "file", file_uri: file.uri }],
        generation_config: { transcription_config },
      }),
    });
    if (!res.ok) {
      let detail = "";
      try {
        const raw = await res.text();
        let msg: any = raw;
        try {
          const j: any = JSON.parse(raw);
          msg = (j && j.error && j.error.message) || (j && j.message) || raw;
        } catch {}
        detail = String(msg).replace(/\s+/g, " ").replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]");
        if (key) detail = detail.split(key).join("[redacted]");
        detail = detail.slice(0, 300);
      } catch {}
      throw new Error(`Gemini transcription failed (${res.status})` + (detail ? ": " + detail : ""));
    }
    const data: any = await res.json();
    if (data?.status && data.status !== "completed") {
      throw new Error(`Gemini transcription did not complete (status: ${String(data.status)})`);
    }

    const words = extractWords(data);
    try {
      const stepsArr: any[] = Array.isArray(data?.steps) ? data.steps : [];
      const contentTypes: string[] = [];
      const annTypes: string[] = [];
      let annCount = 0;
      let annKeys = "";
      for (const s of stepsArr) {
        const cs: any[] = Array.isArray(s?.content) ? s.content : [];
        for (const c of cs) {
          const ct = String(c?.type);
          if (contentTypes.indexOf(ct) < 0) contentTypes.push(ct);
          const anns: any[] = Array.isArray(c?.annotations) ? c.annotations : [];
          annCount += anns.length;
          for (const a of anns) {
            const at = String(a?.type);
            if (annTypes.indexOf(at) < 0) annTypes.push(at);
            if (!annKeys && a && typeof a === "object") annKeys = Object.keys(a).join(",");
          }
        }
      }
      console.log("gemini-shape:", JSON.stringify({
        status: data?.status,
        topKeys: Object.keys(data || {}),
        steps: stepsArr.map((s: any) => String(s?.type)),
        contentTypes,
        annotations: annCount,
        annotationTypes: annTypes,
        annotationKeys: annKeys,
        words: words.length,
      }));
    } catch {}
    const text = (Array.isArray(data?.steps) ? data.steps : [])
      .filter((s: any) => !s?.type || s.type === "model_output")
      .flatMap((s: any) => (Array.isArray(s?.content) ? s.content : []))
      .filter((c: any) => typeof c?.text === "string")
      .map((c: any) => c.text as string)
      .join("\n");
    return { words, text };
  } finally {
    await deleteFile(key, file.name, base, f);
  }
}
