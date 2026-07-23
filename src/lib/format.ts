export function formatNaira(amount: number, withDecimals = true): string {
  const value = Math.abs(amount);
  const formatted = value.toLocaleString("en-NG", {
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  });
  return `${amount < 0 ? "-" : ""}₦${formatted}`;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// Mask a bank account number, keeping only the last 4 digits visible.
export function maskAccount(num: string): string {
  const n = (num || "").trim();
  if (n.length <= 4) return "•".repeat(n.length);
  return "•".repeat(n.length - 4) + n.slice(-4);
}

// Mask an account holder name, keeping the first and last character.
export function maskName(name: string): string {
  const n = (name || "").trim();
  if (n.length <= 2) return n ? n[0] + "•" : "";
  return n[0] + "•".repeat(Math.min(n.length - 2, 10)) + n[n.length - 1];
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
