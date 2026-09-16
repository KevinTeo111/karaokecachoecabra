import type { RequestStatus } from "./types";

/**
 * Transitions are enforced server-side in the Postgres function
 * `transition_request` (supabase/migrations). The client only needs labels.
 */
export const STATUS_LABEL: Record<RequestStatus, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  QUEUED: "En cola",
  CALLED: "Llamado",
  PLAYING: "Cantando",
  COMPLETED: "Finalizada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  SKIPPED: "Saltada",
};
