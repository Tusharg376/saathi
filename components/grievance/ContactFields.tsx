"use client";

import { Field, inputClass } from "./Field";
import { useI18n } from "@/lib/i18n/provider";
import type { Contact } from "@/lib/grievance/letter";

/** The worker's own details. They stay on this phone and are filled into the letter there. */
export function ContactFields({ contact, onChange }: { contact: Contact; onChange: (c: Contact) => void }) {
  const { t } = useI18n();
  const set = (k: keyof Contact) => (e: { target: { value: string } }) => onChange({ ...contact, [k]: e.target.value });

  return (
    <fieldset className="space-y-3 rounded-2xl border-2 border-dashed border-tarmac p-3">
      <legend className="px-1 text-sm font-extrabold">{t("cmp.you")}</legend>
      <Field label={t("cmp.name")}>
        <input
          className={inputClass}
          autoComplete="name"
          value={contact.name ?? ""}
          maxLength={80}
          onChange={set("name")}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2">
        <Field label={t("cmp.phone")}>
          <input
            className={inputClass}
            inputMode="tel"
            autoComplete="tel"
            value={contact.phone ?? ""}
            maxLength={20}
            onChange={set("phone")}
          />
        </Field>
        <Field label={t("cmp.city")}>
          <input
            className={inputClass}
            autoComplete="address-level2"
            value={contact.city ?? ""}
            maxLength={60}
            onChange={set("city")}
          />
        </Field>
      </div>
    </fieldset>
  );
}
