import type { Performance, Vote } from "./types";

export function averageStars(votes: Vote[]): number | null {
  if (votes.length === 0) return null;
  const sum = votes.reduce((acc, v) => acc + v.stars, 0);
  return Math.round((sum / votes.length) * 10) / 10;
}

export function starBreakdown(votes: Vote[]) {
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of votes) counts[v.stars] += 1;
  return counts;
}

/** Completed performances eligible for the night ranking, best first. */
export function rankPerformances(performances: Performance[], minVotes: number) {
  return performances
    .filter((p) => p.endedAt !== null && p.finalRating !== null && p.voteCount >= minVotes)
    .sort((a, b) => {
      if (b.finalRating! !== a.finalRating!) return b.finalRating! - a.finalRating!;
      if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
      return a.endedAt! - b.endedAt!;
    });
}
