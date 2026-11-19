import type { ManualContent } from "../manuals";

export const content: ManualContent = {
  intro: "Upload your cleaned data and receive a full analysis written for your project: tables, charts, plain-language interpretations, Chapter 5 and defense questions.",
  fee: "₦10,000 (Chapter 5 and the defense questions are free)",
  blocks: [
    { t: "h", text: "About this feature" },
    { t: "p", text: "Quantitative Data Analysis turns your cleaned survey spreadsheet into a complete analysis document. The app guides you step by step. You choose the analysis, and you always see the fee before anything runs." },
    { t: "h", text: "What you get" },
    { t: "ul", items: [
      "A full, detailed document with tables and a plain-language interpretation of each table, with discussion and conclusions.",
      "Tables with mean, standard deviation and percentages, plus bar and pie charts.",
      "A choice of analysis types (the app lists 14 options, from Descriptive Statistics to Regression and Mediation).",
      "Chapter 5 (summary, conclusion, limitations, recommendations) and likely defense questions with answers."
    ] },
    { t: "h", text: "Before you start" },
    { t: "p", text: "Have these ready before you open the feature. It makes the analysis faster and avoids mistakes." },
    { t: "ol", items: [
      "The topic of your project.",
      "Your spreadsheet, already cleaned and converted to numbers (use the Quantitative Data Cleaning feature first).",
      "Your questionnaire: a link is preferred (for example, the Google Form link you shared for responses), or a PDF/Word file. You need only one of the two.",
      "Your Methodology (Chapter 3) in document format. This is optional on the screen, but it helps.",
      "Your research questions, objectives and hypothesis. You must provide at least two of these three.",
      "A short summary of your problem statement, methodology and limitations. You will need it near the end (Step 13).",
      "Your original questionnaire on standby for cross-checking. If you have only one device, print it or open it on another device."
    ] },
    { t: "note", kind: "info", title: "Decide first, then start", text: "The app suggests analyses, but you are responsible for choosing them. Before you begin, know your construct (the idea you are measuring), your dependent variable (the outcome you want to explain) and your independent variables (the factors you think influence it). Talk to your supervisor if you are not sure." },
    { t: "h", text: "Words you will see" },
    { t: "table", head: ["Word", "Meaning"], rows: [
      ["Construct", "An idea measured by several questions, e.g. “Perceived Credibility”."],
      ["IV (independent variable)", "The factor you think influences something, e.g. Influencer Exposure."],
      ["DV (dependent variable)", "The outcome you think is affected, e.g. Purchase Intention."],
      ["Cronbach’s alpha", "A reliability score from your pilot study. 0.70 or higher is the usual minimum."],
      ["p-value", "Shows whether a result is statistically significant. p < .05 is usually considered significant."]
    ] },
    { t: "note", kind: "warn", title: "IMPORTANT: Processing steps", text: "While the app is working, do not leave the tab, do not minimise the app, and be patient. Use a strong internet connection. Leaving the page can stop your analysis." },

    { t: "h", step: "STEP 1", text: "Accept the price" },
    { t: "p", text: "Open Quantitative Data Analysis. Read the “What you get” screen. It shows the price (₦10,000) and your balance. Tap Accept and continue." },

    { t: "h", step: "STEP 2", text: "Upload your data and tell the app about your research" },
    { t: "p", text: "This is “Step 1 of 10” in the app. Fill in each part carefully:" },
    { t: "ul", items: [
      "Choose Data File: select your cleaned spreadsheet.",
      "Questionnaire (required): paste the link or tap Upload Questionnaire. Only one is needed. A link is read faster.",
      "Chapter 3 (Methodology): optional. Paste a link or upload the file.",
      "What do you want to analyze?: write one short sentence.",
      "Research Framework: type your topic, research questions, hypotheses and objectives. Put each question or objective on its own line.",
      "Tap Continue."
    ] },
    { t: "p", text: "Response rate screen. The app then asks how your questionnaire was given out:" },
    { t: "ul", items: [
      "Choose the Method of administration (e.g. Physical copies or Google Forms).",
      "Type the location and the count given out. Tap + Add another location if you used more than one. The total is added for you.",
      "Type the Total number returned. The app calculates your response rate (for example, 432 given out and 401 returned = 92.8%).",
      "Tap Continue."
    ] },

    { t: "h", step: "STEP 3", text: "Confirm your data (Step 2 of 10)" },
    { t: "p", text: "The app shows what it found in your file: columns detected and respondent rows detected. Now confirm these against your questionnaire:" },
    { t: "ul", items: [
      "Total questions in your questionnaire: should match the columns detected.",
      "Number of sections: type how many parts your questionnaire has (for example, 4 = Demographics plus three constructs).",
      "Expected number of respondents: should match the rows detected.",
      "Tick “I confirm these numbers are correct…” and tap Continue."
    ] },
    { t: "note", kind: "warn", title: "If the numbers do not match", text: "Stop and check your spreadsheet before you continue. A mismatch usually means a column is missing or an extra column is included." },

    { t: "h", step: "STEP 4", text: "Group your items: add your sections" },
    { t: "p", text: "The next page is called Group Your Items (Steps 4, 5 and 6 of 10 in the app). First, tell the app the names of your sections." },
    { t: "ol", items: [
      "Type Demographics in the box.",
      "Tap the box “This is a Demographic section” so that it turns blue. Then tap Add.",
      "Type your first construct (for example, “Influencer Exposure”) and tap Add. Do not tick the box again. The box is only for the demographics section.",
      "Repeat for every construct or variable section in your questionnaire."
    ] },
    { t: "p", text: "The counter under the box shows how many constructs and demographic sections you have added. Check that it is correct." },
    { t: "note", kind: "warn", title: "Common mistake", text: "Tick the demographic box only once, for the Demographics section. If you tick it for a construct, that construct will be left out of your IV/DV analysis." },

    { t: "h", step: "STEP 5", text: "Set the first and last question, the scale, and your model" },
    { t: "p", text: "After you add your sections, each one appears under “Set each section’s range & scale”." },
    { t: "p", text: "A. Choose the first and last question" },
    { t: "ul", items: [
      "Tap the left box under the section name. A drop-down list of your questionnaire items opens. Pick the first question of that section.",
      "Tap the box on the right and pick the last question of that section.",
      "The app shows “… questions included”. Check that this number matches your questionnaire.",
      "Do the same for every section, in order."
    ] },
    { t: "p", text: "B. Choose the scale (constructs only)" },
    { t: "ul", items: [
      "Under Scale used, pick the scale you used, for example 5-point: Strongly Disagree → Strongly Agree. Demographics do not need a scale.",
      "If your scale is not listed, choose custom and type your own options.",
      "Advanced: reverse-code / reverse-worded items are optional. Skip them if you are unsure."
    ] },
    { t: "note", kind: "tip", title: "No worries if the scale is missing", text: "You can still fix scale labels later on the Data Cleaning page (Step 9)." },
    { t: "p", text: "C. Declare your research model" },
    { t: "ul", items: [
      "Under Independent Variable(s), tick the constructs that influence the outcome.",
      "Under Dependent Variable(s), tick the outcome construct.",
      "A construct should be either an IV or a DV, not both.",
      "Wait while the button shows “Saving…”."
    ] },

    { t: "h", step: "STEP 6", text: "Enter your reliability scores (Cronbach’s alpha)" },
    { t: "p", text: "This page is called Reliability of Your Research Instrument. It lists each of your constructs." },
    { t: "ul", items: [
      "Type the Cronbach’s alpha you got for each construct in your pilot study (for example, 0.84, 0.89 and 0.78).",
      "Check that every score is 0.70 or higher, then tap Continue.",
      "Your scores appear in the first table of your report. A construct below 0.70 should be read with caution."
    ] },
    { t: "note", kind: "info", title: "Do not have a pilot study yet?", text: "Run the Pilot Study & Reliability Test feature first, then come back with your scores. Tapping Skip this step still produces your results, but your reliability scores and their interpretation will not be included. We recommend that you do not skip." },

    { t: "h", step: "STEP 7", text: "Choose your analysis (Step 8 of 10)" },
    { t: "p", text: "This page lists every analysis the app offers. At the top, a box says “Which test should you run? Analyzing your data and research plan…”. The app is studying your information and will suggest a test. Wait a moment, then read the suggestion." },
    { t: "p", text: "How to use this page:" },
    { t: "ol", items: [
      "Decide with your supervisor first. The app only gives a suggestion. You must know what you want to find out, which variable is the main (independent) one, and which is the dependent one. This also helps you avoid multicollinearity (when your independent variables are too closely related to each other).",
      "To use the suggestion, tap Use this test. If it does not suit you, tap Choose manually below.",
      "Tick one or more tests. You may choose more than one. Each test has a short description to help you.",
      "When you tick Correlation or Regression, extra choices open under it (see below).",
      "A greyed-out test, such as Logistic Regression, is not available for your data. It needs an outcome with exactly two answers (for example, Pass/Fail).",
      "Scroll to the bottom and tap Continue to Section Mapping."
    ] },
    { t: "note", kind: "warn", title: "The analysis you choose decides your results", text: "Choose carefully. If you are not sure which test fits your objectives and hypothesis, ask your supervisor before you tap Continue." },
    { t: "p", text: "What each analysis means:" },
    { t: "table", head: ["Analysis", "What it does, in plain English", "Example"], rows: [
      ["Descriptive Statistics", "Summarises each construct with the mean, standard deviation, minimum and maximum. The foundation of every study.", "The average Credibility score is 3.67."],
      ["Correlation", "Measures how strong the link is between two or more constructs, and whether it goes up or down together.", "Do students who see more influencer posts also intend to buy more?"],
      ["Regression", "Tests how well your IV(s) predict your DV. Gives four tables.", "Does Credibility predict Purchase Intention?"],
      ["Independent Samples T-Test", "Compares the average of exactly two groups.", "Male vs Female"],
      ["One-Way ANOVA", "Compares averages across three or more groups (with Tukey post-hoc test).", "Year 1 vs Year 2 vs Year 3"],
      ["Chi-Square Test", "Tests whether two category variables are related.", "Gender vs preferred study mode"],
      ["Paired-Samples T-Test", "Compares two measurements from the same people.", "Score before and after a course"],
      ["Mann-Whitney U", "Like the T-Test, for two groups, but for ranked or skewed data.", "Two groups, data not normal"],
      ["Wilcoxon Signed-Rank", "Like the Paired T-Test, for data that is not normal.", "Before/after, data not normal"],
      ["Kruskal-Wallis", "Like One-Way ANOVA, for three or more groups with data that is not normal.", "Three groups, data not normal"],
      ["Two-Way ANOVA", "Tests the effect of two grouping variables at once, and whether they interact.", "Gender AND Year Level on Exam Score"],
      ["Mediation (Sobel)", "Tests whether A affects B through a third, in-between variable.", "Does Study Habits explain why Motivation affects Grades?"],
      ["Moderation", "Tests whether the link between two variables changes depending on a third variable.", "Is the Motivation-Grades link stronger for older students?"],
      ["Logistic Regression", "Predicts an outcome with exactly two answers. Greyed out unless your data allows it.", "Pass or Fail"]
    ] },
    { t: "p", text: "Which test do I need?" },
    { t: "ul", items: [
      "Describe your sample: Descriptive Statistics.",
      "See if constructs are related: Correlation.",
      "Test if one thing predicts another: Regression.",
      "Compare two groups: T-Test (or Mann-Whitney U if data is not normal).",
      "Compare three or more groups: One-Way ANOVA (or Kruskal-Wallis).",
      "Same people measured twice: Paired T-Test (or Wilcoxon).",
      "Two category questions: Chi-Square."
    ] },
    { t: "p", text: "Correlation options:" },
    { t: "ul", items: [
      "Tick at least 2 variables under Independent, Dependent or both. Leave all unticked to use every variable.",
      "Pearson runs by default. Turn on Spearman only if your data is ranked, or you need a non-parametric test.",
      "Significance test: keep Two-tailed (default) if you are not sure.",
      "Optional extras: partial, item-level and point-biserial / phi correlation."
    ] },
    { t: "p", text: "Regression options:" },
    { t: "ul", items: [
      "Tick your independent variables (left) and your dependent variable (right).",
      "Ask yourself: what do I think changes what? The thing that changes is the dependent variable.",
      "Each dependent variable runs as its own regression, up to 5 runs. Tap + Add another regression run for more. Tick Use the same independent variables as Run 1 to save time, or tap Remove this run.",
      "Within one run, keep each variable either dependent or independent."
    ] },

    { t: "h", step: "STEP 8", text: "Organize your sections" },
    { t: "p", text: "The page Organize Your Sections groups your constructs by type: Section A (Demographic Profile), Section B (Independent Variables) and Section C (Dependent Variable). It also shows how many items are in each." },
    { t: "ul", items: [
      "Check that every section and item count is correct.",
      "You may rename a section title. This is how it will appear in your final report.",
      "When you are satisfied, tap Continue to Data Cleaning."
    ] },

    { t: "h", step: "STEP 9", text: "Data cleaning: check your codes, then decide what to keep" },
    { t: "note", kind: "warn", title: "Wait 30 seconds. Do not touch anything.", text: "When the Data Cleaning page opens, the app is reading all your questions and their values. Do not tap or scroll for about 30 seconds until the page is ready. The page says: “Review these before your analysis runs. You’re always in control — nothing is auto-corrected.”" },
    { t: "p", text: "A. Demographic coding. Some demographic answers are saved as numbers. The app lists what each number means, for example 1 → Male, 2 → Female. Read each list and compare it with your questionnaire." },
    { t: "ul", items: [
      "If a question has numbers with no meaning beside them (for example, Faculty 1 to 17), the app could not find them. You must type them yourself.",
      "Scroll down to the bottom and tap “Let me edit this myself”. Boxes will open next to each number.",
      "Type what each number means, exactly as in your questionnaire (for example, 1 = Agriculture). Use your original questionnaire to check the order.",
      "Tap Done editing when finished."
    ] },
    { t: "p", text: "B. Questionnaire items (construct questions). Under each construct, the app shows every question. For each one you see the spreadsheet column name, the question wording and what each number means (for example, 1 = Never … 5 = Always)." },
    { t: "ul", items: [
      "Check that the wording and number meanings are exactly as in your questionnaire.",
      "If anything is wrong or missing, tap the box and type the correct text directly. Your edits are used when you continue.",
      "If you see “not in data” beside a number, no respondent in your spreadsheet chose that number. This is normal. Leave it as it is.",
      "Tap Save item edits after changing anything."
    ] },
    { t: "note", kind: "info", title: "Tip: typing mistakes", text: "If a question shows a typing mistake, it came from your own questionnaire. The app does not change it. You may correct the wording in the box if you want it fixed in your report." },
    { t: "p", text: "C. Choose how to finish the questions" },
    { t: "ul", items: [
      "Looks correct, continue: use this if everything above is right.",
      "Let me edit this myself: opens the boxes so you can change codes. Tap Done editing afterwards.",
      "Save item edits: saves changes made to question wording or number meanings."
    ] },
    { t: "p", text: "D. Missing values. Each section shows “0 rows affected” when nothing is missing. If some answers are empty, choose:" },
    { t: "ul", items: [
      "Exclude Row: removes the whole respondent from the analysis.",
      "Exclude Item Only: ignores only the empty answer and keeps the rest of that respondent’s answers."
    ] },
    { t: "p", text: "E. Duplicate rows. The app shows how many duplicate rows it found (for example, 20). Choose Exclude Duplicates or Keep Duplicates. Remove only rows that are truly repeated submissions." },
    { t: "p", text: "F. Straight-lining / low-effort responses. These are respondents who gave the exact same answer to every question in a section. It can be a sign of low effort. Choose Exclude These or Keep Anyway." },
    { t: "p", text: "G. Charts and citation style. Chart Types to Include: Bar Charts and Pie Charts are already picked for you. APA style: tap the drop-down and select the citation style your school uses. When everything is correct, tap Continue to Analysis Engine." },
    { t: "note", kind: "warn", title: "Think before you exclude", text: "In this example the app flagged 377 of 401 respondents as straight-lining. If a large share of your sample is flagged, your sample could shrink a lot if you exclude them. Check your data, and ask your supervisor before you tap Exclude." },
    { t: "note", kind: "tip", title: "Nothing changes without your choice", text: "The app does not correct anything by itself. You decide what to keep and what to exclude. The results page tells you how many rows were excluded." },

    { t: "h", step: "STEP 10", text: "See your results and proceed" },
    { t: "p", text: "Your results appear in 10 to 15 seconds. First you will see the tables and charts (for example, frequency tables for gender and age with pie charts, and tables for each question with mean and standard deviation). Scroll down until you see the heading “Results. Your data has been calculated. Review below, then proceed to generate the full interpretation.” Tap Proceed to Full Document Interpretation." },
    { t: "h", step: "STEP 11", text: "Wait while the interpretation is written" },
    { t: "p", text: "You will see messages such as “Analyzing results” and “Interpreting tables”. A countdown timer then appears. This can take up to 3 minutes, depending on the number of constructs and the strength of your internet connection. Stay on the page, keep the app open and wait. The timer is writing an interpretation for every table." },
    { t: "h", step: "STEP 12", text: "Read your tables and interpretation" },
    { t: "p", text: "When the timer ends, the tables show first. Scroll down to read the interpretation of each table, the Discussion, the Summary of Findings (for example, “Of 1 hypotheses tested: 1 supported”) and the related literature. Your Word document may download to your device by itself. Do not tap Download yet. Scroll to the bottom and tap Get Chapter 5 and Defense Prep Questions." },
    { t: "h", step: "STEP 13", text: "Get Chapter 5 and the defense questions (free)" },
    { t: "p", text: "The screen “Get Chapter 5 and Defense Prep Questions?” shows Free. Tap Yes, get both. Then type your summary of the problem statement, methodology and limitations in the boxes provided. Fill them in carefully." },
    { t: "h", step: "STEP 14", text: "Wait, then download" },
    { t: "p", text: "The page “Finalizing your Chapter 5…” counts down. Stay on the page. When it is ready, you will see your Chapter 5 (5.1 Introduction, 5.2 Summary, 5.3 Conclusion, 5.4 Limitations, 5.5 Recommendations and References). The file downloads to your phone and a “File downloaded” message appears. Tap Open, or use Merge and download to get everything as one Word file." },
    { t: "note", kind: "info", title: "Check your references before you submit", text: "The app lists related literature and verified sources. Always check each reference yourself before you submit. If it says that only some verified sources were found, add more sources manually." },

    { t: "h", text: "Checklist" },
    { t: "p", text: "Tick each item before you move on. Every item should be checked before you tap the final buttons." },
    { t: "ul", items: [
      "I have my topic, cleaned spreadsheet and questionnaire (link or file) ready.",
      "I have my research questions, objectives and hypothesis (at least two of the three).",
      "I have my pilot study Cronbach’s alpha scores (0.70 or higher).",
      "I have decided my analysis, my IV(s) and my DV with my supervisor.",
      "My original questionnaire is on standby (printed or on another device).",
      "I accepted the ₦10,000 fee and uploaded my files and research details.",
      "The columns, questions and respondents match on the Confirm Your Data page.",
      "I ticked the demographic box only for the Demographics section.",
      "The first and last question and scale are correct for every section.",
      "I checked the codes and wording on the Data Cleaning page and filled in anything missing.",
      "I made my choices on missing values, duplicates and straight-lining.",
      "I waited on the page for the interpretation and did not leave the tab.",
      "I tapped Get Chapter 5 and Defense Prep Questions and entered my summary.",
      "I downloaded my files and checked my references."
    ] },
    { t: "h", text: "Quick fixes" },
    { t: "table", head: ["If this happens", "Do this"], rows: [
      ["The numbers on “Confirm Your Data” do not match.", "Check your spreadsheet and questionnaire before you continue."],
      ["A demographic question (like Faculty) has no meanings.", "Scroll down, tap “Let me edit this myself”, type each meaning, then tap Done editing."],
      ["The page looks empty on the Data Cleaning page.", "Wait about 30 seconds without touching anything."],
      ["The timer is running.", "Stay on the page, keep the app open and check your internet connection."]
    ] },
    { t: "note", kind: "info", title: "You are in control", text: "Nothing is auto-corrected. You decide your analysis, your codes and what to keep or exclude. If you are unsure, ask your supervisor." }
  ],
};
