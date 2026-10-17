import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEntry } from "@/lib/kb";
import { saveProfile } from "@/lib/profile/store";
import { renderUi } from "@/test/render";
import { QualifyCheck } from "./QualifyCheck";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

beforeEach(() => localStorage.clear());

const openForm = () => userEvent.click(screen.getByText("Check what I qualify for"));
const check = () => userEvent.click(screen.getByRole("button", { name: "Check" }));
const results = () => within(screen.getByRole("region", { name: "What you may get" }));
const rowFor = (id: string) => results().getAllByText(getEntry(id)!.title)[0].closest("li")!;

describe("QualifyCheck: the kind of work matters for some schemes", () => {
  it("says Likely for the street vendors' loan once the worker says they sell on the street", async () => {
    renderUi(<QualifyCheck />);
    await openForm();
    await userEvent.selectOptions(screen.getByLabelText("Your work"), "Street vendor");
    await check();
    expect(within(rowFor("scheme.pmsvanidhi")).getByText("Likely")).toBeInTheDocument();
  });

  it("says Not eligible for the same loan when the work is something else", async () => {
    renderUi(<QualifyCheck />);
    await openForm();
    await userEvent.selectOptions(screen.getByLabelText("Your work"), "Delivery partner");
    await check();
    expect(within(rowFor("scheme.pmsvanidhi")).getByText("Not eligible")).toBeInTheDocument();
  });

  it("does not guess at all while the work is left as Choose, and asks for it instead", async () => {
    renderUi(<QualifyCheck />);
    await openForm();
    await userEvent.type(screen.getByLabelText("Your age"), "35");
    await check();
    const row = rowFor("scheme.pmsvanidhi");
    expect(within(row).getByText("Maybe")).toBeInTheDocument();
    expect(within(row).getByText(/To be sure, tell us/)).toHaveTextContent("Your work");
  });

  it("never promises a state-run scheme, even when the worker's details match every rule", async () => {
    renderUi(<QualifyCheck />);
    await openForm();
    await userEvent.type(screen.getByLabelText("Your age"), "35");
    await userEvent.selectOptions(screen.getByLabelText("Your work"), "Construction worker");
    await check();
    const row = rowFor("scheme.bocw");
    expect(within(row).getByText("Maybe")).toBeInTheDocument();
    expect(within(row).queryByText("Likely")).not.toBeInTheDocument();
  });
});

describe("QualifyCheck: remembering answers on this phone", () => {
  it("shows last time's answers when the worker opens it again, so they are typed once", async () => {
    saveProfile({ age: 41, state: "Bihar", workerType: "street_vendor", hasBankAccount: true });
    renderUi(<QualifyCheck />);
    await openForm();
    expect(screen.getByLabelText("Your age")).toHaveValue("41");
    expect(screen.getByLabelText("Your state")).toHaveValue("Bihar");
    expect(screen.getByLabelText("Your work")).toHaveValue("street_vendor");
    expect(
      within(screen.getByRole("group", { name: "Do you have a bank account?" })).getByLabelText("Yes"),
    ).toBeChecked();
  });

  it("keeps a typed answer through the check, and the new answer is what gets saved", async () => {
    saveProfile({ age: 41 });
    renderUi(<QualifyCheck />);
    await openForm();
    await userEvent.clear(screen.getByLabelText("Your age"));
    await userEvent.type(screen.getByLabelText("Your age"), "29");
    await check();
    expect(JSON.parse(localStorage.getItem("saathi.profile")!)).toMatchObject({ age: 29 });
    expect(screen.getByLabelText("Your age")).toHaveValue("29");
  });

  it("says plainly that the answers stay on this phone", async () => {
    renderUi(<QualifyCheck />);
    await openForm();
    expect(screen.getByText("Saved on this phone only.")).toBeInTheDocument();
  });
});
