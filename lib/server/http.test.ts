import { describe, expect, it } from "vitest";
import { z } from "zod";
import { readBody, tooLarge } from "./http";

const request = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://app/api/x", { method: "POST", headers, body });

describe("tooLarge", () => {
  it("refuses a body that announces itself as bigger than the limit, with a 413", async () => {
    const res = tooLarge(request("{}", { "content-length": "9000000" }));
    expect(res?.status).toBe(413);
    expect(await res?.json()).toEqual({ error: "too_large" });
  });

  it("lets a body at or under the limit through", () => {
    expect(tooLarge(request("{}", { "content-length": "4500000" }))).toBeNull();
    expect(tooLarge(request("{}", { "content-length": "2" }), 10)).toBeNull();
    expect(tooLarge(request("{}", { "content-length": "11" }), 10)?.status).toBe(413);
  });

  it("does not guess when there is no usable length", () => {
    expect(tooLarge(request("{}"))).toBeNull();
    expect(tooLarge(request("{}", { "content-length": "abc" }))).toBeNull();
  });
});

describe("readBody", () => {
  const schema = z.object({ a: z.number() });

  it("returns the validated data", async () => {
    expect(await readBody(request('{"a":1}'), schema)).toEqual({ ok: true, data: { a: 1 } });
  });

  it("answers 400 for text that is not JSON and for JSON that fails the schema", async () => {
    for (const body of ["{nope", '{"a":"x"}']) {
      const r = await readBody(request(body), schema);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.res.status).toBe(400);
    }
  });

  it("answers 413 without reading a body that is announced as too large", async () => {
    const r = await readBody(request('{"a":1}', { "content-length": "99999999" }), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(413);
  });
});
