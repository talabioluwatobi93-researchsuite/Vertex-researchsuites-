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

// ---- Grouped table unit: title + its rendered blocks (title paragraph, table, spacer) ----
// title is the exact table title string (e.g. "Table 3. Independent Samples Test for Score")
// used to splice matching interpretation text after this group in Doc B.
export interface TableGroup {
  title: string;
  blocks: (Paragraph | Table)[];
}

// ==== Citation-style-aware table formatting (Doc B only) ====
// Doc A always uses the plain SPSS box-cell style above, regardless of citation_style.

export type CitationStyle =
  | "APA7" | "APA6" | "MLA9" | "Chicago17" | "Harvard"
  | "Vancouver" | "IEEE" | "Turabian9" | "OSCOLA" | "AMA";

interface StyleTableConfig {
  borderStyle: "full" | "horizontal" | "minimal";
  headerShaded: boolean;
  titleCase: "numeral" | "romanCaps";
  titleSuffix: string;
  captionBelowTitle: boolean;
  captionItalic: boolean;
}

const HORIZONTAL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "333333" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

const MINIMAL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "666666" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "666666" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function toRoman(num: number): string {
  const romans: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let result = "";
  let n = num;
  for (const [value, sym] of romans) {
    while (n >= value) {
      result += sym;
      n -= value;
    }
  }
  return result;
}

function getStyleConfig(style: CitationStyle): StyleTableConfig {
  switch (style) {
    case "APA7":
    case "APA6":
      return { borderStyle: "horizontal", headerShaded: false, titleCase: "numeral", titleSuffix: "", captionBelowTitle: true, captionItalic: true };
    case "Vancouver":
    case "AMA":
      return { borderStyle: "full", headerShaded: false, titleCase: "numeral", titleSuffix: ".", captionBelowTitle: false, captionItalic: false };
    case "IEEE":
      return { borderStyle: "full", headerShaded: true, titleCase: "romanCaps", titleSuffix: "", captionBelowTitle: false, captionItalic: false };
    case "Chicago17":
    case "Turabian9":
      return { borderStyle: "horizontal", headerShaded: false, titleCase: "numeral", titleSuffix: ".", captionBelowTitle: false, captionItalic: false };
    case "Harvard":
      return { borderStyle: "full", headerShaded: false, titleCase: "numeral", titleSuffix: ":", captionBelowTitle: false, captionItalic: false };
    case "MLA9":
      return { borderStyle: "minimal", headerShaded: false, titleCase: "numeral", titleSuffix: "", captionBelowTitle: true, captionItalic: true };
    case "OSCOLA":
      return { borderStyle: "minimal", headerShaded: false, titleCase: "numeral", titleSuffix: "", captionBelowTitle: false, captionItalic: false };
    default:
      return { borderStyle: "horizontal", headerShaded: false, titleCase: "numeral", titleSuffix: "", captionBelowTitle: true, captionItalic: true };
  }
}

function borderForStyle(cfg: StyleTableConfig) {
  if (cfg.borderStyle === "full") return SPSS_BORDER;
  if (cfg.borderStyle === "horizontal") return HORIZONTAL_BORDER;
  return MINIMAL_BORDER;
}

export function headerCellStyled(text: string, style: CitationStyle): TableCell {
  const cfg = getStyleConfig(style);
  return new TableCell({
    borders: borderForStyle(cfg),
    shading: cfg.headerShaded ? { fill: "D9D9D9" } : undefined,
    width: { size: 100, type: WidthType.AUTO },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true })],
      }),
    ],
  });
}

export function bodyCellStyled(text: string, style: CitationStyle, align: "center" | "left" = "center"): TableCell {
  const cfg = getStyleConfig(style);
  return new TableCell({
    borders: borderForStyle(cfg),
    width: { size: 100, type: WidthType.AUTO },
    children: [
      new Paragraph({
        alignment: align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text })],
      }),
    ],
  });
}

export function makeTableStyled(
  headers: string[],
  rows: string[][],
  style: CitationStyle,
  firstColLeftAlign: boolean = false
): Table {
  const headerRow = new TableRow({
    children: headers.map((h) => headerCellStyled(h, style)),
    tableHeader: true,
  });

  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map((cellText, colIdx) =>
          bodyCellStyled(cellText, style, firstColLeftAlign && colIdx === 0 ? "left" : "center")
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

// tableNumber: sequential number across the whole Doc B (1, 2, 3, ...)
export function tableTitleStyled(tableNumber: number, captionText: string, style: CitationStyle): Paragraph[] {
  const cfg = getStyleConfig(style);
  const label = cfg.titleCase === "romanCaps"
    ? "TABLE " + toRoman(tableNumber)
    : "Table " + String(tableNumber) + cfg.titleSuffix;

  if (cfg.captionBelowTitle) {
    return [
      new Paragraph({
        spacing: { before: 240, after: 60 },
        children: [new TextRun({ text: label, bold: true })],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: captionText, italics: cfg.captionItalic })],
      }),
    ];
  }

  return [
    new Paragraph({
      spacing: { before: 240, after: 120 },
      alignment: cfg.titleCase === "romanCaps" ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: label + "  " + captionText, bold: true })],
    }),
  ];
}
