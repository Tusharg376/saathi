import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearHandoff, peekHandoff } from "@/lib/handoff";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { DocumentHelper } from "./DocumentHelper";

const { push, fileToJpeg } = vi.hoisted(() => ({ push: vi.fn(), fileToJpeg: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/image/downscale", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image/downscale")>()),
  fileToJpeg,
}));

const insight = (over = {}) => ({
  kind: "challan",
  title: "Traffic challan",
  what_is_this: "A fine of Rs 500 for not wearing a helmet.",
  what_it_wants: "Pay the fine within 30 days.",
  deadline: "30 days from 12 October",
  amount: "Rs 500",
  risks: ["A bigger fine if you pay late."],
  next_steps: ["Check the challan on the official site.", "Pay online."],
  bring: ["Vehicle papers"],
  scam_signs: false,
  needs_human_help: false,
  confidence: "high",
  related: [],
  ...over,
});

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const photo = () => new File(["x"], "notice.jpg", { type: "image/jpeg" });

/** Choose a photo the way a worker does: through the file picker behind "Choose a photo". */
async function choosePhoto(file = photo()) {
  const input = document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;
  await userEvent.upload(input, file);
}

beforeEach(() => {
  push.mockReset();
  clearHandoff("complaint");
  fileToJpeg.mockReset().mockResolvedValue({ mimeType: "image/jpeg", data: "BASE64DATA", width: 10, height: 10 });
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("DocumentHelper: photo in, plain-language explanation out", () => {
  it("explains the paper: what it is, what it wants, the deadline and the next steps", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight() })));
    renderUi(<DocumentHelper />);
    await choosePhoto();

    expect(await screen.findByRole("heading", { name: "Traffic challan" })).toBeInTheDocument();
    expect(screen.getByText("A fine of Rs 500 for not wearing a helmet.")).toBeInTheDocument();
    expect(screen.getByText(/30 days from 12 October/)).toBeInTheDocument();
    expect(screen.getByText("Pay online.")).toBeInTheDocument();
  });

  it("sends the shrunken photo and the worker's question, and tells the server the language", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { insight: insight() }));
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<DocumentHelper />);
    await userEvent.type(screen.getByLabelText(/Anything you want to know/), "Do I have to pay this?");
    await choosePhoto();
    await screen.findByRole("heading", { name: "Traffic challan" });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/documents");
    expect(body.image).toEqual({ mimeType: "image/jpeg", data: "BASE64DATA" });
    expect(body.note).toBe("Do I have to pay this?");
    expect(body.lang).toBe("en");
  });

  it("says plainly that the photo is not saved", () => {
    renderUi(<DocumentHelper />);
    expect(screen.getByText(/photo is not saved/i)).toBeInTheDocument();
  });

  it("warns loudly about a likely scam, with the cyber-fraud helpline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight({ scam_signs: true }) })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/looks like a scam|scam/i);
    expect(screen.getByRole("link", { name: /1930/ })).toHaveAttribute("href", "tel:1930");
  });

  it("points a serious paper to free legal aid before the worker signs or pays", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight({ needs_human_help: true }) })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    expect(await screen.findByRole("link", { name: /15100/ })).toHaveAttribute("href", "tel:15100");
  });

  it("admits when it may have misread the paper", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight({ confidence: "low" }) })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    expect(await screen.findByText(/may not have read this correctly/)).toBeInTheDocument();
  });

  it("offers related help from the knowledge base", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respond(200, { insight: insight({ related: ["grievance.challan"] }) })),
    );
    renderUi(<DocumentHelper />);
    await choosePhoto();
    expect(await screen.findByText("Related help")).toBeInTheDocument();
  });

  it("Check another paper starts over", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight() })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    await userEvent.click(await screen.findByRole("button", { name: "Check another paper" }));
    expect(screen.queryByRole("heading", { name: "Traffic challan" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take a photo" })).toBeInTheDocument();
  });
});

describe("DocumentHelper: from the paper to a complaint", () => {
  it("a challan opens the matching complaint with the explanation and amount filled in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight() })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    await userEvent.click(await screen.findByRole("button", { name: "Write a complaint about this paper" }));

    expect(push).toHaveBeenCalledWith("/help/complaint");
    expect(peekHandoff("complaint")).toEqual({
      issue: "challan",
      description: "A fine of Rs 500 for not wearing a helmet.",
      amountInr: 500,
    });
  });

  it("another kind of paper leaves the worker to choose the type of complaint", async () => {
    const other = insight({ kind: "platform_message", amount: "" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: other })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    await userEvent.click(await screen.findByRole("button", { name: "Write a complaint about this paper" }));
    expect(peekHandoff("complaint")).toEqual({ description: other.what_is_this });
  });

  it("offers no complaint for a photo that could not be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight({ kind: "unreadable" }) })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    await screen.findByText("Could not read");
    expect(screen.queryByRole("button", { name: "Write a complaint about this paper" })).not.toBeInTheDocument();
  });
});

describe("DocumentHelper: when something goes wrong", () => {
  it("no API key: says reading papers needs AI that is not switched on", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(503, { error: "no_key" })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    expect(await screen.findByRole("alert")).toHaveTextContent(/needs AI, which is not switched on/);
  });

  it("offline: asks for a clearer photo and lets the worker try again", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not read this paper");
    expect(screen.getByRole("button", { name: "Take a photo" })).toBeEnabled();
  });

  it("rate limited: asks the worker to wait", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(429, { error: "rate_limited" })));
    renderUi(<DocumentHelper />);
    await choosePhoto();
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many tries");
  });

  it("a file that is not a usable photo never reaches the server", async () => {
    const { ImageError } = await import("@/lib/image/downscale");
    fileToJpeg.mockRejectedValue(new ImageError("Not an image"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<DocumentHelper />);
    await choosePhoto();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not open that photo");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("DocumentHelper: accessibility", () => {
  it("has no violations before and after a photo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight({ scam_signs: true }) })));
    const { container } = renderUi(<DocumentHelper />);
    expect(await axe(container)).toHaveNoViolations();
    await choosePhoto();
    await screen.findByRole("heading", { name: "Traffic challan" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
