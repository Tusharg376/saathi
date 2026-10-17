import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORIGIN, html, requestFor, startWorker, text } from "@/test/serviceWorker";

const PAGES = ["/", "/sos", "/rights", "/earnings", "/help", "/help/documents", "/help/complaint"];
const CSS = "/_next/static/css/app.css";
const JS = "/_next/static/chunks/app.js";
const FONT = "/_next/static/media/noto.woff2";

/** A phone that is online: every main page links the same script and stylesheet, and the stylesheet names a font. */
function onlineSite(w: ReturnType<typeof startWorker>) {
  for (const p of PAGES) {
    w.network.routes[p] = () => html(`<html>${p}<link href="${CSS}"><script src="${JS}"></script></html>`);
  }
  w.network.routes[CSS] = () => text(`@font-face{src:url(${FONT})}`);
  w.network.routes[JS] = () => text("console.log('app')");
  w.network.routes[FONT] = () => text("fontbytes");
}

const shell = (w: ReturnType<typeof startWorker>) => w.caches.stores.get("saathi-shell-v1")!;
const assets = (w: ReturnType<typeof startWorker>) => w.caches.stores.get("saathi-assets-v1")!;
const bodyOf = async (r: Promise<Response> | null) => (await r!).text();

describe("offline worker: getting ready while there is signal", () => {
  it("saves every main page, including SOS, so they open later with no signal", async () => {
    const w = startWorker();
    onlineSite(w);
    await w.lifecycle("install");
    for (const p of PAGES) expect([...shell(w).entries.keys()], p).toContain(ORIGIN + p);
  });

  it("also saves the scripts, styles and fonts those pages use, or they would open blank offline", async () => {
    const w = startWorker();
    onlineSite(w);
    await w.lifecycle("install");
    expect([...assets(w).entries.keys()].sort()).toEqual([CSS, FONT, JS].map((f) => ORIGIN + f).sort());
  });

  it("takes over straight away, without waiting for every tab to close", async () => {
    const w = startWorker();
    onlineSite(w);
    await w.lifecycle("install");
    expect(w.calls.skipWaiting).toBe(1);
  });

  it("finishes installing even when the phone is offline, and fills in later as pages are visited", async () => {
    const w = startWorker();
    w.network.offline = true;
    await expect(w.lifecycle("install")).resolves.toBeUndefined();
    expect(w.calls.skipWaiting).toBe(1);
  });

  it("does not save a page the server answered with an error", async () => {
    const w = startWorker();
    onlineSite(w);
    w.network.routes["/rights"] = () => text("oops", 500);
    await w.lifecycle("install");
    expect([...shell(w).entries.keys()]).not.toContain(ORIGIN + "/rights");
    expect([...shell(w).entries.keys()]).toContain(ORIGIN + "/sos");
  });

  it("clears out saved files from older versions of Saathi, and leaves other sites' caches alone", async () => {
    const w = startWorker();
    await w.caches.open("saathi-shell-v0");
    await w.caches.open("saathi-assets-v0");
    await w.caches.open("saathi-shell-v1");
    await w.caches.open("someone-elses-cache");

    await w.lifecycle("activate");

    expect(await w.caches.keys()).toEqual(["saathi-shell-v1", "someone-elses-cache"]);
    expect(w.calls.claim).toBe(1);
  });
});

describe("offline worker: what it leaves alone", () => {
  let w: ReturnType<typeof startWorker>;
  beforeEach(async () => {
    w = startWorker();
    onlineSite(w);
    await w.lifecycle("install");
  });

  it("never touches the AI and data requests, even if one is opened like a page, because the app handles being offline itself", () => {
    expect(w.fetchEvent(requestFor("/api/chat", { method: "POST" }))).toBeNull();
    expect(w.fetchEvent(requestFor("/api/health", { mode: "navigate" }))).toBeNull();
    expect(w.fetchEvent(requestFor("/api/earnings/parse", { mode: "navigate" }))).toBeNull();
  });

  it("only handles reading pages, never form posts or other changes", () => {
    expect(w.fetchEvent(requestFor("/earnings", { method: "POST", mode: "navigate" }))).toBeNull();
  });

  it("ignores other websites", () => {
    expect(w.fetchEvent(requestFor("https://fonts.example.com/font.woff2"))).toBeNull();
  });

  it("never serves itself from the cache, so a fixed version can always arrive", () => {
    expect(w.fetchEvent(requestFor("/sw.js"))).toBeNull();
  });

  it("leaves Next's page-data requests fresh, whichever way they are marked", () => {
    expect(w.fetchEvent(requestFor("/earnings?_rsc=abc123", { mode: "navigate" }))).toBeNull();
    expect(w.fetchEvent(requestFor("/earnings", { mode: "navigate", headers: { RSC: "1" } }))).toBeNull();
  });
});

