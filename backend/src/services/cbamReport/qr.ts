import QRCode from "qrcode";

const VERIFY_BASE_URL = "https://intellocarbon.com/verify";

/** Standard trust-signal QR for the report cover — resolves to a public verification page for the report reference. */
export const buildVerifyQr = async (reportReference: string): Promise<{ buffer: Buffer; url: string }> => {
  const url = `${VERIFY_BASE_URL}/${encodeURIComponent(reportReference)}`;
  const buffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#0F1923", light: "#FFFFFF" },
  });
  return { buffer, url };
};
