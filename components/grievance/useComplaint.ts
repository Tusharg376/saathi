"use client";

import { useCallback, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { readContact, saveContact } from "@/lib/grievance/contact";
import { runDraft, startingPoint } from "@/lib/grievance/flow";
import type { Contact, Issue } from "@/lib/grievance/letter";
import { EMPTY_FIELDS, type Fields } from "@/lib/grievance/request";
import { letterDate } from "@/lib/grievance/share";
import type { LetterView } from "@/lib/grievance/view";
import { useHandoff } from "@/lib/handoff";

export type Step = "issue" | "describe" | "questions" | "result";
export type ComplaintForm = ReturnType<typeof useComplaint>;

/** The complaint flow as a small state machine. The decisions live in lib/grievance/flow; this holds the state. */
export function useComplaint() {
  const { lang } = useI18n();
  // Context from another screen (an earnings warning, a document, a card, the chat) starts the form filled in.
  const start = startingPoint(useHandoff("complaint"));

  const [step, setStep] = useState<Step>(start.issue ? "describe" : "issue");
  const [issue, setIssue] = useState<Issue | null>(start.issue);
  const [description, setDescription] = useState(start.description);
  const [fields, setFields] = useState<Fields>(start.fields);
  const [contact, setContactState] = useState<Contact>(() => readContact());
  const [letterLang, setLetterLang] = useState<"en" | "app">("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [view, setView] = useState<LetterView | null>(null);

  const setContact = (next: Contact) => {
    setContactState(next);
    saveContact(next); // remembered on this device so the worker types it once
  };

  const submit = async (final: boolean, withAnswers: boolean) => {
    if (!issue) return;
    setError(null);
    setBusy(true);
    const result = await runDraft({
      issue,
      lang,
      letterLang,
      description,
      fields,
      contact,
      date: letterDate(),
      final,
      ...(withAnswers && { questions, answers }),
    });
    setBusy(false);

    if (result.kind === "error") return setError(result.key);
    if (result.kind === "questions") {
      setQuestions(result.questions);
      setAnswers(result.questions.map(() => ""));
      return setStep("questions");
    }
    setView(result.view);
    setStep("result");
  };

  const restart = useCallback(() => {
    setStep("issue");
    setIssue(null);
    setDescription("");
    setFields(EMPTY_FIELDS);
    setQuestions([]);
    setAnswers([]);
    setView(null);
    setError(null);
  }, []);

  return {
    step,
    issue,
    description,
    fields,
    contact,
    letterLang,
    busy,
    error,
    questions,
    answers,
    view,
    setDescription,
    setFields,
    setContact,
    setLetterLang,
    setView,
    setAnswer: (i: number, value: string) => setAnswers((all) => all.map((a, j) => (j === i ? value : a))),
    choose: (i: Issue) => {
      setIssue(i);
      setStep("describe");
    },
    goTo: (s: Step) => {
      setError(null);
      setStep(s);
    },
    submit,
    restart,
  };
}
