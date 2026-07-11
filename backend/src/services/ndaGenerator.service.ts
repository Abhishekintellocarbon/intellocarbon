import path from "path";
import PDFDocument from "pdfkit";
import { buildNdaDocument, type NdaGeneratorInput } from "./ndaGenerator/build";

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
    .replace(/(^-|-$)/g, "") || "recipient";

/** Stateless generate-and-download tool — nothing is persisted, the PDF is built and streamed straight back on each request. */
export const generateNdaPdf = async (input: NdaGeneratorInput): Promise<{ fileName: string; fileData: Buffer }> => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  buildNdaDocument(doc, LOGO_PATH, input);
  const fileData = await pdfToBuffer(doc);
  const fileName = `nda-${slugify(input.recipientName)}.pdf`;
  return { fileName, fileData };
};
