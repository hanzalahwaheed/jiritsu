// Shared settings helpers. Used by background, popup, options, and challenge.
export const DEFAULTS = {
  blockedDomains: ["reddit.com", "instagram.com", "x.com"],
  unlockMinutes: 20
};

// Normalize whatever the user typed into a bare host: "https://www.X.com/foo" -> "x.com".
export function normalizeDomain(raw) {
  let d = String(raw).trim().toLowerCase();
  if (!d) return "";
  d = d.replace(/^[a-z]+:\/\//, ""); // strip scheme
  d = d.replace(/^www\./, ""); // strip leading www.
  d = d.split("/")[0]; // drop path
  d = d.split("?")[0];
  d = d.split(":")[0]; // drop port
  return d;
}

export async function getSettings() {
  const stored = await chrome.storage.local.get(["blockedDomains", "unlockMinutes"]);
  return {
    blockedDomains: Array.isArray(stored.blockedDomains)
      ? stored.blockedDomains
      : DEFAULTS.blockedDomains,
    unlockMinutes: Number(stored.unlockMinutes) > 0 ? Number(stored.unlockMinutes) : DEFAULTS.unlockMinutes
  };
}

// Turn ["reddit.com","x.com"] into a regex matching those hosts (and subdomains).
export function domainsToRegex(domains) {
  const cleaned = domains.map(normalizeDomain).filter(Boolean);
  if (cleaned.length === 0) return null;
  const alt = cleaned.map((d) => d.replace(/[.\\]/g, "\\$&")).join("|");
  return `^https?://([a-z0-9-]+\\.)?(${alt})(?:[:/]|$)`;
}
