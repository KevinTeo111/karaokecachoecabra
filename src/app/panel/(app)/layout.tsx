import type { Metadata } from "next";
import { PanelShell } from "@/components/panel/shell";

export const metadata: Metadata = { title: "Panel" };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <PanelShell>{children}</PanelShell>;
}
