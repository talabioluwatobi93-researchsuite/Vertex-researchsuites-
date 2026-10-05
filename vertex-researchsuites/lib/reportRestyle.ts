// Report restyle engine: reads an uploaded Chapter 4 .docx (SPSS cell-format tables with
// interpretations beneath), and rebuilds it in the chosen citation style.
// Nothing here depends on a dataset, a table count, or a questionnaire.
import { Document, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, BorderStyle, TableLayoutType, WidthType } from "docx";
import { makeTableStyled, tableTitleStyled, spacer } from "@/lib/quantBunkerDocx";
import type { CitationStyle } from "@/lib/quantBunkerDocx";
import { callQuantInterpretChain } from "@/lib/openrouter";
import { getCitationWritingRule } from "@/lib/quantInterpret";

// ---------------------------------------------------------------- types
export type Block =
  | { kind: "p"; text: string; heading: number }
  | { kind: "table"; rows: string[][] }
  | { kind: "img"; index: number };

export interface ParsedImage {
  data: Buffer;
  type: "png" | "jpg" | "gif" | "bmp" | "unsupported";
  width: number;
  height: number;
}

export interface ParsedReport {
  blocks: Block[];
  images: ParsedImage[];
}

export type Node =
  | { kind: "heading"; id: number; level: number; text: string }
  | { kind: "body"; id: number; text: string }
  | { kind: "img"; index: number }
  | { kind: "table"; id: number; number: number; captionFound: boolean; caption: string; rows: string[][] };

export interface RewriteItem {
  id: string;
  text: string;
}

export interface RewriteResult {
  id: string;
  text: string;
  ok: boolean;
  reason?: string;
}

// ---------------------------------------------------------------- html helpers
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function htmlToText(inner: string): string {
  return decodeEntities(
    inner
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|div)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function cellText(inner: string): string {
  return htmlToText(inner).replace(/\s*\n\s*/g, " ").trim();
}

// ---------------------------------------------------------------- image helpers
function imageInfo(buf: Buffer, contentType: string): ParsedImage {
  const ct = (contentType || "").toLowerCase();
  let type: ParsedImage["type"] = "unsupported";
  if (ct.includes("png")) type = "png";
  else if (ct.includes("jpeg") || ct.includes("jpg")) type = "jpg";
  else if (ct.includes("gif")) type = "gif";
  else if (ct.includes("bmp")) type = "bmp";

  let width = 450;
  let height = 300;
  try {
    if (type === "png" && buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      width = buf.readUInt32BE(16);
      height = buf.readUInt32BE(20);
    } else if (type === "jpg") {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const marker = buf[i + 1];
        const len = buf.readUInt16BE(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          height = buf.readUInt16BE(i + 5);
          width = buf.readUInt16BE(i + 7);
          break;
        }
        i += 2 + len;
      }
    } else if (type === "gif" && buf.length > 10) {
      width = buf.readUInt16LE(6);
      height = buf.readUInt16LE(8);
    }
  } catch {
    /* keep defaults */
  }
  if (!width || !height) { width = 450; height = 300; }
  return { data: buf, type, width, height };
}

