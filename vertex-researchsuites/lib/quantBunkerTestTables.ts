import { Paragraph, Table } from "docx";
import { makeTable, tableTitle, spacer, fmt, fmtP } from "./quantBunkerDocx";

// ---- Independent samples t-test ----
export function buildTTestTables(ttest: any, tableNumber: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  // Group statistics table
  out.push(tableTitle(`Table ${tableNumber}. Group Statistics for ${ttest.outcomeVariableName} by ${ttest.groupVariableName}`));
  out.push(
    makeTable(
      [ttest.groupVariableName, "N", "Mean", "SD", "SEM"],
      [
        [ttest.group1Label, String(ttest.group1.n), fmt(ttest.group1.mean), fmt(ttest.group1.sd), fmt(ttest.group1.sem)],
        [ttest.group2Label, String(ttest.group2.n), fmt(ttest.group2.mean), fmt(ttest.group2.sd), fmt(ttest.group2.sem)],
      ],
      true
    )
  );
  out.push(spacer());

  // Independent samples test table (Levene's + both variance assumptions)
  out.push(tableTitle(`Table ${tableNumber + 1}. Independent Samples Test for ${ttest.outcomeVariableName}`));
  out.push(
    makeTable(
      ["", "Levene's F", "Levene's p", "t", "df", "p", "Mean Diff", "SE Diff", "95% CI Lower", "95% CI Upper"],
      [
        [
          "Equal variances assumed",
          fmt(ttest.levene?.f ?? ttest.levene, 2),
          fmtP(ttest.levene?.p),
          fmt(ttest.equalVariances.t),
          fmt(ttest.equalVariances.df, 0),
          fmtP(ttest.equalVariances.p),
          fmt(ttest.equalVariances.meanDiff),
          fmt(ttest.equalVariances.seDiff),
          fmt(ttest.equalVariances.ciLower),
          fmt(ttest.equalVariances.ciUpper),
        ],
        [
          "Equal variances not assumed",
          "",
          "",
          fmt(ttest.unequalVariances.t),
          fmt(ttest.unequalVariances.df, 2),
          fmtP(ttest.unequalVariances.p),
          fmt(ttest.unequalVariances.meanDiff),
          fmt(ttest.unequalVariances.seDiff),
          fmt(ttest.unequalVariances.ciLower),
          fmt(ttest.unequalVariances.ciUpper),
        ],
      ],
      true
    )
  );
  out.push(spacer());
  return out;
}

// ---- Paired samples t-test ----
export function buildPairedTTestTable(paired: any, tableNumber: number): (Paragraph | Table)[] {
  const headers = ["Pair", "N", "Mean", "SD", "SE Mean", "Mean Diff", "SD Diff", "SE Diff", "95% CI Lower", "95% CI Upper", "t", "df", "p"];
  const rows = [
    [
      `${paired.group1Name} - ${paired.group2Name}`,
      String(paired.n),
      `${fmt(paired.before.mean)} / ${fmt(paired.after.mean)}`,
      `${fmt(paired.before.sd)} / ${fmt(paired.after.sd)}`,
      "",
      fmt(paired.meanDiff),
      fmt(paired.sdDiff),
      fmt(paired.semDiff),
      fmt(paired.ciLower),
      fmt(paired.ciUpper),
      fmt(paired.t),
      fmt(paired.df, 0),
      fmtP(paired.p),
    ],
  ];
  return [
    tableTitle(`Table ${tableNumber}. Paired Samples Test for ${paired.group1Name} and ${paired.group2Name}`),
    makeTable(headers, rows, true),
    spacer(),
  ];
}

// ---- Mann-Whitney U test ----
export function buildMannWhitneyTable(mw: any, tableNumber: number): (Paragraph | Table)[] {
  const headers = [mw.groupVariableName, "N", "Median", "Rank Sum"];
  const rows = [
    [mw.group1Label, String(mw.group1.n), fmt(mw.group1.median), fmt(mw.group1.rankSum, 1)],
    [mw.group2Label, String(mw.group2.n), fmt(mw.group2.median), fmt(mw.group2.rankSum, 1)],
  ];
  const statsHeaders = ["U", "Z", "p"];
  const statsRows = [[fmt(mw.u, 1), fmt(mw.z), fmtP(mw.p)]];
  return [
    tableTitle(`Table ${tableNumber}. Mann-Whitney U Test Ranks for ${mw.outcomeVariableName}`),
    makeTable(headers, rows, true),
    spacer(),
    tableTitle(`Table ${tableNumber + 1}. Mann-Whitney U Test Statistics`),
    makeTable(statsHeaders, statsRows, false),
    spacer(),
  ];
}

// ---- Wilcoxon Signed-Rank test ----
export function buildWilcoxonTable(w: any, tableNumber: number): (Paragraph | Table)[] {
  const headers = ["N", "N Excluded (Ties=0)", "W+", "W-", "W", "Mean W", "SD W", "Z", "p"];
  const rows = [
    [
      String(w.n),
      String(w.nExcludedZero),
      fmt(w.wPlus, 1),
      fmt(w.wMinus, 1),
      fmt(w.w, 1),
      fmt(w.meanW, 2),
      fmt(w.sigmaW, 2),
      fmt(w.z),
      fmtP(w.p),
    ],
  ];
  return [
    tableTitle(`Table ${tableNumber}. Wilcoxon Signed-Rank Test for ${w.group1Name} and ${w.group2Name}`),
    makeTable(headers, rows, false),
    spacer(),
  ];
}
