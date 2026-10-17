import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LANGUAGES } from "@/lib/i18n/messages";
import manifest from "./manifest";
import { GET as iconRoute, generateStaticParams } from "./icons/[size]/route";

const m = manifest();
const root = path.resolve(__dirname, "..");
const iconRequest = (size: string) =>
  iconRoute(new Request(`http://x/icons/${size}`), { params: Promise.resolve({ size }) });

describe("web app manifest (installing Saathi on the home screen)", () => {
  it("opens full screen from the front page, as an installed app", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.name).toContain("Saathi");
  });

  it("opens in a language the app actually has", () => {
    expect(LANGUAGES.map((l) => l.code)).toContain(m.lang);
  });

  it("offers a plain icon and a maskable one, both large enough for a phone home screen", () => {
    const purposes = (m.icons ?? []).map((i) => i.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
    expect((m.icons ?? []).some((i) => i.sizes === "512x512")).toBe(true);
    expect((m.icons ?? []).some((i) => i.sizes === "192x192")).toBe(true);
  });

  it("only points at icons that really are served, as PNG pictures of the size it claims", async () => {
    const served = generateStaticParams().map((p) => Number(p.size));
    const listed = [...(m.icons ?? []), ...(m.shortcuts ?? []).flatMap((s) => s.icons ?? [])];
    for (const icon of listed) {
      const px = Number(String(icon.sizes).split("x")[0]);
      expect(icon.src, `icon ${icon.src}`).toBe(`/icons/${px}`);
      expect(served, `icon ${icon.src}`).toContain(px);
    }
    const res = await iconRequest("192");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]); // the file really is a PNG
  });

  it("refuses to draw an icon size nobody asked for, instead of burning server time on any number", async () => {
    expect((await iconRequest("9999")).status).toBe(404);
    expect((await iconRequest("abc")).status).toBe(404);
  });

  it("gives long-press shortcuts to Emergency and Earnings, and both screens exist", () => {
    const urls = (m.shortcuts ?? []).map((s) => s.url);
    expect(urls).toEqual(["/sos", "/earnings"]);
    for (const url of urls) expect(existsSync(path.join(root, "app", url, "page.tsx")), url).toBe(true);
  });

  it("keeps the shortcuts working with no signal, because the offline worker stores those pages in advance", () => {
    const worker = readFileSync(path.join(root, "public", "sw.js"), "utf8");
    const precache = worker.match(/PRECACHE\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    for (const url of [m.start_url, ...(m.shortcuts ?? []).map((s) => s.url)]) {
      expect(precache, `${url} is saved for offline use`).toContain(`"${url}"`);
    }
  });
});