// ---------------------------------------------------------------- reading the .docx
export function parseHtml(
  html: string,
  resolveSrc?: (src: string) => { data: Buffer; contentType: string } | null
): ParsedReport {
  const blocks: Block[] = [];
  const images: ParsedImage[] = [];

  const addImagesFrom = (inner: string) => {
    const re = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(inner))) {
      const src = decodeEntities(m[1]);
      let data: Buffer | null = null;
      let contentType = "";
      const dm = /^data:([^;,]+);base64,(.*)$/i.exec(src);
      if (dm) {
        contentType = dm[1];
        data = Buffer.from(dm[2], "base64");
      } else if (resolveSrc) {
        const r = resolveSrc(src);
        if (r) { data = r.data; contentType = r.contentType; }
      }
      if (data) {
        images.push(imageInfo(data, contentType));
        blocks.push({ kind: "img", index: images.length - 1 });
      }
    }
  };

  const TOP = /<(p|h[1-6]|table|ul|ol|blockquote|figure)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = TOP.exec(html))) {
    const tag = m[1].toLowerCase();
    const inner = m[2];

    if (tag === "table") {
      const rows: string[][] = [];
      const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let tr: RegExpExecArray | null;
      while ((tr = trRe.exec(inner))) {
        const cells: string[] = [];
        const tdRe = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
        let td: RegExpExecArray | null;
        while ((td = tdRe.exec(tr[1]))) cells.push(cellText(td[1]));
        if (cells.length) rows.push(cells);
      }
      if (rows.length) blocks.push({ kind: "table", rows });
      continue;
    }

    const hasImg = /<img\b/i.test(inner);
    if (hasImg) addImagesFrom(inner);

    if (tag === "figure") continue;
    const text = htmlToText(inner);
    if (!text) continue;
    const heading = /^h([1-6])$/.test(tag) ? parseInt(tag.slice(1), 10) : 0;
    blocks.push({ kind: "p", text, heading });
  }
  return { blocks, images };
}

export async function parseReport(buffer: Buffer): Promise<ParsedReport> {
  const mod: any = await import("mammoth");
  const mammoth: any = mod.default || mod;
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image: any) => {
        const b64: string = await image.read("base64");
        return { src: `data:${image.contentType};base64,${b64}` };
      }),
    }
  );
  return parseHtml(result.value);
}

// ---------------------------------------------------------------- structure analysis
const CAPTION_NUM = /^\s*table\s+(\d+)\b[\s.:\u2013\u2014-]*([\s\S]*)$/i;
const CAPTION_ROMAN = /^\s*TABLE\s+([IVXLCDM]+)\b[\s.:\u2013\u2014-]*([\s\S]*)$/;

function romanToInt(s: string): number {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = v[s[i]];
    const next = v[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

function parseCaption(text: string): { number: number; rest: string } | null {
  const t = text.replace(/\s+/g, " ").trim();
  let m = CAPTION_NUM.exec(t);
  if (m) return { number: parseInt(m[1], 10), rest: m[2].trim() };
  m = CAPTION_ROMAN.exec(t);
  if (m) return { number: romanToInt(m[1]), rest: m[2].trim() };
  return null;
}

function looksLikeCaption(text: string): boolean {
  const c = parseCaption(text);
  if (!c) return false;
  if (text.replace(/\s+/g, " ").trim().length > 300) return false;
  // a real caption is a title, not a sentence about the table
  return !/[.!?]\s+[A-Z]/.test(c.rest);
}

// a short standalone line with no sentence punctuation is a heading, even when the
// source document did not apply a Word heading style to it
function looksLikeHeading(text: string): boolean {
  const t = text.trim();
  return t.length <= 60 && !t.includes("\n") && /[A-Za-z]/.test(t) && !/[.!?:;,]$/.test(t);
}

export function analyze(blocks: Block[]): Node[] {
  const consumed = new Set<number>();
  const captionFor = new Map<number, { number: number | null; caption: string }>();

  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].kind !== "table") continue;
    let found = -1;
    for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
      const b = blocks[j];
      if (b.kind !== "p" || b.heading > 0 || consumed.has(j)) break;
      if (looksLikeCaption(b.text)) { found = j; break; }
    }
    if (found >= 0) {
      const first = parseCaption((blocks[found] as any).text)!;
      const parts: string[] = [first.rest];
      for (let k = found + 1; k < i; k++) parts.push((blocks[k] as any).text);
      for (let k = found; k < i; k++) consumed.add(k);
      captionFor.set(i, {
        number: first.number,
        caption: parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
      });
    } else {
      captionFor.set(i, { number: null, caption: "" });
    }
  }

  const nodes: Node[] = [];
  let lastNum = 0;
  blocks.forEach((b, i) => {
    if (consumed.has(i)) return;
    if (b.kind === "p") {
      if (b.heading > 0) nodes.push({ kind: "heading", id: i, level: b.heading, text: b.text });
      else if (looksLikeHeading(b.text)) nodes.push({ kind: "heading", id: i, level: 1, text: b.text });
      else nodes.push({ kind: "body", id: i, text: b.text });
    } else if (b.kind === "img") {
      nodes.push({ kind: "img", index: b.index });
    } else {
      const c = captionFor.get(i)!;
      const number = c.number ?? lastNum + 1;
      lastNum = number;
      nodes.push({ kind: "table", id: i, number, captionFound: c.number !== null, caption: c.caption, rows: b.rows });
    }
  });
  return nodes;
}

