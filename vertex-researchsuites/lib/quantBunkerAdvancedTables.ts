import { Paragraph, Table } from "docx";
import { makeTable, tableTitle, spacer, fmt, fmtP } from "./quantBunkerDocx";

// ---- Correlation matrix (Pearson, + Spearman if present) ----
export function buildCorrelationTables(corr: any, tableNumber: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  const headers = ["", ...corr.labels];
  const buildRows = (matrix: any[]) =>
    matrix.map((row: any, i: number) => [
      row.name,
      ...row.cells.map((c: any, j: number) => {
        if (i === j) return "—";
        const stars = c.p !== null && c.p < 0.001 ? "***" : c.p !== null && c.p < 0.01 ? "**" : c.p !== null && c.p < 0.05 ? "*" : "";
        return `${fmt(c.r)}${stars}`;
      }),
    ]);

  out.push(tableTitle(`Table ${tableNumber}. Pearson Correlation Matrix`));
  out.push(makeTable(headers, buildRows(corr.matrix), true));
  out.push(spacer());

  if (corr.spearmanMatrix) {
    out.push(tableTitle(`Table ${tableNumber + 1}. Spearman's Rank Correlation Matrix`));
    out.push(makeTable(headers, buildRows(corr.spearmanMatrix), true));
    out.push(spacer());
  }

  return out;
}

// ---- Linear regression ----
export function buildRegressionTables(reg: any, tableNumber: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  out.push(tableTitle(`Table ${tableNumber}. Model Summary for ${reg.dvName}`));
  out.push(
    makeTable(
      ["R", "R²", "Adjusted R²", "Std. Error"],
      [[fmt(reg.modelSummary.r), fmt(reg.modelSummary.rSquared), fmt(reg.modelSummary.adjRSquared), fmt(reg.modelSummary.stdError)]],
      false
    )
  );
  out.push(spacer());

  out.push(tableTitle(`Table ${tableNumber + 1}. ANOVA for ${reg.dvName}`));
  out.push(
    makeTable(
      ["Source", "SS", "df", "MS", "F", "p"],
      [
        ["Regression", fmt(reg.anova.regression?.ss ?? reg.anova.regression), "", "", fmt(reg.anova.F), fmtP(reg.anova.p)],
        ["Residual", fmt(reg.anova.residual?.ss ?? reg.anova.residual), "", "", "", ""],
        ["Total", fmt(reg.anova.total?.ss ?? reg.anova.total), "", "", "", ""],
      ],
      true
    )
  );
  out.push(spacer());

  out.push(tableTitle(`Table ${tableNumber + 2}. Regression Coefficients for ${reg.dvName}`));
  out.push(
    makeTable(
      ["Predictor", "B", "SE", "Beta", "t", "p"],
      reg.coefficients.map((c: any) => [c.name, fmt(c.B), fmt(c.SE), fmt(c.beta), fmt(c.t), fmtP(c.p)]),
      true
    )
  );
  out.push(spacer());

  return out;
}

// ---- Moderation analysis ----
export function buildModerationTables(mod: any, tableNumber: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  out.push(tableTitle(`Table ${tableNumber}. Model Summary for ${mod.outcomeName}`));
  out.push(
    makeTable(
      ["R", "R²", "Adjusted R²", "Std. Error"],
      [[fmt(mod.modelSummary.r), fmt(mod.modelSummary.rSquared), fmt(mod.modelSummary.adjRSquared), fmt(mod.modelSummary.stdError)]],
      false
    )
  );
  out.push(spacer());

  out.push(tableTitle(`Table ${tableNumber + 1}. Moderation Coefficients (${mod.predictorName} x ${mod.moderatorName} on ${mod.outcomeName})`));
  out.push(
    makeTable(
      ["Term", "B", "SE", "Beta", "t", "p"],
      mod.coefficients.map((c: any) => [c.name, fmt(c.B), fmt(c.SE), fmt(c.beta), fmt(c.t), fmtP(c.p)]),
      true
    )
  );
  out.push(spacer());

  return out;
}

