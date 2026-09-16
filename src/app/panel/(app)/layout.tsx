import type { Metadata } from "next";
import { PanelShell } from "@/components/panel/shell";
import { SessionGate } from "@/components/session-gate";

export const metadata: Metadata = { title: "Panel" };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGate>
      <PanelShell>{children}</PanelShell>
    </SessionGate>
  );
}
