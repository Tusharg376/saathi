import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _openForTest, listEntries } from "@/lib/db";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { EarningsView } from "./EarningsView";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

let dbCounter = 0;
let db: ReturnType<typeof _openForTest>;
beforeEach(() => {
  db = _openForTest(`add-earnings-sheet-${++dbCounter}`); // a fresh on-device database for every test
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const sheet = () => screen.getByRole("dialog", { name: "Add earnings" });
const field = (label: string, index = 0) => within(sheet()).getAllByLabelText(label)[index];
const fileInput = () => sheet().querySelector<HTMLInputElement>('input[type="file"]')!;
const screenshot = (name = "payout.png") => new File([new Uint8Array(2000)], name, { type: "image/png" });
const noMatchingFiles = userEvent.setup({ applyAccept: false });

async function openSheet() {
  renderUi(<EarningsView />);
  await screen.findByText(/No earnings yet/);
  await userEvent.click(screen.getByRole("button", { name: "Add earnings" }));
}

/** A phone that can decode and redraw photos; jsdom cannot, so this stands in for the camera roll. */
function phoneWithPhotos({ decodes = true, drawingBreaks = false } = {}) {
  const bitmap = { width: 3000, height: 1500, close: vi.fn() };
  vi.stubGlobal(
    "createImageBitmap",
    decodes ? vi.fn().mockResolvedValue(bitmap) : vi.fn().mockRejectedValue(new Error("corrupt")),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    if (drawingBreaks) throw new Error("canvas exploded");
    return { fillRect() {}, drawImage() {}, set fillStyle(_v: string) {} } as unknown as CanvasRenderingContext2D;
  } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) =>
    cb(new Blob(["jpegbytes"], { type: "image/jpeg" })),
  );
  return bitmap;
}