describe("offline worker: opening pages", () => {
  let w: ReturnType<typeof startWorker>;
  beforeEach(async () => {
    w = startWorker();
    onlineSite(w);
    await w.lifecycle("install");
  });
  afterEach(() => vi.useRealTimers());

  const open = (path: string) => w.fetchEvent(requestFor(path, { mode: "navigate" }));

  it("with signal, shows the newest version of the page and keeps it for later", async () => {
    w.network.routes["/rights"] = () => html("<html>NEW rights page</html>");
    expect(await bodyOf(open("/rights"))).toContain("NEW rights page");
    await vi.waitFor(async () =>
      expect(await (await shell(w).match(ORIGIN + "/rights"))!.text()).toContain("NEW rights page"),
    );
  });

  it("with no signal, shows the last saved copy of the page", async () => {
    w.network.offline = true;
    expect(await bodyOf(open("/earnings"))).toContain("/earnings");
  });

  it("with no signal and a page never opened before, shows the SOS screen instead of an error", async () => {
    w.network.offline = true;
    expect(await bodyOf(open("/some/page/never/visited"))).toContain("/sos");
  });

  it("with no signal and nothing saved at all, fails the way a browser normally would", async () => {
    const empty = startWorker();
    empty.network.offline = true;
    const res = await empty.fetchEvent(requestFor("/earnings", { mode: "navigate" }))!;
    expect(res.type).toBe("error");
  });

  it("treats /earnings?x=1 and /earnings as one page, so a saved copy is found whatever the link looked like", async () => {
    w.network.routes["/earnings"] = () => html("<html>fresh earnings</html>");
    await open("/earnings?fresh=1");
    await vi.waitFor(async () => expect(await shell(w).match(ORIGIN + "/earnings")).toBeDefined());
    w.network.offline = true;
    expect(await bodyOf(open("/earnings"))).toContain("fresh earnings");
  });

  it("does not overwrite a good saved copy with a server error page", async () => {
    w.network.routes["/rights"] = () => text("Internal error", 500);
    expect(await bodyOf(open("/rights"))).toBe("Internal error"); // the worker shows what the server said
    await new Promise((r) => setTimeout(r, 10));
    expect(await (await shell(w).match(ORIGIN + "/rights"))!.text()).toContain("/rights"); // but keeps the good copy
  });

  it("on a stalled connection, gives up after 4 seconds and shows the saved copy instead of hanging", async () => {
    vi.useFakeTimers();
    w.network.routes["/rights"] = () => new Promise<Response>(() => {}); // never answers
    const answer = open("/rights")!;
    await vi.advanceTimersByTimeAsync(4100);
    expect(await (await answer).text()).toContain("/rights");
  });

  it("is more patient when nothing is saved, waiting up to 15 seconds for a slow network", async () => {
    vi.useFakeTimers();
    const fresh = startWorker();
    fresh.network.routes["/rights"] = () =>
      new Promise<Response>((resolve) => setTimeout(() => resolve(html("<html>slow but arrived</html>")), 9000));
    const answer = fresh.fetchEvent(requestFor("/rights", { mode: "navigate" }))!;
    await vi.advanceTimersByTimeAsync(9100);
    expect(await (await answer).text()).toContain("slow but arrived");
  });
});

describe("offline worker: scripts, styles, fonts and icons", () => {
  it("serves a saved file straight from the phone without using the network", async () => {
    const w = startWorker();
    onlineSite(w);
    await w.lifecycle("install");
    w.network.requested.length = 0;

    const res = await w.fetchEvent(requestFor(JS))!;

    expect(await res.text()).toBe("console.log('app')");
    expect(w.network.requested).toEqual([]);
  });

  it("fetches a file it has not seen yet, then keeps it for next time", async () => {
    const w = startWorker();
    w.network.routes["/icons/192"] = () => new Response("png", { headers: { "content-type": "image/png" } });

    expect(await bodyOf(w.fetchEvent(requestFor("/icons/192")))).toBe("png");
    await vi.waitFor(() => expect(assets(w).entries.size).toBe(1));

    w.network.offline = true;
    expect(await bodyOf(w.fetchEvent(requestFor("/icons/192")))).toBe("png");
  });

  it("does not keep a file that failed to download", async () => {
    const w = startWorker();
    w.network.routes[JS] = () => text("gone", 404);
    await bodyOf(w.fetchEvent(requestFor(JS)));
    await new Promise((r) => setTimeout(r, 10));
    expect(assets(w).entries.size).toBe(0);
  });
});
