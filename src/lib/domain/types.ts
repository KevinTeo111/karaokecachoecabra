export type SessionStatus = "OPEN" | "CLOSED";

export type RequestStatus =
  | "PENDING"
  | "APPROVED"
  | "QUEUED"
  | "CALLED"
  | "PLAYING"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED"
  | "SKIPPED";

export const ACTIVE_STATUSES: readonly RequestStatus[] = [
  "PENDING",
  "APPROVED",
  "QUEUED",
  "CALLED",
  "PLAYING",
];

export const QUEUE_STATUSES: readonly RequestStatus[] = ["QUEUED", "CALLED"];

export interface Song {
  id: string;
  youtubeVideoId: string;
  title: string;
  artistGuess: string;
  channelTitle: string;
  durationSec: number;
  embeddable: boolean;
  verified: boolean;
  favorite: boolean;
  categories: string[];
}

export interface CatalogStats {
  songs: number;
  channels: number;
  lastSyncAt: number | null;
  pendingQueries: number;
  quotaUsedToday: number;
  fallbackSearchesToday: number;
  byCategory: Record<string, number>;
}

export interface Participant {
  id: string;
  /** True when this participant was created by the requesting device. */
  mine: boolean;
  displayName: string;
  tableNumber: number;
  /** Short-lived signed URL from private storage, or null. */
  selfieUrl: string | null;
}

export interface KaraokeRequest {
  id: string;
  participantId: string;
  songId: string;
  status: RequestStatus;
  queueOrder: number | null;
  requestedAt: number;
  approvedAt: number | null;
  rejectReason: string | null;
}

export interface Performance {
  id: string;
  requestId: string;
  startedAt: number;
  endedAt: number | null;
  paused: boolean;
  /** Last known stage player time in seconds, and when it was reported. */
  playerTime: number;
  tickAt: number;
  finalRating: number | null;
  voteCount: number;
  rank: number | null;
}

export interface Vote {
  id: string;
  performanceId: string;
  /** True when the requesting device cast this vote. Voter identities never leave the server. */
  mine: boolean;
  stars: 1 | 2 | 3 | 4 | 5;
  createdAt: number;
}

export interface SessionSettings {
  etaBufferSec: number;
  minVotesForRanking: number;
  blockSameTableVote: boolean;
  maxActiveRequestsPerDevice: number;
  prepareNoticeSongs: number;
  selfieRetentionHours: number;
  fallbackSearchCapPerNight: number;
}

export interface AuditEntry {
  id: string;
  at: number;
  action: string;
  entityId: string;
  detail?: string;
}

export interface KaraokeSession {
  id: string;
  name: string;
  status: SessionStatus;
  startsAt: string;
  endsAt: string;
}

export interface SessionState {
  /** Server clock at snapshot time, for drift-free ETA and sync on phones. */
  serverNow: number;
  session: KaraokeSession;
  settings: SessionSettings;
  queueVersion: number;
  songs: Song[];
  participants: Participant[];
  requests: KaraokeRequest[];
  performances: Performance[];
  votes: Vote[];
  audit: AuditEntry[];
  /** Admin snapshots only. */
  catalog: CatalogStats | null;
}

/** Everything a screen needs about one queue entry, joined. */
export interface QueueEntry {
  request: KaraokeRequest;
  participant: Participant;
  song: Song;
  performance: Performance | null;
}