export function describeReport(parsed: ParsedReport) {
  const nodes = analyze(parsed.blocks);
  const tables = nodes.filter((n) => n.kind === "table") as Extract<Node, { kind: "table" }>[];
  const items: RewriteItem[] = nodes
    .filter((n) => n.kind === "body" && (n as any).text.trim().length >= 30)
    .map((n) => ({ id: String((n as any).id), text: (n as any).text }));
  const warnings: string[] = [];
  tables.forEach((t) => {
    if (!t.captionFound) warnings.push(`A table without a "Table N" caption was numbered ${t.number} automatically.`);
  });
  parsed.images.forEach((im, i) => {
    if (im.type === "unsupported") warnings.push(`Image ${i + 1} has an unsupported format and could not be carried over.`);
  });
  return { tableCount: tables.length, imageCount: parsed.images.length, items, warnings };
}

// ---------------------------------------------------------------- table value style (APA 6/7 only)
const BOUNDED_HEADERS = new Set([
  "p", "sig", "sig.", "p-value", "p value",
  "r", "r²", "r2", "r square", "adjusted r²", "adjusted r2", "adjusted r square",
  "beta", "β", "standardized beta",
]);
const P_HEADERS = new Set(["p", "sig", "sig.", "p-value", "p value"]);

// PHASE5B: APA 6 / APA 7 conversion in code (tables and text follow the same rules)
const APA_BOUNDED = "(?:p|r|rs|\u03C1|R\u00B2|R2|r\u00B2|\u03B2|\u03B7\u00B2|\u03B7p\u00B2)";
const STAT_SYM_RX = /(^|[^A-Za-z0-9])(R\u00B2|SD|SE|M|n|N|p|r|t|F|B)(?=\s*[=<>(])/g;

function collectBetaValues(nodes: Node[]): { v: number; dp: number }[] {
  const out: { v: number; dp: number }[] = [];
  for (const n of nodes) {
    if (n.kind !== "table" || !n.rows.length) continue;
    const rows = n.rows;
    rows[0].forEach((h, ci) => {
      const k = String(h || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (k !== "beta" && k !== "\u03B2" && k !== "standardized beta") return;
      for (let i = 1; i < rows.length; i++) {
        const c = String(rows[i][ci] || "").trim();
        const m = /^-?\d*\.(\d+)$/.exec(c);
        if (m) out.push({ v: Math.abs(Number(c)), dp: m[1].length });
      }
    });
  }
  return out;
}

function apaText(s: string, betaVals: { v: number; dp: number }[]): string {
  let t = s;
  t = t.replace(/(^|[^A-Za-z0-9])p\s*=\s*0?\.0{3,}(?!\d)/g, (_m, a) => a + "p < .001");
  t = t.replace(/(^|[^A-Za-z0-9])(n|N|M|SD|SE|B|t|F|p|r|df|R\u00B2|R2)\s*([=<>\u2264\u2265])\s*(?=[-\u2212\d.])/g, (_m, a, b, c) => a + b + " " + c + " ");
  t = t.replace(/(^|[^A-Za-z0-9])(t|F)\((\d+(?:,\s*\d+)?)\)\s*=\s*(?=[-\d.])/g, (_m, a, b, c) => a + b + "(" + c + ") = ");
  t = t.replace(new RegExp("(^|[^A-Za-z0-9])(" + APA_BOUNDED + ")(\\s*[=<>\u2264\u2265]\\s*)(-?)0(\\.\\d+)", "g"), (_m, a, b, c, d, e) => a + b + c + d + e);
  t = t.replace(/\b(p-value|p value|R Square|R-squared|R squared|R value)\b([^.\d]{0,30}?)(-?)0(\.\d+)/gi, (_m, a, b, c, d) => a + b + c + d);
  t = t.replace(/\b(Beta coefficient|beta coefficient|Beta|beta)\b([^.\d]{0,30}?)(-?)0(\.\d+)/g, (m, a, b, c, d) => {
    const val = Math.abs(Number("0" + d));
    const ok = betaVals.some((x) => Math.abs(x.v - val) < 0.5 * Math.pow(10, -x.dp) + 1e-9);
    return ok ? a + b + c + d : m;
  });
  return t;
}

function statParagraph(text: string): Paragraph {
  const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const runs: TextRun[] = [];
  lines.forEach((line, li) => {
    const rx = new RegExp(STAT_SYM_RX.source, "g");
    let last = 0;
    let first = true;
    let m: RegExpExecArray | null;
    const push = (t: string, it: boolean) => {
      if (!t) return;
      runs.push(new TextRun({ text: t, italics: it, break: first && li > 0 ? 1 : 0 }));
      first = false;
    };
    while ((m = rx.exec(line)) !== null) {
      const start = m.index + m[1].length;
      push(line.slice(last, start), false);
      push(m[2], true);
      last = start + m[2].length;
    }
    push(line.slice(last), false);
  });
  return new Paragraph({ spacing: { after: 120 }, children: runs });
}

// PHASE5C: APA table setup (three horizontal rules, wide label column, notes under the table)
const NOTE_RX = /^(note|notes|source|scale)\s*[.:]/i;
const APA_HDR_ITALIC = new Set(["M", "SD", "SE", "N", "n", "t", "F", "p", "r", "B"]);

// PHASE5D: table layout per citation style (rules, shading, heading weight)
type TableSpec = { rules: "three" | "grid"; shade: boolean; hBold: boolean; hItalicSym: boolean };
const THREE: TableSpec = { rules: "three", shade: false, hBold: false, hItalicSym: false };
const TABLE_SPEC: Record<string, TableSpec> = {
  APA6: { ...THREE, hItalicSym: true },
  APA7: { ...THREE, hItalicSym: true },
  MLA9: THREE,
  Chicago17: THREE,
  Turabian9: THREE,
  Vancouver: THREE,
  AMA: THREE,
  OSCOLA: THREE,
  Harvard: { rules: "grid", shade: false, hBold: true, hItalicSym: false },
  IEEE: { rules: "grid", shade: true, hBold: true, hItalicSym: false },
};
function tableSpec(style: string): TableSpec {
  return TABLE_SPEC[style] || THREE;
}

function apaRule(): any {
  return { style: BorderStyle.SINGLE, size: 6, color: "000000" };
}
function apaNone(): any {
  return { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
}

function apaNote(text: string): Paragraph {
  const m = /^(note|notes|source)\s*[.:]/i.exec(text);
  const runs: TextRun[] = m
    ? [new TextRun({ text: m[0], italics: true, size: 20 }), new TextRun({ text: text.slice(m[0].length), size: 20 })]
    : [new TextRun({ text, size: 20 })];
  return new Paragraph({ spacing: { before: 60, after: 60 }, alignment: AlignmentType.LEFT, children: runs });
}

function buildApaTable(headers: string[], rows: string[][], style: CitationStyle, firstColLabel: boolean): Table {
  const n = headers.length;
  const spec = tableSpec(style);
  const hdrBorders = spec.rules === "grid" ? { top: apaRule(), bottom: apaRule(), left: apaRule(), right: apaRule() } : { bottom: apaRule() };
  const total = 9360;
  const widths: number[] = [];
  if (firstColLabel && n > 1) {
    let num = Math.max(820, Math.min(1500, Math.floor((total * 0.55) / (n - 1))));
    if (total - num * (n - 1) < 1500) num = Math.floor((total - 1500) / (n - 1));
    widths.push(total - num * (n - 1));
    for (let i = 1; i < n; i++) widths.push(num);
  } else {
    for (let i = 0; i < n; i++) widths.push(Math.floor(total / n));
  }
  const cell = (text: string, ci: number, header: boolean): TableCell => {
    const left = firstColLabel && ci === 0;
    const sym = header && APA_HDR_ITALIC.has(text.trim());
    return new TableCell({
      width: { size: widths[ci] || widths[widths.length - 1], type: WidthType.DXA },
      borders: header ? hdrBorders : undefined,
      shading: header && spec.shade ? { fill: "D9D9D9" } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [
        new Paragraph({
          alignment: left ? AlignmentType.LEFT : AlignmentType.CENTER,
          children: [new TextRun({ text, size: 20, bold: header && spec.hBold, italics: sym && spec.hItalicSym })],
        }),
      ],
    });
  };
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: spec.rules === "grid" ? { top: apaRule(), bottom: apaRule(), left: apaRule(), right: apaRule(), insideHorizontal: apaRule(), insideVertical: apaRule() } : { top: apaRule(), bottom: apaRule(), left: apaNone(), right: apaNone(), insideHorizontal: apaNone(), insideVertical: apaNone() },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, ci) => cell(h, ci, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, ci) => cell(c, ci, false)) })),
    ],
  });
}

