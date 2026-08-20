import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { PageBuilder } from "../cbamReport/layout";
import { PAGE_HEIGHT, CONTENT_WIDTH, MARGIN_X, fmt, fmtInt, fmtEur, fmtGbp } from "../cbamReport/theme";
import { LOGO_LOCKUP_ON_DARK } from "../brandAssets";
import { buildVerifyQr } from "../cbamReport/qr";

/**
 * Cover-page chrome, shared by every branded report: CBAM, UK CBAM, CCTS,
 * BRSR, ISSB, GRI, CSRD and CDP.
 *
 * Two collisions lived in this layout, both invisible to every existing test
 * because a PDF that renders overlapping text is still a valid PDF that opens
 * and has the right page count.
 *
 * 1. finalize() stamped the running footer on the cover, straight through the
 *    DOC ID badge that coverShell anchors to the foot of the page.
 * 2. The badge sat at a hardcoded offset that cleared the confidentiality text
 *    by 4.7pt — fine for every string in use, and one extra sentence away from
 *    running the text through the badge.
 *
 * These tests assert the geometry directly rather than eyeballing a render,
 * so the next person to lengthen a confidentiality string finds out here.
 */

// Mirrors drawFooter's two text baselines.
const footerNoteY = (pageHeight: number) => pageHeight - 46;
const pageNumberY = (pageHeight: number) => pageHeight - 34;

const BADGE_HEIGHT = 8 + 5 * 2; // fontSize + paddingY * 2, per drawPill
const FOOT_Y = PAGE_HEIGHT - 90;
const TEXT_Y = FOOT_Y + 12;

const measureText = (text: string): number => {
  const doc = new PDFDocument({ size: "A4", margins: { top: 50, left: 50, right: 50, bottom: 20 } });
  return doc.font("Helvetica-Oblique").fontSize(7.5).heightOfString(text, { width: CONTENT_WIDTH, align: "center" });
};

/**
 * Builds a real cover with the given confidentiality string and reads back
 * where coverShell actually put things.
 *
 * Observed rather than recomputed on purpose. An earlier version of this file
 * reimplemented the badge formula and asserted against its own arithmetic,
 * which passes whatever the source does — the one thing a regression test must
 * not do. The badge is located by watching drawPill's roundedRect: it is the
 * lowest rounded rectangle on the page, and its height is fontSize + 2 *
 * paddingY.
 */
const measureCover = async (confidentialityText: string) => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  const pb = new PageBuilder(doc, "ICT-MEASURE-0001");
  const qr = await buildVerifyQr("ICT-MEASURE-0001");

  const rects: { y: number; height: number }[] = [];
  const realRoundedRect = doc.roundedRect.bind(doc);
  doc.roundedRect = ((x: number, y: number, w: number, h: number, r: number) => {
    rects.push({ y, height: h });
    return realRoundedRect(x, y, w, h, r);
  }) as typeof doc.roundedRect;

  pb.coverShell({
    logoPath: LOGO_LOCKUP_ON_DARK,
    eyebrow: "Test",
    title: "Cover Layout Test",
    subtitle: "Verifying cover chrome",
    heroLabel: "Metric",
    heroValue: "1",
    referenceBadge: "ICT-MEASURE-0001",
    controlTitle: "Document Control",
    controlRows: [["Document ID", "ICT-MEASURE-0001"]],
    qrPngBuffer: qr.buffer,
    qrCaption: "Scan to verify",
    qrUrl: qr.url,
    docIdBadge: "DOC ID  ICT-MEASURE-0001  \u00b7  v1.0",
    confidentialityText,
  });

  const badges = rects.filter((r) => Math.abs(r.height - BADGE_HEIGHT) < 0.01);
  expect(badges.length, "no DOC ID badge was drawn").toBeGreaterThan(0);
  const badgeTop = Math.max(...badges.map((r) => r.y));

  return { badgeTop, badgeBottom: badgeTop + BADGE_HEIGHT, textBottom: TEXT_Y + measureText(confidentialityText) };
};

/**
 * Every confidentiality string actually passed to coverShell, read from the
 * builders rather than copied — a copy would keep passing after the real
 * string grew, which is the exact failure being guarded.
 */
