import type { Metadata } from "next";
import { SosPanel } from "@/components/SosPanel";

export const metadata: Metadata = { title: "Emergency · Saathi" };

export default function SosPage() {
  return <SosPanel />;
}
