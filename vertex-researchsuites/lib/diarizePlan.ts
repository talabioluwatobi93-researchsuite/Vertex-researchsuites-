// P12-1: plan for speaker-first transcription of long audio. Pure functions: no network, no storage.
// Flow: diarize in 15-min chunks (6-min overlap) -> match speakers across chunks ->
// build speaker turns -> cut turns into pieces of at most ~100 s for Intron -> render lines in time order.
export type Seg = { speaker: string; start: number; stop: number };
export type GSeg = { speaker: number; start: number; stop: number };
export type Chunk = { index: number; startSeconds: number; durationSeconds: number };
export type ChunkResult = { offset: number; duration: number; segs: Seg[] };
export type ChunkSeam = {
  chunk: number; matchedSpeakers: number; sharedSeconds: number;
  inferred: number; newSpeakers: number; lowConfidence: boolean;
};
export type Turn = { speaker: number; start: number; end: number };
export type Piece = {
  index: number; startSeconds: number; endSeconds: number; durationSeconds: number;
  speaker: number; soft: boolean; softEnd: boolean;
};

export const DIAR_CHUNK_SECONDS = 900; // 15 min per Replicate call
export const DIAR_OVERLAP_SECONDS = 360; // tested in simulation: 120 s splits speakers, 360 s mostly does not
export const PIECE_TARGET_SECONDS = 100; // Intron takes at most 120 s
export const MIN_TURN_SECONDS = 1.5; // shorter turns are folded into the neighbour
export const GAP_FILL_SECONDS = 6; // longer silences are left out
const PAD_SECONDS = 0.2;
const MIN_SHARED_SECONDS = 2;
const MIN_SHARED_FRACTION = 0.3;
const SILENT_SECONDS = 0.5;
const NOTEXT = "[no text returned]";

// "0:00:06.629881" -> 6.629881. Returns NaN when it cannot be read.
export function parseClock(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v !== "string") return NaN;
  const parts = v.trim().split(":");
  if (parts.length > 3) return NaN;
  let sec = 0;
  for (const p of parts) {
    if (p.trim() === "") return NaN;
    const x = Number(p);
    if (!Number.isFinite(x) || x < 0) return NaN;
    sec = sec * 60 + x;
  }
  return sec;
}

// Reads the model output ({ segments: [{speaker,start,stop}] }). Voice fingerprints are ignored.
export function parseSegments(output: unknown): Seg[] {
  const o = output as { segments?: unknown } | null;
  const arr: unknown[] = o && Array.isArray(o.segments) ? o.segments : [];
  const out: Seg[] = [];
  for (const item of arr) {
    const r = item as { speaker?: unknown; start?: unknown; stop?: unknown } | null;
    if (!r || typeof r.speaker !== "string" || r.speaker === "") continue;
    const start = parseClock(r.start);
    const stop = parseClock(r.stop);
    if (Number.isFinite(start) && Number.isFinite(stop) && start >= 0 && stop > start) {
      out.push({ speaker: r.speaker, start, stop });
    }
  }
  return out;
}

// Chunks of 15 min that overlap by 6 min. The last chunk ends exactly at the end of the audio.
export function planDiarChunks(totalSeconds: number): Chunk[] {
  const out: Chunk[] = [];
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return out;
  const step = DIAR_CHUNK_SECONDS - DIAR_OVERLAP_SECONDS;
  for (let start = 0; start < totalSeconds; start += step) {
    const dur = Math.min(DIAR_CHUNK_SECONDS, totalSeconds - start);
    out.push({ index: out.length, startSeconds: start, durationSeconds: dur });
    if (start + dur >= totalSeconds) break;
  }
  return out;
}

function clipSegs(segs: GSeg[], lo: number, hi: number): GSeg[] {
  const out: GSeg[] = [];
  for (const s of segs) {
    const a = Math.max(s.start, lo);
    const b = Math.min(s.stop, hi);
    if (b > a) out.push({ speaker: s.speaker, start: a, stop: b });
  }
  return out;
}

