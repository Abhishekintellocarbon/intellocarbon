/**
 * Turns an uploaded bill file into text, by the cheapest reliable route.
 *
 * Two engines, chosen by what the file actually is rather than by what it
 * claims to be:
 *
 *   PDF with a text layer -> read the text layer. Character-exact, no
 *     recognition step, and typically single-digit milliseconds. Almost every
 *     bill downloaded from a discom portal is one of these.
 *   Image (JPG/PNG/WEBP)  -> Tesseract OCR. Seconds, and fallible, which is
 *     why its output carries a page confidence the parser demotes on.
 *
 * A scanned PDF — image bytes wrapped in a PDF container, no text layer — is
 * reported as NO_TEXT_LAYER rather than OCR'd. Rasterising a PDF page in Node
 * needs a native canvas binding, which is a deployment risk this phase does
 * not take; the client can upload the same bill as a photo to get OCR. Either
 * way the caller falls back to the manual flow, so nothing breaks.
 *
 * Nothing here interprets the text. Recognition and parsing are kept apart so
 * a parser bug can be reproduced from stored text without re-running OCR, and
 * so the parser can be tested exhaustively without either engine present.
 */
import fs from "fs";
import os from "os";
import path from "path";

export type ExtractionEngine = "PDF_TEXT_LAYER" | "OCR_IMAGE";

export type TextExtractionResult =
  | { ok: true; engine: ExtractionEngine; text: string; ocrMeanConfidence: number | null }
  | { ok: false; reason: TextExtractionFailure; detail?: string };

export type TextExtractionFailure =
  | "UNSUPPORTED_FILE_TYPE"
  | "NO_TEXT_LAYER"
  | "ENCRYPTED_PDF"
  | "CORRUPT_FILE"
  | "OCR_UNAVAILABLE"
  | "TIMEOUT";

/**
 * A PDF text layer shorter than this is treated as absent. Scanned bills often
 * still carry a few characters of generator metadata or a page number, so
 * "length zero" is too strict a test for "there is nothing to read here".
 */
const MIN_USEFUL_TEXT_CHARS = 40;

/** Hard ceiling on a single OCR run. Past this the manual flow is the better product. */
const OCR_TIMEOUT_MS = Number(process.env.BILL_OCR_TIMEOUT_MS ?? 60_000);

/** Set BILL_OCR_ENABLED=false to turn OCR off without a deploy of new code. */
const OCR_ENABLED = process.env.BILL_OCR_ENABLED !== "false";

/**
 * Where Tesseract looks for, and caches, its language data.
 *
 * tesseract.js reads `<cachePath>/eng.traineddata` if it is there and
 * otherwise downloads ~5MB from a CDN inside the first recognition of the
 * process. `scripts/fetch-ocr-langdata.js` puts the file here at build time so
 * that download never happens in a request. The default points at the build
 * output; the OS temp dir is the fallback when the build step didn't run, and
 * is writable even where the working directory isn't.
 */
const OCR_CACHE_PATH =
  process.env.BILL_OCR_CACHE_PATH ??
  (fs.existsSync(path.join(process.cwd(), "ocr-langdata", "eng.traineddata"))
    ? path.join(process.cwd(), "ocr-langdata")
    : path.join(os.tmpdir(), "intellocarbon-tesseract"));

/**
 * pdfjs-dist v4 ships ESM only, and this service compiles to CommonJS. A plain
 * `await import()` is rewritten to `require()` by TypeScript's CJS emit, which
 * throws ERR_REQUIRE_ESM at runtime. Going through `new Function` keeps a real
 * dynamic import in the emitted output.
 */
const esmImport = new Function("specifier", "return import(specifier)") as (s: string) => Promise<unknown>;

const isPdf = (buffer: Buffer) => buffer.subarray(0, 5).toString("latin1") === "%PDF-";
const isJpeg = (buffer: Buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
const isPng = (buffer: Buffer) =>
  buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
const isWebp = (buffer: Buffer) =>
  buffer.length >= 12 &&
  buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
  buffer.subarray(8, 12).toString("latin1") === "WEBP";

/** Pages beyond this are ignored — a bill's readable face is its first page or two. */
const MAX_PDF_PAGES = 5;

const extractPdfText = async (buffer: Buffer): Promise<TextExtractionResult> => {
  let pdfjs: {
    getDocument: (opts: unknown) => { promise: Promise<PdfDocumentLike> };
  };
  try {
    pdfjs = (await esmImport("pdfjs-dist/legacy/build/pdf.mjs")) as typeof pdfjs;
  } catch (err) {
    return { ok: false, reason: "OCR_UNAVAILABLE", detail: `PDF reader unavailable: ${String(err)}` };
  }

  try {
    const doc = await pdfjs.getDocument({
      // Copied because pdfjs takes ownership of the buffer it is handed and
      // leaves it detached — the same bytes are still needed by the caller to
      // be written to the Document row.
      data: new Uint8Array(buffer),
      // Nothing in a bill needs an embedded font programme rendered; skipping
      // the fetch keeps this off the network entirely.
      useSystemFonts: false,
      disableFontFace: true,
      isEvalSupported: false,
    }).promise;

    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    for (let i = 1; i <= pageCount; i += 1) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // pdfjs emits one item per text run with an explicit end-of-line marker.
      // Rebuilding real line breaks matters: the parser only accepts a value
      // on the same line as its label.
      let line = "";
      const lines: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join("\n"));
    }

    const text = pages.join("\n");
    if (text.replace(/\s/g, "").length < MIN_USEFUL_TEXT_CHARS) {
      return {
        ok: false,
        reason: "NO_TEXT_LAYER",
        detail: "This PDF carries no readable text layer — it is most likely a scan or a photo saved as a PDF.",
      };
    }
    return { ok: true, engine: "PDF_TEXT_LAYER", text, ocrMeanConfidence: null };
  } catch (err) {
    const message = String(err);
    if (/password|encrypt/i.test(message)) {
      return { ok: false, reason: "ENCRYPTED_PDF", detail: "This PDF is password-protected, so its text cannot be read." };
    }
    return { ok: false, reason: "CORRUPT_FILE", detail: message };
  }
};

