import LegalPage, { LegalSection } from "@/components/LegalPage";

const sections: LegalSection[] = [
  { heading: "1. What we collect", bullets: [
    "Account details: your name, email address and, if you give it, your institution.",
    "What you upload: datasets, audio recordings, transcripts and documents that you submit to run a feature.",
    "Payment records: your wallet history and transaction references. Card and bank payments are processed by Paystack.",
    "Referral records: who referred you and any rewards earned.",
  ] },
  { heading: "2. How we use it", bullets: [
    "To run the feature you requested, such as an analysis, a transcript, a proposal or a restyled report.",
    "To keep your wallet, receipts and transaction history.",
    "To credit and review referral rewards.",
  ] },
  { heading: "3. Your data stays yours", bullets: [
    "We do not sell, rent or trade your research data, uploads or generated reports.",
    "You keep ownership of your datasets, transcripts and the reports generated from them.",
    "To carry out your request, uploaded content is processed by trusted technology providers working on our behalf.",
  ] },
  { heading: "4. Your responsibility", paragraphs: [
    "Do not upload anything you have no right to use. If your study involves people, make sure you have the consent and ethical approval your institution requires before uploading their responses or recordings.",
  ] },
  { heading: "5. Questions and data requests", paragraphs: [
    "Contact us through your dashboard.",
  ] },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated="October 2026" sections={sections} />;
}
