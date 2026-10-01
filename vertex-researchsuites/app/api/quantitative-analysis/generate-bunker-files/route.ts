import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { runQuantInterpretation } from "@/lib/quantInterpret";
import { TableGroup, CitationStyle } from "@/lib/quantBunkerDocx";
import {
  buildDescriptivesTable,
  buildFrequencyTables,
  buildItemDescriptivesTables,
} from "@/lib/quantBunkerTables";
import {
  buildTTestTables,
  buildPairedTTestTable,
  buildMannWhitneyTable,
  buildWilcoxonTable,
  buildAnovaTables,
  buildChiSquareTables,
  buildKruskalWallisTables,
} from "@/lib/quantBunkerTestTables";
import {
  buildCorrelationTables,
  buildRegressionTables,
  buildModerationTables,
  buildTwoWayAnovaTables,
  buildMediationTables,
  buildLogisticTables,
} from "@/lib/quantBunkerAdvancedTables";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

// ---- Build the full ordered list of TableGroups from session.results ----
async function buildAllTableGroups(results: any, citationStyle?: CitationStyle): Promise<TableGroup[]> {
  let groups: TableGroup[] = [];
  let n = 1;

  function errorGroup(label: string, e: any): TableGroup {
    const msg = e?.message || String(e);
    console.error(`buildAllTableGroups block "${label}" FAILED:`, e);
    return {
      title: `[Table generation error: ${label}]`,
      blocks: [
        new Paragraph({
          spacing: { after: 300 },
          children: [new TextRun({ text: `TABLE GENERATION FAILED for "${label}": ${msg}`, bold: true, color: "CC0000" })],
        }),
      ],
    };
  }

  function safeBuild(label: string, fn: () => TableGroup[]) {
    try {
      const g = fn();
      groups = groups.concat(g);
      n += g.length;
    } catch (e: any) {
      groups = groups.concat([errorGroup(label, e)]);
      n += 1;
    }
  }

  async function safeBuildAsync(label: string, fn: () => Promise<TableGroup[]>) {
    try {
      const g = await fn();
      groups = groups.concat(g);
      n += g.length;
    } catch (e: any) {
      groups = groups.concat([errorGroup(label, e)]);
      n += 1;
    }
  }

  if (results.descriptives) {
    safeBuild("descriptives", () => buildDescriptivesTable(results.descriptives, n, citationStyle));
  }
  if (results.frequencyTables) {
    await safeBuildAsync("frequencyTables", () => buildFrequencyTables(results.frequencyTables, n, citationStyle));
  }
  if (results.itemDescriptives) {
    await safeBuildAsync("itemDescriptives", () => buildItemDescriptivesTables(results.itemDescriptives, n, citationStyle));
  }

  if (results.ttest) {
    safeBuild("ttest", () => buildTTestTables(results.ttest, n, citationStyle));
  }
  if (results.paired) {
    safeBuild("paired", () => buildPairedTTestTable(results.paired, n, citationStyle));
  }
  if (results.mannwhitney) {
    safeBuild("mannwhitney", () => buildMannWhitneyTable(results.mannwhitney, n, citationStyle));
  }
  if (results.wilcoxon) {
    safeBuild("wilcoxon", () => buildWilcoxonTable(results.wilcoxon, n, citationStyle));
  }
  if (results.anova) {
    safeBuild("anova", () => buildAnovaTables(results.anova, n, citationStyle));
  }
  if (results.chisquare) {
    safeBuild("chisquare", () => buildChiSquareTables(results.chisquare, n, citationStyle));
  }
  if (results.kruskalwallis) {
    safeBuild("kruskalwallis", () => buildKruskalWallisTables(results.kruskalwallis, n, citationStyle));
  }
  if (results.correlation) {
    safeBuild("correlation", () => buildCorrelationTables(results.correlation, n, citationStyle));
  }
  if (results.regression) {
    safeBuild("regression", () => buildRegressionTables(results.regression, n, citationStyle));
  }
  if (results.moderation) {
    safeBuild("moderation", () => buildModerationTables(results.moderation, n, citationStyle));
  }
  if (results.twowayanova) {
    safeBuild("twowayanova", () => buildTwoWayAnovaTables(results.twowayanova, n, citationStyle));
  }
  if (results.mediation) {
    safeBuild("mediation", () => buildMediationTables(results.mediation, n, citationStyle));
  }
  if (results.logistic) {
    safeBuild("logistic", () => buildLogisticTables(results.logistic, n, citationStyle));
  }

  return groups;
}