type PdfDocumentLike = {
  numPages: number;
  getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: Array<{ str?: string; hasEOL?: boolean }> }> }>;
};

type TesseractWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
};

/**
 * One lazily-created worker, reused across uploads.
 *
 * Creating a worker costs about a second and loading the language data costs
 * more on a cold cache, so per-request workers would make OCR feel broken
 * under any real usage. Jobs are serialised through `ocrQueue` below because a
 * Tesseract worker processes one image at a time — running two recognitions
 * concurrently on one worker interleaves them and corrupts both results.
 */
let workerPromise: Promise<TesseractWorker> | null = null;

const getWorker = async (): Promise<TesseractWorker> => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = (await esmImport("tesseract.js")) as {
        createWorker: (lang: string, oem?: number, opts?: unknown) => Promise<TesseractWorker>;
      };
      fs.mkdirSync(OCR_CACHE_PATH, { recursive: true });
      return createWorker("eng", undefined, {
        cachePath: OCR_CACHE_PATH,
        // Without an errorHandler, tesseract.js rethrows a worker-side failure
        // from inside a message listener (createWorker.js: `throw Error(data)`)
        // — outside any promise chain, so it lands as an uncaught exception and
        // takes the API process down. A failed language-data download is enough
        // to trigger it. Supplying a handler turns that same failure into a
        // logged, contained error, which is the difference between "this bill
        // could not be read" and an outage.
        errorHandler: (err: unknown) => {
          console.error("[billIntelligence] OCR worker error:", err);
        },
      });
    })();
    // A failed creation must not be cached, or every later upload inherits the
    // one-off failure (a transient language-data download, say) forever.
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
};

/** Serialises OCR jobs onto the single shared worker. */
let ocrQueue: Promise<unknown> = Promise.resolve();
const enqueueOcr = <T,>(job: () => Promise<T>): Promise<T> => {
  const run = ocrQueue.then(job, job);
  ocrQueue = run.catch(() => undefined);
  return run;
};

const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("BILL_OCR_TIMEOUT")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

const extractImageText = async (buffer: Buffer): Promise<TextExtractionResult> => {
  if (!OCR_ENABLED) {
    return { ok: false, reason: "OCR_UNAVAILABLE", detail: "OCR is disabled on this environment (BILL_OCR_ENABLED=false)." };
  }
  try {
    const result = await enqueueOcr(async () => {
      const worker = await getWorker();
      return withTimeout(worker.recognize(buffer), OCR_TIMEOUT_MS);
    });
    const text = result.data.text ?? "";
    if (text.replace(/\s/g, "").length < MIN_USEFUL_TEXT_CHARS) {
      return { ok: false, reason: "NO_TEXT_LAYER", detail: "OCR found no readable text in this image." };
    }
    return { ok: true, engine: "OCR_IMAGE", text, ocrMeanConfidence: result.data.confidence };
  } catch (err) {
    if (String(err).includes("BILL_OCR_TIMEOUT")) {
      return { ok: false, reason: "TIMEOUT", detail: `OCR exceeded ${OCR_TIMEOUT_MS}ms.` };
    }
    return { ok: false, reason: "OCR_UNAVAILABLE", detail: String(err) };
  }
};

export const extractText = async (buffer: Buffer): Promise<TextExtractionResult> => {
  if (isPdf(buffer)) return extractPdfText(buffer);
  if (isJpeg(buffer) || isPng(buffer) || isWebp(buffer)) return extractImageText(buffer);
  return { ok: false, reason: "UNSUPPORTED_FILE_TYPE" };
};

/** Releases the shared worker. Used by tests so a run doesn't hang on an idle child process. */
export const shutdownOcr = async (): Promise<void> => {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Nothing to release.
  }
};
