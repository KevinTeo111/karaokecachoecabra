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
}

export interface Participant {
  id: string;
  deviceSessionId: string;
  displayName: string;
  tableNumber: number;
  /** Data URL in the mock store; a signed storage URL once the backend exists. */
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
  voterDeviceSessionId: string;
  stars: 1 | 2 | 3 | 4 | 5;
  createdAt: number;
}

export interface SessionSettings {
  etaBufferSec: number;
  minVotesForRanking: number;
  blockSameTableVote: boolean;
  maxActiveRequestsPerDevice: number;
  prepareNoticeSongs: number;
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
  version: number;
  session: KaraokeSession;
  settings: SessionSettings;
  songs: Song[];
  participants: Participant[];
  requests: KaraokeRequest[];
  performances: Performance[];
  votes: Vote[];
  audit: AuditEntry[];
}

/** Everything a screen needs about one queue entry, joined. */
export interface QueueEntry {
  request: KaraokeRequest;
  participant: Participant;
  song: Song;
  performance: Performance | null;
}
