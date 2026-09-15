import { cn } from "@/lib/utils";

export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "text-[0.65rem]", md: "text-xs", lg: "text-base" };
  return (
    <span className={cn("eyebrow inline-flex items-center gap-2", sizes[size], className)}>
      <span aria-hidden className="inline-block size-1.5 rotate-45 bg-brand-500" />
      Cacho e&apos; Cabra
      <span aria-hidden className="inline-block size-1.5 rotate-45 bg-brand-500" />
    </span>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col items-center text-center animate-rise", className)}>
      <Wordmark />
      <h1 className="text-display mt-2 text-4xl uppercase text-ink-100">{title}</h1>
      {subtitle ? <p className="mt-2 max-w-xs text-sm text-ink-400">{subtitle}</p> : null}
    </header>
  );
}

export function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("fill-current", className)} aria-hidden>
      <path d="M12 2.5l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.7l-6.1 3.4 1.4-6.8L2.2 9.6l6.9-.8z" />
    </svg>
  );
}

export function Stars({
  value,
  className,
  size = "size-4",
}: {
  value: number;
  className?: string;
  size?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} className={cn(size, i <= Math.round(value) ? "text-brand-500" : "text-ink-600")} />
      ))}
    </span>
  );
}
