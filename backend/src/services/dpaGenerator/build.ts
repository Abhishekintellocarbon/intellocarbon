import { fmtDate } from "../cbamReport/theme";
import { LegalDocumentPageBuilder } from "../legalDocument/pageBuilder";

export interface DpaGeneratorInput {
  customerCompanyName: string;
  signingDate: Date;
  signatoryName: string;
  signatoryDesignation: string;
}

interface DpaSection {
  heading: string;
  paragraphs: string[];
}

const SECTIONS: DpaSection[] = [
  {
    heading: "1. Definitions",
    paragraphs: [
      '1.1 "Personal Data" means any information relating to an identified or identifiable natural person that is processed by Intellocarbon on behalf of the Customer in connection with the Platform.',
      '1.2 "Processing" means any operation performed on Personal Data, including collection, storage, use, disclosure, and deletion.',
      '1.3 "Sub-processor" means any third party engaged by Intellocarbon to process Personal Data on behalf of the Customer, as described in Section 6.',
      '1.4 "Applicable Data Protection Law" means the Digital Personal Data Protection Act, 2023 (India), and, where applicable to the Customer\'s own regulatory context, the EU General Data Protection Regulation (GDPR), to the extent either is relevant to the Personal Data processed under this DPA.',
    ],
  },
  {
    heading: "2. Roles of the Parties",
    paragraphs: [
      "2.1 Customer is the Controller of Personal Data submitted to the Platform, including data relating to its employees, facility personnel, and any third-party individuals whose data Customer submits (e.g., supplier contacts).",
      "2.2 Intellocarbon is the Processor, and processes Personal Data solely on behalf of, and in accordance with, the documented instructions of the Customer, as given through use of the Platform and as set out in this DPA.",
    ],
  },
  {
    heading: "3. Scope and Purpose of Processing",
    paragraphs: [
      "3.1 Intellocarbon processes Personal Data solely for the purpose of providing the Platform's services to Customer, namely: enabling account access, facility and activity data management, emissions calculation, report generation, verification workflow facilitation, billing, and compliance deadline notifications.",
      "3.2 The categories of Personal Data processed may include: names, email addresses, phone numbers, designations, and login credentials of Customer's authorised users (Company Admin, Data Entry Operators, and other platform users).",
      "3.3 Intellocarbon will not process Personal Data for any purpose other than as necessary to provide the Platform, nor disclose it to any third party except as set out in this DPA or the Terms of Service.",
    ],
  },
  {
    heading: "4. Customer Obligations",
    paragraphs: [
      "4.1 Customer warrants that it has a lawful basis to submit any Personal Data to the Platform, including Personal Data of its employees or third parties, and that it has provided any notices or obtained any consents required under Applicable Data Protection Law prior to such submission.",
      "4.2 Customer is responsible for the accuracy of Personal Data it submits and for promptly updating or correcting such data as needed.",
    ],
  },
  {
    heading: "5. Intellocarbon's Obligations",
    paragraphs: [
      "5.1 Intellocarbon shall process Personal Data only on documented instructions from Customer, including those given through configuration and use of the Platform, unless required to do otherwise by applicable law.",
      "5.2 Intellocarbon shall ensure that personnel authorised to process Personal Data are subject to confidentiality obligations.",
      "5.3 Intellocarbon shall implement appropriate technical and organisational measures to protect Personal Data against unauthorised access, loss, or disclosure, including role-based access controls, encrypted data transmission, and authentication safeguards, as further described in Intellocarbon's Privacy Policy.",
      "5.4 Intellocarbon shall assist Customer, insofar as reasonably possible, in responding to requests from data subjects seeking to exercise their rights under Applicable Data Protection Law, to the extent such assistance is required of a Processor.",
    ],
  },
  {
    heading: "6. Sub-processors",
    paragraphs: [
      "6.1 Customer provides general authorisation for Intellocarbon to engage Sub-processors for the categories of processing described in Intellocarbon's Privacy Policy (namely: payment processing, transactional email delivery, and cloud application hosting), provided that Intellocarbon remains responsible for such Sub-processors' compliance with data protection obligations equivalent to those in this DPA.",
      "6.2 Intellocarbon will make reasonable efforts to notify Customer of any intended change to its Sub-processors that materially affects the processing of Customer's Personal Data, and Customer may object on reasonable grounds relating to data protection.",
    ],
  },
  {
    heading: "7. Data Breach Notification",
    paragraphs: [
      "In the event Intellocarbon becomes aware of a breach affecting Customer's Personal Data, it shall notify Customer without undue delay, and in any event within 72 hours of becoming aware, providing available details of the nature of the breach, the categories and approximate number of data subjects and records affected, and the measures taken or proposed to address the breach.",
    ],
  },
  {
    heading: "8. Data Retention and Deletion",
    paragraphs: [
      "8.1 Intellocarbon shall retain Personal Data only for as long as necessary to provide the Platform's services, and thereafter for any period required under applicable regulatory retention obligations (including the 7-year CBAM-related record retention period), as further described in Intellocarbon's Privacy Policy.",
      "8.2 Upon termination of the Customer's subscription and expiry of any mandatory retention period, Intellocarbon shall delete or anonymise Personal Data, unless retention is required for legal, audit, or dispute-resolution purposes.",
    ],
  },
  {
    heading: "9. International Transfers",
    paragraphs: [
      "Where processing by a Sub-processor involves the transfer of Personal Data outside India, Intellocarbon shall ensure such transfer is subject to appropriate safeguards consistent with Applicable Data Protection Law.",
    ],
  },
  {
    heading: "10. Audit Rights",
    paragraphs: [
      "Intellocarbon shall make available to Customer, upon reasonable written request and no more than once per year, information reasonably necessary to demonstrate compliance with this DPA. Where a physical or third-party audit is reasonably necessary and cannot be satisfied through provision of documentation, the parties shall agree on reasonable scope, timing, and confidentiality terms in advance, at Customer's cost, subject to reasonable prior written notice.",
    ],
  },
  {
    heading: "11. Liability",
    paragraphs: ["Liability arising under this DPA is subject to the limitations of liability set out in the Terms of Service between the parties."],
  },
  {
    heading: "12. Term",
    paragraphs: [
      "This DPA remains in effect for as long as Intellocarbon processes Personal Data on behalf of Customer under the Terms of Service, and terminates automatically upon termination of the underlying Terms of Service.",
    ],
  },
  {
    heading: "13. Governing Law",
    paragraphs: ["This DPA is governed by the laws of India, consistent with the governing law provisions of the Terms of Service."],
  },
  {
    heading: "14. Contact",
    paragraphs: ["For data protection queries relating to this DPA, contact support@intellocarbon.com."],
  },
];

