import { NowPlayingBanner } from "@/components/client/now-playing-banner";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="stage-bg min-h-dvh">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-8 safe-bottom">{children}</main>
      <NowPlayingBanner />
    </div>
  );
}
