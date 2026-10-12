// P12-4: speaker-first run. Pure TypeScript, no network: the page gives it functions.
// Flow: plan chunks -> start/poll speaker detection per chunk -> match -> turns -> pieces.
import { planDiarChunks, matchChunks, buildTurns, planPieces } from "./diarizePlan";
import type { Chunk, ChunkResult, Piece, Seg } from "./diarizePlan";

export type DiarJob = { predictionId: string; token: string; chunkPath: string };
export type DiarStart = { busy?: boolean; error?: string; job?: DiarJob };
export type DiarCheck = { busy?: boolean; error?: string; state?: string; segments?: Seg[] };
export type DiarDeps = {
  startChunk: (c: Chunk) => Promise<DiarStart>;
  checkChunk: (j: DiarJob) => Promise<DiarCheck>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  onProgress?: (text: string) => void;
  shouldStop?: () => boolean;
};
export type DiarConfig = { maxRunning: number; pollMs: number; busyBackoffMs: number; maxStartTries: number; maxCheckErrors: number; chunkTimeoutMs: number; overallTimeoutMs: number };
export const DEFAULT_DIAR_CONFIG: DiarConfig = {
  maxRunning: 3, pollMs: 5000, busyBackoffMs: 10000, maxStartTries: 3, maxCheckErrors: 6,
  chunkTimeoutMs: 12 * 60 * 1000, overallTimeoutMs: 40 * 60 * 1000,
};
export type JoinReport = {
  chunks: number; speakerCount: number; droppedSeconds: number; pieces: number;
  lowConfidenceJoins: number; inferredSpeakers: number; newSpeakers: number;
};
export type DiarResult = { ok: true; pieces: Piece[]; report: JoinReport } | { ok: false; error: string };

type C = { chunk: Chunk; status: "pending" | "running" | "done"; tries: number; errs: number; job?: DiarJob; startedAt: number; segs: Seg[] };

export async function runDiarize(totalSeconds: number, deps: DiarDeps, cfgIn: Partial<DiarConfig> = {}): Promise<DiarResult> {
  const cfg = { ...DEFAULT_DIAR_CONFIG, ...cfgIn };
  const chunks = planDiarChunks(totalSeconds);
  if (chunks.length === 0) return { ok: false, error: "No audio to analyse." };
  const st: C[] = chunks.map((c) => ({ chunk: c, status: "pending", tries: 0, errs: 0, startedAt: 0, segs: [] }));
  const t0 = deps.now();
  let nextStartAt = 0;
  const say = () => { if (deps.onProgress) deps.onProgress("Detecting speakers... " + st.filter((x) => x.status === "done").length + " of " + st.length + " parts done."); };
  say();
  while (st.some((x) => x.status !== "done")) {
    if (deps.shouldStop && deps.shouldStop()) return { ok: false, error: "Stopped." };
    const now = deps.now();
    if (now - t0 > cfg.overallTimeoutMs) return { ok: false, error: "Speaker detection took too long." };
    let acted = false;
    const running = st.filter((x) => x.status === "running");
    const next = st.find((x) => x.status === "pending");
    if (next && running.length < cfg.maxRunning && now >= nextStartAt) {
      acted = true;
      let r: DiarStart;
      try { r = await deps.startChunk(next.chunk); } catch (e: any) { r = { error: String((e && e.message) || "start failed") }; }
      if (r.busy) { nextStartAt = deps.now() + cfg.busyBackoffMs; }
      else if (r.error || !r.job) {
        next.tries++;
        if (next.tries >= cfg.maxStartTries) return { ok: false, error: r.error || "Could not start speaker detection." };
        nextStartAt = deps.now() + cfg.busyBackoffMs;
      } else { next.job = r.job; next.status = "running"; next.startedAt = deps.now(); }
    }
    for (const x of st.filter((y) => y.status === "running")) {
      if (!x.job) continue;
      acted = true;
      let r: DiarCheck;
      try { r = await deps.checkChunk(x.job); } catch (e: any) { r = { error: String((e && e.message) || "check failed") }; }
      if (r.busy) continue;
      if (r.error || !r.state) {
        x.errs++;
        if (x.errs > cfg.maxCheckErrors) return { ok: false, error: r.error || "Could not check speaker detection." };
      } else if (r.state === "done" && Array.isArray(r.segments)) { x.segs = r.segments; x.status = "done"; say(); }
      else if (r.state === "failed") return { ok: false, error: r.error || "Speaker detection failed for one part." };
      else if (deps.now() - x.startedAt > cfg.chunkTimeoutMs) return { ok: false, error: "Speaker detection took too long for one part." };
    }
    if (st.some((x) => x.status !== "done")) await deps.sleep(acted ? cfg.pollMs : 1000);
  }
  const results: ChunkResult[] = st.map((x) => ({ offset: x.chunk.startSeconds, duration: x.chunk.durationSeconds, segs: x.segs }));
  const m = matchChunks(results);
  const t = buildTurns(m.segs, totalSeconds);
  const pieces = planPieces(t.turns, totalSeconds);
  if (pieces.length === 0) return { ok: false, error: "No speech found." };
  return {
    ok: true, pieces,
    report: {
      chunks: st.length, speakerCount: m.speakerCount, droppedSeconds: Math.round(t.droppedSeconds), pieces: pieces.length,
      lowConfidenceJoins: m.seams.filter((s) => s.lowConfidence).length,
      inferredSpeakers: m.seams.reduce((a, s) => a + s.inferred, 0),
      newSpeakers: m.seams.reduce((a, s) => a + s.newSpeakers, 0),
    },
  };
}

// Pieces -> what intron-pieces expects (the planner's "soft" is the start flag).
export function toPieceIn(p: Piece) {
  return { index: p.index, startSeconds: p.startSeconds, endSeconds: p.endSeconds, softStart: p.soft, softEnd: p.softEnd };
}
// Pieces -> parts for runIntronParts.
export function toRunnerParts(pieces: Piece[]) {
  return pieces.map((p) => ({ index: p.index, startSeconds: p.startSeconds, durationSeconds: p.durationSeconds }));
}
