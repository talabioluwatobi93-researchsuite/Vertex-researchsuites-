"use client";
// Speaker cards: one plain-language card per speaker with "same person" and "swap" actions.
// Rewrites transcript TEXT only (the page keeps the Undo). Nothing changes until the user confirms.
import { useState } from "react";
import { mergeSpeakers, swapSpeakersInPart, partNumbers } from "@/lib/speakerTools";
import { speakerCards, linesInPart } from "@/lib/speakerCards";
import type { SpeakerCard } from "@/lib/speakerCards";

type Props = {
  text: string;
  apply: (out: unknown, message: string) => void;
  dark: string;
  muted: string;
  gold: string;
  border: string;
};
type OpenCard = { n: number; mode: "merge" | "swap" } | null;

export default function SpeakerCards({ text, apply, dark, muted, gold, border }: Props) {
  const [open, setOpen] = useState<OpenCard>(null);
  const [target, setTarget] = useState("");
  const [swapPart, setSwapPart] = useState("");
  const cards = speakerCards(text);
  const found: number[] = Array.from(partNumbers(text) as unknown as Iterable<number>);
  const partList: number[] = found.length > 0 ? found : [1];
  const many = partList.length > 1;

  const box = { backgroundColor: "#FFFFFF", border: "1px solid " + border, borderRadius: "10px", padding: "10px 12px", marginBottom: "8px" } as const;
  const sel = { padding: "6px 8px", borderRadius: "8px", border: "1px solid " + border, fontSize: "13px", color: dark, backgroundColor: "#FFFFFF" } as const;
  const small = { color: muted, fontSize: "12px", margin: "6px 0 0 0" } as const;
  const ask = { color: dark, fontSize: "13px", margin: "8px 0 4px 0" } as const;
  const btn = (primary: boolean, off?: boolean) => ({
    padding: "7px 12px", borderRadius: "8px", border: primary ? "none" : "1px solid " + border,
    fontSize: "13px", fontWeight: 700, cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.5 : 1,
    backgroundColor: primary ? gold : "#FFFFFF", color: dark, marginRight: "8px", marginTop: "8px",
  }) as const;

  const begin = (c: SpeakerCard, mode: "merge" | "swap") => {
    const rest = cards.filter((x) => x.n !== c.n).sort((a, b) => b.words - a.words);
    setOpen({ n: c.n, mode });
    setTarget(rest.length > 0 ? String(rest[0].n) : "");
    setSwapPart(String(c.parts.length > 0 ? c.parts[0] : partList[0]));
  };
  const plural = (k: number) => k + (k === 1 ? " line" : " lines");

  return (
    <div>
      {cards.map((c) => {
        const others = cards.filter((x) => x.n !== c.n);
        const mode = open !== null && open.n === c.n ? open.mode : null;
        const tv = others.some((x) => String(x.n) === target) ? target : others.length > 0 ? String(others[0].n) : "";
        const to = Number(tv);
        const pt = Number(swapPart) || partList[0];
        const a = mode === "swap" && tv ? linesInPart(text, pt, c.n) : 0;
        const b = mode === "swap" && tv ? linesInPart(text, pt, to) : 0;
        const where = many ? "In Part " + pt + ", " : "";
        return (
          <div key={c.n} style={box}>
            <p style={{ color: dark, fontSize: "14px", fontWeight: 700, margin: "0" }}>{"Speaker " + c.n}</p>
            <p style={small}>
              {plural(c.lines) + ", " + c.words + " words" + (c.first ? ", first heard at " + c.first : "") +
                (many ? ", in " + (c.parts.length === 1 ? "Part " : "Parts ") + c.parts.join(", ") : "")}
            </p>
            {c.samples.map((s, k) => (
              <p key={k} style={{ color: dark, fontSize: "12px", fontStyle: "italic", margin: "4px 0 0 0" }}>{"\u201C" + s + "\u201D"}</p>
            ))}
            {others.length > 0 && mode === null && (
              <div>
                <button type="button" onClick={() => begin(c, "merge")} style={btn(false)}>Same person as another speaker</button>
                <button type="button" onClick={() => begin(c, "swap")} style={btn(false)}>Swap with another speaker</button>
              </div>
            )}
            {mode === "merge" && (
              <div>
                <p style={ask}>{"Speaker " + c.n + " is really:"}</p>
                <select value={tv} onChange={(e) => setTarget(e.target.value)} aria-label="Who is this speaker really?" style={sel}>
                  {others.map((o) => (<option key={o.n} value={String(o.n)}>{"Speaker " + o.n + " (" + plural(o.lines) + ")"}</option>))}
                </select>
                <p style={small}>{"All " + plural(c.lines) + " of Speaker " + c.n + " will become Speaker " + tv + ". Speaker " + c.n + " will disappear. You can undo this."}</p>
                <button type="button" disabled={!tv} style={btn(true, !tv)}
                  onClick={() => { apply(mergeSpeakers(text, c.n, to), "Done. Every Speaker " + c.n + " line is now Speaker " + to + "."); setOpen(null); }}>Yes, merge them</button>
                <button type="button" onClick={() => setOpen(null)} style={btn(false)}>Cancel</button>
              </div>
            )}
            {mode === "swap" && (
              <div>
                {many && (
                  <div>
                    <p style={ask}>Which part is wrong?</p>
                    <select value={String(pt)} onChange={(e) => setSwapPart(e.target.value)} aria-label="Part" style={sel}>
                      {partList.map((p) => (<option key={p} value={String(p)}>{"Part " + p}</option>))}
                    </select>
                  </div>
                )}
                <p style={ask}>{"Swap Speaker " + c.n + " with:"}</p>
                <select value={tv} onChange={(e) => setTarget(e.target.value)} aria-label="Swap with" style={sel}>
                  {others.map((o) => (<option key={o.n} value={String(o.n)}>{"Speaker " + o.n}</option>))}
                </select>
                <p style={small}>
                  {a + b === 0
                    ? where + "neither speaker has any lines, so there is nothing to swap."
                    : where + "Speaker " + c.n + "'s " + plural(a) + " will become Speaker " + tv + ", and Speaker " + tv + "'s " +
                      plural(b) + " will become Speaker " + c.n + ". Everything else stays the same. You can undo this."}
                </p>
                <button type="button" disabled={a + b === 0} style={btn(true, a + b === 0)}
                  onClick={() => { apply(swapSpeakersInPart(text, pt, c.n, to), "Done. Swapped Speaker " + c.n + " and Speaker " + to + (many ? " in Part " + pt : "") + "."); setOpen(null); }}>Yes, swap them</button>
                <button type="button" onClick={() => setOpen(null)} style={btn(false)}>Cancel</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
