import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * Runs the real public/sw.js the way a browser would, against a fake phone: an in-memory cache
 * store and a network the test controls. Nothing here re-implements the worker; it only supplies
 * what the browser would (self, caches, fetch, location) and lets the test fire its events.
 */

export const ORIGIN = "https://saathi.test";

type Handler = (event: unknown) => void;
type Routes = Record<string, () => Response | Promise<Response>>;

class FakeCache {
  readonly entries = new Map<string, Response>();
  // Like the real Cache API, a path is the same entry as the full address it resolves to.
  private key = (r: unknown) => new URL(typeof r === "string" ? r : (r as { url: string }).url, ORIGIN).href;
  async put(request: unknown, response: Response) {
    this.entries.set(this.key(request), response);
  }
  async match(request: unknown) {
    return this.entries.get(this.key(request))?.clone();
  }
}

class FakeCacheStorage {
  readonly stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)!;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
}

/** A navigation or fetch the way the worker sees it. (The real Request class refuses `mode: navigate`.) */
export function requestFor(
  url: string,
  init: { method?: string; mode?: string; headers?: Record<string, string> } = {},
) {
  return {
    url: url.startsWith("http") ? url : ORIGIN + url,
    method: init.method ?? "GET",
    mode: init.mode ?? "no-cors",
    headers: new Headers(init.headers),
  };
}

export const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html" } });
export const text = (body: string, status = 200) => new Response(body, { status });

export function startWorker() {
  const handlers: Record<string, Handler> = {};
  const caches = new FakeCacheStorage();
  const network = { routes: {} as Routes, requested: [] as string[], offline: false };
  const calls = { skipWaiting: 0, claim: 0 };

  const fetchFake = async (input: unknown) => {
    const url = typeof input === "string" ? input : (input as { url: string }).url;
    const path = new URL(url, ORIGIN).pathname + new URL(url, ORIGIN).search;
    network.requested.push(path);
    if (network.offline) throw new TypeError("Failed to fetch");
    const route = network.routes[path] ?? network.routes[new URL(url, ORIGIN).pathname];
    if (!route) return new Response("not found", { status: 404 });
    return route();
  };

  const self = {
    addEventListener: (type: string, fn: Handler) => void (handlers[type] = fn),
    skipWaiting: async () => void calls.skipWaiting++,
    clients: { claim: async () => void calls.claim++ },
  };

  const source = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");
  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetchFake,
    location: { origin: ORIGIN },
    Request,
    Response,
    URL,
    Headers,
    Set,
    Promise,
    setTimeout: (...a: Parameters<typeof setTimeout>) => setTimeout(...a),
    clearTimeout: (t: Parameters<typeof clearTimeout>[0]) => clearTimeout(t),
  });

  /** Fires `install` or `activate` and waits for the work the worker asked the browser to wait for. */
  async function lifecycle(type: "install" | "activate") {
    let work: Promise<unknown> = Promise.resolve();
    handlers[type]({ waitUntil: (p: Promise<unknown>) => void (work = p) });
    await work;
  }

  /** Fires a fetch. `answer` is what the worker gave the page, or null when it left the request alone. */
  function fetchEvent(request: ReturnType<typeof requestFor>) {
    let answer: Promise<Response> | null = null;
    handlers.fetch({ request, respondWith: (p: Promise<Response>) => void (answer = p) });
    return answer as Promise<Response> | null;
  }

  return { caches, network, calls, lifecycle, fetchEvent };
}
