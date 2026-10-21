// Browser-side Word export for Pilot Study results.
import {
  AlignmentType, Document, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType,
} from 'docx';

type Construct = { name: string; k: number; n: number; alpha: number; error?: string };
type Combined = { k: number; n: number; alpha: number } | null;
type DemoRow = { label: string; frequency: number; percent: number; validPercent: number; cumulativePercent: number };
type DemoTable = { name: string; nValid: number; nMissing: number; rows: DemoRow[] };

const f3 = (x: any) => (Number.isFinite(x) ? Number(x).toFixed(3) : 'n/a');
const f1 = (x: any) => (Number.isFinite(x) ? Number(x).toFixed(1) : '');

function p(text: string, bold = false, italics = false) {
  return new Paragraph({
    spacing: { after: 140, line: 340 },
    children: [new TextRun({ text, bold, italics })],
  });
}
function cell(text: string, bold = false) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 22 })] })],
  });
}
function tbl(head: string[], body: string[][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: head.map((h) => cell(h, true)) }),
      ...body.map((r) => new TableRow({ children: r.map((c) => cell(c)) })),
    ],
  });
}

export async function pilotResultsToDocxBlob(o: {
  constructs: Construct[];
  combined: Combined;
  demographics: { tables: DemoTable[] } | null;
  interp: any;
}): Promise<Blob> {
  const kids: any[] = [];
  kids.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 300 },
    children: [new TextRun({ text: 'Pilot Study Results', bold: true, size: 32 })],
  }));
  kids.push(p('Table 1', true));
  kids.push(p('Reliability Statistics (Cronbach\u2019s Alpha) by Construct', false, true));
  const body = o.constructs.map((c) => [c.name, String(c.k), String(c.n), c.error ? 'n/a' : f3(c.alpha)]);
  if (o.combined) body.push(['Total (Combined)', String(o.combined.k), String(o.combined.n), f3(o.combined.alpha)]);
  kids.push(tbl(['Construct', 'Items (k)', 'n', 'Alpha'], body));
  kids.push(p('Note. \u03b1 values above .70 are considered acceptable for pilot testing.', false, true));
  const tables = o.demographics?.tables || [];
  tables.forEach((t, i) => {
    kids.push(p('Table ' + (i + 2), true));
    kids.push(p(t.name, false, true));
    kids.push(tbl(
      ['Category', 'Frequency', 'Percent', 'Valid %', 'Cumulative %'],
      t.rows.map((r) => [r.label, String(r.frequency), f1(r.percent), f1(r.validPercent), f1(r.cumulativePercent)]),
    ));
    kids.push(p('Note. Valid n = ' + t.nValid + '; missing = ' + t.nMissing + '.', false, true));
  });
  const r = o.interp?.pilot_study_report;
  if (r) {
    kids.push(p('Interpretation', true));
    if (r.insufficient_data) kids.push(p(r.insufficient_data));
    if (r.response_rate_summary) kids.push(p(r.response_rate_summary));
    if (r.reliability_overview) kids.push(p(r.reliability_overview));
    (r.construct_evaluations || []).forEach((c: any) => {
      kids.push(p(c.construct_name + ' \u2013 ' + c.alpha_score + ' (' + c.status + ')', true));
      if (c.action_required) kids.push(p(c.action_required));
    });
    if (r.validity_discussion) kids.push(p(r.validity_discussion));
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{ children: kids }],
  });
  return Packer.toBlob(doc);
}
