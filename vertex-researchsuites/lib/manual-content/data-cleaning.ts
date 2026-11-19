import type { ManualContent } from "../manuals";

export const content: ManualContent = {
  intro: "A short guide to changing the word answers in your spreadsheet into numbers, ready for analysis.",
  blocks: [
    { t: "h", text: "About this feature" },
    { t: "p", text: "Questionnaires often record answers as words, such as “Daily”, “Female” or “Instagram”. Analysis needs numbers. The Quantitative Data Cleaning feature changes the word answers in your spreadsheet into numbers. The Vertex statistical engine reads your file, finds every question with word answers, gives each word option a number, shows you every change to check, and gives you a new cleaned file with a Codebook sheet listing every word and its number." },
    { t: "note", kind: "tip", title: "Your original file is safe", text: "Nothing changes until you tap Confirm and download. Blank cells stay blank, and your original file is not touched. The cleaned file is a separate copy, and a copy is also saved to your Bunker." },
    { t: "h", text: "Before you start" },
    { t: "ol", items: [
      "Your spreadsheet must be .xlsx or .xls, with one respondent per row, one question per column, and the question titles in the first row.",
      "Keep your physical questionnaire, or a copy, close by. You will use it to confirm that every number is correct."
    ] },
    { t: "h", text: "Step-by-step guide" },
    { t: "h", step: "STEP 1", text: "Upload your spreadsheet" },
    { t: "p", text: "On the Quantitative Data Cleaning page, tap Choose File under “1. Upload your Excel file” and select your file." },
    { t: "h", step: "STEP 2", text: "Type your first question" },
    { t: "p", text: "The engine shows the number of rows and columns it found (in the manual’s sample, 385 rows and 30 columns). Under “2. Type your first question”, type the name of your first question exactly as it is written in your file, then tap Find my questions. The app finds that question and every question after it." },
    { t: "h", step: "STEP 3", text: "Check your numbers" },
    { t: "p", text: "The Check your numbers page lists every question that will be changed (10 in the manual’s sample), with each word option and its number, for example “Female = 1 | Male = 2 | Prefer not to say = 3”. To correct a number, tap Change next to that question. When everything is right, tap Confirm and download. To begin again, tap Start over." },
    { t: "note", kind: "info", title: "Cross-check every question against your questionnaire", text: "The first option in your questionnaire should get 1, the second 2, and so on, in the exact order the options appear in your questionnaire. For example, if “18 to 24” is the first age option, it should be 1. If a number does not match, tap Change and correct it. Wrong numbers will give wrong results in your analysis." },
    { t: "h", step: "STEP 4", text: "Download your cleaned file" },
    { t: "p", text: "A message says “Your cleaned file is ready” and the file downloads automatically (in the manual’s sample, my analysis_coded.xlsx, with 3,850 answers changed to numbers). If it does not download, tap Download again. You can also tap Open my Bunker to open the saved copy, or Clean another file." },
    { t: "note", kind: "warn", title: "Stay on the page while the feature is working", text: "While your file is processing, do not leave the tab, minimise the app or quickly move to another part of the application. This can cause an error or interrupt the process. Wait until everything has fully loaded before you leave or log out." },

    { t: "h", text: "Before and after" },
    { t: "p", text: "The same spreadsheet before and after cleaning. Before, answers in columns such as Age, Gender, Educational qualification, Occupation and Preferred social media platform are words. After, they are numbers, and each row still belongs to the same respondent. Questions that already contain numbers stay as they are. The second sheet in the cleaned file, Codebook, records which number stands for which word." },

    { t: "h", text: "Quick checklist" },
    { t: "ul", items: [
      "My file is .xlsx or .xls, with question titles in the first row.",
      "I typed my first question exactly as it appears in my file.",
      "I checked every question against my questionnaire and used Change where needed.",
      "I stayed on the page until the cleaned file was ready.",
      "I opened my cleaned file and confirmed the Codebook sheet is there."
    ] },
    { t: "note", kind: "tip", title: "Next step", text: "You can upload the cleaned file to the Pilot Study & Reliability Test feature, which needs numerical answers." }
  ],
};
