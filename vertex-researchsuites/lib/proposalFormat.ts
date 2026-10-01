// Shared parsing for proposal text: used by the on-screen view and the Word export.
export const HEADINGS: string[] = [
  '1. Background of the Study',
  '2. Statement of the Problem',
  '3. Objectives of the Study',
  '4. Research Questions',
  '5. Significance of the Study',
  '6. Theoretical Framework',
  '7. Research Methodology',
  '8. Sampling Procedure',
  '9. References',
  '10. Supervisor-Style Feedback',
];

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'para'; text: string; label?: string };

const LABEL_RE = /^(Section|Question|Answer|Stage \d+|Theory \d+):\s*(.*)$/;

export function parseProposal(input: string): { title: string; blocks: Block[] } {
  const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
  const hasTitle = lines.length > 0 && !HEADINGS.includes(lines[0]);
  const title = hasTitle ? lines[0] : 'Research Proposal';
  const blocks: Block[] = [];
  for (const line of hasTitle ? lines.slice(1) : lines) {
    if (HEADINGS.includes(line)) {
      blocks.push({ kind: 'heading', text: line });
      continue;
    }
    const m = line.match(LABEL_RE);
    if (m) blocks.push({ kind: 'para', label: m[1], text: m[2] });
    else blocks.push({ kind: 'para', text: line });
  }
  return { title, blocks };
}

export interface Run { text: string; href?: string }

// Turns https links and "doi:10..." into tappable runs; trailing punctuation stays outside the link.
export function linkify(input: string): Run[] {
  const out: Run[] = [];
  const re = /(https?:\/\/[^\s)]+|doi:\s?10\.\S+)/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const raw = m[0];
    const trail = (raw.match(/[.,;]+$/) || [''])[0];
    const core = raw.slice(0, raw.length - trail.length);
    if (m.index > last) out.push({ text: input.slice(last, m.index) });
    const href = /^https?:/i.test(core) ? core : `https://doi.org/${core.replace(/^doi:\s?/i, '')}`;
    out.push({ text: core, href });
    last = m.index + core.length;
    re.lastIndex = last;
  }
  if (last < input.length) out.push({ text: input.slice(last) });
  return out;
}
