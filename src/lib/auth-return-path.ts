/** Only local app paths are valid destinations after visiting the login page. */
export function authReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") ||
      value.startsWith("//") || /[\\\x00-\x20]|%5c/i.test(value)) return "/dashboard";
  try {
    if (new URL(value, "https://shoot-it.invalid").origin === "https://shoot-it.invalid") return value;
  } catch { /* Invalid destinations return to the dashboard. */ }
  return "/dashboard";
}
