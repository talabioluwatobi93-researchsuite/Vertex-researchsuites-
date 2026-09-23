export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { callProposalChain } from '@/lib/openrouter';

const SECTIONS = [
  { key: 'background', title: '1. Background of the Study', instruction: 'Provide detailed context for this topic, explaining the general area and why it is worth studying.' },
  { key: 'problem', title: '2. Statement of the Problem', instruction: 'Clearly articulate the specific gap or issue this study addresses.' },
  { key: 'objectives', title: '3. Objectives of the Study', instruction: 'State one general objective and 3-4 specific objectives, each briefly explained.' },
  { key: 'questions', title: '4. Research Questions', instruction: 'State 3-4 clear research questions, each with a brief explanation of what it investigates.' },
  { key: 'significance', title: '5. Significance of the Study', instruction: 'Explain who benefits from this study and how.' },
  { key: 'methodology', title: '6. Research Methodology', instruction: 'Describe the research design, population/sample, data collection method, and analysis approach in real detail.' },
  { key: 'feasibility', title: '7. Feasibility Note', instruction: 'Explain honestly why this topic is realistic for a Nigerian undergraduate/postgraduate student to complete within a typical academic timeframe, considering data access, cost, and local context.' },
  { key: 'feedback', title: "8. Supervisor's Likely Feedback", instruction: 'Write 2-3 realistic points a supervisor might push back on regarding this proposal, and suggest how the student could address each one.' },
];

function buildSectionPrompt(studentDetails: string, chosenTopic: string, researchType: string, problemStatement: string, section: { title: string; instruction: string }) {
  return `You are an experienced academic research supervisor in Nigeria, writing one section of a student's full-length research proposal.

${studentDetails}
${researchType === 'applied' ? `This is APPLIED research addressing this real-world problem: "${problemStatement || 'researcher'}".` : `This is PURE (basic) research, aimed at generating new knowledge/theory rather than solving one specific applied problem.`}

Chosen topic:
${chosenTopic}

Write ONLY the section "${section.title}".
${section.instruction}

STRICT RULES:
- Maximum 8 lines of text. Be concise and precise, not verbose.
- Write in clear, professional academic English appropriate for a Nigerian university context.
- Do NOT include the section title/heading in your output — just the body text.
- Do NOT include any preamble, introduction, or closing remarks.
- No markdown formatting, no bullet points unless the section is Research Questions or Objectives (then use plain numbered lines, no markdown symbols).`;
}

function buildReferencesPrompt(studentDetails: string, chosenTopic: string) {
  return `You are an experienced academic research supervisor in Nigeria.

${studentDetails}

Chosen topic:
${chosenTopic}

Provide a short list of 5-6 illustrative example references in APA 7th edition format relevant to this topic area.
Start your output with exactly this line: "Note: These are illustrative examples only. Verify all references independently and replace with real, current sources before submission."
Then list the 5-6 references, each on its own line, properly APA formatted.
Do not present these as verified real papers. No other commentary.`;
}

export async function POST(req: NextRequest) {
  try {
    const { institution, course, department, interest, sequence, chosenTopic, researchType, problemStatement } = await req.json();

    if (!chosenTopic) {
      return NextResponse.json({ proposal: 'No topic was provided to expand into a proposal.' }, { status: 400 });
    }

    const studentDetails = `Student details:
Institution: ${institution}
Course of study: ${course}
Department: ${department}
${interest ? `Research interest: ${interest}` : ''}
${sequence ? `Additional focus: ${sequence}` : ''}`;

    try {
      const sectionPromises = SECTIONS.map((section) =>
        callProposalChain(buildSectionPrompt(studentDetails, chosenTopic, researchType, problemStatement, section))
          .then((r) => ({ title: section.title, text: (r.content || '').trim() }))
      );
      const referencesPromise = callProposalChain(buildReferencesPrompt(studentDetails, chosenTopic))
        .then((r) => ({ title: '9. Suggested References', text: (r.content || '').trim() }));

      const results = await Promise.all([...sectionPromises, referencesPromise]);

      const proposal = results.map((r) => `${r.title}\n${r.text}`).join('\n\n');

      return NextResponse.json({ proposal });
    } catch (err: any) {
      return NextResponse.json({ proposal: 'Something went wrong generating the proposal. Please try again.', error: err.message }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ proposal: 'Something went wrong generating the proposal. Please try again.', error: error.message }, { status: 500 });
  }
}
