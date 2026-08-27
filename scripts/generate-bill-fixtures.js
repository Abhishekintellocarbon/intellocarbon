#!/usr/bin/env node
// Renders the bill layout fixtures to real PDF and PNG files.
//
// Two uses:
//   - the OCR integration test needs a genuine raster image to recognise;
//   - the live-site smoke test needs files a human can actually pick in a
//     file dialog and upload through the browser.
//
// These are reconstructions of each discom's bill *layout*, not copies of real
// customer bills. A green run against them says the parser handles the shapes
// it was built for. It does not say the parser handles a real bill from any of
// these utilities — that needs genuine bills, and any format they break on
// belongs back in billFixtures.ts as a new case.
//
// Usage (from repo root):
//   node scripts/generate-bill-fixtures.js [outputDir]
//
// PNG conversion uses macOS `sips` and is skipped elsewhere; the PDFs are
// produced on every platform.
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const PDFDocument = require(path.join(__dirname, "..", "backend", "node_modules", "pdfkit"));

const outDir = process.argv[2] ?? path.join(__dirname, "..", "backend", "src", "services", "billIntelligence", "__tests__", "fixtures");

// Kept in step with backend/src/services/billIntelligence/__tests__/billFixtures.ts.
// Duplicated rather than imported because that file is TypeScript and this is a
// plain node script run outside the build; the parser tests read the TS copy, and
// the round-trip test below re-parses these PDFs, so a drift between the two
// shows up as a failing test rather than as a silently stale fixture.
const FIXTURES = {
  "msedcl-ht-industrial": `MAHARASHTRA STATE ELECTRICITY DISTRIBUTION CO. LTD.
MAHAVITARAN
HT ENERGY BILL
Consumer No : 010119001234          Bill No : 1234567890
Consumer Name : NORTHWIND STEEL PVT LTD
Tariff Category : HT-I INDUSTRIAL
Sanctioned Load : 2500 KVA          Contract Demand : 2400 KVA
Billing Period : 01/06/2026 to 30/06/2026
Present Reading : 458200            Previous Reading : 445700
Units Consumed : 12,50,000 kWh
Rate Per Unit : Rs. 8.45
Net Bill Amount : Rs. 1,05,62,500.00`,

  "tangedco-ht": `TAMIL NADU GENERATION AND DISTRIBUTION CORPORATION LIMITED
TANGEDCO HT CURRENT CONSUMPTION BILL
Service Connection No: 0123456789
Tariff: HT-IA INDUSTRIAL
Sanctioned Demand: 1500 KVA
Billing Period: 01-07-2026 to 31-07-2026
Total Units Consumed: 845,320 kWh
Average Rate Per Unit: 7.90
Total Amount Payable: 66,780,280.00`,

  "bescom-lt": `BANGALORE ELECTRICITY SUPPLY COMPANY LIMITED
BESCOM
RR No: BLR-4471-2290
Tariff: LT-5 INDUSTRIAL
Sanctioned Load: 85 KW
Billing Period: 05.05.2026 - 04.06.2026
Units Consumed: 42500
Rate/Unit: 7.10
Total Payable: 301750.00`,

  "pvvnl-billing-month": `PASCHIMANCHAL VIDYUT VITRAN NIGAM LIMITED
PVVNL
Account No: 4400123456
Tariff Category: LMV-6 INDUSTRIAL
Sanctioned Load: 120 KW
Billing Month: JUNE-2026
Energy Consumed: 96.4 MWh
Rate Per Unit: 8.05`,

  "torrent-kvah-only": `TORRENT POWER LIMITED
Service No: 992010445
Tariff: HTP-I INDUSTRIAL
Sanctioned Load: 3000 KVA
Billing Period: 01/06/2026 to 30/06/2026
Units Consumed: 1,120,400 kVAh
Rate Per Unit: 8.10`,

  "not-a-bill": `PURCHASE ORDER
Vendor: Acme Refractories Pvt Ltd
PO Number: PO-2026-8841
Delivery Date: 12/06/2026
Item: Magnesia carbon brick, 40 tonnes
Total: Rs. 18,40,000`,
};

const writePdf = (name, text) =>
  new Promise((resolve, reject) => {
    const file = path.join(outDir, `${name}.pdf`);
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(file);
    doc.pipe(stream);
    // Courier keeps the column alignment that real bills use, and keeps the
    // glyphs unambiguous for the OCR pass.
    doc.font("Courier").fontSize(10);
    for (const line of text.split("\n")) doc.text(line);
    doc.end();
    stream.on("finish", () => resolve(file));
    stream.on("error", reject);
  });

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const [name, text] of Object.entries(FIXTURES)) {
    written.push(await writePdf(name, text));
  }

  // One raster fixture for the OCR path. Only the MSEDCL bill is rasterised —
  // the OCR test is about the engine working end to end, not about re-testing
  // every layout through a second engine.
  if (process.platform === "darwin") {
    const src = path.join(outDir, "msedcl-ht-industrial.pdf");
    const dest = path.join(outDir, "msedcl-ht-industrial.png");
    try {
      // Resampled to 2480px wide — A4 at roughly 300 DPI. This is not a
      // cosmetic choice: the same page rasterised at ~200 DPI OCRs at 60%
      // confidence and comes back as "Units Consused : 12,50,000 keh", which
      // the parser correctly refuses to read. Resolution is the single largest
      // factor in whether OCR produces anything usable, which is also why the
      // upload UI asks clients for a straight, full-page photo.
      execFileSync("sips", ["-s", "format", "png", "--resampleWidth", "2480", src, "--out", dest], {
        stdio: "ignore",
      });
      written.push(dest);
    } catch (err) {
      console.warn(`Could not rasterise the OCR fixture: ${err.message}`);
    }
  } else {
    console.warn("Not macOS — skipping PNG generation. The committed PNG fixture is still used by the OCR test.");
  }

  console.log(`Wrote ${written.length} bill fixture(s) to ${outDir}\n`);
  for (const f of written) console.log(`  ${path.relative(process.cwd(), f)}`);
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