describe("Add earnings: reading a photo of the earnings screen", () => {
  it("the photo button opens the phone's photo picker", async () => {
    await openSheet();
    const pick = vi.spyOn(HTMLInputElement.prototype, "click");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Photo of earnings screen" }));
    expect(pick).toHaveBeenCalled();
    expect(fileInput()).toHaveAttribute("accept", "image/*");
  });

  it("shrinks the photo, sends only that picture, and fills the form for the worker to check before saving", async () => {
    const bitmap = phoneWithPhotos();
    const fetchMock = vi.fn().mockResolvedValue(
      respond(200, {
        entries: [
          { date: "2026-10-16", platform: "Zomato", grossInr: 2100, deductionsInr: 150, fuelInr: 0, otherCostInr: 0 },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await openSheet();

    await userEvent.upload(fileInput(), screenshot());

    await waitFor(() => expect(field("App or work")).toHaveValue("Zomato"));
    expect(field("Earned (Rs)")).toHaveValue("2100");
    expect(field("Cut or penalty (Rs)")).toHaveValue("150");

    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent.image).toEqual({ mimeType: "image/jpeg", data: btoa("jpegbytes") });
    expect(sent.text).toBeUndefined();
    expect(bitmap.close).toHaveBeenCalled();
    expect(await listEntries()).toHaveLength(0); // read, not saved: the worker has not pressed Save
  });

  it("shows that it is reading, and stops the worker pressing things twice meanwhile", async () => {
    phoneWithPhotos();
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((r) => (finish = r))));
    await openSheet();

    await userEvent.upload(fileInput(), screenshot());

    expect(await within(sheet()).findByRole("status", { name: "Reading…" })).toBeInTheDocument();
    expect(within(sheet()).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(sheet()).getByRole("button", { name: "Reading…" })).toBeDisabled();

    finish(respond(200, { entries: [], question: "Which day was this?" }));
    expect(await within(sheet()).findByText("Which day was this?")).toBeInTheDocument();
    expect(within(sheet()).queryByRole("status", { name: "Reading…" })).not.toBeInTheDocument();
    expect(within(sheet()).getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("says so when the file is not a picture, and sends nothing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await openSheet();

    await noMatchingFiles.upload(fileInput(), new File(["%PDF"], "statement.pdf", { type: "application/pdf" }));

    expect(await within(sheet()).findByRole("alert")).toHaveTextContent("Could not open that photo.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(sheet()).getByRole("button", { name: "Photo of earnings screen" })).toBeEnabled(); // can try again
  });

  it("says so when the photo is damaged and cannot be opened", async () => {
    phoneWithPhotos({ decodes: false });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await openSheet();

    await userEvent.upload(fileInput(), screenshot());

    expect(await within(sheet()).findByRole("alert")).toHaveTextContent("Could not open that photo.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to filling the form by hand when something unexpected breaks while preparing the photo", async () => {
    phoneWithPhotos({ drawingBreaks: true });
    await openSheet();

    await userEvent.upload(fileInput(), screenshot());

    expect(await within(sheet()).findByRole("alert")).toHaveTextContent("Could not read that. Fill the form by hand.");
    await userEvent.type(field("Earned (Rs)"), "900"); // the manual form still works
    expect(field("Earned (Rs)")).toHaveValue("900");
  });

  it("tells the worker to wait when too many photos were sent, instead of saying it failed", async () => {
    phoneWithPhotos();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(429, { error: "rate_limited" })));
    await openSheet();
    await userEvent.upload(fileInput(), screenshot());
    expect(await within(sheet()).findByRole("alert")).toHaveTextContent("Too many tries. Wait a minute.");
  });
});

describe("Add earnings: several entries and saving", () => {
  it("adds a second day and saves both entries together", async () => {
    await openSheet();
    await userEvent.type(field("App or work", 0), "Swiggy");
    await userEvent.type(field("Earned (Rs)", 0), "1000");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add another" }));
    await userEvent.type(field("App or work", 1), "Zomato");
    await userEvent.type(field("Earned (Rs)", 1), "700");

    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));

    await waitFor(async () => expect(await listEntries()).toHaveLength(2));
    expect((await listEntries()).map((e) => e.platform).sort()).toEqual(["Swiggy", "Zomato"]);
  });

  it("removes an extra entry with its Remove button, and only offers Remove when there is more than one", async () => {
    await openSheet();
    expect(within(sheet()).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add another" }));
    expect(within(sheet()).getAllByRole("button", { name: "Remove" })).toHaveLength(2);

    await userEvent.type(field("Earned (Rs)", 1), "700");
    await userEvent.click(within(sheet()).getAllByRole("button", { name: "Remove" })[0]);

    expect(within(sheet()).getAllByLabelText("Earned (Rs)")).toHaveLength(1);
    expect(field("Earned (Rs)")).toHaveValue("700"); // the right one was removed
    expect(within(sheet()).queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("keeps the worker's entries on screen and says why when the phone cannot save them", async () => {
    vi.spyOn(db.earnings, "bulkAdd").mockRejectedValue(new Error("QuotaExceededError"));
    await openSheet();
    await userEvent.type(field("Earned (Rs)"), "1850");

    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));

    expect(await within(sheet()).findByRole("alert")).toHaveTextContent("This browser cannot save on your phone.");
    expect(sheet()).toBeVisible();
    expect(field("Earned (Rs)")).toHaveValue("1850"); // nothing typed is lost
    expect(within(sheet()).getByRole("button", { name: "Save" })).toBeEnabled(); // and they can try again
    expect(await listEntries()).toHaveLength(0);
  });

  it("starts empty every time it is opened, with no leftovers from a cancelled attempt", async () => {
    await openSheet();
    await userEvent.type(within(sheet()).getByLabelText("Say or type it"), "swiggy 900 rupees");
    await userEvent.type(field("Earned (Rs)"), "900");
    await userEvent.click(within(sheet()).getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: "Add earnings" }));

    expect(within(sheet()).getByLabelText("Say or type it")).toHaveValue("");
    expect(field("Earned (Rs)")).toHaveValue("");
    expect(await listEntries()).toHaveLength(0);
  });

  it("shows each form's own mistakes, and fixing one does not clear the other's", async () => {
    await openSheet();
    await userEvent.click(within(sheet()).getByRole("button", { name: "Add another" }));
    await userEvent.type(field("Earned (Rs)", 0), "abc");
    await userEvent.type(field("Earned (Rs)", 1), "500");

    await userEvent.click(within(sheet()).getByRole("button", { name: "Save" }));

    const alerts = await within(sheet()).findAllByRole("alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent("Use numbers only.");
    expect(await listEntries()).toHaveLength(0); // one bad entry holds back the whole save
  });

  it("has no accessibility violations while a photo is being read", async () => {
    phoneWithPhotos();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => {})));
    const { container } = renderUi(<EarningsView />);
    await screen.findByText(/No earnings yet/);
    await userEvent.click(screen.getByRole("button", { name: "Add earnings" }));
    await userEvent.upload(fileInput(), screenshot());
    await within(sheet()).findByRole("status", { name: "Reading…" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
