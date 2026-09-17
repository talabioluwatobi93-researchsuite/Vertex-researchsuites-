import { Paragraph, Table } from "docx";
import { makeTable as baseMakeTable, tableTitle, spacer, fmt, fmtP, TableGroup, CitationStyle, makeTableStyled } from "./quantBunkerDocx";

// ---- Independent samples t-test ----
export function buildTTestTables(ttest: any, tableNumber: number, citationStyle?: CitationStyle): TableGroup[] {
  const makeTable = citationStyle
    ? (h: string[], r: string[][], f?: boolean) => makeTableStyled(h, r, citationStyle, f)
    : baseMakeTable;
  const groupStatsTitle = `Table ${tableNumber}. Group Statistics for ${ttest.outcomeVariableName} by ${ttest.groupVariableName}`;
  const testTitle = `Table ${tableNumber + 1}. Independent Samples Test for ${ttest.outcomeVariableName}`;

  return [
    {
      title: groupStatsTitle,
      blocks: [
        tableTitle(groupStatsTitle),
        makeTable(
          [ttest.groupVariableName, "N", "Mean", "SD", "SEM"],
          [
            [ttest.group1Label, String(ttest.group1.n), fmt(ttest.group1.mean), fmt(ttest.group1.sd), fmt(ttest.group1.sem)],
            [ttest.group2Label, String(ttest.group2.n), fmt(ttest.group2.mean), fmt(ttest.group2.sd), fmt(ttest.group2.sem)],
          ],
          true
        ),
        spacer(),
      ],
    },
    {
      title: testTitle,
      blocks: [
        tableTitle(testTitle),
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
        ),
        spacer(),
      ],
    },
  ];
}

// ---- Paired samples t-test ----
export function buildPairedTTestTable(paired: any, tableNumber: number, citationStyle?: CitationStyle): TableGroup[] {
  const makeTable = citationStyle
    ? (h: string[], r: string[][], f?: boolean) => makeTableStyled(h, r, citationStyle, f)
    : baseMakeTable;
  const title = `Table ${tableNumber}. Paired Samples Test for ${paired.group1Name} and ${paired.group2Name}`;
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
  return [{ title, blocks: [tableTitle(title), makeTable(headers, rows, true), spacer()] }];
}

// ---- Mann-Whitney U test ----
export function buildMannWhitneyTable(mw: any, tableNumber: number, citationStyle?: CitationStyle): TableGroup[] {
  const makeTable = citationStyle
    ? (h: string[], r: string[][], f?: boolean) => makeTableStyled(h, r, citationStyle, f)
    : baseMakeTable;
  const ranksTitle = `Table ${tableNumber}. Mann-Whitney U Test Ranks for ${mw.outcomeVariableName}`;
  const statsTitle = `Table ${tableNumber + 1}. Mann-Whitney U Test Statistics`;

  return [
    {
      title: ranksTitle,
      blocks: [
        tableTitle(ranksTitle),
        makeTable(
          [mw.groupVariableName, "N", "Median", "Rank Sum"],
          [
            [mw.group1Label, String(mw.group1.n), fmt(mw.group1.median), fmt(mw.group1.rankSum, 1)],
            [mw.group2Label, String(mw.group2.n), fmt(mw.group2.median), fmt(mw.group2.rankSum, 1)],
          ],
          true
        ),
        spacer(),
      ],
    },
    {
      title: statsTitle,
      blocks: [
        tableTitle(statsTitle),
        makeTable(["U", "Z", "p"], [[fmt(mw.u, 1), fmt(mw.z), fmtP(mw.p)]], false),
        spacer(),
      ],
    },
  ];
}

// ---- Wilcoxon Signed-Rank test ----
export function buildWilcoxonTable(w: any, tableNumber: number, citationStyle?: CitationStyle): TableGroup[] {
  const makeTable = citationStyle
    ? (h: string[], r: string[][], f?: boolean) => makeTableStyled(h, r, citationStyle, f)
    : baseMakeTable;
  const title = `Table ${tableNumber}. Wilcoxon Signed-Rank Test for ${w.group1Name} and ${w.group2Name}`;
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
  return [{ title, blocks: [tableTitle(title), makeTable(headers, rows, false), spacer()] }];
}

