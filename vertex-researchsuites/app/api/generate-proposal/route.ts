import { NextRequest, NextResponse } from 'next/server';
import { callProposalChain } from '@/lib/openrouter';
import { CITATION_STYLES } from '@/lib/citationStyles';
import { searchVerifiedRefs, formatReference, VerifiedRef } from '@/lib/citationVerify';

export const maxDuration = 60;

interface Section { title: string; instruction: string; maxLines: number; listOk: boolean }

const SECTIONS: Section[] = [
  { title: '1. Background of the Study', maxLines: 8, listOk: false, instruction: 'Provide detailed context for this topic, explaining the general area and why it is worth studying.' },
  { title: '2. Statement of the Problem', maxLines: 8, listOk: false, instruction: 'Clearly articulate the specific gap or issue this study addresses.' },
  { title: '3. Objectives of the Study', maxLines: 8, listOk: true, instruction: 'State one general objective and 3-4 specific objectives, each briefly explained.' },
  { title: '4. Research Questions', maxLines: 8, listOk: true, instruction: 'State 3-4 clear research questions, each with a brief explanation of what it investigates.' },
  { title: '5. Significance of the Study', maxLines: 8, listOk: false, instruction: 'Explain who benefits from this study and how.' },
  {
    title: '6. Theoretical Framework', maxLines: 20, listOk: true,
    instruction: 'Name exactly TWO theories that support and justify this course of study and this topic. For each theory: name it and the scholar who proposed it, explain its core ideas in concrete, vivid detail, give one specific realistic example from this topic\'s own setting showing the theory at work, and state exactly how it supports and justifies studying this topic. Label them "Theory 1:" and "Theory 2:". Do not cite any article, book or publication year, and do not write a reference list.',
  },
  { title: '7. Research Methodology', maxLines: 10, listOk: false, instruction: 'Describe the research design, population/sample, data collection method, and analysis approach in real detail.' },
  {
    title: '8. Sampling Procedure', maxLines: 24, listOk: true,
    instruction: 'State the research design to be employed and how it is proposed to be carried out. Present every stage clearly, one stage per line labelled "Stage 1:", "Stage 2:" and so on (for example target population, sampling frame, sampling technique, sample size determination, selection and recruitment, data collection, data handling), and for each stage give the reasoning behind the procedural choice. Keep it realistic for a Nigerian student project.',
  },
];

function buildSectionPrompt(studentDetails: string, chosenTopic: string, researchType: string, problemStatement: string, s: Section) {
  return `You are an experienced academic research supervisor in Nigeria, writing one section of a student's full-length research proposal.

${studentDetails}
${researchType === 'applied' ? `This is APPLIED research addressing this real-world problem: "${problemStatement || 'researcher'}".` : `This is PURE (basic) research, aimed at generating new knowledge/theory rather than solving one specific applied problem.`}

Chosen topic:
${chosenTopic}

Write ONLY the section "${s.title}".
${s.instruction}

STRICT RULES:
- Maximum ${s.maxLines} lines. Be precise, not verbose.
- Write in clear, professional academic English appropriate for a Nigerian university context.
- Do NOT include the section title/heading in your output — just the body text.
- Do NOT include any preamble, introduction, or closing remarks.
- ${s.listOk ? 'Use plain numbered or labelled lines only, with no markdown symbols.' : 'No markdown formatting and no bullet points.'}`;
}

function buildFeedbackPrompt(studentDetails: string, chosenTopic: string, draft: string) {
  return `You are an experienced academic research supervisor in Nigeria reviewing a student's draft research proposal.

${studentDetails}

Chosen topic:
${chosenTopic}

Draft proposal:
${draft.slice(0, 12000)}

Task: go through the proposal section by section (Background, Statement of the Problem, Objectives, Research Questions, Significance, Theoretical Framework, Methodology, Sampling Procedure). For each section, state the 1-2 most important questions a real supervisor would likely raise from THAT section. Present each question clearly, then answer it so the student can defend their work.

FORMAT (plain text, no markdown symbols):
Section: [section name]
Question: [the question]
Answer: [a direct, specific answer grounded in what the draft actually says]

RULES:
- Ground every question and answer in the draft above.
- Do not cite any article, book, author or publication year.
- No preamble and no closing remarks.`;
}

