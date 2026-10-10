// Pause-based cutting for long Intron files. Pure TypeScript.
// Parts are cut at the quietest moment in a short window near every 100 seconds, with no overlap.
import { parseDiarizedText, formatTime } from "./intronStitch";

export const CUT_STEP_SECONDS = 100;
export const CUT_WINDOW_SECONDS = 18;
export const CUT_MAX_PART_SECONDS = 120;
const CUT_MIN_TAIL_SECONDS = 12;
const CUT_FRAME_MS = 50;

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function partCountFor(totalSeconds: number): number {
  const t = Number(totalSeconds);
  if (!isFinite(t) || t <= 0) return 0;
  if (t <= CUT_MAX_PART_SECONDS) return 1;
  return Math.ceil((t - CUT_MAX_PART_SECONDS) / CUT_STEP_SECONDS) + 1;
}

// Rough plan the page uses to track parts. Real cut points are found by the server.
export function nominalPlan(totalSeconds: number): { index: number; startSeconds: number; durationSeconds: number }[] {
  const count = partCountFor(totalSeconds);
  const plan: { index: number; startSeconds: number; durationSeconds: number }[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * CUT_STEP_SECONDS;
    const dur = i === count - 1 ? totalSeconds - start : CUT_STEP_SECONDS;
    plan.push({ index: i, startSeconds: start, durationSeconds: round2(dur) });
  }
  return plan;
}

// Where to look for the quiet moment that ends part k-1 and starts part k (k >= 1).
export function cutWindow(k: number, totalSeconds: number): { startSeconds: number; lengthSeconds: number } {
  const start = k * CUT_STEP_SECONDS;
  return { startSeconds: start, lengthSeconds: Math.max(1, Math.min(CUT_WINDOW_SECONDS, totalSeconds - start - CUT_MIN_TAIL_SECONDS)) };
}

// Real start and length of part i, given the offset found inside each cut window.
export function partRange(
  i: number,
  totalSeconds: number,
  offsetFor: (k: number) => number
): { startSeconds: number; durationSeconds: number } {
  const count = partCountFor(totalSeconds);
  const at = (k: number) => {
    const w = cutWindow(k, totalSeconds);
    const off = Math.min(Math.max(0, Number(offsetFor(k)) || 0), w.lengthSeconds);
    return w.startSeconds + off;
  };
  const start = i <= 0 ? 0 : at(i);
  const end = i >= count - 1 ? totalSeconds : at(i + 1);
  return { startSeconds: round2(start), durationSeconds: round2(end - start) };
}

// Finds the quietest stretch in a block of audio samples. Works for any pause length.
export function findQuietCut(samples: ArrayLike<number>, sampleRate: number): { offsetSeconds: number; weak: boolean } {
  const frame = Math.max(1, Math.floor((sampleRate * CUT_FRAME_MS) / 1000));
  const n = Math.floor(samples.length / frame);
  if (n < 3) return { offsetSeconds: samples.length / sampleRate / 2, weak: true };
  const e: number[] = [];
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let i = f * frame; i < (f + 1) * frame; i++) {
      const v = Number(samples[i]) || 0;
      s += v * v;
    }
    e.push(s / frame);
  }
  const sm = e.map((_v, i) => {
    let s = 0;
    let c = 0;
    for (let j = i - 1; j <= i + 1; j++) if (j >= 0 && j < n) { s += e[j]; c++; }
    return s / c;
  });
  const sorted = [...sm].sort((a, b) => a - b);
  const mn = sorted[0];
  const med = sorted[Math.floor(n / 2)];
  const thr = mn + 0.2 * (med - mn);
  let best = 0;
  let bestLen = 0;
  let runStart = -1;
  for (let i = 0; i <= n; i++) {
    const low = i < n && sm[i] <= thr;
    if (low && runStart < 0) runStart = i;
    if (!low && runStart >= 0) {
      const len = i - runStart;
      if (len > bestLen) { bestLen = len; best = runStart; }
      runStart = -1;
    }
  }
  if (bestLen === 0) return { offsetSeconds: samples.length / sampleRate / 2, weak: true };
  return { offsetSeconds: ((best + bestLen / 2) * frame) / sampleRate, weak: med > 0 && mn >= 0.25 * med };
}

export type JoinPartInput = { index: number; text: string | null; startSeconds?: number };
export type JoinResult = { text: string; speakerCount: number; failedParts: number[]; emptyTurns: number; notices: string[] };

// Joins parts in order. Speaker numbers are the engine's own numbers + 1 (they can differ between parts).
export function joinIntronParts(partsIn: JoinPartInput[]): JoinResult {
  const parts = [...partsIn].sort((a, b) => a.index - b.index);
  const lines: string[] = [];
  const failedParts: number[] = [];
  const speakers = new Set<number>();
  let emptyTurns = 0;
  let labelled = false;
  let multi = 0;
  parts.forEach((p, pos) => {
    const at = formatTime(p.startSeconds ?? p.index * 100);
    if (p.text === null || p.text === undefined) {
      failedParts.push(p.index);
      lines.push("[Part " + (p.index + 1) + " could not be transcribed. The audio from about " + at + " is missing here.]");
      return;
    }
    const parsed = parseDiarizedText(p.text);
    emptyTurns += parsed.emptyTurns;
    if (!parsed.turns.length) return;
    if (parsed.labelled) labelled = true;
    if (pos > 0) lines.push("[Part " + (p.index + 1) + " starts here (about " + at + ")]");
    multi++;
    for (const t of parsed.turns) {
      const words = t.text.split(/\s+/).filter(Boolean).join(" ");
      if (!words) continue;
      if (t.label >= 0) {
        speakers.add(t.label + 1);
        lines.push("Speaker " + (t.label + 1) + ": " + words);
      } else lines.push(words);
    }
  });
  const notices: string[] = [];
  if (failedParts.length) notices.push(failedParts.length + " part(s) could not be transcribed. Look for the [Part ... could not be transcribed] notes.");
  if (labelled && multi > 1) {
    notices.push("This recording was transcribed in parts. Speaker numbers can differ between parts, so the same person may appear under a different number. Use the speaker tools below to fix this.");
  }
  if (emptyTurns) notices.push("The engine returned " + emptyTurns + " empty speaker turn(s). They were removed.");
  return { text: lines.join("\n"), speakerCount: speakers.size, failedParts, emptyTurns, notices };
}
