// P13-4: speaker names are kept apart from the transcript text (which stays "Speaker N").
// applyNames is used only on the way out (Word export, notes request).
const LINE = /^((?:\[\d{1,3}:\d{2}(?::\d{2})?\] ?)?)Speaker (\d+): ?(.*)$/;

export function applyNames(text: string, names: Record<number, string>): string {
  return String(text || "").split("\n").map((line) => {
    const m = LINE.exec(line);
    if (!m) return line;
    const nm = String(names[Number(m[2])] || "").replace(/[\r\n:]+/g, " ").trim();
    return nm ? m[1] + nm + ": " + m[3] : line;
  }).join("\n");
}
