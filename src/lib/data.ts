export type PlanId = "free" | "lite" | "starter" | "pro" | "elite" | "prime";

export const WORD_ROUNDS = 2;

export interface DailyCaps {
  voice: number;
  word: number;
  task: number;
  post: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  commission: number; // affiliate commission when a referral activates this plan
  perVoice: number;
  perWord: number;
  perPost: number;
  perTask: number;
  daily: DailyCaps;
  tagline: string;
  popular?: boolean;
}

export function planDailyMax(p: Plan): number {
  return p.daily.voice * p.perVoice + p.daily.word * p.perWord * WORD_ROUNDS + p.daily.task * p.perTask + p.daily.post * p.perPost;
}

export const PLANS: Plan[] = [
  {
    id: "lite",
    name: "Voice Lite",
    price: 1500,
    commission: 850,
    perVoice: 100,
    perWord: 60,
    perPost: 50,
    perTask: 30,
    daily: { voice: 1, word: 1, task: 5, post: 3 },
    tagline: "Dip your toes in and start earning.",
  },
  {
    id: "starter",
    name: "Voice Starter",
    price: 3000,
    commission: 1875,
    perVoice: 220,
    perWord: 140,
    perPost: 110,
    perTask: 60,
    daily: { voice: 1, word: 1, task: 8, post: 4 },
    tagline: "A solid step up for daily earners.",
  },
  {
    id: "pro",
    name: "Voice Pro",
    price: 5000,
    commission: 3100,
    perVoice: 380,
    perWord: 240,
    perPost: 180,
    perTask: 100,
    daily: { voice: 1, word: 2, task: 12, post: 6 },
    tagline: "For creators who show up every day.",
    popular: true,
  },
  {
    id: "elite",
    name: "Audio Elite",
    price: 9500,
    commission: 6150,
    perVoice: 480,
    perWord: 320,
    perPost: 210,
    perTask: 130,
    daily: { voice: 1, word: 2, task: 18, post: 8 },
    tagline: "Premium rates, faster payouts.",
  },
  {
    id: "prime",
    name: "Prime Artiste",
    price: 15000,
    commission: 10200,
    perVoice: 600,
    perWord: 400,
    perPost: 250,
    perTask: 150,
    daily: { voice: 1, word: 2, task: 26, post: 21 },
    tagline: "The highest earning tier. Pay once, earn forever.",
  },
];

export const FREE_PLAN: Plan = {
  id: "free",
  name: "Free",
  price: 0,
  commission: 0,
  perVoice: 0,
  perWord: 0,
  perPost: 0,
  perTask: 0,
  daily: { voice: 0, word: 0, task: 0, post: 0 },
  tagline: "Activate a plan to start earning.",
};

export function planById(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id) ?? FREE_PLAN;
}

export const WITHDRAW_MIN = 45000; // engagement wallet
export const SALES_WITHDRAW_MIN = 1000; // sales/affiliate wallet

export interface VoiceLang {
  key: string;
  label: string;
  sub: string;
  flag: string;
  code: string; // BCP-47 for SpeechRecognition
  sentences: string[];
}

export const VOICE_LANGS: VoiceLang[] = [
  {
    key: "english",
    label: "English",
    sub: "Simple everyday sentences",
    flag: "🇬🇧",
    code: "en-US",
    sentences: [
      "The constitution provides fundamental rights for all citizens.",
      "Every voice you lend today builds the wealth of tomorrow.",
      "Speak clearly and earn boldly with Task Earner Africa.",
      "Small daily wins compound into life changing rewards.",
      "Your words carry value far beyond the sound.",
    ],
  },
  {
    key: "pidgin",
    label: "Pidgin",
    sub: "Naija pidgin English",
    flag: "🇳🇬",
    code: "en-NG",
    sentences: [
      "Wetin you dey wait for, come dey earn with your voice.",
      "Small small money dey turn to plenty when you consistent.",
      "Your voice na money, use am well well today.",
      "No be lie, Task Earner dey pay real cash.",
      "Make you talk am well, e go enter your wallet.",
    ],
  },
  {
    key: "french",
    label: "French",
    sub: "Basic French phrases",
    flag: "🇫🇷",
    code: "fr-FR",
    sentences: [
      "Votre voix a une grande valeur aujourd hui.",
      "Chaque jour vous pouvez gagner de l argent facilement.",
      "Parlez clairement pour gagner votre récompense.",
      "La constance est la clé de la réussite.",
      "Bienvenue sur Task Earner Africa.",
    ],
  },
];

export interface WordItem {
  word: string;
  hint: string;
}
export interface WordLang {
  key: string;
  label: string;
  sub: string;
  flag: string;
  code: string;
  words: WordItem[];
}

