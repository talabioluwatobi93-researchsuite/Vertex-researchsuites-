// Text-only speaker clean-up for transcripts with "Speaker N: words"
// lines and "[Part N starts here ...]" markers. A line may start with a
// time stamp such as [02:14]; it is kept when speakers are merged or swapped.
const SPEAKER = /^((?:\[\d{1,3}:\d{2}(?::\d{2})?\] ?)?)Speaker (\d+): ?(.*)$/;
const PART_MARK = /^\[Part (\d+) (?:starts here|could not)/;

function collapse(lines: string[]): string[] {
  const out: string[] = [];
  let lastSpk = -1;
  for (const line of lines) {
    const m = SPEAKER.exec(line);
    if (m && out.length && lastSpk === Number(m[2])) {
      out[out.length - 1] = out[out.length - 1] + " " + m[3];
    } else out.push(line);
    lastSpk = m ? Number(m[2]) : -1;
  }
  return out;
}

export function speakerNumbers(text: string): number[] {
  const set = new Set<number>();
  for (const line of String(text || "").split("\n")) {
    const m = SPEAKER.exec(line);
    if (m) set.add(Number(m[2]));
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
    return m && Number(m[2]) === from ? m[1] + "Speaker " + to + ": " + m[3] : line;
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
    const n = Number(m[2]);
    if (n === a) return m[1] + "Speaker " + b + ": " + m[3];
    if (n === b) return m[1] + "Speaker " + a + ": " + m[3];
    return line;
  });
  return collapse(lines).join("\n");
}
