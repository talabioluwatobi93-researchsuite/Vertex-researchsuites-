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
        .update({ interpretation, discussion })
        .eq("id", sessionId);
    } else {
      // interpretation/discussion already existed in DB, but tableInterpretations
      // is not persisted anywhere - must recompute it to get per-table splits for Doc B.
      const result = await runQuantInterpretation(session, session.citation_style);
      tableInterpretations = result.tableInterpretations;
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
    for (const g of tableGroupsB) {
      docBChildren.push(...g.blocks);
      const interp = tableInterpretations[g.title];
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
