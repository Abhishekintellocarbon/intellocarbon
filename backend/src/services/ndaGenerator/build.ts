import { fmtDate } from "../cbamReport/theme";
import { LegalDocumentPageBuilder } from "../legalDocument/pageBuilder";

export type NdaRecipientType = "INDIVIDUAL" | "COMPANY";

export interface NdaGeneratorInput {
  recipientName: string;
  recipientType: NdaRecipientType;
  recipientAddress: string;
  effectiveDate: Date;
}

interface NdaSection {
  heading: string;
  paragraphs: string[];
}

const SECTIONS: NdaSection[] = [
  {
    heading: "1. Purpose",
    paragraphs: [
      'The Parties wish to explore a potential business, investment, employment, advisory, or partnership relationship (the "Purpose"), in connection with which one or both Parties may disclose certain confidential and proprietary information to the other.',
    ],
  },
  {
    heading: "2. Confidential Information",
    paragraphs: [
      '2.1 "Confidential Information" means any non-public information disclosed by one Party ("Disclosing Party") to the other ("Receiving Party"), whether oral, written, or in any other form, including but not limited to: business plans, financial information, pricing, product architecture and technical design (including calculation methodologies, software architecture, and platform functionality), customer and prospect information, regulatory strategy, pitch materials, and any other information that a reasonable person would understand to be confidential given the nature of the information and circumstances of disclosure.',
      "2.2 Confidential Information does not include information that: (a) is or becomes publicly available through no fault of the Receiving Party; (b) was already lawfully known to the Receiving Party prior to disclosure; (c) is independently developed by the Receiving Party without use of the Disclosing Party's Confidential Information; or (d) is lawfully received from a third party without breach of any confidentiality obligation.",
    ],
  },
  {
    heading: "3. Obligations of the Receiving Party",
    paragraphs: [
      "3.1 The Receiving Party shall: (a) hold the Disclosing Party's Confidential Information in strict confidence; (b) not disclose it to any third party without prior written consent of the Disclosing Party, except to its own employees, advisors, or representatives who have a genuine need to know for the Purpose and who are bound by confidentiality obligations at least as protective as this Agreement; (c) use the Confidential Information solely for the Purpose and not for any other purpose, including competitive use; and (d) protect the Confidential Information using at least the same degree of care it uses for its own confidential information, and in no event less than reasonable care.",
      "3.2 If the Receiving Party is required by law, regulation, or valid court/government order to disclose Confidential Information, it shall, to the extent legally permitted, give the Disclosing Party prompt written notice prior to such disclosure to allow the Disclosing Party to seek a protective order or other appropriate remedy.",
    ],
  },
  {
    heading: "4. No License or Ownership Transfer",
    paragraphs: [
      "Nothing in this Agreement grants the Receiving Party any right, title, license, or interest in or to the Disclosing Party's Confidential Information, intellectual property, or any products, technology, or methodologies referenced therein, except the limited right to use such information solely for the Purpose.",
    ],
  },
  {
    heading: "5. Term",
    paragraphs: [
      "5.1 This Agreement shall remain in effect for a period of 3 (three) years from the Effective Date, unless earlier terminated by either Party upon 30 days' written notice.",
      "5.2 The confidentiality obligations under this Agreement shall survive termination of this Agreement and continue for a further period of 3 (three) years thereafter, or for as long as the relevant information remains a trade secret under applicable law, whichever is longer.",
    ],
  },
  {
    heading: "6. Return or Destruction of Information",
    paragraphs: [
      "Upon written request of the Disclosing Party, or upon termination of discussions related to the Purpose, the Receiving Party shall promptly return or destroy all documents, materials, and other tangible or electronic manifestations of the Disclosing Party's Confidential Information in its possession, and certify such return or destruction in writing if requested.",
    ],
  },
  {
    heading: "7. No Obligation",
    paragraphs: [
      "Nothing in this Agreement obligates either Party to proceed with any business relationship, transaction, investment, or arrangement, or to disclose any particular information. Either Party may terminate discussions related to the Purpose at any time without liability, other than the confidentiality obligations set out herein.",
    ],
  },
  {
    heading: "8. Remedies",
    paragraphs: [
      "The Parties acknowledge that unauthorised disclosure or use of Confidential Information may cause irreparable harm for which monetary damages alone may be an inadequate remedy, and that the Disclosing Party shall be entitled to seek injunctive relief, in addition to any other remedies available at law or in equity, without the necessity of posting a bond.",
    ],
  },
  {
    heading: "9. Governing Law and Jurisdiction",
    paragraphs: [
      "This Agreement shall be governed by the laws of India. The courts at Ambikapur, Chhattisgarh shall have exclusive jurisdiction over any disputes arising out of or in connection with this Agreement.",
    ],
  },
  {
    heading: "10. General",
    paragraphs: [
      "10.1 This Agreement constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior discussions or agreements relating to confidentiality between the Parties for the Purpose.",
      "10.2 This Agreement may only be amended in writing signed by both Parties. No failure or delay by either Party in exercising any right under this Agreement shall operate as a waiver of that right.",
      "10.3 If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall continue in full force and effect.",
    ],
  },
];

export function buildNdaDocument(doc: PDFKit.PDFDocument, logoPath: string, input: NdaGeneratorInput) {
  const { recipientName, recipientType, recipientAddress, effectiveDate } = input;
  const effectiveDateLabel = `Effective Date: ${fmtDate(effectiveDate)}`;
  const recipientTypeClause = recipientType === "INDIVIDUAL" ? "an individual" : "a company incorporated under applicable law";

  const pb = new LegalDocumentPageBuilder(doc, logoPath, "MUTUAL NON-DISCLOSURE AGREEMENT");
  pb.titleBlock("Mutual Non-Disclosure Agreement", "Intellocarbon Solutions Private Limited", effectiveDateLabel);

  pb.paragraph(
    `This Mutual Non-Disclosure Agreement ("Agreement") is entered into on ${fmtDate(effectiveDate)} ("Effective Date") between:`,
  );
  pb.paragraph(
    '1. Intellocarbon Solutions Private Limited, a company incorporated under the Companies Act, 2013, having CIN ' +
      'U62020CT2026PTC020653 and its registered office at Ambikapur, Surguja, Chhattisgarh, India ("Company"); and',
  );
  pb.paragraph(`2. ${recipientName}, ${recipientTypeClause}, having address at ${recipientAddress} ("Recipient"),`);
  pb.paragraph('each individually a "Party" and collectively the "Parties".');

  for (const section of SECTIONS) {
    pb.sectionHeading(section.heading);
    for (const paragraph of section.paragraphs) {
      pb.paragraph(paragraph);
    }
  }

  pb.ensureSpace(40);
  pb.paragraph("IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.", { bold: true, size: 10.5 });
  pb.y += 8;

  pb.signatureBlock("For Intellocarbon Solutions Private Limited", "Abhishek Dwivedi", "Director", null);
  pb.signatureBlock("For Recipient", recipientName, "____________", fmtDate(effectiveDate));

  pb.finalize();
}
