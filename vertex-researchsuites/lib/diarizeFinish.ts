// P12-4b: turns finished pieces into the usual "[mm:ss] Speaker N: text" transcript, plus a plain report line.
import { renderPieces } from "./diarizePlan";
import type { Piece } from "./diarizePlan";
import type { JoinReport } from "./diarizeRun";

export function reportText(r: JoinReport): string {
  return "Speaker-first (testing): " + r.chunks + " audio parts checked, " + r.speakerCount + " speakers, " + r.pieces +
    " pieces. Uncertain joins: " + r.lowConfidenceJoins + ", guessed: " + r.inferredSpeakers + ", new speakers: " + r.newSpeakers +
    ", silence left out: " + r.droppedSeconds + " s.";
}

export function finishSpeakerFirst(pieces: Piece[], parts: { startSeconds: number; text: string | null }[]) {
  const by = new Map<number, string | null>();
  for (const p of parts) by.set(p.startSeconds, p.text);
  const items = pieces.map((p) => {
    const t = by.get(p.startSeconds);
    return { startSeconds: p.startSeconds, speaker: p.speaker, text: typeof t === "string" ? t : null };
  });
  const failed = items.filter((i) => i.text === null).length;
  const empty = items.filter((i) => i.text !== null && i.text.trim() === "").length;
  const notices: string[] = [];
  if (failed > 0) notices.push(failed + " part(s) could not be transcribed.");
  return { text: renderPieces(items), notices, speakerCount: new Set(pieces.map((p) => p.speaker)).size, failedParts: failed, emptyTurns: empty };
}
