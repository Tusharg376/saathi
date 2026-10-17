import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IconArt } from "./icon";

describe("IconArt (the app icon)", () => {
  it("draws at exactly the size asked for, from one picture that scales cleanly", () => {
    for (const size of [32, 180, 192, 512]) {
      const svg = renderToStaticMarkup(<IconArt size={size} />);
      expect(svg).toContain(`width="${size}"`);
      expect(svg).toContain(`height="${size}"`);
      expect(svg).toContain('viewBox="0 0 512 512"');
    }
  });

  it("is shapes only, with no text, so it looks identical on every device whatever fonts are installed", () => {
    const svg = renderToStaticMarkup(<IconArt size={192} />);
    expect(svg).not.toMatch(/<text|font-family|<image/);
    expect(svg).toContain("<path"); // the S is drawn as a stroke
  });
});
