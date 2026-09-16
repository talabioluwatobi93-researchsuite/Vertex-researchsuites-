import { Paragraph, Table } from "docx";
import { makeTable, tableTitle, spacer, fmt } from "./quantBunkerDocx";

// ---- Descriptives table ----
// descriptives: [{ name, role, n, mean, sd, min, max }]
export function buildDescriptivesTable(
  descriptives: { name: string; role: string; n: number; mean: number; sd: number; min: number; max: number }[],
  tableNumber: number
): (Paragraph | Table)[] {
  const headers = ["Variable", "Role", "N", "Mean", "SD", "Min", "Max"];
  const rows = descriptives.map((d) => [
    d.name,
    d.role,
    String(d.n),
    fmt(d.mean),
    fmt(d.sd),
    fmt(d.min),
    fmt(d.max),
  ]);
  return [
    tableTitle(`Table ${tableNumber}. Descriptive Statistics`),
    makeTable(headers, rows, true),
    spacer(),
  ];
}

// ---- Frequency tables ----
// frequencyTables: [{ name, nValid, nMissing, rows: [{ label, frequency, percent, validPercent, cumulativePercent }] }]
export function buildFrequencyTables(
  frequencyTables: {
    name: string;
    nValid: number;
    nMissing: number;
    rows: { label: string; frequency: number; percent: number; validPercent: number; cumulativePercent: number }[];
  }[],
  startTableNumber: number
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  frequencyTables.forEach((ft, idx) => {
    const headers = ["Value", "Frequency", "Percent", "Valid Percent", "Cumulative Percent"];
    const rows = ft.rows.map((r) => [
      r.label,
      String(r.frequency),
      fmt(r.percent, 1),
      fmt(r.validPercent, 1),
      fmt(r.cumulativePercent, 1),
    ]);
    out.push(
      tableTitle(
        `Table ${startTableNumber + idx}. Frequency Distribution for ${ft.name} (N valid = ${ft.nValid}, Missing = ${ft.nMissing})`
      )
    );
    out.push(makeTable(headers, rows, true));
    out.push(spacer());
  });
  return out;
}

// ---- Item descriptives (Likert-style construct tables) ----
// itemDescriptives: [{ constructName, scaleMin, scaleMax, items: [{ label, n, pointPercents, mean, sd, overallPercent }], totalMean, totalSD, totalOverallPercent }]
export function buildItemDescriptivesTables(
  itemDescriptives: {
    constructName: string;
    scaleMin: number;
    scaleMax: number;
    items: {
      label: string;
      n: number;
      pointPercents: Record<number, number>;
      mean: number | null;
      sd: number | null;
      overallPercent: number | null;
    }[];
    totalMean: number | null;
    totalSD: number | null;
    totalOverallPercent: number | null;
  }[],
  startTableNumber: number
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  itemDescriptives.forEach((construct, idx) => {
    const scalePoints: number[] = [];
    for (let p = construct.scaleMin; p <= construct.scaleMax; p++) scalePoints.push(p);

    const headers = ["Item", "N", ...scalePoints.map((p) => `Point ${p} (%)`), "Mean", "SD", "Overall %"];

    const rows = construct.items.map((item) => [
      item.label,
      String(item.n),
      ...scalePoints.map((p) => fmt(item.pointPercents[p], 1)),
      fmt(item.mean),
      fmt(item.sd),
      fmt(item.overallPercent, 1),
    ]);

    // Totals row
    rows.push([
      "Total (Composite)",
      "",
      ...scalePoints.map(() => ""),
      fmt(construct.totalMean),
      fmt(construct.totalSD),
      fmt(construct.totalOverallPercent, 1),
    ]);

    out.push(tableTitle(`Table ${startTableNumber + idx}. Item Descriptives for ${construct.constructName}`));
    out.push(makeTable(headers, rows, true));
    out.push(spacer());
  });
  return out;
}
