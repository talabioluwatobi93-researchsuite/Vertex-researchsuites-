// Stitches word-level, speaker-labelled transcripts of overlapping audio parts
// into one continuous transcript with consistent speaker labels.
// Pure functions only: no network, no storage, nothing dataset-specific.

export type Word = { text: string; speaker: string; start: number; end: number };

export type PartInput = {
  /** Start of this part inside the full recording, in seconds. */
  offset: number;
  /** Words with times relative to the start of THIS part, in seconds. */
  words: Word[];
};

export type Seam = {
  part: number;
  matchedWords: number;
  lowConfidence: boolean;
};

export type StitchResult = {
  text: string;
  words: Word[]; // absolute times, global speaker labels ("S1", "S2", ...)
  seams: Seam[];
  speakerCount: number;
};

const MATCH_WINDOW_SECONDS = 1.5;
const MIN_MATCHED_WORDS = 3;

export function parseOffset(v: unknown): number {
  if (typeof v === "number" && isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/s$/i, ""));
    if (isFinite(n)) return n;
  }
  return 0;
}

/** Reads word_info annotations out of a Gemini interactions response. */
export function extractWords(response: any): Word[] {
  const out: Word[] = [];
  const steps = Array.isArray(response?.steps) ? response.steps : [];
  for (const step of steps) {
    const contents = Array.isArray(step?.content) ? step.content : [];
    for (const content of contents) {
      const anns = Array.isArray(content?.annotations) ? content.annotations : [];
      for (const a of anns) {
        if (a?.type !== "word_info" || typeof a.text !== "string") continue;
        out.push({
          text: a.text,
          speaker: typeof a.speaker === "string" && a.speaker ? a.speaker : "spk_1",
          start: parseOffset(a.start_offset),
          end: parseOffset(a.end_offset),
        });
      }
    }
  }
  return out;
}

function norm(t: string): string {
  return t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function stitchParts(parts: PartInput[]): StitchResult {
  const globalOf = new Map<string, string>(); // "partIndex|spk" -> "S#"
  let nextGlobal = 1;
  const newGlobal = () => `S${nextGlobal++}`;

  let acc: Word[] = [];
  const seams: Seam[] = [];

  parts.forEach((part, pi) => {
    const abs: Word[] = part.words
      .filter((w) => norm(w.text).length > 0)
      .map((w) => ({
        text: w.text,
        speaker: w.speaker,
        start: w.start + part.offset,
        end: w.end + part.offset,
      }))
      .sort((a, b) => a.start - b.start);

    if (pi === 0 || acc.length === 0) {
      const spks: string[] = [];
      abs.forEach((w) => { if (!spks.includes(w.speaker)) spks.push(w.speaker); });
      spks.forEach((s) => globalOf.set(`${pi}|${s}`, newGlobal()));
      acc = acc.concat(abs.map((w) => ({ ...w, speaker: globalOf.get(`${pi}|${w.speaker}`)! })));
      return;
    }

    const prevEnd = acc[acc.length - 1].end;
    const overlapStart = part.offset;
    const hasOverlap = prevEnd > overlapStart;

    // Count co-occurring speakers on words heard in both parts.
    const counts = new Map<string, Map<string, number>>(); // newSpk -> (globalSpk -> n)
    let matched = 0;
    if (hasOverlap) {
      const accOverlap = acc.filter((w) => w.start >= overlapStart - MATCH_WINDOW_SECONDS);
      const used = new Set<number>();
      for (const w of abs) {
        if (w.start > prevEnd) break;
        const n = norm(w.text);
        let best = -1;
        let bestDiff = MATCH_WINDOW_SECONDS + 1;
        for (let i = 0; i < accOverlap.length; i++) {
          if (used.has(i)) continue;
          if (norm(accOverlap[i].text) !== n) continue;
          const d = Math.abs(accOverlap[i].start - w.start);
          if (d <= MATCH_WINDOW_SECONDS && d < bestDiff) { best = i; bestDiff = d; }
        }
        if (best >= 0) {
          used.add(best);
          matched++;
          const g = accOverlap[best].speaker;
          if (!counts.has(w.speaker)) counts.set(w.speaker, new Map());
          const m = counts.get(w.speaker)!;
          m.set(g, (m.get(g) || 0) + 1);
        }
      }
    }

    // One-to-one assignment, strongest evidence first.
    const pairs: { n: string; g: string; c: number }[] = [];
    counts.forEach((m, n) => m.forEach((c, g) => pairs.push({ n, g, c })));
    pairs.sort((a, b) => b.c - a.c);
    const takenNew = new Set<string>();
    const takenGlobal = new Set<string>();
    const mapping = new Map<string, string>();
    for (const p of pairs) {
      if (p.c < 2) continue;
      if (takenNew.has(p.n) || takenGlobal.has(p.g)) continue;
      mapping.set(p.n, p.g);
      takenNew.add(p.n);
      takenGlobal.add(p.g);
    }
    const spks: string[] = [];
    abs.forEach((w) => { if (!spks.includes(w.speaker)) spks.push(w.speaker); });
    spks.forEach((s) => { if (!mapping.has(s)) mapping.set(s, newGlobal()); });

    // Cut in the middle of the overlap so both sides have context.
    const cut = hasOverlap ? (overlapStart + prevEnd) / 2 : overlapStart;
    acc = acc.filter((w) => w.start < cut);
    acc = acc.concat(
      abs.filter((w) => w.start >= cut).map((w) => ({ ...w, speaker: mapping.get(w.speaker)! }))
    );

    seams.push({
      part: pi,
      matchedWords: matched,
      lowConfidence: !hasOverlap || matched < MIN_MATCHED_WORDS,
    });
  });

  // Renumber speakers by order of first appearance in the final transcript.
  const order: string[] = [];
  acc.forEach((w) => { if (!order.includes(w.speaker)) order.push(w.speaker); });
  const rename = new Map(order.map((s, i) => [s, `S${i + 1}`]));
  const words = acc.map((w) => ({ ...w, speaker: rename.get(w.speaker)! }));

  return { text: renderTranscript(words), words, seams, speakerCount: order.length };
}

const NO_SPACE_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u0e00-\u0eff\u1000-\u109f\u1780-\u17ff]/;

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** One line per speaker turn: "[MM:SS] Speaker N: text". */
// Display-only tidy-up of the model's word list. The raw words are never changed.
// 1) Bursts: 3 or more very short turns within a few seconds are shown as one line,
//    under the speaker who said most of those words.
// 2) Exact repeats: a short phrase repeated many times in a row is shown twice,
//    followed by [repeated].
const RT_BURST_SECONDS = 6;
const RT_BURST_MIN_TURNS = 3;
const RT_BURST_MAX_WORDS = 2;
const RT_REPEAT_MAX_BLOCK = 6;

