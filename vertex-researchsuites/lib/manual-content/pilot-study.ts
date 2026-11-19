import type { ManualContent } from "../manuals";

export const content: ManualContent = {
  intro: "A short guide to running your pilot study, reading your Cronbach’s alpha results, and knowing what to do when a result does not pass.",
  fee: "₦1,000 (paid from your Vertex wallet)",
  blocks: [
    { t: "h", text: "About this feature" },
    { t: "p", text: "The Pilot Study & Reliability Test checks whether the questions in your questionnaire measure your topic consistently, using Cronbach’s alpha. You upload your data, tell the app which questions belong to which construct (the main idea your questions measure, such as “Perceived Credibility”), and it gives you an APA-style results table with an interpretation, downloads the report as a Word document, and saves a copy to your Bunker." },
    { t: "h", text: "Before you start" },
    { t: "note", kind: "info", title: "Your answers must be numbers, not words", text: "Your file must be .xlsx, .xls or .csv, with one respondent per row. If responses are still words (for example “Strongly Agree”), convert them first with the Quantitative Data Cleaning feature. Each word becomes the number matching its position in your questionnaire: for a five-point scale, the first option is 1 and the last is 5." },
    { t: "h", text: "Step-by-step guide" },
    { t: "h", step: "STEP 1", text: "Pay and upload" },
    { t: "p", text: "After payment, tap Choose File and select your numerical spreadsheet." },
    { t: "h", step: "STEP 2", text: "Group your items" },
    { t: "p", text: "On this page:" },
    { t: "ol", items: [
      "Set your scale, for example 1 in the first box and 5 in the last for a five-point scale.",
      "Choose your citation style.",
      "Add your constructs one at a time (type a name, tap Add, then repeat).",
      "Under every question, use the drop-down to assign its construct, and leave demographic questions (Gender, Age, Faculty, Level and so on) on Exclude (not used).",
      "Cross-check that every question sits under the right construct, then continue."
    ] },
    { t: "note", kind: "tip", title: "The “reverse-worded” box", text: "Under each assigned question is a box, This item is reverse-worded. Tick it only if the question is worded in the opposite direction to the others in its construct (for example “I do not trust influencers” among trust statements). The app then reverses its scoring (on a 1 to 5 scale, 5 becomes 1). If all questions in the construct point the same way, leave it unticked. Ticking it by mistake can lower alpha." },
    { t: "h", step: "STEP 3", text: "Continue" },
    { t: "p", text: "Tap the continue button at the bottom of the Group Your Items page. The app then shows a short Data Cleaning page. Read the options shown, then tap Continue to Analysis Engine." },
    { t: "h", step: "STEP 4", text: "Wait for your report" },
    { t: "p", text: "A page shows “Calculating reliability”, then “Finalizing your pilot study report”. Stay on the page and do not close the app." },
    { t: "h", step: "STEP 5", text: "Get your results" },
    { t: "p", text: "The Pilot Study Results page opens and the Word report should download automatically. If not, tap Download Word. To see your receipt, open Purchase History, where you can download or print it." },

    { t: "h", text: "How to read your results" },
    { t: "p", text: "The table lists each construct, its number of items (k), respondents (n) and alpha. Figures are shown in green when reliable, orange when borderline, and red when failed." },
    { t: "table", head: ["Cronbach’s alpha", "Meaning"], rows: [
      ["Above 0.90", "Excellent"],
      ["0.80 to 0.90", "Good"],
      ["0.70 to 0.80", "Acceptable"],
      ["0.60 to 0.70", "Questionable"],
      ["Below 0.60", "Poor"],
      ["Negative", "A serious problem. Check your coding and reverse-worded items."]
    ] },

    { t: "h", text: "If your report does not pass" },
    { t: "note", kind: "warn", title: "Please note", text: "A report that did not pass the Cronbach’s alpha test should not be submitted for review by your supervisor or the owner of the study. In the manual’s sample, Perceived Credibility (0.202) and Purchase Intention (-0.568) are far below 0.70. The two samples in the PDF come from different datasets, so their figures differ." },
    { t: "p", text: "Instead, adjust your questionnaire and test again:" },
    { t: "ol", items: [
      "Find the weak construct (red or orange alpha).",
      "Check your coding. Make sure words were converted to numbers in the correct order, first option to last. A wrong order can give a negative alpha.",
      "Check the reverse-worded box. Tick it for questions truly worded in the opposite direction, and untick it where it was ticked by mistake. Also confirm every question sits under the right construct.",
      "Adjust the problem question item. Reword unclear or off-topic questions, or replace them with better ones. Adding one or two well-written items can strengthen a borderline construct.",
      "Run the pilot test again with the improved items, and repeat until every construct reaches at least 0.70. Share the report with your supervisor only after it passes."
    ] },
    { t: "note", kind: "info", title: "Note on sample size", text: "A pilot study is a small test run of your questionnaire, to check that your question items are reliable and suitable for full data collection. The number of respondents can be around 40, 50 or more. There is no single fixed number, because it depends on your research work and on the decisions of the researcher or the supervisor. The reliability test can also be run on the full data collected for a quantitative analysis. Please confirm with your supervisor which option is accepted for your study." },

    { t: "h", text: "Quick checklist" },
    { t: "ul", items: [
      "My data is numerical, not words.",
      "I entered the correct first and last number of my scale.",
      "I added only my constructs, and left demographic questions unassigned.",
      "Every question is under the correct construct, and “reverse-worded” is ticked only where it applies.",
      "I stayed on the page until my results were ready."
    ] }
  ],
};
