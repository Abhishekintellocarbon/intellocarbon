#!/usr/bin/env node
// Downloads Tesseract's English language data into the OCR cache directory, so
// the running API never has to fetch it.
//
// Why this exists: tesseract.js loads eng.traineddata from
// `<cachePath>/eng.traineddata` if it is there, and otherwise fetches ~5MB
// from the jsdelivr CDN on the very first OCR of the process. That download
// sits inside a request, is slow on a cold container, and fails outright
// wherever egress is restricted — turning the first client to upload a bill
// after each deploy into the one who pays for it.
//
// Run at build time, where a slow download costs nothing. Failure here is not
// fatal: the API degrades to fetching at runtime, and if that also fails the
// extraction is marked OCR_UNAVAILABLE and the manual flow carries on.
//
// Usage:
//   node scripts/fetch-ocr-langdata.js [targetDir]
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const LANG = "eng";
// Must match the URL tesseract.js v5 builds for LSTM-only workers — see
// worker-script/index.js. Pinned rather than derived so an upstream change
// surfaces as a checksum-sized mismatch here instead of a silent miss.
const URL = `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${LANG}/4.0.0_best_int/${LANG}.traineddata.gz`;
const TIMEOUT_MS = 120_000;

const targetDir = process.argv[2] ?? path.join(__dirname, "..", "backend", "ocr-langdata");
const targetFile = path.join(targetDir, `${LANG}.traineddata`);

(async () => {
  if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 1_000_000) {
    console.log(`OCR language data already present at ${targetFile} — nothing to do.`);
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`Fetching ${URL}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const gz = Buffer.from(await res.arrayBuffer());
    // tesseract.js caches the decompressed file, so decompress before writing —
    // a .gz written under this name is read back as a corrupt model.
    const raw = zlib.gunzipSync(gz);
    // Written via a temp file and renamed, so an interrupted build can't leave
    // a half-written model that reads as present and then fails to load.
    const tmp = `${targetFile}.partial`;
    fs.writeFileSync(tmp, raw);
    fs.renameSync(tmp, targetFile);
    console.log(`Wrote ${targetFile} (${(raw.length / 1024 / 1024).toFixed(1)} MB)`);
  } catch (err) {
    console.warn(`Could not fetch OCR language data: ${err.message}`);
    console.warn("OCR will try to fetch it at runtime instead; if that also fails, bill extraction reports OCR_UNAVAILABLE and the manual upload flow is unaffected.");
    // Deliberately not a non-zero exit: OCR is an enhancement, and a CDN
    // hiccup must not fail a deploy of everything else.
  } finally {
    clearTimeout(timer);
  }
})();
