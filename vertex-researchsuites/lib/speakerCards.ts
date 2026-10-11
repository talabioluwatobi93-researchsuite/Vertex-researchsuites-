// Read-only helpers for the speaker cards. They only read the transcript text.
export type SpeakerCard = {
  n: number;
  lines: number;
  words: number;
  first: string;
  parts: number[];
  samples: string[];
};

const LINE = /^((?:\[(\d{1,3}:\d{2}(?::\d{2})?)\] ?)?)Speaker (\d+): ?(.*)$/;
const PART = /^\[Part (\d+) (?:starts here|could not)/;
const NOTEXT = "[no text returned]";

export function speakerCards(text: string): SpeakerCard[] {
  const map = new Map<number, SpeakerCard>();
  let part = 1;
  for (const line of String(text || "").split("\n")) {
    const pm = PART.exec(line);
    if (pm) { part = Number(pm[1]); continue; }
    const m = LINE.exec(line);
    if (!m) continue;
    const n = Number(m[3]);
    let c = map.get(n);
    if (!c) { c = { n, lines: 0, words: 0, first: "", parts: [], samples: [] }; map.set(n, c); }
    c.lines += 1;
    if (m[2] && !c.first) c.first = m[2];
    if (!c.parts.includes(part)) c.parts.push(part);
    const body = m[4].trim();
    if (body.indexOf(NOTEXT) >= 0) continue;
    const w = body.split(/\s+/).filter(Boolean);
    c.words += w.length;
    if (w.length >= 3 && c.samples.length < 2) c.samples.push(w.slice(0, 9).join(" ") + (w.length > 9 ? " ..." : ""));
  }
  return Array.from(map.values()).sort((a, b) => a.n - b.n);
}

// Lines of speaker n inside one part (part 1 = everything before the first "[Part N" marker).
export function linesInPart(text: string, part: number, n: number): number {
  let cur = 1;
  let count = 0;
  for (const line of String(text || "").split("\n")) {
    const pm = PART.exec(line);
    if (pm) { cur = Number(pm[1]); continue; }
    const m = LINE.exec(line);
    if (m && cur === part && Number(m[3]) === n) count += 1;
  }
  return count;
}
