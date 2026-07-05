#!/usr/bin/env node
// Sends the monthly security report email via Resend's HTTP API directly —
// deliberately not importing backend/src/services/email.service.ts, since
// that pulls in config/env.ts's full env validation (DATABASE_URL, JWT
// secrets, etc.), none of which this CI job has or needs. Only
// RESEND_API_KEY is required; reads the report body from stdin.
//
// Usage: cat report.txt | RESEND_API_KEY=... node scripts/send-monthly-report.js

const to = process.env.SECURITY_REPORT_TO || "abhishek@intellocarbon.com";
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM || "Intellocarbon <notifications@intellocarbon.com>";

const readStdin = () =>
  new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  const reportText = await readStdin();

  if (!apiKey) {
    console.log("RESEND_API_KEY not set — printing report instead of emailing (dev/local run):\n");
    console.log(reportText);
    return;
  }

  const html = `
    <div style="background:#0F1923;padding:32px;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:640px;margin:0 auto;background:#162230;border-radius:12px;padding:32px;border:1px solid #22303f;">
        <h1 style="color:#00D4AA;font-size:20px;margin:0 0 16px;">Intellocarbon — Monthly Security Report</h1>
        <pre style="color:#B5C0CC;font-size:13px;line-height:1.6;white-space:pre-wrap;font-family:ui-monospace,monospace;">${escapeHtml(reportText)}</pre>
      </div>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Intellocarbon monthly security report — ${new Date().toISOString().slice(0, 10)}`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend API returned ${res.status}: ${body}`);
    process.exit(1);
  }

  console.log(`Monthly security report sent to ${to}`);
}

main().catch((err) => {
  console.error("Failed to send monthly security report:", err);
  process.exit(1);
});