function apa6Title(num: number, caption: string): Paragraph[] {
  return [
    new Paragraph({ spacing: { before: 240, after: 60 }, children: [new TextRun({ text: "Table " + String(num) })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: caption, italics: true })] }),
  ];
}

function apaCell(value: string, header: string, caption: string = ""): string {
  const h = header.toLowerCase().replace(/\s+/g, " ").trim();
  const sm = /^(-?)0(\.\d+)(\*{1,3})?$/.exec(value.trim());
  if (sm && /correlat|relationship|association|spearman|pearson/i.test(caption)) return sm[1] + sm[2] + (sm[3] || "");
  if (!BOUNDED_HEADERS.has(h)) return value;
  const t = value.trim();
  if (P_HEADERS.has(h) && /^0?\.0+$/.test(t)) return "< .001";
  const m = /^(-?)0\.(\d+)$/.exec(t);
  if (m) return m[1] + "." + m[2];
  return value;
}

// ---------------------------------------------------------------- building the document
function headingLevel(n: number) {
  const map: any = {
    1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3,
    4: HeadingLevel.HEADING_4, 5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
  };
  return map[n] || HeadingLevel.HEADING_1;
}

function textParagraph(text: string): Paragraph {
  const lines = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return new Paragraph({
    spacing: { after: 120 },
    children: lines.map((l, i) => new TextRun({ text: l, break: i > 0 ? 1 : 0 })),
  });
}

