import type { ReactNode } from "react";

interface PlateProps {
  /** The number the worker acts on: "112", "₹1,310", a deadline. */
  value: ReactNode;
  /** What the number is. Shown in the tag above it, so the plate explains itself. */
  label: string;
  size?: "sm" | "md" | "lg";
  tone?: "plate" | "signal";
  className?: string;
}

/**
 * The signature element. Numbers that matter sit on a commercial number plate:
 * black on yellow, readable in direct sun. The tag says what the number is.
 */
export function Plate({ value, label, size = "md", tone = "plate", className = "" }: PlateProps) {
  return (
    <span className={`plate plate-${size} ${tone === "signal" ? "plate-signal" : ""} ${className}`}>
      <span className="plate-tag">{label}</span>
      <span className="plate-num">{value}</span>
    </span>
  );
}
