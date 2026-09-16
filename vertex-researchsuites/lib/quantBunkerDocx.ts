import {
  Table,
  TableRow,
  TableCell,
  Paragraph,
  TextRun,
  BorderStyle,
  WidthType,
  AlignmentType,
  HeadingLevel,
} from "docx";

// ---- SPSS box-cell border style: full 1px black border on every cell ----
const SPSS_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
};

// ---- Header cell: bold, centered, full border ----
export function headerCell(text: string): TableCell {
  return new TableCell({
    borders: SPSS_BORDER,
    width: { size: 100, type: WidthType.AUTO },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true })],
      }),
    ],
  });
}

// ---- Body cell: plain text, centered, full border ----
export function bodyCell(text: string, align: "center" | "left" = "center"): TableCell {
  return new TableCell({
    borders: SPSS_BORDER,
    width: { size: 100, type: WidthType.AUTO },
    children: [
      new Paragraph({
        alignment: align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text })],
      }),
    ],
  });
}

// ---- Build a full SPSS box-cell table from headers + row data ----
// rows: array of arrays of strings (already formatted, e.g. "3.45" not raw number)
// firstColLeftAlign: if true, left-align the first column's body cells (useful for row labels)
export function makeTable(
  headers: string[],
  rows: string[][],
  firstColLeftAlign: boolean = false
): Table {
  const headerRow = new TableRow({
    children: headers.map((h) => headerCell(h)),
    tableHeader: true,
  });

  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map((cellText, colIdx) =>
          bodyCell(cellText, firstColLeftAlign && colIdx === 0 ? "left" : "center")
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

// ---- Table title paragraph (e.g. "Table 1. Descriptive Statistics") ----
export function tableTitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, italics: true })],
  });
}

// ---- Section heading (e.g. "Descriptive Statistics") ----
export function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true })],
  });
}

// ---- Spacer paragraph between tables ----
export function spacer(): Paragraph {
  return new Paragraph({ text: "", spacing: { after: 200 } });
}

// ---- Formatting helpers for numbers ----
export function fmt(n: number | null | undefined, decimals: number = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toFixed(decimals);
}

export function fmtP(p: number | null | undefined): string {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  if (p < 0.001) return "< .001";
  return p.toFixed(3).replace(/^0\./, ".");
}
