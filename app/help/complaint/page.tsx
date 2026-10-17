import type { Metadata } from "next";
import { ComplaintWizard } from "@/components/grievance/ComplaintWizard";

export const metadata: Metadata = { title: "Write a complaint · Saathi" };

export default function ComplaintPage() {
  return <ComplaintWizard />;
}