const confidentialityTexts = (): [string, string][] => {
  const servicesDir = path.join(__dirname, "..");
  const found: [string, string][] = [];
  for (const dir of fs.readdirSync(servicesDir)) {
    const buildFile = path.join(servicesDir, dir, "build.ts");
    if (!fs.existsSync(buildFile)) continue;
    const src = fs.readFileSync(buildFile, "utf8");
    const match = src.match(/confidentialityText:\s*((?:\s*"(?:[^"\\]|\\.)*"\s*\+?)+)/);
    if (!match) continue;
    const joined = (match[1].match(/"(?:[^"\\]|\\.)*"/g) ?? []).map((x) => JSON.parse(x) as string).join("");
    found.push([dir, joined]);
  }
  return found;
};

describe("cover confidentiality strip and DOC ID badge", () => {
  it("finds the builders' confidentiality strings", () => {
    const texts = confidentialityTexts();
    // Guards the reader above: if the regex stops matching, every clearance
    // assertion below would vacuously pass on an empty list.
    expect(texts.length).toBeGreaterThanOrEqual(8);
    expect(texts.every(([, t]) => t.includes("Confidential"))).toBe(true);
  });

  it.each(confidentialityTexts())("%s: the badge clears the confidentiality text", async (_name, text) => {
    const { badgeTop, textBottom } = await measureCover(text);
    expect(badgeTop).toBeGreaterThanOrEqual(textBottom);
  });

  it.each(confidentialityTexts())("%s: the badge stays inside the printable page", async (_name, text) => {
    // pdfkit's bottom margin is 20; anything past that risks spilling.
    const { badgeBottom } = await measureCover(text);
    expect(badgeBottom).toBeLessThanOrEqual(PAGE_HEIGHT - 20);
  });

  /**
   * The property the old fixed offset lacked, and the reason this file exists:
   * a longer string must push the badge down rather than grow into it.
   */
  it("moves the badge down when the text wraps to another line", async () => {
    const twoLine = "x".repeat(200).replace(/(.{40})/g, "$1 ");
    const fourLine = "x".repeat(500).replace(/(.{40})/g, "$1 ");
    const short = await measureCover(twoLine);
    const long = await measureCover(fourLine);

    expect(long.badgeTop).toBeGreaterThan(short.badgeTop);
    expect(long.badgeTop).toBeGreaterThanOrEqual(long.textBottom);
  });

  /**
   * Existing covers must not visibly shift. Two-line text — which is every
   * report today — has to land the badge where it always did, within a point.
   */
  it("leaves today's two-line covers where they were", async () => {
    for (const [name, text] of confidentialityTexts()) {
      const { badgeTop } = await measureCover(text);
      expect(Math.abs(badgeTop - (FOOT_Y + 34)), `${name} shifted`).toBeLessThan(1);
    }
  });
});

/**
 * Records which page each text draw lands on during finalize().
 *
 * Installed immediately before finalize() so it captures only the chrome pass,
 * not the cover body. Asserting on draw calls rather than on the emitted PDF
 * bytes is deliberate: pdfkit splits centred text into separately positioned
 * runs, so a byte search for "Page 2 of 3" is brittle in a way that has
 * nothing to do with the behaviour under test.
 */
const recordChromeDraws = (doc: PDFKit.PDFDocument, lastPageIndex: number) => {
  const draws: { page: number; text: string }[] = [];
  let current = lastPageIndex;

  const realSwitch = doc.switchToPage.bind(doc);
  const realText = doc.text.bind(doc);
  doc.switchToPage = ((n: number) => {
    current = n;
    return realSwitch(n);
  }) as typeof doc.switchToPage;
  doc.text = ((text: string, ...rest: unknown[]) => {
    draws.push({ page: current, text: String(text) });
    return (realText as (...a: unknown[]) => PDFKit.PDFDocument)(text, ...rest);
  }) as typeof doc.text;

  return draws;
};

const buildCoverDoc = async (reference: string) => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 50, left: 50, right: 50, bottom: 20 },
    bufferPages: true,
  });
  const pb = new PageBuilder(doc, reference);
  const qr = await buildVerifyQr(reference);
  pb.coverShell({
    logoPath: LOGO_LOCKUP_ON_DARK,
    eyebrow: "Test",
    title: "Cover Layout Test",
    subtitle: "Verifying cover chrome",
    heroLabel: "Metric",
    heroValue: "1",
    referenceBadge: reference,
    controlTitle: "Document Control",
    controlRows: [["Document ID", reference]],
    qrPngBuffer: qr.buffer,
    qrCaption: "Scan to verify",
    qrUrl: qr.url,
    docIdBadge: `DOC ID  ${reference}  \u00b7  v1.0`,
    confidentialityText:
      "This document is classified Confidential and is intended solely for the named distribution list above.",
  });
  return { doc, pb };
};