type RtTurn = { speaker: string; start: number; text: string; count: number };

function rtNoSpace(s: string): boolean {
  NO_SPACE_SCRIPT.lastIndex = 0;
  return NO_SPACE_SCRIPT.test(s);
}

function rtJoin(a: string, b: string): string {
  return a + (rtNoSpace(b.charAt(0)) || rtNoSpace(a.slice(-1)) ? "" : " ") + b;
}

function rtNorm(t: string): string {
  return t.toLowerCase().replace(/[.,!?;:"'()\[\]\u2026\u2019\u201C\u201D]/g, "");
}

function rtCollapseRepeats(text: string): string {
  const toks = text.split(/\s+/).filter(Boolean);
  if (toks.length < 8) return text;
  const norm = toks.map(rtNorm);
  const res: string[] = [];
  let changed = false;
  let i = 0;
  while (i < toks.length) {
    let hit = false;
    for (let n = 1; n <= RT_REPEAT_MAX_BLOCK && !hit; n++) {
      if (i + n > toks.length) break;
      const block = norm.slice(i, i + n);
      if (block.some((x) => x === "")) continue;
      const key = block.join(" ");
      let r = 1;
      while (i + (r + 1) * n <= toks.length && norm.slice(i + r * n, i + (r + 1) * n).join(" ") === key) r++;
      if (r >= (n === 1 ? 6 : 4)) {
        for (let k = 0; k < 2 * n; k++) res.push(toks[i + k]);
        res.push("[repeated]");
        i += r * n;
        hit = true;
        changed = true;
      }
    }
    if (!hit) {
      res.push(toks[i]);
      i++;
    }
  }
  return changed ? res.join(" ") : text;
}

export function renderTranscript(words: Word[]): string {
  // Group consecutive words by speaker, as before.
  const turns: RtTurn[] = [];
  let cur: RtTurn | null = null;
  for (const w of words) {
    if (!cur || cur.speaker !== w.speaker) {
      cur = { speaker: w.speaker, start: w.start, text: w.text, count: 1 };
      turns.push(cur);
    } else {
      cur.text = rtJoin(cur.text, w.text);
      cur.count += 1;
    }
  }
  // Merge bursts of very short turns.
  const out: RtTurn[] = [];
  let i = 0;
  while (i < turns.length) {
    let j = i;
    while (j < turns.length && turns[j].count <= RT_BURST_MAX_WORDS && turns[j].start - turns[i].start <= RT_BURST_SECONDS) j++;
    if (j - i >= RT_BURST_MIN_TURNS) {
      const tally = new Map<string, number>();
      let text = turns[i].text;
      let count = 0;
      for (let k = i; k < j; k++) {
        tally.set(turns[k].speaker, (tally.get(turns[k].speaker) || 0) + turns[k].count);
        count += turns[k].count;
        if (k > i) text = rtJoin(text, turns[k].text);
      }
      let best = turns[i].speaker;
      let bestCount = -1;
      tally.forEach((c, s) => {
        if (c > bestCount) {
          best = s;
          bestCount = c;
        }
      });
      out.push({ speaker: best, start: turns[i].start, text, count });
      i = j;
    } else {
      out.push(turns[i]);
      i++;
    }
  }
  // A merged burst can sit next to the same speaker: join them.
  const merged: RtTurn[] = [];
  for (const t of out) {
    const last = merged.length ? merged[merged.length - 1] : null;
    if (last && last.speaker === t.speaker) {
      last.text = rtJoin(last.text, t.text);
      last.count += t.count;
    } else {
      merged.push({ speaker: t.speaker, start: t.start, text: t.text, count: t.count });
    }
  }
  return merged
    .map((t) => "[" + mmss(t.start) + "] Speaker " + t.speaker.slice(1) + ": " + rtCollapseRepeats(t.text))
    .join("\n");
}
