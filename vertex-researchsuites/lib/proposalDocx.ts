// Browser-side Word export for one proposal.
import {
  AlignmentType, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun, UnderlineType,
} from 'docx';
import { linkify, parseProposal } from './proposalFormat';

function runsFor(text: string) {
  return linkify(text).map((r) =>
    r.href
      ? new ExternalHyperlink({
          link: r.href,
          children: [new TextRun({ text: r.text, color: '0563C1', underline: { type: UnderlineType.SINGLE } })],
        })
      : new TextRun({ text: r.text })
  );
}

export async function proposalToDocxBlob(text: string): Promise<Blob> {
  const { title, blocks } = parseProposal(text);
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: title, bold: true, size: 32 })],
    }),
  ];
  for (const b of blocks) {
    if (b.kind === 'heading') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 320, after: 120 },
          children: [new TextRun({ text: b.text, bold: true, size: 26, color: '000000' })],
        })
      );
    } else {
      children.push(
        new Paragraph({
          spacing: { after: 140, line: 340 },
          children: [
            ...(b.label ? [new TextRun({ text: `${b.label}: `, bold: true })] : []),
            ...runsFor(b.text),
          ],
        })
      );
    }
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Times New Roman', size: 24 } } } },
    sections: [{ children }],
  });
  return Packer.toBlob(doc);
}

export function safeFileName(t: string): string {
  return t.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'proposal';
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