const plain = (s: string) =>
  s.replace(/\*\*|__|`/g, '').replace(/^#{1,6}\s*/gm, '').replace(/^\s*\*\s+/gm, '').trim();

function topicTitle(raw: string): string {
  const m = raw.match(/Topic\s*\d+\s*:\s*(.+)/i);
  return (m ? m[1] : raw.split('\n')[0]).replace(/[*#]/g, '').trim();
}

const NUMBERED = new Set(['Vancouver', 'IEEE', 'AMA']);

function buildReferenceItems(refs: VerifiedRef[], style: string): { text: string; url: string }[] {
  const list = NUMBERED.has(style)
    ? refs
    : [...refs].sort((a, b) => a.authors[0].family.localeCompare(b.authors[0].family));
  return list.map((r, i) => {
    const t = formatReference(r, style).replace(/\*/g, '');
    const text = style === 'IEEE' ? `[${i + 1}] ${t}` : NUMBERED.has(style) ? `${i + 1}. ${t}` : t;
    return { text, url: r.url };
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { institution, course, department, interest, sequence, researchType, problemStatement, chosenTopic, part, draft } = body;

    if (!chosenTopic) {
      return NextResponse.json({ proposal: 'No topic was provided to expand into a proposal.' }, { status: 400 });
    }

    const style = CITATION_STYLES.some((s) => s.value === body.citationStyle) ? String(body.citationStyle) : 'APA7';
    const topicRaw = String(chosenTopic);
    const topic = topicTitle(topicRaw);

    const studentDetails = `Student details:
Institution: ${institution}
Course of study: ${course}
Department: ${department}
${interest ? `Research interest: ${interest}` : ''}
${sequence ? `Additional focus: ${sequence}` : ''}`;

    try {
      if (part === 'feedback') {
        if (!draft) return NextResponse.json({ feedback: 'No draft was provided.' }, { status: 400 });
        const r = await callProposalChain(buildFeedbackPrompt(studentDetails, topicRaw, String(draft)));
        const text = plain(r.content || '');
        if (!text) throw new Error('Supervisor feedback came back empty');
        return NextResponse.json({ feedback: `10. Supervisor-Style Feedback\n${text}` });
      }

      const [sections, found] = await Promise.all([
        Promise.all(
          SECTIONS.map(async (s) => {
            const r = await callProposalChain(buildSectionPrompt(studentDetails, topicRaw, researchType, problemStatement, s));
            const text = plain(r.content || '');
            if (!text) throw new Error(`Section "${s.title}" came back empty`);
            return `${s.title}\n${text}`;
          })
        ),
        searchVerifiedRefs(topic, 6),
      ]);

      const yr = new Date().getFullYear();
      const items = buildReferenceItems(found.refs, style);
      let note: string;
      if (items.length === 0) {
        note = `No verifiable references could be retrieved for this topic right now. None have been invented. Please search for ${found.fromYear}-${yr} sources yourself, or try again later.`;
      } else {
        note = `Each reference below was retrieved from the CrossRef/OpenAlex scholarly registries (DOI-linked, published ${found.fromYear}-${yr}). Open each link to confirm it fits your study before citing it.`;
        if (found.shortfall > 0) {
          note += ` Only ${items.length} verified references were found for this topic in that window; please add more yourself. None have been invented to fill the gap.`;
        }
      }
      const refBlock = `9. References\n${note}${items.length ? `\n\n${items.map((i) => i.text).join('\n\n')}` : ''}`;
      const proposal = `${topic}\n\n${sections.join('\n\n')}\n\n${refBlock}`;

      return NextResponse.json({
        proposal,
        references: items,
        topicTitle: topic,
        citationStyle: style,
        shortfall: found.shortfall,
      });
    } catch (err: any) {
      return NextResponse.json({ proposal: 'Something went wrong generating the proposal. Please try again.', error: err.message }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ proposal: 'Something went wrong generating the proposal. Please try again.', error: error.message }, { status: 500 });
  }
}
