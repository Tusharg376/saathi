import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "@/test/axe";
import { renderUi } from "@/test/render";
import { DocumentHelper } from "./DocumentHelper";

const { fileToJpeg } = vi.hoisted(() => ({ fileToJpeg: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/image/downscale", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image/downscale")>()),
  fileToJpeg,
}));

const insight = (over = {}) => ({
  kind: "notice",
  title: "Notice from the delivery app",
  what_is_this: "The app says your account may be paused.",
  what_it_wants: "Reply with your vehicle papers.",
  deadline: "",
  amount: "",
  risks: [],
  next_steps: ["Reply in the app."],
  bring: [],
  scam_signs: false,
  needs_human_help: false,
  confidence: "high",
  related: [],
  ...over,
});
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const photo = () => new File(["x"], "paper.jpg", { type: "image/jpeg" });
const cameraInput = () => document.querySelector('input[type="file"][capture]') as HTMLInputElement;
const galleryInput = () => document.querySelector('input[type="file"]:not([capture])') as HTMLInputElement;

beforeEach(() => {
  fileToJpeg.mockReset().mockResolvedValue({ mimeType: "image/jpeg", data: "BASE64DATA", width: 10, height: 10 });
  URL.createObjectURL = vi.fn(() => "blob:preview-1");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DocumentHelper: getting the photo in", () => {
  it("'Take a photo' opens the back camera, and 'Choose a photo' opens the phone's gallery", async () => {
    renderUi(<DocumentHelper />);
    const click = vi.spyOn(HTMLInputElement.prototype, "click");

    await userEvent.click(screen.getByRole("button", { name: "Take a photo" }));
    expect(click.mock.instances.at(-1)).toBe(cameraInput());
    expect(cameraInput()).toHaveAttribute("capture", "environment");

    await userEvent.click(screen.getByRole("button", { name: "Choose a photo" }));
    expect(click.mock.instances.at(-1)).toBe(galleryInput());
    expect(galleryInput()).not.toHaveAttribute("capture");
  });

  it("reads a photo taken with the camera just like one from the gallery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight() })));
    renderUi(<DocumentHelper />);
    await userEvent.upload(cameraInput(), photo());
    expect(await screen.findByRole("heading", { name: "Notice from the delivery app" })).toBeInTheDocument();
  });

  it("shows the worker their own photo while it is being read, and blocks a second one meanwhile", async () => {
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>((r) => (finish = r))));
    const { container } = renderUi(<DocumentHelper />);

    await userEvent.upload(galleryInput(), photo());

    expect(await screen.findByRole("status", { name: "Reading…" })).toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute("src", "blob:preview-1");
    expect(screen.getByRole("button", { name: "Take a photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Choose a photo" })).toBeDisabled();
    expect(screen.getByLabelText(/Anything you want to know/)).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();

    finish(respond(200, { insight: insight() }));
    await screen.findByRole("heading", { name: "Notice from the delivery app" });
    expect(screen.queryByRole("status", { name: "Reading…" })).not.toBeInTheDocument();
  });

  it("lets go of the photo's temporary link when the worker starts over, so it does not linger in memory", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, { insight: insight() })));
    const { container } = renderUi(<DocumentHelper />);
    await userEvent.upload(galleryInput(), photo());
    await userEvent.click(await screen.findByRole("button", { name: "Check another paper" }));

    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1"));
    expect(container.querySelector("img")).toBeNull();
  });

  it("can read the same photo again right after, because the picker is cleared each time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(503, { error: "no_key" })));
    renderUi(<DocumentHelper />);
    await userEvent.upload(galleryInput(), photo());
    await screen.findByRole("alert");
    expect(galleryInput().value).toBe("");
  });
});

describe("DocumentHelper: when the answer is not what was hoped", () => {
  it("an unreadable photo says what would help, without pretending to list what the paper asks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        respond(200, {
          insight: insight({
            kind: "unreadable",
            title: "Could not read",
            what_is_this: "Too dark. Try again near a window.",
            what_it_wants: "Something the model made up",
            confidence: "low",
          }),
        }),
      ),
    );
    renderUi(<DocumentHelper />);
    await userEvent.upload(galleryInput(), photo());

    expect(await screen.findByText("Too dark. Try again near a window.")).toBeInTheDocument();
    expect(screen.queryByText("Something the model made up")).not.toBeInTheDocument();
    expect(screen.queryByText(/may not have read this correctly/)).not.toBeInTheDocument(); // no vague 'low' note on top
  });

  it("an answer with nothing in it is reported as a failure, not shown as an empty card", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respond(200, {})));
    renderUi(<DocumentHelper />);
    await userEvent.upload(galleryInput(), photo());
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not read this paper");
  });

  it("an unexpected crash while preparing the photo ends in a clear message, not a frozen screen", async () => {
    fileToJpeg.mockRejectedValue(new Error("canvas exploded"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderUi(<DocumentHelper />);
    await userEvent.upload(galleryInput(), photo());

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not read this paper");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(document.body).getByRole("button", { name: "Take a photo" })).toBeEnabled();
  });

  it("a paper with a deadline and an amount shows both prominently", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(respond(200, { insight: insight({ deadline: "by 30 October", amount: "Rs 2,000" }) })),
    );
    renderUi(<DocumentHelper />);
    await userEvent.upload(galleryInput(), photo());
    expect(await screen.findByText(/Deadline: by 30 October/)).toBeInTheDocument();
    expect(screen.getByText(/Rs 2,000/)).toBeInTheDocument();
  });
});