// Joins the chunks into one timeline with consistent speaker numbers (1, 2, 3 by first appearance).
// Letters restart in every chunk, so they are matched by who speaks at the same moments in the overlap.
export function matchChunks(chunks: ChunkResult[]): { segs: GSeg[]; seams: ChunkSeam[]; speakerCount: number } {
  let acc: GSeg[] = [];
  let next = 1;
  const seams: ChunkSeam[] = [];
  chunks.forEach((ch, ci) => {
    const abs = ch.segs
      .filter((s) => s.stop > s.start)
      .map((s) => ({ speaker: s.speaker, start: s.start + ch.offset, stop: s.stop + ch.offset }))
      .sort((a, b) => a.start - b.start);
    if (ci === 0 || acc.length === 0) {
      const ids = new Map<string, number>();
      for (const s of abs) if (!ids.has(s.speaker)) ids.set(s.speaker, next++);
      acc = acc.concat(abs.map((s) => ({ speaker: ids.get(s.speaker)!, start: s.start, stop: s.stop })));
      return;
    }
    const prev = chunks[ci - 1];
    const ovStart = ch.offset;
    const ovEnd = prev.offset + prev.duration;
    const hasOv = ovEnd > ovStart;
    const letters: string[] = [];
    abs.forEach((s) => { if (!letters.includes(s.speaker)) letters.push(s.speaker); });
    const newDur = new Map<string, number>();
    const oldDur = new Map<number, number>();
    const shared = new Map<string, number>();
    if (hasOv) {
      const oldIn = acc.filter((s) => s.stop > ovStart && s.start < ovEnd);
      for (const g of oldIn) {
        const len = Math.min(g.stop, ovEnd) - Math.max(g.start, ovStart);
        oldDur.set(g.speaker, (oldDur.get(g.speaker) || 0) + Math.max(0, len));
      }
      for (const n of abs.filter((s) => s.stop > ovStart && s.start < ovEnd)) {
        const a = Math.max(n.start, ovStart);
        const b = Math.min(n.stop, ovEnd);
        newDur.set(n.speaker, (newDur.get(n.speaker) || 0) + Math.max(0, b - a));
        for (const g of oldIn) {
          const lo = Math.max(a, g.start);
          const hi = Math.min(b, g.stop);
          if (hi > lo) shared.set(n.speaker + "|" + g.speaker, (shared.get(n.speaker + "|" + g.speaker) || 0) + hi - lo);
        }
      }
    }
    const pairs: { l: string; g: number; v: number }[] = [];
    shared.forEach((v, k) => { const i = k.lastIndexOf("|"); pairs.push({ l: k.slice(0, i), g: Number(k.slice(i + 1)), v }); });
    pairs.sort((a, b) => b.v - a.v);
    const map = new Map<string, number>();
    const takenG = new Set<number>();
    let matched = 0;
    let sharedTotal = 0;
    for (const p of pairs) {
      if (map.has(p.l) || takenG.has(p.g)) continue;
      const minDur = Math.min(newDur.get(p.l) || 0, oldDur.get(p.g) || 0);
      if (p.v < MIN_SHARED_SECONDS || p.v < MIN_SHARED_FRACTION * minDur) continue;
      map.set(p.l, p.g); takenG.add(p.g); matched++; sharedTotal += p.v;
    }
    // Elimination: one new speaker and one old speaker are both silent in the overlap -> same person.
    let inferred = 0;
    if (hasOv) {
      const silentNew = letters.filter((l) => !map.has(l) && (newDur.get(l) || 0) < SILENT_SECONDS);
      const allOld = Array.from(new Set(acc.map((s) => s.speaker)));
      const silentOld = allOld.filter((g) => !takenG.has(g) && (oldDur.get(g) || 0) < SILENT_SECONDS);
      if (silentNew.length === 1 && silentOld.length === 1) { map.set(silentNew[0], silentOld[0]); takenG.add(silentOld[0]); inferred = 1; }
    }
    let created = 0;
    for (const l of letters) if (!map.has(l)) { map.set(l, next++); created++; }
    const mid = hasOv ? (ovStart + ovEnd) / 2 : ovStart;
    const mapped = abs.map((s) => ({ speaker: map.get(s.speaker)!, start: s.start, stop: s.stop }));
    acc = clipSegs(acc, -Infinity, mid).concat(clipSegs(mapped, mid, Infinity));
    seams.push({
      chunk: ci, matchedSpeakers: matched, sharedSeconds: Math.round(sharedTotal * 10) / 10,
      inferred, newSpeakers: created, lowConfidence: !hasOv || matched === 0 || created > 0,
    });
  });
  acc.sort((a, b) => a.start - b.start);
  const order: number[] = [];
  acc.forEach((s) => { if (!order.includes(s.speaker)) order.push(s.speaker); });
  const num = new Map(order.map((g, i) => [g, i + 1] as [number, number]));
  return { segs: acc.map((s) => ({ speaker: num.get(s.speaker)!, start: s.start, stop: s.stop })), seams, speakerCount: order.length };
}

