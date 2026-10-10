// Intron long-file helpers. Pure TypeScript, no imports.
// Plans overlapping parts, reads "SPEAKER_00: words" text, and joins the parts back together.

export const INTRON_PART_SECONDS = 120;
export const INTRON_OVERLAP_SECONDS = 10;

const TAIL_WORDS = 80;
const HEAD_WORDS = 80;
const EDGE_WORDS = 12;
const MIN_PAIRS = 4;
const MIN_EXACT = 3;
const MIN_RATIO = 0.5;
const MAX_DROP_DIFF = 30;
const MAX_DROP = 90;
const HIGH_PAIRS = 6;
const HIGH_RATIO = 0.6;
const HIGH_EXACT_SHARE = 0.5;
const RECENT_WORDS = 600;
const MIN_VOTES = 2;
const VOTE_SHARE = 0.6;
const S_EXACT = 6;
const S_NEAR = 1;
const S_MISS = -4;
const S_GAP = -4;
const NEG = -1000000000;

export type PlannedPart = { index: number; startSeconds: number; durationSeconds: number };

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export function planIntronParts(
  totalSeconds: number,
  partSeconds: number = INTRON_PART_SECONDS,
  overlapSeconds: number = INTRON_OVERLAP_SECONDS
): PlannedPart[] {
  const total = Number(totalSeconds);
  if (!isFinite(total) || !(total > 0) || !(partSeconds > 0)) return [];
  const overlap = overlapSeconds >= 0 && overlapSeconds < partSeconds ? overlapSeconds : 0;
  const step = partSeconds - overlap;
  const parts: PlannedPart[] = [];
  for (let i = 0; i < 100000; i++) {
    const start = round3(i * step);
    const duration = round3(Math.min(partSeconds, total - start));
    parts.push({ index: i, startSeconds: start, durationSeconds: duration });
    if (start + partSeconds >= total) break;
  }
  return parts;
}

export function billedSeconds(parts: { durationSeconds: number }[]): number {
  let sum = 0;
  for (const p of parts) sum += Math.ceil(p.durationSeconds);
  return sum;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const two = (n: number) => (n < 10 ? "0" + n : String(n));
  return h > 0 ? h + ":" + two(m) + ":" + two(r) : two(m) + ":" + two(r);
}

const MARKS = new RegExp("\\p{M}", "gu");
const NOT_ALNUM = new RegExp("[^\\p{L}\\p{N}]", "gu");

export function normalizeWord(w: string): string {
  return String(w).normalize("NFD").replace(MARKS, "").toLowerCase().replace(NOT_ALNUM, "");
}

export type Turn = { label: number; text: string };