// ---- Two-way ANOVA ----
export function buildTwoWayAnovaTables(twa: any, tableNumber: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  out.push(tableTitle(`Table ${tableNumber}. Two-Way ANOVA for ${twa.outcomeVariableName}`));
  out.push(
    makeTable(
      ["Source", "SS", "df", "MS", "F", "p"],
      twa.anovaTable.map((row: any) => [
        row.source,
        fmt(row.ss),
        fmt(row.df, 0),
        row.ms !== null && row.ms !== undefined ? fmt(row.ms) : "",
        row.F !== null && row.F !== undefined ? fmt(row.F) : "",
        row.p !== null && row.p !== undefined ? fmtP(row.p) : "",
      ]),
      true
    )
  );
  out.push(spacer());

  out.push(tableTitle(`Table ${tableNumber + 1}. Cell Statistics (${twa.factorAName} x ${twa.factorBName})`));
  out.push(
    makeTable(
      [twa.factorAName, twa.factorBName, "N", "Mean", "SD"],
      twa.cellStats.map((c: any) => [c.factorALevel, c.factorBLevel, String(c.n), fmt(c.mean), fmt(c.sd)]),
      true
    )
  );
  out.push(spacer());

  out.push(tableTitle(`Table ${tableNumber + 2}. Marginal Means for ${twa.factorAName}`));
  out.push(
    makeTable(
      [twa.factorAName, "N", "Mean", "SD"],
      twa.marginalA.map((m: any) => [m.level, String(m.n), fmt(m.mean), fmt(m.sd)]),
      true
    )
  );
  out.push(spacer());

  out.push(tableTitle(`Table ${tableNumber + 3}. Marginal Means for ${twa.factorBName}`));
  out.push(
    makeTable(
      [twa.factorBName, "N", "Mean", "SD"],
      twa.marginalB.map((m: any) => [m.level, String(m.n), fmt(m.mean), fmt(m.sd)]),
      true
    )
  );
  out.push(spacer());

  return out;
}

// ---- Mediation analysis (Sobel test) ----
export function buildMediationTables(med: any, tableNumber: number): (Paragraph | Table)[] {
  const headers = ["Path", "Coefficient", "SE", "t", "p"];
  const rows = [
    ["a (Predictor -> Mediator)", fmt(med.pathA.coefficient), fmt(med.pathA.se), fmt(med.pathA.t), fmtP(med.pathA.p)],
    ["b (Mediator -> Outcome)", fmt(med.pathB.coefficient), fmt(med.pathB.se), fmt(med.pathB.t), fmtP(med.pathB.p)],
    ["c' (Direct Effect)", fmt(med.pathCPrime.coefficient), fmt(med.pathCPrime.se), fmt(med.pathCPrime.t), fmtP(med.pathCPrime.p)],
    ["c (Total Effect)", fmt(med.totalEffect.coefficient), fmt(med.totalEffect.se), fmt(med.totalEffect.t), fmtP(med.totalEffect.p)],
  ];

  const sobelHeaders = ["Indirect Effect (a*b)", "Sobel SE", "Sobel Z", "Sobel p", "Proportion Mediated"];
  const sobelRows = [[
    fmt(med.indirectEffect),
    fmt(med.sobelSE),
    fmt(med.sobelZ),
    fmtP(med.sobelP),
    med.proportionMediated !== null ? fmt(med.proportionMediated * 100, 1) + "%" : "—",
  ]];

  return [
    tableTitle(`Table ${tableNumber}. Mediation Path Coefficients`),
    makeTable(headers, rows, true),
    spacer(),
    tableTitle(`Table ${tableNumber + 1}. Sobel Test for Indirect Effect`),
    makeTable(sobelHeaders, sobelRows, false),
    spacer(),
  ];
}

// ---- Logistic regression ----
export function buildLogisticTables(log: any, tableNumber: number): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  out.push(tableTitle(`Table ${tableNumber}. Logistic Regression Model Fit for ${log.dvName ?? ""}`));
  out.push(
    makeTable(
      ["N", "-2 Log Likelihood", "Chi-Square", "df", "p", "McFadden R²"],
      [[String(log.n), fmt(log.deviance), fmt(log.chiSq), fmt(log.df, 0), fmtP(log.p), fmt(log.mcFaddenR2)]],
      false
    )
  );
  out.push(spacer());

  out.push(tableTitle(`Table ${tableNumber + 1}. Logistic Regression Coefficients`));
  out.push(
    makeTable(
      ["Predictor", "B", "SE", "z", "p", "Odds Ratio"],
      log.coefficients.map((c: any) => [c.name, fmt(c.B), fmt(c.SE), fmt(c.z), fmtP(c.p), fmt(c.oddsRatio)]),
      true
    )
  );
  out.push(spacer());

  out.push(tableTitle(`Table ${tableNumber + 2}. Classification Table`));
  out.push(
    makeTable(
      ["", "Predicted Negative", "Predicted Positive"],
      [
        ["Actual Negative", String(log.classification.trueNeg), String(log.classification.falsePos)],
        ["Actual Positive", String(log.classification.falseNeg), String(log.classification.truePos)],
      ],
      true
    )
  );
  out.push(spacer());
  out.push(tableTitle(`Overall Accuracy: ${fmt(log.classification.accuracy * 100, 1)}%`));

  return out;
}
