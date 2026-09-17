/** Categories the venue asked for. Slugs are stored in `songs.categories`. */
export const CATEGORIES = [
  { slug: "boleros", label: "Boleros" },
  { slug: "romanticas", label: "Románticas" },
  { slug: "80s", label: "Años 80" },
  { slug: "90s", label: "Años 90" },
  { slug: "2000s", label: "2000s" },
  { slug: "latinas", label: "Latinas" },
  { slug: "rock", label: "Rock" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const isCategory = (v: string): v is CategorySlug => CATEGORIES.some((c) => c.slug === v);

/** Karaoke channels whose uploads feed the catalog; ids resolve from handles on first sync. */
export const DEFAULT_CHANNELS = [
  "@KaraokeLatino",
  "@KaraFunES",
  "@singkingkaraoke",
  "@StingrayKaraoke",
  "@KaraokeVersion",
  "@ZoomKaraoke",
  "@Cantoyo",
];

const RULES: [CategorySlug, RegExp][] = [
  ["boleros", /\bbolero/i],
  ["romanticas", /rom[áa]ntic|balada|amor\b|love song/i],
  ["80s", /\b(19)?8\d'?s\b|a[ñn]os 80|ochenta/i],
  ["90s", /\b(19)?9\d'?s\b|a[ñn]os 90|noventa/i],
  ["2000s", /\b2000s?\b|a[ñn]os 2000/i],
  ["latinas", /cumbia|salsa|reggaet[oó]n|bachata|merengue|latin[oa]?\b|vallenato|ranchera/i],
  ["rock", /\brock\b|metal\b|punk\b/i],
];

/** Heuristic categories from a title; seed queries add their own explicit category. */
export function guessCategories(title: string): CategorySlug[] {
  return RULES.filter(([, re]) => re.test(title)).map(([slug]) => slug);
}

const POSITIVE = [/karaoke/i, /instrumental/i, /con letra/i, /lyrics/i, /sing along/i, /pista/i];
const NEGATIVE = [/\blive\b|en vivo/i, /reaction|reacci[oó]n/i, /tutorial/i, /cover ac[uú]stic/i, /remix/i, /\bmix\b|megamix/i, /hour|horas/i];

/** Spec §9: positive for karaoke markers, negative for live, reaction, tutorial, acoustic cover. */
export function karaokeScore(title: string, channelTitle: string, durationSec: number) {
  const text = `${title} ${channelTitle}`;
  let score = 0;
  for (const re of POSITIVE) if (re.test(text)) score += 3;
  for (const re of NEGATIVE) if (re.test(text)) score -= 6;
  if (durationSec > 0 && (durationSec < 60 || durationSec > 15 * 60)) score -= 8;
  return score;
}

/** Splits "Artist - Title (Karaoke Version)" style titles into a clean title and an artist guess. */
export function splitTitle(raw: string): { title: string; artist: string } {
  let t = raw
    .replace(/[([{][^)\]}]*(karaoke|instrumental|lyrics?|letra|pista|version|versi[oó]n|hd|4k|official)[^)\]}]*[)\]}]/gi, "")
    .replace(/\b(karaoke|instrumental|con letra|lyrics?|pista|hd|4k)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/[\s|:-]+$/g, "")
    .trim();
  const parts = t.split(/\s[-–|]\s/);
  if (parts.length >= 2) {
    const [a, b] = [parts[0].trim(), parts.slice(1).join(" - ").trim()];
    // Karaoke channels mostly write "Artist - Title"; fall back to the longer part as the title.
    return b.length >= a.length ? { artist: a, title: b } : { artist: b, title: a };
  }
  t = t || raw;
  return { title: t, artist: "" };
}

export function normalizeQuery(q: string) {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && t !== "karaoke")
    .sort()
    .join(" ");
}
