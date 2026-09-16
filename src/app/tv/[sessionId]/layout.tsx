import type { Metadata } from "next";
import { SessionGate } from "@/components/session-gate";

export const metadata: Metadata = { title: "TV" };

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate>{children}</SessionGate>;
}
