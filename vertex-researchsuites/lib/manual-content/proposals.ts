import type { ManualContent } from "../manuals";

export const content: ManualContent = {
  intro: "A short guide to generating your five research topics, choosing one, and downloading its full proposal.",
  fee: "\u20A62,000 (paid from your Vertex wallet)",
  blocks: [
    { t: "note", kind: "warn", title: "Have everything ready before you start", text: "Have everything you need ready before you start. This allows faster processing and avoids delays or errors. You need: your institution's name, your course of study, your department, your citation style, and (optional) your research interest and specific focus." },
    { t: "p", text: "The full proposal is designed to include a background of study and research gap, problem statement, objectives, research questions, significance, theoretical framework, methodology, sampling procedure, references, and supervisor-style questions and answers." },
    { t: "h", text: "Step-by-step guide" },
    { t: "h", step: "STEP 1", text: "Open the feature" },
    { t: "p", text: "Read the feature description and check the price shown before continuing. Choose from the citation styles offered. When ready, tap Accept and continue." },
    { t: "h", step: "STEP 2", text: "Choose your research type" },
    { t: "ul", items: [
      "Pure (Basic) Research: choose this when your main aim is to understand a subject, expand knowledge or examine a theory. Example: a Mass Communication student studies how social media exposure relates to students' understanding of news credibility.",
      "Applied Research: choose this when investigating a practical problem and seeking findings that may help improve a real situation. Example: a Business Administration student investigates why student-owned businesses on campus struggle to attract customers."
    ] },
    { t: "h", step: "STEP 3", text: "Complete the research information form" },
    { t: "ul", items: [
      "Institution: enter your university or institution's name.",
      "Course of Study: enter your programme, such as Mass Communication, Economics or Computer Science.",
      "Department: enter your actual department, not just your faculty.",
      "Research Interest (optional): a broad area, such as social media use among undergraduates.",
      "Specific Focus (optional): a narrower issue, group or setting, such as Instagram advertising and purchase decisions among undergraduates.",
      "Citation Style: choose the style required by your department or supervisor."
    ] },
    { t: "h", step: "STEP 4", text: "Review your five topics" },
    { t: "p", text: "Read all five titles and descriptions. Check that each is relevant to your course and department, manageable within your time and resources, and suitable for your supervisor's requirements. Choose a topic by tapping its Get Full Proposal button." },
    { t: "h", step: "STEP 5", text: "Open and download a full proposal" },
    { t: "p", text: "Review the proposal for consistency between the title, research problem, objectives, questions, theory, methodology and references." },
    { t: "p", text: "Automatic download: on some devices or browsers, the file downloads as soon as the proposal is generated. Wait for it to finish and confirm that the file has saved." },
    { t: "p", text: "Manual download: if it does not download automatically, tap the Download button in the proposal section." },
    { t: "p", text: "On a phone, check Files or My Files and open Downloads. On a computer, check the browser's downloads list. Open the file to make sure it is complete and readable." },
    { t: "h", step: "STEP 6", text: "Return to the five topics for another proposal" },
    { t: "p", text: "After saving a proposal, tap the Back to Topics button at the top-left of the proposal page. Then tap Get Full Proposal on another topic. Save every proposal you need before you leave the feature." },
    { t: "note", kind: "warn", title: "Stay on the page while the feature is working", text: "Do not close the tab or navigate away while your topics or a proposal are being generated. Your five topics are saved automatically for 48 hours and are restored if you return to the feature, but a generation that is interrupted may not complete." },
    { t: "note", kind: "warn", title: "Academic responsibility", text: "Generated topics and proposals are research-support materials, not a substitute for your own reading, judgement or your supervisor's guidance. Verify references and factual claims, follow research ethics and your institution's rules, and revise the work to reflect your actual study." },
    { t: "h", text: "Quick checklist" },
    { t: "ul", items: [
      "I have my institution, course, department and citation style ready.",
      "I chose the research type that matches my study.",
      "I checked my entries before tapping Generate 5 Topics.",
      "I saved every proposal I need and confirmed the files opened.",
      "I stayed on the page until my results were ready."
    ] }
  ],
};
