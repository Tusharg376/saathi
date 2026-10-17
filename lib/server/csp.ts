/**
 * The Content-Security-Policy sent with every page. It tells the browser what this app may load, so
 * that a bug or a bad dependency cannot quietly pull in or send data to somewhere unexpected.
 *
 * - Scripts and styles allow inline code because Next.js writes its startup data inline; a stricter
 *   per-request nonce would force every page to be rendered on demand, which is slower on a phone.
 * - Nothing may be loaded from, or sent to, another website: the AI is called from our own server.
 * - Photos shown back to the worker are `blob:` addresses made on the device.
 * - `upgrade-insecure-requests` is left out on purpose: nothing here is fetched over plain HTTP, the
 *   Strict-Transport-Security header already forces HTTPS, and the directive breaks the offline worker
 *   when the production build is tried on http://localhost.
 */
export function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "blob:", "data:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'"],
    "manifest-src": ["'self'"],
    "worker-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const rules = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  return rules.join("; ");
}