describe("the running footer is not stamped on the cover", () => {
  /**
   * The collision that was actually visible: the badge occupies y 786-804 and
   * drawFooter writes at 796 and 808. Asserted as a geometric fact so that
   * re-adding the footer to the cover fails here rather than shipping.
   */
  it("would collide with the badge if it were", async () => {
    const [, text] = confidentialityTexts()[0];
    const { badgeTop, badgeBottom } = await measureCover(text);
    expect(footerNoteY(PAGE_HEIGHT)).toBeGreaterThan(badgeTop);
    expect(footerNoteY(PAGE_HEIGHT)).toBeLessThan(badgeBottom);
  });

  it("draws no footer or header text on the cover, and both on interior pages", async () => {
    const { doc, pb } = await buildCoverDoc("ICT-TEST-0001");
    pb.startSection(1, "Interior");
    pb.paragraph("Body copy.");

    const draws = recordChromeDraws(doc, doc.bufferedPageRange().count - 1);
    pb.finalize();

    const onCover = draws.filter((d) => d.page === 0);
    expect(onCover.filter((d) => d.text.includes("intellocarbon.com"))).toHaveLength(0);
    expect(onCover.filter((d) => d.text.startsWith("Page "))).toHaveLength(0);
    // The header band stamps the report reference; it must stay off the cover too.
    expect(onCover.filter((d) => d.text === "ICT-TEST-0001")).toHaveLength(0);

    const onInterior = draws.filter((d) => d.page === 1);
    expect(onInterior.some((d) => d.text.includes("intellocarbon.com"))).toBe(true);
    expect(onInterior.some((d) => d.text.startsWith("Page "))).toBe(true);
  });
});

describe("page numbering is unaffected by skipping the cover", () => {
  it("still counts the cover in the total and numbers interior pages from it", async () => {
    const { doc, pb } = await buildCoverDoc("ICT-TEST-0002");
    pb.startSection(1, "One");
    pb.startSection(2, "Two");

    const draws = recordChromeDraws(doc, doc.bufferedPageRange().count - 1);
    pb.finalize();

    const numbers = draws.filter((d) => d.text.startsWith("Page ")).map((d) => `${d.page}:${d.text}`);
    // Cover is page index 0 and prints no number; it is still counted in the total.
    expect(numbers).toEqual(["1:Page 2 of 3", "2:Page 3 of 3"]);
  });
});

/**
 * The running footer is the only place an interior page says whose document it
 * is. It used to name Intellocarbon and nobody else, so a page separated from
 * its cover carried a confidentiality claim with no owner attached to it.
 */
describe("the running footer names the reporting organisation", () => {
  const footerDrawsFor = async (organisation?: string) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, left: 50, right: 50, bottom: 20 },
      bufferPages: true,
    });
    const pb = new PageBuilder(doc, "ICT-TEST-0003", organisation);
    pb.noCoverPage();
    pb.paragraph("Body copy.");

    const draws = recordChromeDraws(doc, doc.bufferedPageRange().count - 1);
    pb.finalize();
    return draws.map((d) => d.text);
  };

  it("puts the client's name in the footer when one is given", async () => {
    const texts = await footerDrawsFor("Northwind Steel Ltd");
    const footer = texts.find((t) => t.includes("Confidential"));
    expect(footer).toContain("Northwind Steel Ltd");
    // Provenance is never dropped in favour of the client name.
    expect(footer).toContain("intellocarbon.com");
  });

  it("falls back to the Intellocarbon-only note when no organisation is given", async () => {
    const texts = await footerDrawsFor();
    const footer = texts.find((t) => t.includes("Confidential"));
    expect(footer).toContain("Intellocarbon Solutions Private Limited");
  });
});

/**
 * A document with no cover page must say so, or finalize() treats page index 0
 * as a cover and skips it — which is what left the Green Steel working paper
 * with no header band, no confidentiality footer and no page number on the
 * only page it usually has.
 */
describe("a report with no cover still gets page chrome on page 1", () => {
  it("stamps header, footer and page number on the first page", async () => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, left: 50, right: 50, bottom: 20 },
      bufferPages: true,
    });
    const pb = new PageBuilder(doc, "GS-TESTREF1", "Northwind Steel Ltd");
    pb.noCoverPage();
    pb.heading("Calculation summary");

    const draws = recordChromeDraws(doc, doc.bufferedPageRange().count - 1);
    pb.finalize();

    const onFirst = draws.filter((d) => d.page === 0);
    expect(onFirst.some((d) => d.text.includes("Confidential"))).toBe(true);
    expect(onFirst.some((d) => d.text === "Page 1 of 1")).toBe(true);
    expect(onFirst.some((d) => d.text === "GS-TESTREF1")).toBe(true);
  });
});

/**
 * Every document control panel reports when the document was generated to the
 * minute, not the day. Two copies produced on the same day are otherwise
 * indistinguishable, which is exactly the question a version dispute asks.
 * Read from the builders rather than asserted per-report, so a new report type
 * that only prints a date fails here.
 */
