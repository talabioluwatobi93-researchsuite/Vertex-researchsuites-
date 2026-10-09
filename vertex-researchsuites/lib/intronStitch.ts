// Planning and stitching for Intron transcripts cut into overlapping parts.
// Pure functions (no network, no database). Intron returns diarized text as lines like
// "SPEAKER_00: words" with NO timestamps, and speaker numbers restart in every part.
// Parts overlap by a few seconds. The overlap words are matched (tolerating spelling
// differences) to remove the duplicate once and to carry each speaker across the seam.

export const INTRON_PART_SECONDS = 120;
export const INTRON_OVERLAP_SECONDS = 10;

export type PlannedPart = { index: number; startSeconds: number; durationSeconds: number };

// Part i starts at i * (partSeconds - overlapSeconds). Stops as soon as a part reaches the end.
export function planIntronParts(
  totalSeconds: number,
  partSeconds: number = INTRON_PART_SECONDS,
  overlapSeconds: number = INTRON_OVERLAP_SECONDS
): PlannedPart[] {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return [];
  if (!(partSeconds > 0) || !(overlapSeconds >= 0) || overlapSeconds >= partSeconds) {
    throw new Error("Invalid part settings");
  }
  const step = partSeconds - overlapSeconds;
  const parts: PlannedPart[] = [];
  for (let i = 0; ; i++) {
    const start = i * step;
    const dur = Math.min(partSeconds, totalSeconds - start);
    parts.push({ index: i, startSeconds: start, durationSeconds: dur });
    if (start + dur >= totalSeconds - 1e-9) break;
  }
  return parts;
}

// Total audio seconds sent to the engine (this is what is billed).
export function billedSeconds(parts: PlannedPart[]): number {
  let t = 0;
  for (const p of parts) t += p.durationSeconds;
  return t;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? h + ":" + mm + ":" + ss : mm + ":" + ss;
}

// ---------- parsing ----------

const RE_MARKS = new RegExp("\\p{M}", "gu");
const RE_NONWORD = new RegExp("[^\\p{L}\\p{N}]+", "gu");

// Lowercase, no accents or tone marks, letters and digits only. Used for matching only.
export function normalizeWord(raw: string): string {
  return raw.normalize("NFD").replace(RE_MARKS, "").toLowerCase().replace(RE_NONWORD, "");
}

type LocalTok = { raw: string; norm: string; local: number | null };
export type ParsedPart = { toks: LocalTok[]; emptyTurns: number; labelled: boolean };

const LABEL_LINE = /^\s*SPEAKER[_ ]?(\d+)\s*:\s?(.*)$/i;

export function parseDiarizedText(text: string): ParsedPart {
  const turns: { local: number | null; text: string }[] = [];
  let labelled = false;
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = LABEL_LINE.exec(line);
    if (m) {
      labelled = true;
      turns.push({ local: parseInt(m[1], 10), text: m[2] });
    } else if (line.trim()) {
      if (turns.length) turns[turns.length - 1].text += " " + line.trim();
      else turns.push({ local: null, text: line.trim() });
    }
  }
  let emptyTurns = 0;
  const toks: LocalTok[] = [];
  for (const t of turns) {
    const words = t.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      emptyTurns++;
      continue;
    }
    for (const w of words) toks.push({ raw: w, norm: normalizeWord(w), local: t.local });
  }
  return { toks, emptyTurns, labelled };
}

// ---------- matching ----------

function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev.push(j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost));
    }
    prev = cur;
  }
  return prev[b.length] <= max;
}

// 2 = same word, 1 = same word with a small spelling difference, 0 = different.
function matchKind(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 2;
  const L = Math.min(a.length, b.length);
  if (L >= 9) return withinEdits(a, b, 2) ? 1 : 0;
  if (L >= 5) return withinEdits(a, b, 1) ? 1 : 0;
  return 0;
}

type Pair = { a: number; b: number; exact: boolean };

const TAIL_WORDS = 80;
const HEAD_WORDS = 80;
const SLACK_WORDS = 12;
const MIN_PAIRS_LOW = 4;
const MIN_PAIRS_HIGH = 6;
const MIN_EXACT = 3;
const MIN_EXACT_SHARE_HIGH = 0.5;
const MIN_RATIO_LOW = 0.5;
const MIN_RATIO_HIGH = 0.6;
const MAX_DROP_GAP = 30;
// Alignment scores. Exact matches count far more than near-matches, so a long chain of
// look-alike words cannot outscore the real overlap.
const SC_EXACT = 6;
const SC_NEAR = 1;
const SC_MISMATCH = -4;
const SC_GAP = -4;
const MIN_VOTES = 2;
const MAX_DROP_WORDS = 90;