export function buildDpaDocument(doc: PDFKit.PDFDocument, logoPath: string, input: DpaGeneratorInput) {
  const { customerCompanyName, signingDate, signatoryName, signatoryDesignation } = input;
  const effectiveDateLabel = `Effective Date: ${fmtDate(signingDate)}`;

  const pb = new LegalDocumentPageBuilder(doc, logoPath, "DATA PROCESSING AGREEMENT");
  pb.titleBlock("Data Processing Agreement", "Intellocarbon Solutions Private Limited", effectiveDateLabel);

  pb.paragraph(
    `This Data Processing Agreement ("DPA") is entered into between Intellocarbon Solutions Private Limited, having ` +
      `its registered office at Ambikapur, Surguja, Chhattisgarh, India, CIN U62020CT2026PTC020653 ("Processor", ` +
      `"Intellocarbon"), and ${customerCompanyName} ("Controller", "Customer"), and forms part of, and is incorporated ` +
      `by reference into, the Terms of Service between the parties.`,
  );

  for (const section of SECTIONS) {
    pb.sectionHeading(section.heading);
    for (const paragraph of section.paragraphs) {
      pb.paragraph(paragraph);
    }
  }

  pb.ensureSpace(40);
  pb.paragraph("Acknowledged and agreed:", { bold: true, size: 10.5 });
  pb.y += 8;

  pb.signatureBlock("For Intellocarbon Solutions Private Limited", "Abhishek Dwivedi", "Director", null);
  pb.signatureBlock(`For ${customerCompanyName}`, signatoryName, signatoryDesignation, fmtDate(signingDate));

  pb.finalize();
}
