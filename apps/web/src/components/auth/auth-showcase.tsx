import { ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The marketing panel beside the sign-in form on wide screens.
 *
 * Its job is to answer "what is this?" for someone who has landed on the login screen cold —
 * an invite link, a bookmark, a teammate's forward — without making them go and find the
 * marketing site first.
 *
 * Two deliberate choices:
 *
 * **It is always dark**, in both themes, so it reads as a distinct surface rather than as part
 * of the form. Its accent is the brand orange, which measures 6.25:1 against this panel's
 * near-black ground — comfortably legible, and the one place a fixed hex is correct because
 * the surface it sits on is fixed too. That means fixed colours instead of theme tokens, which is the one place in the
 * app where that is correct: the panel is not chrome the user is working in, and a light
 * variant would leave the split invisible on a light background.
 *
 * **It is built from markup, not an image.** It stays crisp at any density, costs no network
 * request, and — the actual reason — it cannot go stale. A screenshot of the results UI would
 * silently start lying the first time that UI changed.
 *
 * The figures are illustrative and labelled as such. The panel deliberately claims no
 * statistical significance, because the product does not compute any: a login screen promising
 * "95% confidence" would be advertising a feature that is not there, and would set exactly the
 * expectation the results UI then has to walk back.
 */

function Arm({
  url,
  visitors,
  rate,
  share,
  leading = false,
}: {
  url: string;
  visitors: string;
  rate: string;
  /** Bar width as a percentage of the better arm, so the two are visually comparable. */
  share: number;
  leading?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cn(
            "truncate rounded-md px-1.5 py-0.5 font-mono text-[11px]",
            leading ? "bg-white/10 text-white" : "bg-white/[0.06] text-white/55",
          )}
        >
          {url}
        </span>
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            leading ? "text-white" : "text-white/55",
          )}
        >
          {rate}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={cn("h-full rounded-full", leading ? "bg-[#F46300]" : "bg-white/25")}
          style={{ width: `${share}%` }}
        />
      </div>

      <p className="text-[11px] text-white/40 tabular-nums">{visitors} visitors</p>
    </div>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check className="mt-0.5 size-3.5 shrink-0 text-[#F46300]" aria-hidden />
      <span className="text-sm leading-relaxed text-white/60">{children}</span>
    </li>
  );
}

export function AuthShowcase({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        // The seam matters in dark mode, where the form column is itself near-black and the
        // split would otherwise be invisible. In light mode it simply disappears.
        "relative isolate overflow-hidden border-l border-white/10 bg-[#0a0a0b] px-10 py-14 xl:px-16",
        "flex flex-col justify-center",
        className,
      )}
    >
      {/* Depth only: a warm pool of light behind the card, and a faint grid that fades out. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 size-[34rem] rounded-full bg-[#F46300]/[0.09] blur-3xl" />
        <div className="absolute -bottom-40 -left-32 size-[30rem] rounded-full bg-white/[0.04] blur-3xl" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.045)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_75%_60%_at_50%_40%,#000,transparent)] [background-size:56px_56px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[30rem] space-y-9">
        <header className="space-y-4">
          <span className="inline-flex items-center rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium tracking-[0.14em] text-white/50 uppercase ring-1 ring-white/10">
            Redirect testing
          </span>

          <h2 className="text-3xl font-semibold tracking-tight text-balance text-white xl:text-4xl">
            Test two URLs. Ship the winner.
          </h2>

          <p className="text-[15px] leading-relaxed text-pretty text-white/55">
            Point half your traffic at a different page, track conversions on both, and see which
            one actually earns the click.
          </p>
        </header>

        {/* Decorative: the same story is told by the copy above and the list below. */}
        <div
          aria-hidden
          className="rounded-2xl bg-white/[0.035] p-5 ring-1 ring-white/10 backdrop-blur-sm"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/90">Pricing page rewrite</p>
              <p className="text-[11px] text-white/35">Example results</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F46300]/10 px-2.5 py-1 text-[11px] font-medium text-[#F46300] ring-1 ring-[#F46300]/25">
              <span className="size-1.5 rounded-full bg-[#F46300]" />
              Running
            </span>
          </div>

          <div className="space-y-4">
            <Arm url="/pricing" visitors="1,204" rate="4.1%" share={56} />
            <Arm url="/pricing-v2" visitors="1,198" rate="7.3%" share={100} leading />
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-white/45">
              <span className="font-mono">/pricing</span>
              <ArrowRight className="size-3" />
              <span className="font-mono text-white/70">/pricing-v2</span>
            </span>
            <span className="rounded-md bg-[#F46300]/10 px-2 py-0.5 text-xs font-semibold text-[#F46300] tabular-nums">
              +78%
            </span>
          </div>
        </div>

        <ul className="space-y-3">
          <Point>One script tag. No framework, no build step, no code on your pages.</Point>
          <Point>
            Visitors stay in the arm they were given, so a refresh can never move them or
            double-count a conversion.
          </Point>
          <Point>
            Plain numbers, honestly labelled — we show which arm is ahead, not a confidence claim we
            cannot stand behind.
          </Point>
        </ul>
      </div>
    </aside>
  );
}