// Local alignment of the end of the text so far (A) with the start of the new part (B).
// The match must end near the end of A and begin near the start of B, because the overlap
// is the last seconds of the previous part and the first seconds of this one.
function alignOverlap(A: string[], B: string[]): Pair[] | null {
  const n = A.length;
  const m = B.length;
  if (n === 0 || m === 0) return null;
  const W = m + 1;
  const NEG = -1e9;
  const H = new Float64Array((n + 1) * W).fill(NEG);
  const D = new Uint8Array((n + 1) * W);
  const K = new Uint8Array(n * m);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) K[i * m + j] = matchKind(A[i], B[j]);

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const k = K[(i - 1) * m + (j - 1)];
      const s = k === 2 ? SC_EXACT : k === 1 ? SC_NEAR : SC_MISMATCH;
      let best = NEG;
      let dir = 0;
      if (s > 0 && j - 1 < SLACK_WORDS) {
        best = s;
        dir = 0;
      }
      const diag = H[(i - 1) * W + (j - 1)];
      if (diag > NEG / 2 && diag + s > best) {
        best = diag + s;
        dir = 1;
      }
      const up = H[(i - 1) * W + j];
      if (up > NEG / 2 && up + SC_GAP > best) {
        best = up + SC_GAP;
        dir = 2;
      }
      const left = H[i * W + (j - 1)];
      if (left > NEG / 2 && left + SC_GAP > best) {
        best = left + SC_GAP;
        dir = 3;
      }
      if (best <= 0) best = NEG;
      H[i * W + j] = best;
      D[i * W + j] = dir;
    }
  }

  let bi = -1;
  let bj = -1;
  let bs = NEG;
  for (let i = Math.max(1, n - SLACK_WORDS); i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (K[(i - 1) * m + (j - 1)] === 0) continue;
      const d = D[i * W + j];
      if (d !== 0 && d !== 1) continue;
      const v = H[i * W + j];
      if (v > bs) {
        bs = v;
        bi = i;
        bj = j;
      }
    }
  }
  if (bi < 0) return null;

  const pairs: Pair[] = [];
  let ci = bi;
  let cj = bj;
  for (;;) {
    const d = D[ci * W + cj];
    const kk = K[(ci - 1) * m + (cj - 1)];
    if ((d === 0 || d === 1) && kk > 0) pairs.push({ a: ci - 1, b: cj - 1, exact: kk === 2 });
    if (d === 0) break;
    if (d === 1) {
      ci--;
      cj--;
    } else if (d === 2) ci--;
    else cj--;
  }
  pairs.reverse();
  return pairs;
}

// ---------- stitching ----------

type Tok = { raw: string; norm: string; spk: number }; // spk 0 = unlabelled
type Marker = { marker: string };
type Item = Tok | Marker;

function isMarker(x: Item): x is Marker {
  return (x as Marker).marker !== undefined;
}

export type StitchInput = {
  index: number;
  text: string | null; // null = this part failed
  startSeconds?: number;
};

export type StitchOptions = {
  partSeconds?: number;
  overlapSeconds?: number;
  markers?: boolean; // insert "[Joined two parts here ...]" lines where a seam needs a check
};

export type SeamInfo = {
  part: number;
  atSeconds: number;
  confidence: "high" | "low" | "none" | "gap";
  matchedWords: number;
  droppedFromPrevious: number;
  droppedFromThis: number;
  newSpeakers: number;
  inferredSpeakers: number;
};

export type StitchResult = {
  text: string;
  speakerCount: number;
  seams: SeamInfo[];
  emptyTurns: number;
  failedParts: number[];
  notices: string[];
};

