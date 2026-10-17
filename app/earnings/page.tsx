import type { Metadata } from "next";
import { EarningsView } from "@/components/earnings/EarningsView";

export const metadata: Metadata = { title: "Earnings · Saathi" };

export default function EarningsPage() {
  return <EarningsView />;
}
