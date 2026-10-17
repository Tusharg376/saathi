import { configureAxe } from "vitest-axe";

/**
 * Accessibility check for component tests. Colour contrast is switched off here because jsdom cannot
 * paint, so it cannot measure colours; contrast is checked in a real browser (axe + Lighthouse on the
 * production build).
 */
export const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });
