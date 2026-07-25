// NEKpay Nigeria payout bank list (代付银行列表). bank_code = "NGR" + Paystack code.
// Auto-payout works ONLY for banks in this list. Moniepoint / FairMoney / Carbon
// are NOT here — those must be paid out manually (resolver returns null).

export const NEKPAY_BANKS: { code: string; name: string }[] = [
  { code: "NGR044", name: "Access Bank" },
  { code: "NGR063", name: "Access Bank (Diamond)" },
  { code: "NGR050", name: "Ecobank Nigeria" },
  { code: "NGR214", name: "First City Monument Bank" },
  { code: "NGR070", name: "Fidelity Bank" },
  { code: "NGR011", name: "First Bank of Nigeria" },
  { code: "NGR058", name: "Guaranty Trust Bank" },
  { code: "NGR030", name: "Heritage Bank" },
  { code: "NGR301", name: "Jaiz Bank" },
  { code: "NGR082", name: "Keystone Bank" },
  { code: "NGR221", name: "Stanbic IBTC Bank" },
  { code: "NGR232", name: "Sterling Bank" },
  { code: "NGR033", name: "United Bank For Africa" },
  { code: "NGR032", name: "Union Bank of Nigeria" },
  { code: "NGR215", name: "Unity Bank" },
  { code: "NGR035", name: "Wema Bank" },
  { code: "NGR057", name: "Zenith Bank" },
  { code: "NGR035A", name: "ALAT by WEMA" },
  { code: "NGR50211", name: "Kuda Bank" },
  { code: "NGR999991", name: "PalmPay" },
  { code: "NGR999992", name: "Paycom" }, // OPay
  { code: "NGR076", name: "Polaris Bank" },
  { code: "NGR101", name: "Providus Bank" },
  { code: "NGR068", name: "Standard Chartered Bank" },
  { code: "NGR100", name: "Suntrust Bank" },
  { code: "NGR302", name: "TAJ Bank" },
  { code: "NGR102", name: "Titan Bank" },
  { code: "NGR327", name: "Paga" },
  { code: "NGR100022", name: "GoMoney" },
  { code: "NGR51310", name: "Sparkle Microfinance Bank" },
  { code: "NGR50126", name: "Eyowo" },
  { code: "NGR000802", name: "9 Payment Service Bank" },
  { code: "NGR090426", name: "Tangerine Bank" },
  { code: "NGR090286", name: "Safe Haven MFB" },
  { code: "NGR100004", name: "Opay" }, // extra alias if present in stored data
  { code: "NGR110002", name: "Flutterwave Technology Solutions Limited" },
  { code: "NGR999999", name: "NIP Virtual Bank" },
];

const CODES = new Set(NEKPAY_BANKS.map((b) => b.code));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const BY_NAME = new Map(NEKPAY_BANKS.map((b) => [norm(b.name), b.code]));
// Authoritative overrides (checked FIRST). OPay must be NGR999992 ("Paycom"),
// PalmPay NGR999991, Kuda NGR50211 — plus common short names people type.
const ALIASES: Record<string, string> = {
  opay: "NGR999992", paycom: "NGR999992",
  palmpay: "NGR999991",
  kuda: "NGR50211", kudabank: "NGR50211", kudamfb: "NGR50211",
  gtbank: "NGR058", gtb: "NGR058", gtbankplc: "NGR058", guarantytrust: "NGR058",
  access: "NGR044", accessbank: "NGR044",
  firstbank: "NGR011", firstbanknigeria: "NGR011",
  uba: "NGR033",
  zenith: "NGR057", zenithbank: "NGR057",
  wema: "NGR035", wemabank: "NGR035", alat: "NGR035A", alatbywema: "NGR035A",
  fidelity: "NGR070", fidelitybank: "NGR070",
  ecobank: "NGR050",
  stanbic: "NGR221", stanbicibtc: "NGR221",
  sterling: "NGR232", sterlingbank: "NGR232",
  union: "NGR032", unionbank: "NGR032",
  polaris: "NGR076", polarisbank: "NGR076",
  providus: "NGR101", providusbank: "NGR101",
  paga: "NGR327",
};

// Resolve a bank to its NEKpay bank_code. Overrides first, then the Paystack
// code ("NGR"+it), then exact name, then fuzzy. Returns null if NEKpay can't
// pay it (→ manual settlement).
export function nekpayBankCode(bankName?: string | null, paystackCode?: string | null): string | null {
  if (bankName) {
    const n = norm(bankName);
    if (ALIASES[n] && CODES.has(ALIASES[n])) return ALIASES[n];
  }
  if (paystackCode) {
    const c = "NGR" + String(paystackCode).replace(/^NGR/i, "").trim();
    if (CODES.has(c)) return c;
  }
  if (bankName) {
    const n = norm(bankName);
    if (BY_NAME.has(n)) return BY_NAME.get(n)!;
    for (const [k, code] of BY_NAME) if (k.length > 4 && (k.includes(n) || n.includes(k))) return code;
  }
  return null; // NEKpay can't pay this bank → manual settlement
}

// A bank is auto-payable when NEKpay has a code for it.
export function isInstantPayable(bankName?: string | null, paystackCode?: string | null): boolean {
  return nekpayBankCode(bankName, paystackCode) !== null;
}
