// Bank name → NEKpay bank_code map for payouts.
// NOTE: The exact numeric codes below are placeholders shaped like the common
// NIBSS codes — CONFIRM/replace them against NEKpay's official bank_code list
// (port the reference nekpayBanks.ts). What matters structurally: which banks
// are supported for instant payout vs. routed to the manual queue.

export interface BankEntry {
  code: string;
  instant: boolean;
}

const BANKS: Record<string, BankEntry> = {
  "opay": { code: "100004", instant: true },
  "palmpay": { code: "100033", instant: true },
  "kuda": { code: "090267", instant: true },
  "kuda bank": { code: "090267", instant: true },
  "gtbank": { code: "000013", instant: true },
  "guaranty trust bank": { code: "000013", instant: true },
  "access bank": { code: "000014", instant: true },
  "access": { code: "000014", instant: true },
  "zenith bank": { code: "000015", instant: true },
  "zenith": { code: "000015", instant: true },
  "uba": { code: "000004", instant: true },
  "united bank for africa": { code: "000004", instant: true },
  "first bank": { code: "000016", instant: true },
  "first bank of nigeria": { code: "000016", instant: true },
  "fidelity bank": { code: "000007", instant: true },
  "fidelity": { code: "000007", instant: true },
  "wema bank": { code: "000017", instant: true },

  // Explicitly NOT supported for instant payout → manual queue
  "moniepoint": { code: "", instant: false },
  "fairmoney": { code: "", instant: false },
  "carbon": { code: "", instant: false },
};

export function resolveBank(name: string): BankEntry | null {
  const key = (name || "").trim().toLowerCase();
  return BANKS[key] ?? null;
}

// A bank is auto-payable when we have a code and it's instant-supported.
export function isInstantPayable(name: string): boolean {
  const b = resolveBank(name);
  return !!b && b.instant && !!b.code;
}
