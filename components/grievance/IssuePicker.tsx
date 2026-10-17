"use client";

import { useI18n } from "@/lib/i18n/provider";
import { ISSUE_LABEL } from "@/lib/grievance/labels";
import { ISSUES, type Issue } from "@/lib/grievance/letter";

/** Step one: what kind of problem is it? Big tiles, one tap. */
export function IssuePicker({ onPick }: { onPick: (i: Issue) => void }) {
  const { t } = useI18n();
  return (
    <section aria-labelledby="issue-h" className="space-y-3">
      <h2 id="issue-h" className="font-extrabold">
        {t("cmp.step1")}
      </h2>
      <ul className="grid grid-cols-2 gap-3">
        {ISSUES.map((i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onPick(i)}
              className="flex min-h-24 w-full items-center rounded-2xl border-2 border-tarmac bg-paper p-3 text-left text-lg font-extrabold leading-snug active:bg-plate"
            >
              {t(ISSUE_LABEL[i])}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
