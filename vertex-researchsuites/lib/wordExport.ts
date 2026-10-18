// Builds a Word (.docx) file in the browser with no extra packages.
// A .docx is a zip of a few XML files. The zip here is "stored" (not compressed).

const enc = new TextEncoder();

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type ZipEntry = { name: string; data: Uint8Array };

function zipStore(entries: ZipEntry[]): Uint8Array {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);
    parts.push(local, e.data);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    central.push(cen);
    offset += local.length + size;
  }
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = parts.concat(central, [end]);
  let total = 0;
  for (const a of all) total += a.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of all) {
    out.set(a, pos);
    pos += a.length;
  }
  return out;
}

function esc(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type RunOpts = { bold?: boolean; italic?: boolean; color?: string; size?: number };

function run(text: string, o: RunOpts = {}): string {
  if (!text) return "";
  const pr =
    (o.bold ? "<w:b/>" : "") +
    (o.italic ? "<w:i/>" : "") +
    (o.color ? '<w:color w:val="' + o.color + '"/>' : "") +
    (o.size ? '<w:sz w:val="' + o.size + '"/><w:szCs w:val="' + o.size + '"/>' : "");
  return "<w:r>" + (pr ? "<w:rPr>" + pr + "</w:rPr>" : "") + '<w:t xml:space="preserve">' + esc(text) + "</w:t></w:r>";
}

function para(runs: string, after = 120): string {
  return '<w:p><w:pPr><w:spacing w:after="' + after + '"/></w:pPr>' + runs + "</w:p>";
}

// **bold** pieces inside a line of notes.
function inlineRuns(text: string, base: RunOpts = {}): string {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .map((piece) => {
      const m = /^\*\*([^*]+)\*\*$/.exec(piece);
      return m ? run(m[1], { ...base, bold: true }) : run(piece, base);
    })
    .join("");
}

const SPEAKER_LINE = /^((?:\[\d{1,3}:\d{2}(?::\d{2})?\] ?)?)(Speaker \d+:) ?(.*)$/;

function bodyFor(text: string, kind: "transcript" | "notes"): string {
  const out: string[] = [];
  for (const raw of String(text || "").split("\n")) {
    const line = raw.replace(/\uFEFF/g, "").replace(/\s+$/, "");
    if (!line.trim()) continue;
    if (kind === "transcript") {
      const m = SPEAKER_LINE.exec(line);
      if (m) {
        out.push(para(run(m[1], { color: "7F7F7F" }) + run(m[2] + " ", { bold: true }) + run(m[3])));
      } else if (/^\[Part \d+/.test(line)) {
        out.push(para(run(line, { italic: true, color: "7F7F7F" })));
      } else {
        out.push(para(run(line)));
      }
      continue;
    }
    if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) continue;
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const size = h[1].length <= 1 ? 32 : h[1].length === 2 ? 28 : 24;
      out.push(para(inlineRuns(h[2], { bold: true, size }), 160));
      continue;
    }
    const b = /^\s*[-*\u2022]\s+(.*)$/.exec(line);
    if (b) {
      out.push(para(run("\u2022 ") + inlineRuns(b[1])));
      continue;
    }
    out.push(para(inlineRuns(line)));
  }
  return out.join("");
}

const NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

export function buildDocx(text: string, kind: "transcript" | "notes"): Uint8Array {
  const title = kind === "notes" ? "Interpretive Notes" : "Transcript";
  const d = new Date();
  const p2 = (n: number) => (n < 10 ? "0" : "") + n;
  const date = d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  const head = para(run(title, { bold: true, size: 36 }), 60) + para(run(date, { color: "7F7F7F", size: 20 }), 240);
  const doc =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="' + NS + '"><w:body>' + head + bodyFor(text, kind) +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    "</w:body></w:document>";
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="' + NS + '"><w:docDefaults><w:rPrDefault><w:rPr>' +
    '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="en-US"/>' +
    '</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>';
  const types =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    "</Types>";
  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="word/document.xml"/></Relationships>';
  const docRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="' + REL + '/styles" Target="styles.xml"/></Relationships>';
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(types) },
    { name: "_rels/.rels", data: enc.encode(rels) },
    { name: "word/document.xml", data: enc.encode(doc) },
    { name: "word/_rels/document.xml.rels", data: enc.encode(docRels) },
    { name: "word/styles.xml", data: enc.encode(styles) },
  ]);
}

// Saves a Word file on the user's device. Never throws.
export function downloadWordFile(filename: string, text: unknown, kind: "transcript" | "notes") {
  try {
    const body = typeof text === "string" ? text : JSON.stringify(text, null, 2);
    const bytes = buildDocx(body || "", kind);
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {}
}
