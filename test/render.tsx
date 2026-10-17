import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { I18nProvider } from "@/lib/i18n/provider";
import type { LangCode } from "@/lib/i18n/messages";

/** Renders a component the way the app does: inside the language provider, in English unless told otherwise. */
export function renderUi(ui: ReactElement, lang: LangCode = "en"): RenderResult {
  localStorage.setItem("saathi.lang", lang);
  return render(<I18nProvider>{ui}</I18nProvider>);
}
