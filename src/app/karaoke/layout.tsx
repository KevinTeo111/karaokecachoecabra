import { NowPlayingBanner } from "@/components/client/now-playing-banner";
import { SessionGate } from "@/components/session-gate";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGate>
      <div className="stage-bg min-h-dvh">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-8 pb-[calc(7rem+env(safe-area-inset-bottom))]">{children}</main>
        <NowPlayingBanner />
      </div>
    </SessionGate>
  );
}
