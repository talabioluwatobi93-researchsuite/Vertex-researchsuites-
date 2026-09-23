import { Paragraph, Table, ImageRun } from "docx";
import { makeTable, tableTitle, spacer, fmt, TableGroup, CitationStyle, makeTableStyled, tableTitleStyled } from "./quantBunkerDocx";

// ---- QuickChart.io chart image embed (server-side, no local canvas needed) ----
async function buildChartImage(
  chartConfig: any,
  widthPx: number = 450,
  heightPx: number = 300
): Promise<Paragraph | null> {
  try {
    const url = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=${widthPx}&h=${heightPx}&backgroundColor=white`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return new Paragraph({
      children: [
        new ImageRun({
          type: "png",
          data: buffer,
          transformation: { width: widthPx * 0.75, height: heightPx * 0.75 },
        }),
      ],
      spacing: { before: 120, after: 200 },
    });
  } catch (e) {
    console.error("Chart image fetch failed:", e);
    return null;
  }
}


// ---- Descriptives table ----
export function buildDescriptivesTable(
  descriptives: { name: string; role: string; n: number; mean: number; sd: number; min: number; max: number }[],
  tableNumber: number,
  citationStyle?: CitationStyle
): TableGroup[] {
  const caption = "Descriptive Statistics";
  const title = `Table ${tableNumber}. ${caption}`;
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
  const titleBlocks: Paragraph[] = citationStyle ? tableTitleStyled(tableNumber, caption, citationStyle) : [tableTitle(title)];
  const tableBlock: Table = citationStyle ? makeTableStyled(headers, rows, citationStyle, true) : makeTable(headers, rows, true);
  return [
    {
      title,
      blocks: [...titleBlocks, tableBlock, spacer()],
    },
  ];
}

// ---- Frequency tables ----
export async function buildFrequencyTables(
  frequencyTables: {
    name: string;
    nValid: number;
    nMissing: number;
    rows: { label: string; frequency: number; percent: number; validPercent: number; cumulativePercent: number }[];
  }[],
  startTableNumber: number,
  citationStyle?: CitationStyle
): Promise<TableGroup[]> {
  const groups = await Promise.all(frequencyTables.map(async (ft, idx) => {
    const tableNumber = startTableNumber + idx;
    const caption = `Frequency Distribution for ${ft.name} (N valid = ${ft.nValid}, Missing = ${ft.nMissing})`;
    const title = `Table ${tableNumber}. ${caption}`;
    const headers = ["Value", "Frequency", "Percent", "Valid Percent", "Cumulative Percent"];
    const rows = ft.rows.map(r => [
      r.label,
      String(r.frequency),
      fmt(r.percent, 1),
      fmt(r.validPercent, 1),
      fmt(r.cumulativePercent, 1),
    ]);
    const titleBlocks: Paragraph[] = citationStyle ? tableTitleStyled(tableNumber, caption, citationStyle) : [tableTitle(title)];
    const tableBlock: Table = citationStyle ? makeTableStyled(headers, rows, citationStyle, true) : makeTable(headers, rows, true);

    const chartConfig = {
      type: "pie",
      data: {
        labels: ft.rows.map(r => r.label),
        datasets: [{ data: ft.rows.map(r => r.frequency) }],
      },
      options: {
        plugins: {
          title: { display: true, text: ft.name },
          legend: { position: "bottom" },
        },
      },
    };
    const chartImage = await buildChartImage(chartConfig);

    const blocks: (Paragraph | Table)[] = [...titleBlocks, tableBlock];
    if (chartImage) blocks.push(chartImage);
    blocks.push(spacer());

    return { title, blocks };
  }));
  return groups;
}

// ---- Item descriptives (Likert-style construct tables) ----
export async function buildItemDescriptivesTables(
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
  startTableNumber: number,
  citationStyle?: CitationStyle
): Promise<TableGroup[]> {
  const groups = await Promise.all(itemDescriptives.map(async (construct, idx) => {
    const tableNumber = startTableNumber + idx;
    const scalePoints: number[] = [];
    for (let p = construct.scaleMin; p <= construct.scaleMax; p++) scalePoints.push(p);

    const caption = `Item Descriptives for ${construct.constructName}`;
    const title = `Table ${tableNumber}. ${caption}`;
    const headers = ["Item", "N", ...scalePoints.map(p => `Point ${p} (%)`), "Mean", "SD", "Overall %"];

    const rows = construct.items.map((item) => [
      item.label,
      String(item.n),
      ...scalePoints.map(p => fmt(item.pointPercents[p], 1)),
      fmt(item.mean),
      fmt(item.sd),
      fmt(item.overallPercent, 1),
    ]);

    rows.push([
      "Total (Composite)",
      "",
      ...scalePoints.map(() => ""),
      fmt(construct.totalMean),
      fmt(construct.totalSD),
      fmt(construct.totalOverallPercent, 1),
    ]);

    const titleBlocks: Paragraph[] = citationStyle ? tableTitleStyled(tableNumber, caption, citationStyle) : [tableTitle(title)];
    const tableBlock: Table = citationStyle ? makeTableStyled(headers, rows, citationStyle, true) : makeTable(headers, rows, true);

    const chartConfig = {
      type: "bar",
      data: {
        labels: construct.items.map(item => item.label.length > 30 ? item.label.slice(0, 30) + "..." : item.label),
        datasets: [{ label: "Mean", data: construct.items.map(item => item.mean ?? 0) }],
      },
      options: {
        indexAxis: "y",
        plugins: {
          title: { display: true, text: construct.constructName },
          legend: { display: false },
        },
        scales: { x: { min: construct.scaleMin, max: construct.scaleMax } },
      },
    };
    const chartImage = await buildChartImage(chartConfig, 500, 350);

    const blocks: (Paragraph | Table)[] = [...titleBlocks, tableBlock];
    if (chartImage) blocks.push(chartImage);
    blocks.push(spacer());

    return { title, blocks };
  }));
  return groups;
}