function normalizeRows(rows: string[][]): string[][] {
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => (r.length === width ? r : [...r, ...Array(width - r.length).fill("")]));
}

function firstColumnIsLabel(body: string[][]): boolean {
  if (!body.length) return true;
  const labels = body.filter((r) => !/^[-+<\s]*\.?\d/.test((r[0] || "").trim())).length;
  return labels >= body.length / 2;
}

export function buildRestyledDocument(
  parsed: ParsedReport,
  style: CitationStyle,
  rewrites: Record<string, string>
): Document {
  const nodes = analyze(parsed.blocks);
  const apa = style === "APA6" || style === "APA7";
  const betaVals = collectBetaValues(nodes);
  const children: any[] = [];

  let afterTable = false;
  let pendingSpacer = false;
  for (const n of nodes) {
    const isNote = afterTable && n.kind === "body" && NOTE_RX.test(String((n as any).text || "").trim());
    if (pendingSpacer && !isNote) { children.push(spacer()); pendingSpacer = false; }
    if (!isNote) afterTable = false;
    if (n.kind === "heading") {
      children.push(new Paragraph({ text: n.text, heading: headingLevel(n.level), spacing: { before: 400, after: 200 } }));
    } else if (n.kind === "body") {
      const r = rewrites[String(n.id)];
      const baseText = typeof r === "string" && r.trim() ? r : n.text;
      if (isNote) children.push(apaNote(apa ? apaText(baseText.trim(), betaVals) : baseText.trim()));
      else children.push(apa ? statParagraph(apaText(baseText, betaVals)) : textParagraph(baseText));
    } else if (n.kind === "img") {
      const im = parsed.images[n.index];
      if (!im || im.type === "unsupported") {
        children.push(textParagraph("[A chart in the original document could not be carried over (unsupported image format).]"));
        continue;
      }
      let w = im.width * 0.75;
      let h = im.height * 0.75;
      if (w > 450) { h = (h * 450) / w; w = 450; }
      children.push(
        new Paragraph({
          spacing: { before: 120, after: 200 },
          alignment: AlignmentType.LEFT,
          children: [new ImageRun({ type: im.type, data: im.data, transformation: { width: Math.round(w), height: Math.round(h) } } as any)],
        })
      );
    } else {
      const rows = normalizeRows(n.rows);
      const headers = rows[0];
      const body = rows.slice(1).map((r) => r.map((c, ci) => (apa ? apaCell(c, headers[ci] || "", n.caption) : c)));
      if (style === "APA6") children.push(...apa6Title(n.number, n.caption));
      else children.push(...tableTitleStyled(n.number, n.caption, style));
      children.push(buildApaTable(headers, body, style, firstColumnIsLabel(body)));
      afterTable = true;
      pendingSpacer = true;
    }
  }
  return new Document({ sections: [{ children }] });
}

