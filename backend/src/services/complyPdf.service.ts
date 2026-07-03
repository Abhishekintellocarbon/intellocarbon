import PDFDocument from "pdfkit";
import type { ComplyResults } from "./intellocalcCalculations";

const TEAL = "#00A886";
const NAVY = "#0F1923";
const MUTED = "#5B6B7A";
const BORDER = "#D8DEE4";

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const drawHeader = (doc: PDFKit.PDFDocument) => {
  doc.rect(0, 0, doc.page.width, 90).fillColor(NAVY).fill();
  doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(16).text("IntelloCalc Comply", 50, 28);
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(11).text("Your Personalised Compliance Map", 50, 50);
  doc
    .fillColor("#B5C0CC")
    .font("Helvetica")
    .fontSize(8)
    .text(`Generated ${fmtDate(new Date())}`, 400, 50, { width: 145, align: "right" });
};

const drawFooter = (doc: PDFKit.PDFDocument) => {
  doc
    .fillColor(MUTED)
    .font("Helvetica")
    .fontSize(7.5)
    .text(
      "© 2026 Intellocarbon Solutions Private Limited | intellocarbon.com | All calculations are estimates. Verified reports available on the platform.",
      50,
      doc.page.height - 32,
      { width: 495 },
    );
};

/** One-page compliance map PDF, mirroring the on-screen IntelloCalc Comply results grid. */
export const buildComplyPdf = (
  name: string,
  company: string,
  results: ComplyResults,
): PDFKit.PDFDocument => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });

  drawHeader(doc);
  let y = 110;

  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(`Prepared for ${name}, ${company}`, 50, y);
  y += 24;

  if (results.nonManufacturer) {
    doc
      .fillColor("#1A2530")
      .font("Helvetica")
      .fontSize(10)
      .text(
        "Most carbon compliance frameworks apply to manufacturers. You may still have EPR obligations if you import or sell packaged goods. Contact us to assess.",
        50,
        y,
        { width: 495 },
      );
    drawFooter(doc);
    return doc;
  }

  if (results.noneApplicable) {
    doc
      .fillColor("#1A2530")
      .font("Helvetica")
      .fontSize(10)
      .text(
        "Great news — based on your answers, you may not have mandatory carbon compliance obligations right now. However UK CBAM starts 2027 and India CCTS is expanding. Stay ahead with Intellocarbon monitoring.",
        50,
        y,
        { width: 495 },
      );
    drawFooter(doc);
    return doc;
  }

  for (const framework of results.frameworks) {
    doc.roundedRect(50, y, 495, 74, 6).strokeColor(BORDER).lineWidth(1).stroke();
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(framework.name, 62, y + 10, { width: 471 });
    doc
      .fillColor(framework.status === "MANDATORY" ? "#C0392B" : TEAL)
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .text(framework.status, 62, y + 28);
    doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(framework.deadline, 62, y + 42, { width: 471 });
    doc.fillColor("#1A2530").font("Helvetica").fontSize(8.5).text(framework.whatWeDo, 62, y + 56, { width: 471 });
    y += 84;

    if (y > doc.page.height - 140) {
      drawFooter(doc);
      doc.addPage();
      drawHeader(doc);
      y = 110;
    }
  }

  if (results.cbamDeMinimisNote) {
    doc
      .fillColor(MUTED)
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .text(
        "Your export volume may be below the 50-tonne threshold. CBAM may not apply. We will confirm for you.",
        50,
        y,
        { width: 495 },
      );
    y += 24;
  }

  if (results.combinedNote) {
    doc
      .fillColor(MUTED)
      .font("Helvetica-Oblique")
      .fontSize(8.5)
      .text(
        "You qualify for Article 9 deduction — your CCTS carbon price paid in India reduces your CBAM exposure. Only Intellocarbon calculates this automatically.",
        50,
        y,
        { width: 495 },
      );
  }

  drawFooter(doc);
  return doc;
};