export async function POST(req: Request) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const { data: session, error } = await supabaseAdmin
      .from("quantitative_analysis_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error || !session || !session.results) {
      return NextResponse.json({ error: "Results not found. Run calculation first." }, { status: 404 });
    }

    // Ensure interpretation exists (reuse existing shared logic, don't duplicate)
    let interpretation = session.interpretation;
    let discussion = session.discussion;
    let tableInterpretations: Record<string, string> = {};

    if (!interpretation || !discussion) {
      const result = await runQuantInterpretation(session, session.citation_style);
      interpretation = result.interpretation;
      discussion = result.discussion;
      tableInterpretations = result.tableInterpretations;

      await supabaseAdmin
        .from("quantitative_analysis_sessions")
        .update({ interpretation, discussion, table_interpretations: tableInterpretations })
        .eq("id", sessionId);
    } else {
      // Per-table interpretations are saved when the interpretation is generated, so no AI call
      // runs here and this route cannot time out. Older sessions have none saved; their full
      // interpretation text is added to the report below so nothing is lost.
      const savedTables = (session as any).table_interpretations;
      tableInterpretations = savedTables && typeof savedTables === "object" ? savedTables : {};
    }

    const tableGroupsA = await buildAllTableGroups(session.results);
    const citationStyle = session.citation_style as CitationStyle | undefined;
    let tableGroupsB: TableGroup[];
    let tableGroupsBError: string | null = null;
    try {
      tableGroupsB = await buildAllTableGroups(session.results, citationStyle);
    } catch (e: any) {
      tableGroupsBError = e?.message || String(e);
      tableGroupsB = [];
      console.error("buildAllTableGroups (Doc B) FAILED:", e);
    }

    // ---- Doc A: raw tables only ----
    const docA = new Document({
      sections: [
        {
          children: tableGroupsA.flatMap((g) => g.blocks),
        },
      ],
    });

    // ---- Doc B: tables + interpretation interleaved ----
    const docBChildren: any[] = [];
    if (tableGroupsBError) {
      docBChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `TABLE GENERATION FAILED: ${tableGroupsBError}`,
              bold: true,
              color: "CC0000",
            }),
          ],
          spacing: { after: 300 },
        })
      );
    }
    const normTitle = (t: string) =>
      String(t || "")
        .toLowerCase()
        .replace(/^\s*table\s+(?:[0-9]+|[ivxlc]+)\b[\s.:)\-–—]*/i, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    const interpEntries = Object.entries(tableInterpretations || {}).map(([key, text]) => ({
      norm: normTitle(key),
      text: String(text || ""),
      used: false,
    }));
    const findInterp = (title: string): string | undefined => {
      const n = normTitle(title);
      if (!n) return undefined;
      let hit = interpEntries.find((e) => !e.used && e.norm === n);
      if (!hit) {
        hit = interpEntries.find(
          (e) => !e.used && n.length >= 8 && e.norm.length >= 8 && (e.norm.includes(n) || n.includes(e.norm))
        );
      }
      if (!hit) return undefined;
      hit.used = true;
      return hit.text;
    };
    for (const g of tableGroupsB) {
      docBChildren.push(...g.blocks);
      const interp = findInterp(g.title);
      if (interp) {
        docBChildren.push(
          new Paragraph({
            spacing: { after: 300 },
            children: [],
          })
        );
        for (const line of interp.split("\n")) {
          if (line.trim().length > 0) {
            docBChildren.push(new Paragraph({ text: line, spacing: { after: 120 } }));
          }
        }
      }
    }
    const unmatchedInterps = interpEntries.filter((e) => !e.used && e.text.trim().length > 0);
    if (unmatchedInterps.length > 0) {
      console.warn("Doc B: " + unmatchedInterps.length + " table interpretation(s) could not be matched to a table title");
      docBChildren.push(
        new Paragraph({ text: "Additional table interpretations", heading: "Heading1" as any, spacing: { before: 400, after: 200 } })
      );
      for (const e of unmatchedInterps) {
        for (const line of e.text.split("\n")) {
          if (line.trim().length > 0) {
            docBChildren.push(new Paragraph({ text: line, spacing: { after: 120 } }));
          }
        }
      }
    } else if (interpEntries.length === 0 && interpretation && String(interpretation).trim()) {
      docBChildren.push(
        new Paragraph({ text: "Interpretation", heading: "Heading1" as any, spacing: { before: 400, after: 200 } })
      );
      for (const line of String(interpretation).split("\n")) {
        if (line.trim().length > 0) {
          docBChildren.push(new Paragraph({ text: line, spacing: { after: 120 } }));
        }
      }
    }

    // Append overall discussion at the end of Doc B
    if (discussion) {
      docBChildren.push(new Paragraph({ text: "Discussion", heading: "Heading1" as any, spacing: { before: 400, after: 200 } }));
      for (const line of discussion.split("\n")) {
        if (line.trim().length > 0) {
          docBChildren.push(new Paragraph({ text: line, spacing: { after: 120 } }));
        }
      }
    }

    const docB = new Document({
      sections: [
        {
          children: docBChildren,
        },
      ],
    });

    const bufferA = await Packer.toBuffer(docA);
    const bufferB = await Packer.toBuffer(docB);

    const pathA = `${sessionId}/dataset-raw.docx`;
    const pathB = `${sessionId}/report-full.docx`;

    const { error: uploadErrorA } = await supabaseAdmin.storage.from("quant-bunker").upload(pathA, bufferA, { upsert: true });
    if (uploadErrorA) {
      return NextResponse.json({ error: "Could not save raw dataset file." }, { status: 500 });
    }

    const { error: uploadErrorB } = await supabaseAdmin.storage.from("quant-bunker").upload(pathB, bufferB, { upsert: true });
    if (uploadErrorB) {
      return NextResponse.json({ error: "Could not save full report file." }, { status: 500 });
    }

    return NextResponse.json({ success: true, pathA, pathB, tableGroupsBError });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Bunker file generation failed" }, { status: 500 });
  }
}