export const WORD_LANGS: WordLang[] = [
  {
    key: "english",
    label: "English",
    sub: "Simple words",
    flag: "🇬🇧",
    code: "en-US",
    words: [
      { word: "Entrepreneurship", hint: "on-truh-pruh-NUR-ship" },
      { word: "Determination", hint: "dee-tur-mih-NAY-shun" },
      { word: "Accomplishment", hint: "uh-KOM-plish-ment" },
      { word: "Serendipity", hint: "seh-run-DIP-ih-tee" },
      { word: "Responsibility", hint: "ri-spon-sih-BIL-ih-tee" },
      { word: "Congratulations", hint: "kun-grach-oo-LAY-shuns" },
    ],
  },
  {
    key: "pidgin",
    label: "Pidgin",
    sub: "Naija words",
    flag: "🇳🇬",
    code: "en-NG",
    words: [
      { word: "Wahala", hint: "wah-HAH-lah" },
      { word: "Gbese", hint: "g-BEH-seh" },
      { word: "Sabi", hint: "SAH-bee" },
      { word: "Chop", hint: "chop" },
      { word: "Comot", hint: "koh-MOT" },
      { word: "Abeg", hint: "ah-BEG" },
    ],
  },
  {
    key: "french",
    label: "French",
    sub: "Basic words",
    flag: "🇫🇷",
    code: "fr-FR",
    words: [
      { word: "Bonjour", hint: "bon-ZHOOR" },
      { word: "Merci", hint: "mair-SEE" },
      { word: "Félicitations", hint: "fay-lee-see-ta-SYON" },
      { word: "Magnifique", hint: "man-yee-FEEK" },
      { word: "Bienvenue", hint: "byan-vuh-NUU" },
      { word: "Extraordinaire", hint: "eks-tra-or-dee-NAIR" },
    ],
  },
];

export const VOICE_SENTENCES: string[] = [
  "The quick brown fox jumps over the lazy dog.",
  "Every voice you lend today builds the wealth of tomorrow.",
  "Nigeria is home to over two hundred million dreamers.",
  "Speak clearly, earn boldly, and share your success.",
  "Innovation begins the moment you decide to try.",
  "Consistency is the quiet engine behind every great result.",
  "Your words carry value far beyond the sound.",
  "Small daily wins compound into life-changing rewards.",
];

export const WORD_GAME_WORDS: string[] = [
  "Entrepreneurship",
  "Onomatopoeia",
  "Serendipity",
  "Extraordinary",
  "Responsibility",
  "Sophisticated",
  "Congratulations",
  "Pronunciation",
  "Accomplishment",
  "Determination",
];

export interface DailyTask {
  id: string;
  title: string;
  detail: string;
  category: "social" | "survey" | "watch" | "review";
}

export const DAILY_TASKS: DailyTask[] = [
  { id: "t1", title: "Follow Task Earner Africa on Instagram", detail: "Tap follow and confirm your handle.", category: "social" },
  { id: "t2", title: "Watch a 30s promo video", detail: "Watch the full clip to unlock the reward.", category: "watch" },
  { id: "t3", title: "Rate our app 5 stars", detail: "Leave an honest review on the store.", category: "review" },
  { id: "t4", title: "Take a 2-minute survey", detail: "Tell us how you like to earn online.", category: "survey" },
  { id: "t5", title: "Join our Telegram channel", detail: "Stay updated with new earning drops.", category: "social" },
  { id: "t6", title: "Share the daily quote", detail: "Post today's motivation to your story.", category: "social" },
  { id: "t7", title: "Retweet the pinned post", detail: "Amplify Task Earner Africa to your followers.", category: "social" },
  { id: "t8", title: "Watch: How payouts work", detail: "Learn how withdrawals are processed.", category: "watch" },
];

export interface SponsoredPost {
  id: string;
  headline: string;
  platform: "WhatsApp" | "Facebook" | "X" | "Instagram" | "TikTok";
  copy: string;
}

export const SPONSORED_POSTS: SponsoredPost[] = [
  { id: "s1", headline: "TASK EARNER IS PAYING", platform: "WhatsApp", copy: "I just got paid on Task Earner Africa for reading sentences aloud. Join with my link!" },
  { id: "s2", headline: "Your voice is currency", platform: "Facebook", copy: "Turn your talk and daily tasks into alerts. Task Earner Africa pays per session — no stress." },
  { id: "s3", headline: "Side hustle unlocked", platform: "X", copy: "Made ₦2,000 today on @taskearnerafrica between classes. This is real." },
  { id: "s4", headline: "Pay once, earn forever", platform: "Instagram", copy: "Lifetime plans on Task Earner Africa. Activate once and earn every single day." },
  { id: "s5", headline: "Talk = money", platform: "TikTok", copy: "POV: your voice is now a paycheck. Task Earner Africa is the wave. 🌍" },
];

export const QUICK_ACTIONS = [
  { id: "airtime", label: "Airtime", color: "brand" },
  { id: "data", label: "Data", color: "emerald" },
  { id: "electricity", label: "Electricity", color: "amber" },
  { id: "tv", label: "TV", color: "rose" },
] as const;

export const COOLDOWN_MS = 60 * 1000; // 60s demo cooldown
