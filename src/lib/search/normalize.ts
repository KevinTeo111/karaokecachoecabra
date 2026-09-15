import type { Song } from "@/lib/domain/types";

const STOPWORDS = new Set(["karaoke", "de", "la", "el", "los", "las", "y", "the", "a", "con", "letra"]);

export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizedQuery(q: string) {
  return normalize(q)
    .filter((t) => !STOPWORDS.has(t))
    .sort()
    .join(" ");
}

const POSITIVE = ["karaoke", "instrumental", "con letra", "lyrics", "sing along"];
const NEGATIVE = ["live", "en vivo", "reaction", "tutorial", "cover acustico", "acoustic cover"];

function trigrams(word: string) {
  const padded = `  ${word} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
  return set;
}

/** Jaccard similarity over trigrams, the same idea pg_trgm uses server-side. */
export function similarity(a: string, b: string) {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

const FUZZY_THRESHOLD = 0.4;

/** Spec §9 term scoring plus verified/favorite boosts. */
export function scoreSong(song: Song, tokens: string[]) {
  const hay = normalize(`${song.title} ${song.artistGuess} ${song.channelTitle}`);
  const hayText = hay.join(" ");
  let score = 0;
  for (const t of tokens) {
    if (hay.includes(t)) score += 10;
    else if (hay.some((h) => h.startsWith(t) || (t.length > 3 && h.includes(t)))) score += 5;
    else if (t.length >= 4) {
      const best = Math.max(...hay.map((h) => similarity(t, h)));
      if (best >= FUZZY_THRESHOLD) score += Math.round(best * 8);
    }
  }
  if (score === 0) return 0;
  for (const p of POSITIVE) if (hayText.includes(p)) score += 3;
  for (const n of NEGATIVE) if (hayText.includes(n)) score -= 6;
  if (song.verified) score += 20;
  if (song.favorite) score += 12;
  if (!song.embeddable) score -= 100;
  return score;
}

export function searchCatalog(songs: Song[], query: string, limit = 8) {
  const tokens = normalize(query).filter((t) => !STOPWORDS.has(t));
  if (tokens.length === 0) return [];
  return songs
    .map((song) => ({ song, score: scoreSong(song, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.song);
}
