import type { Metadata } from "next";
import { RightsBrowser } from "@/components/RightsBrowser";

export const metadata: Metadata = { title: "Rights and schemes · Saathi" };

export default function RightsPage() {
  return <RightsBrowser />;
}
