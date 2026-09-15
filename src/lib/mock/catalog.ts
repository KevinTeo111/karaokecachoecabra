import type { Song } from "@/lib/domain/types";

/**
 * Demo catalog for the UI phase. Video IDs are public, widely known and
 * embeddable so the stage and monitor players work; the real catalog is
 * synced from trusted karaoke channels in development Step 4.
 */
export const DEMO_SONGS: Song[] = [
  song("kJQP7kiw5Fk", "Despacito", "Luis Fonsi ft. Daddy Yankee", "Karaoke Latino", 282, { verified: true }),
  song("NUsoVlDFqZg", "Bailando", "Enrique Iglesias", "Karaoke Latino", 284, { favorite: true }),
  song("p47fEXGabaY", "Livin' la Vida Loca", "Ricky Martin", "Sing King Karaoke", 243),
  song("pRpeEdMmmQ0", "Waka Waka", "Shakira", "KaraFun", 211, { verified: true }),
  song("fJ9rUzIMcZQ", "Bohemian Rhapsody", "Queen", "Sing King Karaoke", 359, { verified: true }),
  song("dQw4w9WgXcQ", "Never Gonna Give You Up", "Rick Astley", "Karaoke Version", 213),
  song("JGwWNGJdvx8", "Shape of You", "Ed Sheeran", "Sing King Karaoke", 264),
  song("2Vv-BfVoq4g", "Perfect", "Ed Sheeran", "KaraFun", 280, { favorite: true }),
  song("hTWKbfoikeg", "Smells Like Teen Spirit", "Nirvana", "Stingray Karaoke", 279),
  song("OPf0YbXqDm0", "Uptown Funk", "Mark Ronson ft. Bruno Mars", "Sing King Karaoke", 271),
  song("CevxZvSJLk8", "Roar", "Katy Perry", "KaraFun", 270),
  song("YQHsXMglC9A", "Hello", "Adele", "Zoom Karaoke", 367),
  song("60ItHLz5WEA", "Faded", "Alan Walker", "Karaoke Version", 213),
  song("kXYiU_JCYtU", "Numb", "Linkin Park", "Stingray Karaoke", 187),
  song("RgKAFK5djSk", "See You Again", "Wiz Khalifa ft. Charlie Puth", "Sing King Karaoke", 238),
  song("9bZkp7q19f0", "Gangnam Style", "PSY", "Zoom Karaoke", 253),
];

function song(
  youtubeVideoId: string,
  title: string,
  artistGuess: string,
  channelTitle: string,
  durationSec: number,
  flags: Partial<Pick<Song, "verified" | "favorite" | "embeddable">> = {},
): Song {
  return {
    id: `song_${youtubeVideoId}`,
    youtubeVideoId,
    title,
    artistGuess,
    channelTitle,
    durationSec,
    embeddable: true,
    verified: false,
    favorite: false,
    ...flags,
  };
}

export function thumbnailUrl(youtubeVideoId: string) {
  return `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`;
}
