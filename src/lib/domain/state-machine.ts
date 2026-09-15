import type { RequestStatus } from "./types";

/** Allowed transitions, spec §5. Everything else is rejected. */
const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["QUEUED", "CANCELLED"],
  QUEUED: ["CALLED", "PLAYING", "CANCELLED", "SKIPPED"],
  CALLED: ["PLAYING", "QUEUED", "CANCELLED", "SKIPPED"],
  PLAYING: ["COMPLETED", "SKIPPED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
  SKIPPED: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus) {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RequestStatus, to: RequestStatus) {
  if (!canTransition(from, to)) {
    throw new Error(`Transición inválida: ${from} → ${to}`);
  }
}

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
