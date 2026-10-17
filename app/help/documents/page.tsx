import type { Metadata } from "next";
import { DocumentHelper } from "@/components/documents/DocumentHelper";

export const metadata: Metadata = { title: "Understand a paper · Saathi" };

export default function DocumentsPage() {
  return <DocumentHelper />;
}
