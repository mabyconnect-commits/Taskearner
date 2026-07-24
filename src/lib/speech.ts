import { useEffect, useRef, useState } from "react";

// Minimal Web Speech API wrapper. Real speech recognition where available
// (Chrome / Android / Brave); callers fall back to a tap flow otherwise.
export function useSpeech(lang: string) {
  const SR: any =
    typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const supported = !!SR;
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  const reset = () => setTranscript("");

  const start = () => {
    if (!SR) {
      setError("unsupported");
      return;
    }
    setError(null);
    setTranscript("");
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript + " ";
      setTranscript(t.trim());
    };
    rec.onerror = (e: any) => {
      setError(e?.error || "error");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("start-failed");
      setListening(false);
    }
  };

  useEffect(() => () => stop(), []);

  return { supported, listening, transcript, error, start, stop, reset };
}

// ── Matching helpers ─────────────────────────────────────────────────────────
export function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

// Is a single target word present in what was said? (lenient for long words)
export function wordMatches(said: string, target: string): boolean {
  const t = normalize(target);
  const s = normalize(said);
  if (!t || !s) return false;
  if (s.includes(t)) return true;
  const tol = Math.max(1, Math.floor(t.length * 0.34));
  return s.split(" ").some((tok) => levenshtein(tok, t) <= tol);
}

// Fraction of a sentence's words present in the transcript (0..1)
export function sentenceCoverage(said: string, sentence: string): number {
  const target = normalize(sentence).split(" ").filter(Boolean);
  if (!target.length) return 0;
  const spoken = normalize(said).split(" ").filter(Boolean);
  let hit = 0;
  for (const w of target) {
    if (spoken.some((x) => x === w || levenshtein(x, w) <= 1)) hit++;
  }
  return hit / target.length;
}