// One speaker per moment (the shortest covering segment wins, so interjections stay visible), then tidy.
export function buildTurns(segs: GSeg[], totalSeconds: number): { turns: Turn[]; droppedSeconds: number } {
  const FR = 10;
  const n = Math.max(0, Math.ceil(totalSeconds * FR));
  const lab = new Int32Array(n);
  const byLen = segs.filter((s) => s.stop > s.start && s.start < totalSeconds).sort((a, b) => (b.stop - b.start) - (a.stop - a.start));
  for (const s of byLen) {
    const a = Math.max(0, Math.floor(s.start * FR));
    const b = Math.min(n, Math.ceil(s.stop * FR));
    for (let i = a; i < b; i++) lab[i] = s.speaker;
  }
  type Run = { sp: number; a: number; b: number };
  const runs: Run[] = [];
  for (let i = 0; i < n; ) { let j = i; while (j < n && lab[j] === lab[i]) j++; runs.push({ sp: lab[i], a: i, b: j }); i = j; }
  // Short silences go half to each neighbour; long silences are left out.
  let cur: Run[] = [];
  let dropped = 0;
  for (let k = 0; k < runs.length; k++) {
    const r = runs[k];
    if (r.sp !== 0) { cur.push({ ...r }); continue; }
    const len = (r.b - r.a) / FR;
    const p = cur.length > 0 && cur[cur.length - 1].sp !== 0 ? cur[cur.length - 1] : null;
    const q = k + 1 < runs.length && runs[k + 1].sp !== 0 ? runs[k + 1] : null;
    if (len > GAP_FILL_SECONDS || (!p && !q)) { dropped += len; cur.push({ ...r }); continue; }
    if (p && q) { const mid = Math.floor((r.a + r.b) / 2); p.b = mid; runs[k + 1] = { ...q, a: mid }; }
    else if (p) p.b = r.b;
    else if (q) runs[k + 1] = { ...q, a: r.a };
  }
  // Fold very short turns into the longer touching neighbour, then join same-speaker neighbours.
  const minF = MIN_TURN_SECONDS * FR;
  for (let pass = 0, changed = true; changed && pass < 20; pass++) {
    changed = false;
    const m: Run[] = [];
    for (const r of cur) { const l = m[m.length - 1]; if (l && l.sp === r.sp && l.b === r.a) l.b = r.b; else m.push({ ...r }); }
    cur = m;
    for (let k = 0; k < cur.length; k++) {
      const r = cur[k];
      if (r.sp === 0 || r.b - r.a >= minF) continue;
      const p = k > 0 && cur[k - 1].sp !== 0 && cur[k - 1].b === r.a ? cur[k - 1] : null;
      const q = k + 1 < cur.length && cur[k + 1].sp !== 0 && cur[k + 1].a === r.b ? cur[k + 1] : null;
      const to = p && q ? ((p.b - p.a) >= (q.b - q.a) ? p : q) : p || q;
      if (to) { r.sp = to.sp; changed = true; }
    }
  }
  const turns: Turn[] = cur.filter((r) => r.sp !== 0).map((r) => ({ speaker: r.sp, start: r.a / FR, end: r.b / FR }));
  return { turns, droppedSeconds: Math.round(dropped * 10) / 10 };
}

// Pieces for Intron: one speaker each, at most ~100 s. soft = the start is a mid-turn cut that
// the route may move to a quiet moment (within a few seconds).
export function planPieces(turns: Turn[], totalSeconds: number): Piece[] {
  const out: Piece[] = [];
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  for (const t of turns) {
    const len = t.end - t.start;
    const n = Math.max(1, Math.ceil(len / PIECE_TARGET_SECONDS));
    const each = len / n;
    // One list of cut points per turn, so a piece's end is exactly the next piece's start.
    const cuts: number[] = [];
    for (let i = 0; i <= n; i++) cuts.push(r3(t.start + i * each));
    for (let i = 0; i < n; i++) {
      const s = i === 0 ? Math.max(0, cuts[0] - PAD_SECONDS) : cuts[i];
      const e = i === n - 1 ? Math.min(totalSeconds, cuts[n] + PAD_SECONDS) : cuts[i + 1];
      if (e > s) {
        out.push({ index: out.length, startSeconds: r3(s), endSeconds: r3(e), durationSeconds: r3(e - s), speaker: t.speaker, soft: i > 0, softEnd: i < n - 1 });
      }
    }
  }
  return out;
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const p = (x: number) => (x < 10 ? "0" : "") + x;
  return p(Math.floor(s / 60)) + ":" + p(s % 60);
}

// "[mm:ss] Speaker N: text" in time order. Pieces of the same turn are joined; failed pieces say so.
export function renderPieces(items: { startSeconds: number; speaker: number; text: string | null }[]): string {
  const sorted = items.slice().sort((a, b) => a.startSeconds - b.startSeconds);
  const lines: { t: number; sp: number; text: string }[] = [];
  for (const it of sorted) {
    const text = (it.text || "").trim() || NOTEXT;
    const last = lines[lines.length - 1];
    if (last && last.sp === it.speaker && text !== NOTEXT) last.text = last.text === NOTEXT ? text : last.text + " " + text;
    else lines.push({ t: it.startSeconds, sp: it.speaker, text });
  }
  return lines.map((l) => "[" + mmss(l.t) + "] Speaker " + l.sp + ": " + l.text).join("\n");
}