// ---------------------------------------------------------------- writing-style rewrite with a number guard
export function numberSignature(text: string): string[] {
  const t = text.replace(/²/g, "2");
  const toks = t.match(/\d+(?:\.\d+)?|\.\d+/g) || [];
  return toks
    .map((tok) => {
      const v = Number(tok);
      if (!isFinite(v)) return tok;
      return String(v <= 0.001 ? 0.001 : v);
    })
    .sort();
}

export function numbersMatch(original: string, rewritten: string): boolean {
  const a = numberSignature(original);
  const b = numberSignature(rewritten);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function stripFences(s: string): string {
  return s.replace(/```json/g, "").replace(/```/g, "").trim();
}

export async function rewriteBatch(style: string, items: RewriteItem[]): Promise<RewriteResult[]> {
  const keep = (reason: string): RewriteResult[] => items.map((it) => ({ id: it.id, text: it.text, ok: false, reason }));
  try {
    const prompt = `You are adjusting the WRITING STYLE of paragraphs from a Chapter 4 results report to a target citation style.

TARGET STYLE: ${style}
STYLE CONVENTION FOR REPORTING STATISTICS: ${getCitationWritingRule(style)}

PARAGRAPHS (JSON): ${JSON.stringify(items)}

RULES:
1. Change ONLY how statistics and results are written (symbols, decimal and leading-zero conventions, p-value format, spacing, punctuation) and any light wording the style convention requires. Never change the meaning, the findings, any Supported/Rejected decision, or the order of the sentences.
2. Keep every number exactly as it is in value. You may only add or drop a leading zero where the style requires it (0.045 or .045), and write a p-value that is below .001 as "p < .001". Never round, add, remove or recalculate a number.
3. Do not add citations, new claims, headings or commentary. Strict third-person academic English. Never use I, we or our.
4. Return EVERY id exactly once, in the same order.

Respond ONLY with valid JSON, no preamble, no markdown fences:
{"items":[{"id":"string","text":"string"}]}`;

    const res: any = await Promise.race([
      callQuantInterpretChain(prompt),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 45000)),
    ]);
    const parsed = JSON.parse(stripFences(String(res?.content || "")));
    const returned = new Map<string, string>();
    for (const r of parsed?.items || []) returned.set(String(r?.id), String(r?.text || "").trim());

    return items.map((it) => {
      const next = returned.get(it.id);
      if (!next) return { id: it.id, text: it.text, ok: false, reason: "not returned" };
      const ratio = next.length / Math.max(1, it.text.length);
      if (ratio < 0.5 || ratio > 2) return { id: it.id, text: it.text, ok: false, reason: "length changed too much" };
      if (!numbersMatch(it.text, next)) return { id: it.id, text: it.text, ok: false, reason: "numbers differ" };
      return { id: it.id, text: next, ok: true };
    });
  } catch (e: any) {
    return keep(e?.message || "rewrite failed");
  }
}
