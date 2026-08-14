import { ImageResponse } from "next/og";
import { flatMarkSvgMarkup, INTELLOCARBON_NAVY } from "@/components/ui/intellocarbon-logo";

// Apple touch icons must be raster — iOS does not accept SVG here, which is
// why this route exists at all rather than being a second static file next to
// icon.svg. Generated at build time from the same geometry constants as the
// on-screen mark, so the icon cannot drift from the component.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // Satori rasterises an <img> source rather than arbitrary inline SVG
  // children, so the mark is handed over as a data URI. Encoded with
  // encodeURIComponent rather than base64 — it keeps the markup greppable in
  // the built output, and the document is small enough that the size
  // difference is irrelevant.
  const markup = flatMarkSvgMarkup();
  const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Apple masks the icon to a rounded rect and composites it on the
          // home screen with no transparency, so it gets the navy ground
          // rather than being left to sit on whatever wallpaper is behind it.
          background: INTELLOCARBON_NAVY,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUri} width={132} height={132} alt="" />
      </div>
    ),
    size,
  );
}
