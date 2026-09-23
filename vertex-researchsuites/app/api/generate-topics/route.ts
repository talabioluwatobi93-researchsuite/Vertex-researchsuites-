export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { callTopicsChain } from '@/lib/openrouter';

export async function POST(req: NextRequest) {
  try {
    const { institution, course, department, interest, sequence, researchType, problemStatement, userCategory } = await req.json();

    const prompt = `You are an experienced academic research supervisor in Nigeria. A student has given you these details:
Institution: ${institution}
Course of study: ${course}
Department: ${department}
${interest ? `Research interest: ${interest}` : ''}
${sequence ? `Additional focus/interest: ${sequence}` : ''}
${researchType === 'applied' ? `This is APPLIED research, meaning it must address a specific, real-world problem. The student described the problem as: "${problemStatement || 'researcher'}". Every topic must be clearly tied to solving this problem.` : `This is PURE (basic) research, meaning it should focus on generating new knowledge or theoretical understanding rather than solving one specific practical problem.`}

Generate exactly 5 well-dated, current, and academically acceptable research topic ideas suitable for this student's field of study and institution level in Nigeria. Write in simple, clear English that a Nigerian undergraduate or postgraduate student and their supervisor can easily understand.

For EACH of the 5 topics, write ONLY:
Topic [number]: [Title]
A short 2-3 sentence summary explaining what the study would be about and why it matters.

Do not write full proposals yet — these are previews only, so the student can choose one to expand later.

Separate each topic clearly with a line of dashes (----------) between them. Do not include any preamble, introduction, or closing remarks — start directly with "Topic 1" and end after "Topic 5".`;

    let text: string;
    try {
      const result = await callTopicsChain(prompt);
      text = result.content || 'Could not generate topics at this time.';
    } catch (err: any) {
      return NextResponse.json({ topics: 'Something went wrong generating topics. Please try again.', error: err.message }, { status: 500 });
    }

    return NextResponse.json({ topics: text });
  } catch (error: any) {
    return NextResponse.json({ topics: 'Something went wrong generating topics. Please try again.', error: error.message }, { status: 500 });
  }
}
