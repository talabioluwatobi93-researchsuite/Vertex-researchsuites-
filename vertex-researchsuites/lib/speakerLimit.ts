// Limits a transcript to the number of main speakers the user chose.
// The speakers with the most words stay (renumbered 1, 2, 3 by first appearance).
// A line from any other label joins the speaker of the line before it
// (or the first main speaker, if it is the first line).
const LINE = /^((?:\[\d{1,3}:\d{2}(?::\d{2})?\] ?)?)Speaker (\d+): ?(.*)$/;

export function limitSpeakers(text: string, max: number): string {
  const lines = String(text || "").split("\n");
  const words = new Map<number, number>();
  const firstAt = new Map<number, number>();
  const entries: { idx: number; n: number; prefix: string; body: string }[] = [];
  lines.forEach((line, idx) => {
    const m = LINE.exec(line);
    if (!m) return;
    const n = Number(m[2]);
    const w = m[3].split("[no text returned]").join("").split(/\s+/).filter(Boolean).length;
    words.set(n, (words.get(n) || 0) + w);
    if (!firstAt.has(n)) firstAt.set(n, idx);
    entries.push({ idx, n, prefix: m[1], body: m[3] });
  });
  if (!(max >= 1) || words.size <= max) return text;
  const ranked = Array.from(words.keys()).sort((a, b) => (words.get(b) || 0) - (words.get(a) || 0) || a - b);
  const majors = ranked.slice(0, max).sort((a, b) => (firstAt.get(a) || 0) - (firstAt.get(b) || 0));
  const newNum = new Map<number, number>();
  majors.forEach((n, i) => newNum.set(n, i + 1));
  const targets: number[] = [];
  entries.forEach((e, k) => {
    const mapped = newNum.get(e.n);
    if (mapped) targets[k] = mapped;
    else targets[k] = k > 0 ? targets[k - 1] : 0;
  });
  let firstMajor = 1;
  for (const t of targets) {
    if (t) {
      firstMajor = t;
      break;
    }
  }
  const byIdx = new Map<number, number>();
  entries.forEach((e, k) => byIdx.set(e.idx, targets[k] || firstMajor));
  const out: string[] = [];
  let lastSpeaker = -1;
  lines.forEach((line, idx) => {
    const target = byIdx.get(idx);
    if (target === undefined) {
      out.push(line);
      lastSpeaker = -1;
      return;
    }
    const m = LINE.exec(line) as RegExpExecArray;
    if (max >= 2 && target === lastSpeaker && out.length) {
      out[out.length - 1] = out[out.length - 1] + " " + m[3];
    } else {
      out.push(m[1] + "Speaker " + target + ": " + m[3]);
    }
    lastSpeaker = target;
  });
  return out.join("\n");
}
