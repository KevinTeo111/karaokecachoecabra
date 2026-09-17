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

/** Channels are consistent about "Artist - Title" vs "Title - Artist"; unknown channels keep the full title. */
const CHANNEL_ORDER: Record<string, "artist-title" | "title-artist"> = {
  "stingray karaoke": "artist-title",
  "sing king": "artist-title",
  "sing king karaoke": "artist-title",
  "zoom karaoke": "artist-title",
  "karafun": "title-artist",
  "karafun español": "title-artist",
  "karaoke version": "title-artist",
  "karaoké version": "title-artist",
  "karaoke latino": "title-artist",
  "cantoyo": "artist-title",
};

const NOISE =
  /\b(karaoke|instrumental|con letra|sin voz|con voz|lyrics?|letra|pista|backing track|no vocals?|with vocals?|with|without|version|versi[oó]n|official|oficial|hq|hd|4k|videoke|sing along)\b/gi;

/** Cleans a YouTube title and, when the channel's convention is known, separates artist and title. */
export function splitTitle(raw: string, channelTitle = ""): { title: string; artist: string } {
  const cleaned = raw
    .replace(/[\p{Extended_Pictographic}️]/gu, "")
    .replace(/[([{][^)\]}]*(karaoke|instrumental|lyrics?|letra|pista|version|versi[oó]n|hd|4k|official|vocals?)[^)\]}]*[)\]}]/gi, "")
    .replace(NOISE, "")
    .replace(/\*+/g, "")
    .replace(/\s*[-–|:]\s*(?=[-–|:]|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s|:,.-]+|[\s|:,.-]+$/g, "")
    .trim();
  const order = CHANNEL_ORDER[channelTitle.trim().toLowerCase()];
  const parts = cleaned.split(/\s[-–|]\s/).map((p) => p.trim()).filter(Boolean);
  if (order && parts.length >= 2) {
    const [first, ...rest] = parts;
    const second = rest.join(" - ");
    return order === "artist-title" ? { artist: first, title: second } : { artist: second, title: first };
  }
  return { title: cleaned || raw, artist: "" };
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
