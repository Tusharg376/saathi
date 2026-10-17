import type { Metadata } from "next";
import { HelpHub } from "@/components/help/HelpHub";

export const metadata: Metadata = { title: "Papers and complaints · Saathi" };

export default function HelpPage() {
  return <HelpHub />;
}
