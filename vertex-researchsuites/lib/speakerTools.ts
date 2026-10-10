// Text-only speaker clean-up for transcripts with "Speaker N: words" lines and "[Part N starts here ...]" markers.
const SPEAKER = /^Speaker (\d+): ?(.*)$/;
const PART_MARK = /^\[Part (\d+) (?:starts here|could not)/;

function collapse(lines: string[]): string[] {
  const out: string[] = [];
  let lastSpk = -1;
  for (const line of lines) {
    const m = SPEAKER.exec(line);
    if (m && out.length && lastSpk === Number(m[1])) {
      out[out.length - 1] = out[out.length - 1] + " " + m[2];
    } else out.push(line);
    lastSpk = m ? Number(m[1]) : -1;
  }
  return out;
}

export function speakerNumbers(text: string): number[] {
  const set = new Set<number>();
  for (const line of String(text || "").split("\n")) {
    const m = SPEAKER.exec(line);
    if (m) set.add(Number(m[1]));
  }
  return [...set].sort((a, b) => a - b);
}

// Part numbers (1-based) that have a "[Part N starts here" marker, plus part 1.
export function partNumbers(text: string): number[] {
  const set = new Set<number>([1]);
  for (const line of String(text || "").split("\n")) {
    const m = PART_MARK.exec(line);
    if (m) set.add(Number(m[1]));
  }
  return [...set].sort((a, b) => a - b);
}

export function mergeSpeakers(text: string, from: number, to: number): string {
  if (from === to) return text;
  const lines = String(text || "").split("\n").map((line) => {
    const m = SPEAKER.exec(line);
    return m && Number(m[1]) === from ? "Speaker " + to + ": " + m[2] : line;
  });
  return collapse(lines).join("\n");
}

export function swapSpeakersInPart(text: string, part: number, a: number, b: number): string {
  if (a === b) return text;
  let current = 1;
  const lines = String(text || "").split("\n").map((line) => {
    const pm = PART_MARK.exec(line);
    if (pm) { current = Number(pm[1]); return line; }
    const m = SPEAKER.exec(line);
    if (!m || current !== part) return line;
    const n = Number(m[1]);
    if (n === a) return "Speaker " + b + ": " + m[2];
    if (n === b) return "Speaker " + a + ": " + m[2];
    return line;
  });
  return collapse(lines).join("\n");
}
