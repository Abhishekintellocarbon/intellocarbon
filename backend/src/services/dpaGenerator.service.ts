import path from "path";
import PDFDocument from "pdfkit";
import { buildDpaDocument, type DpaGeneratorInput } from "./dpaGenerator/build";

const LOGO_PATH = path.join(__dirname, "../assets/logo-full.png");

const pdfToBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "customer";

/** Stateless generate-and-download tool — nothing is persisted, the PDF is built and streamed straight back on each request. */
export const generateDpaPdf = async (input: DpaGeneratorInput): Promise<{ fileName: string; fileData: Buffer }> => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  buildDpaDocument(doc, LOGO_PATH, input);
  const fileData = await pdfToBuffer(doc);
  const fileName = `dpa-${slugify(input.customerCompanyName)}.pdf`;
  return { fileName, fileData };
};
