// Server-side source of truth for plan rates & pricing. The client must never
// be trusted for reward amounts — everything is computed here.
export type PlanId = "free" | "lite" | "starter" | "pro" | "elite" | "prime";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  commission: number;
  perVoice: number;
  perWord: number;
  perPost: number;
  perTask: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", name: "Free", price: 0, commission: 0, perVoice: 0, perWord: 0, perPost: 0, perTask: 0 },
  lite: { id: "lite", name: "Voice Lite", price: 1500, commission: 800, perVoice: 100, perWord: 60, perPost: 50, perTask: 30 },
  starter: { id: "starter", name: "Voice Starter", price: 3000, commission: 1800, perVoice: 220, perWord: 140, perPost: 110, perTask: 60 },
  pro: { id: "pro", name: "Voice Pro", price: 5000, commission: 3000, perVoice: 380, perWord: 240, perPost: 180, perTask: 100 },
  elite: { id: "elite", name: "Audio Elite", price: 9500, commission: 6000, perVoice: 480, perWord: 320, perPost: 210, perTask: 130 },
  prime: { id: "prime", name: "Prime Artiste", price: 15000, commission: 10000, perVoice: 600, perWord: 400, perPost: 250, perTask: 150 },
};

export function planOf(id: string): Plan {
  return PLANS[(id as PlanId)] ?? PLANS.free;
}

export const WITHDRAW_MIN = 45000;
export const COOLDOWN_MS = 60 * 1000;
