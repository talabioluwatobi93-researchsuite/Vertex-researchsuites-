import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph } from "docx";
import { runQuantInterpretation } from "@/lib/quantInterpret";
import { TableGroup } from "@/lib/quantBunkerDocx";
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
function buildAllTableGroups(results: any): TableGroup[] {
  let groups: TableGroup[] = [];
  let n = 1;

  // Always-present blocks
  if (results.descriptives) {
    const g = buildDescriptivesTable(results.descriptives, n);
    groups = groups.concat(g);
    n += g.length;
  }
  if (results.frequencyTables) {
    const g = buildFrequencyTables(results.frequencyTables, n);
    groups = groups.concat(g);
    n += g.length;
  }
  if (results.itemDescriptives) {
    const g = buildItemDescriptivesTables(results.itemDescriptives, n);
    groups = groups.concat(g);
    n += g.length;
  }

  // Mutually-exclusive test type (only one should be populated)
  if (results.ttest) {
    const g = buildTTestTables(results.ttest, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.paired) {
    const g = buildPairedTTestTable(results.paired, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.mannwhitney) {
    const g = buildMannWhitneyTable(results.mannwhitney, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.wilcoxon) {
    const g = buildWilcoxonTable(results.wilcoxon, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.anova) {
    const g = buildAnovaTables(results.anova, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.chisquare) {
    const g = buildChiSquareTables(results.chisquare, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.kruskalwallis) {
    const g = buildKruskalWallisTables(results.kruskalwallis, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.correlation) {
    const g = buildCorrelationTables(results.correlation, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.regression) {
    const g = buildRegressionTables(results.regression, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.moderation) {
    const g = buildModerationTables(results.moderation, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.twowayanova) {
    const g = buildTwoWayAnovaTables(results.twowayanova, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.mediation) {
    const g = buildMediationTables(results.mediation, n);
    groups = groups.concat(g);
    n += g.length;
  } else if (results.logistic) {
    const g = buildLogisticTables(results.logistic, n);
    groups = groups.concat(g);
    n += g.length;
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
      const result = await runQuantInterpretation(session);
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
      const result = await runQuantInterpretation(session);
      tableInterpretations = result.tableInterpretations;
    }

    const tableGroups = buildAllTableGroups(session.results);

    // ---- Doc A: raw tables only ----
    const docA = new Document({
      sections: [
        {
          children: tableGroups.flatMap((g) => g.blocks),
        },
      ],
    });

    // ---- Doc B: tables + interpretation interleaved ----
    const docBChildren: any[] = [];
    for (const g of tableGroups) {
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

    return NextResponse.json({ success: true, pathA, pathB });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Bunker file generation failed" }, { status: 500 });
  }
}