// Reads lines like "SPEAKER_01: words". Text with no speaker lines becomes one turn with label -1.
export function parseDiarizedText(text: string): { turns: Turn[]; emptyTurns: number; labelled: boolean } {
  const re = /^\s*SPEAKER[_ ]?(\d+)\s*:\s?(.*)$/i;
  const turns: Turn[] = [];
  let labelled = false;
  let cur: Turn | null = null;
  for (const line of String(text || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = re.exec(line);
    if (m) {
      labelled = true;
      cur = { label: parseInt(m[1], 10), text: m[2] };
      turns.push(cur);
    } else if (cur) {
      cur.text += " " + line.trim();
    } else {
      cur = { label: -1, text: line.trim() };
      turns.push(cur);
    }
  }
  const kept = turns.filter((t) => t.text.trim().length > 0);
  return { turns: kept, emptyTurns: turns.length - kept.length, labelled };
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
      row.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

function isNear(a: string, b: string): boolean {
  const len = Math.min(a.length, b.length);
  if (len < 5) return false;
  return editDistance(a, b, len >= 9 ? 2 : 1) <= (len >= 9 ? 2 : 1);
}

type Aligned = { matched: [number, number, boolean][]; mismatches: number };

// Local alignment of the end of the earlier text against the start of the new part.
function align(tail: string[], head: string[]): Aligned | null {
  const a = tail.length;
  const b = head.length;
  if (!a || !b) return null;
  const W = b + 1;
  const H = new Int32Array((a + 1) * W).fill(NEG);
  const P = new Int8Array((a + 1) * W);
  for (let i = 1; i <= a; i++) {
    for (let j = 1; j <= b; j++) {
      const x = tail[i - 1];
      const y = head[j - 1];
      const s = x === y ? S_EXACT : isNear(x, y) ? S_NEAR : S_MISS;
      let best = NEG;
      let p = 0;
      const diag = H[(i - 1) * W + (j - 1)];
      if (diag > NEG / 2) {
        best = diag + s;
        p = 1;
      }
      if (j - 1 < EDGE_WORDS && s > best) {
        best = s;
        p = 2;
      }
      const up = H[(i - 1) * W + j];
      if (up > NEG / 2 && up + S_GAP > best) {
        best = up + S_GAP;
        p = 3;
      }
      const left = H[i * W + (j - 1)];
      if (left > NEG / 2 && left + S_GAP > best) {
        best = left + S_GAP;
        p = 4;
      }
      H[i * W + j] = best;
      P[i * W + j] = p;
    }
  }
  let bi = -1;
  let bj = -1;
  let bs = 0;
  for (let i = Math.max(1, a - EDGE_WORDS + 1); i <= a; i++) {
    for (let j = 1; j <= b; j++) {
      const p = P[i * W + j];
      if ((p === 1 || p === 2) && H[i * W + j] > bs) {
        bs = H[i * W + j];
        bi = i;
        bj = j;
      }
    }
  }
  if (bi < 0) return null;
  const pairs: [number, number][] = [];
  let i = bi;
  let j = bj;
  while (i > 0 && j > 0) {
    const p = P[i * W + j];
    if (p === 1 || p === 2) {
      pairs.push([i - 1, j - 1]);
      if (p === 2) break;
      i--;
      j--;
    } else if (p === 3) i--;
    else if (p === 4) j--;
    else break;
  }
  pairs.reverse();
  const matched: [number, number, boolean][] = [];
  let mismatches = 0;
  for (const [ti, hj] of pairs) {
    if (tail[ti] === head[hj]) matched.push([ti, hj, true]);
    else if (isNear(tail[ti], head[hj])) matched.push([ti, hj, false]);
    else mismatches++;
  }
  return { matched, mismatches };
}

export type StitchPartInput = {
  index: number;
  text: string | null;
  startSeconds?: number;
  durationSeconds?: number;
};
export type StitchOptions = { partSeconds?: number; overlapSeconds?: number };
export type SeamConfidence = "high" | "medium" | "low" | "none" | "gap";
export type Seam = {
  part: number;
  atSeconds: number;
  confidence: SeamConfidence;
  matchedWords: number;
  droppedFromPrevious: number;
  droppedFromThis: number;
  newSpeakers: number;
  inferredSpeakers: number;
};
export type StitchResult = {
  text: string;
  speakerCount: number;
  seams: Seam[];
  emptyTurns: number;
  failedParts: number[];
  notices: string[];
};

type WordItem = { k: "w"; raw: string; n: string; spk: number };
type MarkerItem = { k: "m"; text: string; reset: boolean };
type Item = WordItem | MarkerItem;
type PartWord = { raw: string; n: string; label: number };

function render(items: Item[], labelled: boolean): string {
  const lines: string[] = [];
  let cur: { spk: number; words: string[] } | null = null;
  const flush = () => {
    if (cur) lines.push(labelled ? "Speaker " + cur.spk + ": " + cur.words.join(" ") : cur.words.join(" "));
    cur = null;
  };
  for (const it of items) {
    if (it.k === "m") {
      flush();
      lines.push(it.text);
    } else {
      if (!cur || (labelled && cur.spk !== it.spk)) {
        flush();
        cur = { spk: it.spk, words: [] };
      }
      cur.words.push(it.raw);
    }
  }
  flush();
  return lines.join("\n");
}

export function stitchIntronParts(partsIn: StitchPartInput[], opts: StitchOptions = {}): StitchResult {
  const partSec = opts.partSeconds ?? INTRON_PART_SECONDS;
  const overlap = opts.overlapSeconds ?? INTRON_OVERLAP_SECONDS;
  const parts = [...partsIn].sort((x, y) => x.index - y.index);
  const out: Item[] = [];
  const seams: Seam[] = [];
  const failedParts: number[] = [];
  const notices: string[] = [];
  let nextSpk = 1;
  let emptyTurns = 0;
  let anyLabelled = false;
  let wordsInOut = 0;

  const pushWords = (words: PartWord[], from: number, map: Map<number, number>) => {
    for (let k = from; k < words.length; k++) {
      out.push({ k: "w", raw: words[k].raw, n: words[k].n, spk: map.get(words[k].label) as number });
      wordsInOut++;
    }
  };
  const newMap = (words: PartWord[], from: number, map: Map<number, number>): number => {
    let made = 0;
    for (let k = from; k < words.length; k++) {
      if (!map.has(words[k].label)) {
        map.set(words[k].label, nextSpk++);
        made++;
      }
    }
    return made;
  };

  parts.forEach((p, pos) => {
    const start = p.startSeconds ?? p.index * (partSec - overlap);
    if (p.text === null || p.text === undefined) {
      failedParts.push(p.index);
      const dur = p.durationSeconds ?? partSec;
      const from = pos === 0 ? start : start + overlap;
      const to = pos === parts.length - 1 ? start + dur : start + dur - overlap;
      out.push({
        k: "m",
        reset: true,
        text:
          "[Part " + (p.index + 1) + " could not be transcribed. The audio from about " +
          formatTime(from) + " to " + formatTime(Math.max(from, to)) + " is missing here.]",
      });
      return;
    }
    const parsed = parseDiarizedText(p.text);
    emptyTurns += parsed.emptyTurns;
    if (parsed.labelled) anyLabelled = true;
    const words: PartWord[] = [];
    for (const t of parsed.turns) {
      for (const tok of t.text.split(/\s+/)) {
        if (tok) words.push({ raw: tok, n: normalizeWord(tok), label: t.label });
      }
    }
    if (!words.length) return;

    const seamBase = { part: p.index, atSeconds: start };
    const map = new Map<number, number>();

    // Nothing written yet (first part, or only failed parts so far).
    if (wordsInOut === 0) {
      newMap(words, 0, map);
      pushWords(words, 0, map);
      return;
    }

    const tailIdx: number[] = [];
    for (let k = out.length - 1; k >= 0 && tailIdx.length < TAIL_WORDS; k--) {
      const it = out[k];
      if (it.k === "m") break;
      if (it.n) tailIdx.push(k);
    }
    tailIdx.reverse();

    // The earlier text ends with a missing-part marker: nothing to match against.
    if (!tailIdx.length) {
      const made = newMap(words, 0, map);
      pushWords(words, 0, map);
      seams.push({ ...seamBase, confidence: "gap", matchedWords: 0, droppedFromPrevious: 0, droppedFromThis: 0, newSpeakers: made, inferredSpeakers: 0 });
      return;
    }

    const headIdx: number[] = [];
    for (let k = 0; k < words.length && headIdx.length < HEAD_WORDS; k++) {
      if (words[k].n) headIdx.push(k);
    }
    const tailN = tailIdx.map((k) => (out[k] as WordItem).n);
    const headN = headIdx.map((k) => words[k].n);

    let accepted: {
      cutTail: number; keptStart: number; matched: [number, number, boolean][];
      dropPrev: number; dropThis: number; ratio: number; exact: number;
    } | null = null;
    const al = align(tailN, headN);
    if (al && al.matched.length >= MIN_PAIRS) {
      const m = al.matched;
      const exact = m.filter((x) => x[2]).length;
      const span = Math.max(m[m.length - 1][0] - m[0][0] + 1, m[m.length - 1][1] - m[0][1] + 1);
      const ratio = m.length / span;
      const mid = m[Math.floor(m.length / 2)];
      const dropPrev = tailN.length - mid[0];
      const dropThis = mid[1];
      if (
        exact >= MIN_EXACT && ratio >= MIN_RATIO &&
        Math.abs(dropPrev - dropThis) <= MAX_DROP_DIFF && dropPrev <= MAX_DROP && dropThis <= MAX_DROP
      ) {
        accepted = { cutTail: tailIdx[mid[0]], keptStart: headIdx[mid[1]], matched: m, dropPrev, dropThis, ratio, exact };
      }
    }

    // No usable overlap match: start new speaker numbers and say so in the text.
    if (!accepted) {
      out.push({
        k: "m",
        reset: true,
        text:
          "[Joined two parts here (about " + formatTime(start) +
          "). The overlap could not be matched, so a few words may be missing or repeated, and speaker numbers may restart here.]",
      });
      const made = newMap(words, 0, map);
      pushWords(words, 0, map);
      seams.push({ ...seamBase, confidence: "none", matchedWords: 0, droppedFromPrevious: 0, droppedFromThis: 0, newSpeakers: made, inferredSpeakers: 0 });
      return;
    }

    // Speaker mapping from votes of matched word pairs (read before the tail is cut).
    const votes = new Map<number, Map<number, number>>();
    for (const [ti, hj] of accepted.matched) {
      const label = words[headIdx[hj]].label;
      const g = (out[tailIdx[ti]] as WordItem).spk;
      const per = votes.get(label) || new Map<number, number>();
      per.set(g, (per.get(g) || 0) + 1);
      votes.set(label, per);
    }
    const cands: { label: number; g: number; top: number; total: number }[] = [];
    votes.forEach((per, label) => {
      let g = -1;
      let top = 0;
      let total = 0;
      per.forEach((c, gg) => {
        total += c;
        if (c > top) { top = c; g = gg; }
      });
      if (top >= MIN_VOTES && top / total >= VOTE_SHARE) cands.push({ label, g, top, total });
    });
    cands.sort((x, y) => y.top - x.top);
    const claimed = new Set<number>();
    for (const c of cands) {
      if (!claimed.has(c.g)) {
        map.set(c.label, c.g);
        claimed.add(c.g);
      }
    }
    let allResolved = true;
    votes.forEach((_v, label) => {
      if (!map.has(label)) allResolved = false;
    });

    out.length = accepted.cutTail;
    wordsInOut = out.filter((x) => x.k === "w").length;

    const keptLabels: number[] = [];
    for (let k = accepted.keptStart; k < words.length; k++) {
      if (keptLabels.indexOf(words[k].label) < 0) keptLabels.push(words[k].label);
    }
    const unplaced = keptLabels.filter((l) => !map.has(l));
    const recent = new Set<number>();
    let seen = 0;
    for (let k = out.length - 1; k >= 0 && seen < RECENT_WORDS; k--) {
      const it = out[k];
      if (it.k === "m") {
        if (it.reset) break;
        continue;
      }
      recent.add(it.spk);
      seen++;
    }
    const used = new Set<number>();
    map.forEach((g) => used.add(g));
    const unclaimed: number[] = [];
    recent.forEach((g) => { if (!used.has(g)) unclaimed.push(g); });

    let inferred = 0;
    let made = 0;
    if (unplaced.length === 1 && unclaimed.length === 1) {
      map.set(unplaced[0], unclaimed[0]);
      inferred = 1;
    } else {
      for (const l of unplaced) {
        map.set(l, nextSpk++);
        made++;
      }
    }
    if (made > 0) {
      out.push({
        k: "m",
        reset: false,
        text: "[Joined two parts here (about " + formatTime(start) + "). Speaker numbers may not match across this point.]",
      });
    }
    pushWords(words, accepted.keptStart, map);

    const n = accepted.matched.length;
    let confidence: SeamConfidence = "medium";
    if (made > 0) confidence = "low";
    else if (inferred === 0 && allResolved && n >= HIGH_PAIRS && accepted.ratio >= HIGH_RATIO && accepted.exact / n >= HIGH_EXACT_SHARE) confidence = "high";
    seams.push({
      ...seamBase, confidence, matchedWords: n,
      droppedFromPrevious: accepted.dropPrev, droppedFromThis: accepted.dropThis,
      newSpeakers: made, inferredSpeakers: inferred,
    });
  });

  const spk = new Set<number>();
  for (const it of out) if (it.k === "w") spk.add(it.spk);
  const weak = seams.filter((s) => s.confidence === "low" || s.confidence === "none" || s.confidence === "gap").length;
  if (failedParts.length) {
    notices.push(failedParts.length + " part(s) could not be transcribed. Look for the [Part ... could not be transcribed] notes in the text.");
  }
  if (weak) {
    notices.push("Wording or speaker numbers may be off at " + weak + " place(s) where parts were joined. Look for the [Joined two parts here ...] notes.");
  }
  if (emptyTurns) {
    notices.push("The engine returned " + emptyTurns + " empty speaker turn(s). They were removed.");
  }
  return {
    text: render(out, anyLabelled),
    speakerCount: anyLabelled ? spk.size : 0,
    seams, emptyTurns, failedParts, notices,
  };
}
