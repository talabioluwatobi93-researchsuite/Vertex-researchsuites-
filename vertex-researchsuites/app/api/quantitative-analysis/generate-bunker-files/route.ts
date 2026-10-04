export const maxDuration = 60;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { runQuantInterpretation } from "@/lib/quantInterpret";
import { callQuantInterpretChain } from "@/lib/openrouter";
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
      g.forEach((x: any, i: number) => { x.source = label; x.srcIndex = i; });
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
      g.forEach((x: any, i: number) => { x.source = label; x.srcIndex = i; });
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
    // PHASE7E3: extra moderation runs (Run 2, Run 3) in the report, each with its own tables
    if (Array.isArray(results.moderation_runs)) {
      results.moderation_runs.forEach((mr: any) => {
        safeBuild("moderation run " + mr.run, () => buildModerationTables({ ...mr, outcomeName: mr.outcomeName + " (Run " + mr.run + ", moderator " + mr.moderatorName + ")" }, n, citationStyle));
      });
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
    const startedAt = Date.now();
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
    const assigned = new Map<number, string>();
    tableGroupsB.forEach((g, idx) => {
      const n = normTitle(g.title);
      if (!n) return;
      const hit = interpEntries.find((e) => !e.used && e.norm === n);
      if (hit) {
        hit.used = true;
        assigned.set(idx, hit.text);
      }
    });
    tableGroupsB.forEach((g, idx) => {
      if (assigned.has(idx)) return;
      const n = normTitle(g.title);
      if (n.length < 8) return;
      const cands = interpEntries.filter(
        (e) => !e.used && e.norm.length >= 8 && (e.norm.includes(n) || n.includes(e.norm))
      );
      if (cands.length === 1) {
        cands[0].used = true;
        assigned.set(idx, cands[0].text);
      }
    });
    const untitled = tableGroupsB.filter((_, idx) => !assigned.has(idx)).map((g) => g.title);
    if (untitled.length > 0) console.warn("Doc B: tables without a matched interpretation:", JSON.stringify(untitled));
    // ---- Phase 3 guarantee: an interpretation under EVERY table, keyed by position not title ----
      {
        const missingIdx: number[] = [];
        tableGroupsB.forEach((g: any, idx: number) => {
          if (!assigned.has(idx) && g && g.source) missingIdx.push(idx);
        });
        if (missingIdx.length > 0) {
          const results: any = session.results || {};
          const fresh = new Map<number, string>();
          const hypCtx = JSON.stringify(session.research_framework?.hypotheses || []).slice(0, 1500);
          const conCtx = JSON.stringify((session.constructs || []).map((c: any) => ({
            name: c.name, role: c.role, scaleMin: c.scaleMin, scaleMax: c.scaleMax,
            preset: c.presetLabel, reversed: c.scaleReversed,
          }))).slice(0, 1500);

          const itemFor = (idx: number) => {
            const g: any = tableGroupsB[idx];
            let d: any = results[g.source];
            if ((g.source === "frequencyTables" || g.source === "itemDescriptives") && Array.isArray(d)) d = d[g.srcIndex];
            let str = "";
            try { str = JSON.stringify(d) || ""; } catch (e) { str = ""; }
            return { id: idx, title: g.title, data: str.length > 7000 ? str.slice(0, 7000) : str };
          };

          const runBatch = async (ids: number[]) => {
            const elapsed = Date.now() - startedAt;
            const timeoutMs = Math.max(5000, Math.min(24000, 55000 - elapsed));
            const items = ids.map(itemFor);
            const prompt =
              "You write the interpretation that appears directly beneath each statistical table in a Chapter 4 results report for an undergraduate research submission.\n\n" +
              "TABLES (each has an id, a title, and the underlying SPSS-style data for that table):\n" + JSON.stringify(items) + "\n\n" +
              "Research hypotheses (context only): " + hypCtx + "\n" +
              "Construct and scale information (context only): " + conCtx + "\n\n" +
              "TASK: Write ONE separate interpretation for EVERY table id listed. Never skip an id and never merge tables.\n" +
              "RULES:\n" +
              "1. Strict third-person academic English. Never use I, we or our.\n" +
              "2. Maximum 6 lines per table. Plain text only, no markdown, no bullet symbols.\n" +
              "3. Use ONLY numbers present in that table's data. Never invent values.\n" +
              "4. Frequency tables: state the largest and smallest categories with their counts and percentages.\n" +
              "5. Item descriptives: describe the mean pattern across items in terms of the scale meaning, and name the highest and lowest items.\n" +
              "6. Inferential tables: state the key statistic, its p-value, direction and strength, and what it means for the variables.\n" +
              "7. Do not restate the table title.\n\n" +
              'Respond ONLY with valid JSON, no preamble, no markdown fences: {"interpretations":[{"id":0,"interpretation":"string"}]}';
            const res: any = await Promise.race([
              callQuantInterpretChain(prompt),
              new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
            ]);
            const raw = String(res?.content || "").replace(/```json/g, "").replace(/```/g, "").trim();
            const parsed = JSON.parse(raw);
            for (const r of parsed?.interpretations || []) {
              const id = Number(r?.id);
              const text = String(r?.interpretation || "").trim();
              if (ids.includes(id) && text) fresh.set(id, text);
            }
          };

          for (let pass = 0; pass < 2; pass++) {
            const todo = missingIdx.filter((i) => !fresh.has(i));
            if (todo.length === 0) break;
            const size = pass === 0 ? 5 : 2;
            const batches: number[][] = [];
            for (let i = 0; i < todo.length; i += size) batches.push(todo.slice(i, i + size));
            for (let i = 0; i < batches.length; i += 4) {
              if (Date.now() - startedAt > 28000) break;
              await Promise.all(
                batches.slice(i, i + 4).map((b) =>
                  runBatch(b).catch((e: any) => console.error("Phase3 interpretation batch failed:", e?.message || e))
                )
              );
            }
          }

          const toSave: Record<string, string> = {};
          let failed = 0;
          for (const idx of missingIdx) {
            const t = fresh.get(idx);
            if (t) {
              assigned.set(idx, t);
              toSave[(tableGroupsB[idx] as any).title] = t;
            } else {
              failed++;
              assigned.set(idx, "[Interpretation for this table could not be completed within the time limit. Please download again to complete it.]");
            }
          }
          if (Object.keys(toSave).length > 0) {
            try {
              const merged = { ...(tableInterpretations || {}), ...toSave };
              await supabaseAdmin
                .from("quantitative_analysis_sessions")
                .update({ table_interpretations: merged })
                .eq("id", sessionId);
            } catch (e) {
              console.error("Phase3 could not save interpretations:", e);
            }
          }
          console.warn("Phase 3 guarantee: generated " + (missingIdx.length - failed) + " of " + missingIdx.length + " missing table interpretations.");
          if (failed === 0) {
            interpEntries.forEach((e) => { if (!e.used) e.used = true; });
          }
        }
      }
      const findInterp = (idx: number): string | undefined => assigned.get(idx);
    for (let gi = 0; gi < tableGroupsB.length; gi++) {
      const g = tableGroupsB[gi];
      docBChildren.push(...g.blocks);
      const interp = findInterp(gi);
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
      console.warn("Doc B: " + unmatchedInterps.length + " table interpretation(s) could not be matched to a table title:", JSON.stringify(unmatchedInterps.map((e) => e.norm)));
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
