import LegalPage, { LegalSection } from "@/components/LegalPage";

const sections: LegalSection[] = [
  { heading: "1. About these terms", paragraphs: [
    "By creating an account or using Vertex Researchsuite, you agree to these Terms and to the Privacy Policy. Vertex Researchsuite provides online tools that help with research topics and proposals, pilot studies, data cleaning, quantitative and qualitative analysis, voice transcription and report restyling.",
  ] },
  { heading: "2. Academic integrity and your responsibility", bullets: [
    "Vertex Researchsuite is an analytical and educational tool. It does not replace your own judgment, your supervisor or your institution's rules.",
    "You are responsible for reviewing and verifying every output, including statistics, interpretations, quotations, transcripts and references, before you use it.",
    "You are responsible for following your institution's, employer's or client's rules on academic conduct, ethics approval and the use of software tools.",
    "The final interpretation, conclusions and submission of any work remain yours.",
  ] },
  { heading: "3. Wallet, payments and refunds", bullets: [
    "Paid features are funded from your Vertex wallet. You see the fee before a paid step runs.",
    "Card and bank payments are processed by Paystack.",
    "Once a feature has run and your data, audio or request has been processed, the fee is not refundable. Unused wallet balance stays available for future features.",
    "Prices can change. The price shown to you before you confirm is the price that applies.",
  ] },
  { heading: "4. Rewards for sharing Vertex Researchsuite", paragraphs: [
    "Every user has a personal referral link on their Referrals page. When someone you refer creates an account and makes their first deposit, you earn a reward on that deposit, as a small token of appreciation from Vertex Researchsuite for helping our community grow.",
  ], bullets: [
    "The reward is earned once per referred user, on their first deposit.",
    "It is a thank-you gesture, not a salary or a guaranteed income. Amounts are usually modest.",
    "Your reward rate and the minimum amount you can withdraw are always shown on your Referrals page. Some approved ambassadors may have a different rate, and the rate that applies to you is the one displayed there.",
    "You can see how many people you referred, how many deposited, and what you have earned, requested, been paid and still have available.",
    "Withdrawal requests are reviewed before payment. A request may be declined, and a declined amount returns to your available balance.",
    "Fake accounts, referring yourself or other abuse may lead to rewards being withheld or your account being restricted.",
  ] },
  { heading: "5. Acceptable use", bullets: [
    "Do not upload content you have no right to use, or anything unlawful.",
    "If your study involves people, make sure you have the consent and ethical approval your institution requires before uploading their responses or recordings.",
    "Do not misuse the platform, attempt to access other users' data, or interfere with its operation.",
  ] },
  { heading: "6. Limits of our responsibility", paragraphs: [
    "Results depend on the data and instructions you provide. Vertex Researchsuite is not responsible for academic decisions, supervisor or examiner outcomes, grades, or losses resulting from errors in the data you submit or from interruptions to services we depend on.",
    "Features are provided as tools to support your work. Please check outputs carefully before relying on them.",
  ] },
  { heading: "7. Changes and questions", paragraphs: [
    "We may update these Terms as the platform grows. The latest version is always on this page. For questions, contact us through your dashboard.",
  ] },
];

export default function TermsPage() {
  return <LegalPage title="Terms and Conditions" updated="October 2026" sections={sections} />;
}