describe("document control panels report a generated time, not only a date", () => {
  const generatedRows = (): [string, string][] => {
    const servicesDir = path.join(__dirname, "..");
    const found: [string, string][] = [];
    for (const dir of fs.readdirSync(servicesDir)) {
      const buildFile = path.join(servicesDir, dir, "build.ts");
      if (!fs.existsSync(buildFile)) continue;
      const src = fs.readFileSync(buildFile, "utf8");
      const match = src.match(/\["Generated",\s*(fmtDate|fmtDateTime)\(new Date\(\)\)\]/);
      if (!match) continue;
      found.push([dir, match[1]]);
    }
    return found;
  };

  it("finds the builders' generated rows", () => {
    expect(generatedRows().length).toBeGreaterThanOrEqual(8);
  });

  it.each(generatedRows())("%s uses fmtDateTime", (_name, fn) => {
    expect(fn).toBe("fmtDateTime");
  });
});

describe("pageNumberY stays clear of pdfkit's auto-pagination threshold", () => {
  /**
   * drawFooter's own comment warns that a text call whose bottom edge crosses
   * page.height - bottomMargin makes pdfkit add a page — which once silently
   * doubled a report's page count. Pinned so the offsets are not "tidied".
   */
  it("keeps both footer lines above the threshold", () => {
    const threshold = PAGE_HEIGHT - 20;
    const lineHeight = 9;
    expect(footerNoteY(PAGE_HEIGHT) + lineHeight).toBeLessThan(threshold);
    expect(pageNumberY(PAGE_HEIGHT) + lineHeight).toBeLessThan(threshold);
    expect(MARGIN_X).toBeGreaterThan(0);
  });
});

/**
 * Glyphs the PDF builders must not emit.
 *
 * pdfkit's standard fonts are WinAnsi-only, and a character outside that
 * encoding does not fail loudly — it either vanishes or, worse, renders with no
 * advance width so the next character prints on top of it. The euro sign did
 * exactly that on the CBAM cover's hero number for as long as the report has
 * existed: "EUR 8,14,204.24" was printing as a € collided with its first digit,
 * still correct and still unreadable.
 *
 * Asserted by measuring, not by listing known-bad characters, so a glyph nobody
 * has thought of yet is caught the first time a formatter emits it.
 */
describe("the PDF money formatters emit only glyphs the standard-14 metrics cover", () => {
  /**
   * pdfkit writes the base-14 fonts with /Encoding /WinAnsiEncoding and no
   * /Widths array, so a viewer must fall back to the font's built-in Core-14
   * AFM metrics. Those AFMs predate the euro and carry no entry for U+20AC —
   * the viewer substitutes a glyph but advances zero, so the next character
   * prints on top of it.
   *
   * That is why this is a character allowlist rather than a width measurement:
   * pdfkit's own in-process metrics happily report 556 for the euro, so
   * widthOfString cannot see the defect at all. Only the rendered page shows
   * it, and it showed it on the CBAM cover's hero number — "EUR 8,14,204.24"
   * printing as a euro sign collided with its first digit, correct and
   * unreadable.
   *
   * Latin-1 punctuation and symbols that ARE in the Core-14 AFMs are listed
   * explicitly, each because it has been checked, not assumed.
   */
  const SAFE_NON_ASCII = new Set(["\u00a3", "\u00a2", "\u00a5", "\u00b0", "\u2013", "\u2014", "\u2018", "\u2019", "\u201c", "\u201d"]);

  const offending = (formatted: string): string[] =>
    [...formatted].filter((c) => {
      const code = c.codePointAt(0)!;
      if (code >= 0x20 && code <= 0x7e) return false;
      return !SAFE_NON_ASCII.has(c);
    });

  it.each([
    ["fmtEur", fmtEur(814204.24)],
    ["fmtEur negative", fmtEur(-814204.24)],
    ["fmtGbp", fmtGbp(814204.24)],
    ["fmtGbp negative", fmtGbp(-814204.24)],
    ["fmt", fmt(814204.24)],
    ["fmtInt", fmtInt(814204)],
  ])("%s", (_name, formatted) => {
    expect(offending(formatted), `unsafe glyph(s) in ${JSON.stringify(formatted)}`).toEqual([]);
  });

  it("would have caught the euro sign", () => {
    // The regression itself, so the guard above cannot be weakened without
    // this failing too.
    expect(offending("\u20ac8,14,204.24")).toEqual(["\u20ac"]);
  });

  it("spells the euro rather than using the sign", () => {
    expect(fmtEur(1234.5)).toContain("EUR");
    expect(fmtEur(1234.5)).not.toContain("\u20ac");
    expect(fmtEur(-1234.5).startsWith("-")).toBe(true);
    // The pound is in the Core-14 AFMs with a real width, so fmtGbp keeps it.
    expect(fmtGbp(1234.5)).toContain("\u00a3");
  });
});
