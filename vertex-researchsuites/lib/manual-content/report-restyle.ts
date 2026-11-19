import type { ManualContent } from "../manuals";

export const content: ManualContent = {
  intro: "A step-by-step guide to converting the tables, captions and interpretations of your Word report into the citation style you choose.",
  fee: "\u20A61,000 (shown on a preview page before you pay)",
  blocks: [
    { t: "h", text: "About this feature" },
    { t: "p", text: "Different schools, journals and supervisors ask for different citation styles. Restyle Your Report saves you the time of reformatting by hand. You upload your Word report, choose a citation style, and Vertex converts your report into that style. The feature will:" },
    { t: "ul", items: [
      "convert every table, caption and interpretation in your report into the citation style you choose;",
      "keep your charts and numbers exactly as they are;",
      "give you a new Word (.docx) file to download, so your original file stays untouched."
    ] },
    { t: "p", text: "Available citation styles (10): APA 7, APA 6, MLA 9, Chicago 17, Harvard, Vancouver, IEEE, Turabian 9, OSCOLA and AMA. You pay only after you tap Accept and continue." },
    { t: "h", text: "Before you start" },
    { t: "ol", items: [
      "Your report must be a Word document (.docx). No other format is accepted. If it is a PDF or a Google Doc, convert it to Word first and upload the Word version.",
      "Your file must not be larger than 4 MB.",
      "Your report should be a Chapter 4 report with SPSS-format tables and interpretations. This is what the upload page asks for.",
      "Give each table a caption written as Table 1, Table 2 and so on, placed directly above the table, for example Table 1. Descriptive Statistics. This helps Vertex recognise and number your tables correctly.",
      "Use a strong internet connection. The process takes only a few seconds when your connection is strong."
    ] },
    { t: "h", text: "Step-by-step guide" },
    { t: "h", step: "STEP 1", text: "Read the preview and accept" },
    { t: "p", text: "The feature opens on a preview page showing what you get, the price, and a button to continue. If you agree, tap Accept and continue. The fee is deducted and you are taken to the next page." },
    { t: "h", step: "STEP 2", text: "Upload your report and choose a style" },
    { t: "ul", items: [
      "Your report (.docx, up to 4 MB): tap Choose File and select your Word report.",
      "Citation style: tap the drop-down that says Choose a style and select the style you want, for example APA 7, American Psychological Association 7th Edition."
    ] },
    { t: "p", text: "When the file name and the style both appear, tap Restyle and Download." },
    { t: "note", kind: "warn", title: "Stay on the page while the feature is working", text: "While your report is being restyled, do not leave the tab, do not minimise the app, and do not quickly move to another part of the application. Doing so can cause an error message or interrupt the process. Wait until the process has finished and your file has downloaded before you leave the feature or log out." },
    { t: "h", step: "STEP 3", text: "Your restyled report downloads" },
    { t: "p", text: "Restyling takes a few seconds with a strong internet connection. When it is done, the new Word file downloads to your device automatically. The new file keeps your original file name and adds the style to it. If the file does not download, check your internet connection and try again." },
    { t: "p", text: "A summary message also appears under the button. A green message tells you how many tables were restyled, how many charts were carried over and how many paragraphs were rewritten. An orange message is a note for you to read, for example that a table had no Table N caption and was numbered automatically." },
    { t: "note", kind: "tip", title: "Always check your captions after downloading", text: "If the orange note tells you that a table was numbered automatically, open your restyled file and check that table's caption. To avoid this, give every table a caption in the form Table 1. Title directly above it before you upload." },
    { t: "h", text: "Quick checklist" },
    { t: "ul", items: [
      "My report is a Word document (.docx).",
      "My file is not larger than 4 MB.",
      "Each of my tables has a caption such as Table 1. Title directly above it.",
      "I selected the correct citation style before tapping Restyle and Download.",
      "I stayed on the page until the process finished.",
      "I opened the new file and checked my tables and captions.",
      "I kept my original file as a backup."
    ] }
  ],
};