export function stitchIntronParts(parts: StitchInput[], opts: StitchOptions = {}): StitchResult {
  const partSeconds = opts.partSeconds !== undefined ? opts.partSeconds : INTRON_PART_SECONDS;
  const overlap = opts.overlapSeconds !== undefined ? opts.overlapSeconds : INTRON_OVERLAP_SECONDS;
  const step = partSeconds - overlap;
  const markersOn = opts.markers !== false;
  const sorted = parts.slice().sort((x, y) => x.index - y.index);

  const out: Item[] = [];
  const seams: SeamInfo[] = [];
  const failed: number[] = [];
  let nextSpk = 1;
  let emptyTurns = 0;
  let anyLabelled = false;

  for (const part of sorted) {
    const startSec = part.startSeconds !== undefined ? part.startSeconds : part.index * step;

    if (part.text === null) {
      failed.push(part.index);
      if (markersOn) {
        out.push({
          marker:
            "[Part " + (part.index + 1) + " could not be transcribed. The audio from about " +
            formatTime(startSec) + " to " + formatTime(startSec + partSeconds) + " is missing here.]",
        });
      }
      continue;
    }

    const parsed = parseDiarizedText(part.text);
    emptyTurns += parsed.emptyTurns;
    if (parsed.labelled) anyLabelled = true;
    const P = parsed.toks;
    if (P.length === 0) {
      if (part.index > 0) {
        seams.push({ part: part.index, atSeconds: startSec, confidence: "none", matchedWords: 0, droppedFromPrevious: 0, droppedFromThis: 0, newSpeakers: 0, inferredSpeakers: 0 });
      }
      continue;
    }

    // Indices in `out` of the last words (stop at a marker, never match across a gap).
    const tailIdx: number[] = [];
    for (let i = out.length - 1; i >= 0 && tailIdx.length < TAIL_WORDS; i--) {
      if (isMarker(out[i])) break;
      tailIdx.unshift(i);
    }

    const map = new Map<number, number>();
    let confidence: SeamInfo["confidence"] = "none";
    let matched = 0;
    let droppedPrev = 0;
    let droppedThis = 0;
    let keepFrom = 0;

    if (tailIdx.length === 0) {
      confidence = out.length > 0 ? "gap" : "none";
    } else {
      const A = tailIdx.map((i) => (out[i] as Tok).norm);
      const B = P.slice(0, HEAD_WORDS).map((t) => t.norm);
      const pairs = alignOverlap(A, B);
      const exactCount = pairs ? pairs.filter((q) => q.exact).length : 0;
      if (pairs && pairs.length >= MIN_PAIRS_LOW && exactCount >= MIN_EXACT) {
        const spanA = pairs[pairs.length - 1].a - pairs[0].a + 1;
        const spanB = pairs[pairs.length - 1].b - pairs[0].b + 1;
        const ratio = pairs.length / Math.max(spanA, spanB);
        const mid = pairs[Math.floor(pairs.length / 2)];
        const dropPrev = tailIdx.length - mid.a;
        const dropThis = mid.b;
        if (ratio >= MIN_RATIO_LOW && dropPrev <= MAX_DROP_WORDS && dropThis <= MAX_DROP_WORDS && Math.abs(dropPrev - dropThis) <= MAX_DROP_GAP) {
          // Which earlier speaker is each new label? Vote with the matched words.
          const votes = new Map<number, Map<number, number>>();
          for (const p of pairs) {
            const at = out[tailIdx[p.a]] as Tok;
            const lb = P[p.b].local;
            if (at.spk > 0 && lb !== null) {
              let gm = votes.get(lb);
              if (!gm) {
                gm = new Map<number, number>();
                votes.set(lb, gm);
              }
              gm.set(at.spk, (gm.get(at.spk) || 0) + 1);
            }
          }
          const cands: { l: number; g: number; c: number }[] = [];
          votes.forEach((gm, l) => gm.forEach((c, g) => cands.push({ l, g, c })));
          cands.sort((x, y) => y.c - x.c);
          const claimed = new Set<number>();
          for (const c of cands) {
            if (map.has(c.l) || claimed.has(c.g)) continue;
            let total = 0;
            (votes.get(c.l) as Map<number, number>).forEach((v) => (total += v));
            if (c.c >= MIN_VOTES && c.c >= 0.6 * total) {
              map.set(c.l, c.g);
              claimed.add(c.g);
            }
          }
          const allVotedResolved = Array.from(votes.keys()).every((l) => map.has(l));
          confidence = pairs.length >= MIN_PAIRS_HIGH && ratio >= MIN_RATIO_HIGH && exactCount / pairs.length >= MIN_EXACT_SHARE_HIGH && allVotedResolved ? "high" : "low";
          matched = pairs.length;
          keepFrom = mid.b;
          droppedThis = dropThis;
          // Remove the earlier version of the second half of the overlap.
          const cutAt = tailIdx[mid.a];
          droppedPrev = out.length - cutAt;
          out.length = cutAt;
        }
      }
    }

    const kept = P.slice(keepFrom);

    // Labels that the overlap words could not place. If exactly one label is unplaced and exactly one
    // earlier speaker is still unclaimed, they are the same person (the common two-person interview,
    // or one speaker throughout). With two or more unplaced labels we do not guess.
    const labelOrder: number[] = [];
    for (const t of kept) if (t.local !== null && labelOrder.indexOf(t.local) === -1) labelOrder.push(t.local);
    const unplaced = labelOrder.filter((l) => !map.has(l));
    const claimedNow = new Set<number>();
    map.forEach((g) => claimedNow.add(g));
    const unclaimed: number[] = [];
    for (let g = 1; g < nextSpk; g++) if (!claimedNow.has(g)) unclaimed.push(g);
    let inferred = 0;
    if (unplaced.length === 1 && unclaimed.length === 1) {
      map.set(unplaced[0], unclaimed[0]);
      inferred = 1;
      if (confidence === "none") confidence = "low";
    }
    const hadSpeakersBefore = nextSpk > 1;
    let newSpeakers = 0;
    for (const l of labelOrder) {
      if (!map.has(l)) {
        map.set(l, nextSpk++);
        newSpeakers++;
      }
    }
    // A new speaker number while earlier speakers exist cannot be confirmed from the audio: flag it.
    if (hadSpeakersBefore && newSpeakers > 0 && confidence === "high") confidence = "low";

    if (markersOn && (confidence === "low" || confidence === "none" || confidence === "gap") && out.length > 0) {
      const hasLabels = parsed.labelled && anyLabelled;
      out.push({
        marker:
          "[Joined two parts here (about " + formatTime(startSec) + "). " +
          (confidence === "low"
            ? "Please check this spot."
            : hasLabels
            ? "Speaker labels may have changed, and a few words may repeat or be missing."
            : "A few words may repeat or be missing.") +
          "]",
      });
    }

    for (const t of kept) {
      out.push({ raw: t.raw, norm: t.norm, spk: t.local === null ? 0 : (map.get(t.local) as number) });
    }

    if (part.index > 0 || seams.length > 0 || out.length > kept.length) {
      seams.push({
        part: part.index,
        atSeconds: startSec,
        confidence,
        matchedWords: matched,
        droppedFromPrevious: droppedPrev,
        droppedFromThis: droppedThis,
        newSpeakers,
        inferredSpeakers: inferred,
      });
    }
  }

  // Render: one line per speaker turn, markers on their own line.
  const lines: string[] = [];
  let curSpk = -1;
  let curWords: string[] = [];
  const flush = () => {
    if (curWords.length) lines.push((curSpk > 0 ? "Speaker " + curSpk + ": " : "") + curWords.join(" "));
    curWords = [];
    curSpk = -1;
  };
  for (const it of out) {
    if (isMarker(it)) {
      flush();
      lines.push(it.marker);
    } else {
      if (curWords.length && it.spk !== curSpk) flush();
      curSpk = it.spk;
      curWords.push(it.raw);
    }
  }
  flush();

  const notices: string[] = [];
  const needCheck = seams.filter((s) => s.confidence === "low" || s.confidence === "gap" || (s.confidence === "none" && s.newSpeakers > 0));
  if (failed.length) notices.push(failed.length + " part(s) of the recording could not be transcribed and are marked in the text.");
  if (needCheck.length) notices.push(needCheck.length + " place(s) where parts were joined need a quick check. They are marked in the text.");
  if (nextSpk - 1 >= 3 && seams.some((x) => x.inferredSpeakers > 0)) notices.push("With three or more speakers, some speaker labels were matched by elimination. Please check them.");
  if (emptyTurns > 0) notices.push("The engine returned " + emptyTurns + " empty speaker turn(s). Quiet or unclear speech in those spots may be missing.");

  return {
    text: lines.join("\n"),
    speakerCount: nextSpk - 1,
    seams,
    emptyTurns,
    failedParts: failed,
    notices,
  };
}