// ---- One-way ANOVA ----
export function buildAnovaTables(anova: any, tableNumber: number, citationStyle?: CitationStyle): TableGroup[] {
  const makeTable = citationStyle
    ? (h: string[], r: string[][], f?: boolean) => makeTableStyled(h, r, citationStyle, f)
    : baseMakeTable;
  const descTitle = `Table ${tableNumber}. Descriptives for ${anova.outcomeVariableName} by ${anova.groupVariableName}`;
  const summaryTitle = `Table ${tableNumber + 1}. ANOVA Summary for ${anova.outcomeVariableName}`;

  const groups: TableGroup[] = [
    {
      title: descTitle,
      blocks: [
        tableTitle(descTitle),
        makeTable(
          [anova.groupVariableName, "N", "Mean", "SD", "SEM", "95% CI Lower", "95% CI Upper", "Min", "Max"],
          anova.groupStats.map((g: any) => [
            g.label,
            String(g.n),
            fmt(g.mean),
            fmt(g.sd),
            fmt(g.sem),
            fmt(g.ciLower),
            fmt(g.ciUpper),
            fmt(g.min),
            fmt(g.max),
          ]),
          true
        ),
        spacer(),
      ],
    },
    {
      title: summaryTitle,
      blocks: [
        tableTitle(summaryTitle),
        makeTable(
          ["Source", "SS", "df", "MS", "F", "p"],
          [
            ["Between Groups", fmt(anova.ssBetween), fmt(anova.dfBetween, 0), fmt(anova.msBetween), fmt(anova.F), fmtP(anova.p)],
            ["Within Groups", fmt(anova.ssWithin), fmt(anova.dfWithin, 0), fmt(anova.msWithin), "", ""],
            ["Total", fmt(anova.ssTotal), fmt(anova.dfBetween + anova.dfWithin, 0), "", "", ""],
          ],
          true
        ),
        spacer(),
      ],
    },
  ];

  if (anova.tukey && anova.tukey.length > 0) {
    const tukeyTitle = `Table ${tableNumber + 2}. Tukey HSD Post-Hoc Comparisons`;
    groups.push({
      title: tukeyTitle,
      blocks: [
        tableTitle(tukeyTitle),
        makeTable(
          ["Group A", "Group B", "Mean Diff", "SE Diff", "p", "95% CI Lower", "95% CI Upper"],
          anova.tukey.map((t: any) => [t.groupA, t.groupB, fmt(t.meanDiff), fmt(t.seDiff), fmtP(t.p), fmt(t.ciLower), fmt(t.ciUpper)]),
          true
        ),
        spacer(),
      ],
    });
  }

  return groups;
}

// ---- Chi-square test of independence ----
export function buildChiSquareTables(cs: any, tableNumber: number, citationStyle?: CitationStyle): TableGroup[] {
  const makeTable = citationStyle
    ? (h: string[], r: string[][], f?: boolean) => makeTableStyled(h, r, citationStyle, f)
    : baseMakeTable;
  const crosstabTitle = `Table ${tableNumber}. Crosstabulation of ${cs.rowVariableName} by ${cs.colVariableName}`;
  const testsTitle = `Table ${tableNumber + 1}. Chi-Square Tests`;
  const symmetricTitle = `Table ${tableNumber + 2}. Symmetric Measures`;

  const crosstabHeaders = [cs.rowVariableName || "", ...cs.colLabels, "Total"];
  const crosstabRows = cs.crosstab.map((row: any) => [row.label, ...row.observed.map((o: number) => String(o)), String(row.rowTotal)]);
  crosstabRows.push(["Total", ...cs.colTotals.map((c: number) => String(c)), String(cs.grandTotal)]);

  return [
    {
      title: crosstabTitle,
      blocks: [tableTitle(crosstabTitle), makeTable(crosstabHeaders, crosstabRows, true), spacer()],
    },
    {
      title: testsTitle,
      blocks: [
        tableTitle(testsTitle),
        makeTable(
          ["Test", "Value", "df", "p"],
          [
            ["Pearson Chi-Square", fmt(cs.pearsonChiSq), fmt(cs.df, 0), fmtP(cs.pearsonP)],
            ["Likelihood Ratio", fmt(cs.likelihoodRatio), fmt(cs.df, 0), fmtP(cs.likelihoodP)],
            ["Linear-by-Linear Association", fmt(cs.linearByLinear), "1", fmtP(cs.linearP)],
            ["N of Valid Cases", String(cs.grandTotal), "", ""],
          ],
          true
        ),
        spacer(),
      ],
    },
    {
      title: symmetricTitle,
      blocks: [
        tableTitle(symmetricTitle),
        makeTable(
          ["Measure", "Value"],
          [
            ["Cramer's V", fmt(cs.cramersV)],
            ["Minimum Expected Count", fmt(cs.minExpected)],
            ["Cells with Expected Count < 5", `${cs.cellsUnderFive} of ${cs.totalCells} (${fmt(cs.pctCellsUnderFive, 1)}%)`],
          ],
          true
        ),
        spacer(),
      ],
    },
  ];
}

// ---- Kruskal-Wallis H test ----
export function buildKruskalWallisTables(kw: any, tableNumber: number, citationStyle?: CitationStyle): TableGroup[] {
  const makeTable = citationStyle
    ? (h: string[], r: string[][], f?: boolean) => makeTableStyled(h, r, citationStyle, f)
    : baseMakeTable;
  const ranksTitle = `Table ${tableNumber}. Ranks for ${kw.outcomeVariableName} by ${kw.groupVariableName}`;
  const statsTitle = `Table ${tableNumber + 1}. Kruskal-Wallis Test Statistics`;

  return [
    {
      title: ranksTitle,
      blocks: [
        tableTitle(ranksTitle),
        makeTable(
          [kw.groupVariableName, "N", "Median", "Mean Rank", "Rank Sum"],
          kw.groups.map((g: any, idx: number) => [
            kw.groupLabels?.[idx] ?? `Group ${idx + 1}`,
            String(g.n),
            fmt(g.median),
            fmt(g.meanRank, 2),
            fmt(g.rankSum, 1),
          ]),
          true
        ),
        spacer(),
      ],
    },
    {
      title: statsTitle,
      blocks: [
        tableTitle(statsTitle),
        makeTable(["N", "H (Chi-Square)", "df", "p"], [[String(kw.N), fmt(kw.h), fmt(kw.df, 0), fmtP(kw.p)]], false),
        spacer(),
      ],
    },
  ];
}
