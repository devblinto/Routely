import { AuthShowcase } from "@/components/auth/auth-showcase";
import { Brand } from "@/components/layout/brand";
import { routes } from "@/lib/routes";

/**
 * Shell for unauthenticated screens.
 *
 * A two-column split on wide viewports: the form on the left, a dark product panel on the
 * right. The split earns its place by answering a question the centred layout could not —
 * "what is this?" — for someone arriving cold on an invite link or a bookmark, without
 * sending them off to find the marketing site.
 *
 * Below `lg` the right panel is not rendered at all and the left column simply centres, which
 * is the layout this screen had before. That is deliberate rather than a fallback: on a phone
 * the panel would push the actual sign-in button below the fold, and a marketing pitch that
 * delays the one action the page exists for is a worse page, not a smaller one.
 *
 * The form column keeps the theme tokens and follows light/dark. The showcase is fixed dark in
 * both — see the note in `AuthShowcase`.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="relative flex min-h-screen flex-col overflow-hidden lg:min-h-0">
        {/* Depth for the form column, matched to the panel opposite but far fainter. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-24 size-[30rem] rounded-full bg-primary/[0.05] blur-3xl" />
          <div className="absolute inset-0 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_65%_50%_at_35%_30%,#000,transparent)] [background-size:22px_22px] opacity-60" />
        </div>

        {/* One column shared by all three rows, so the mark, the form and the footer sit on a
            single left edge rather than each finding its own. */}
        <header className="relative px-6 pt-8 sm:px-10">
          <div className="mx-auto w-full max-w-[24rem]">
            <Brand href={routes.home} size="lg" />
          </div>
        </header>

        <main className="relative flex flex-1 flex-col justify-center px-6 py-12 sm:px-10">
          <div className="mx-auto w-full max-w-[24rem]">{children}</div>
        </main>

        <footer className="relative px-6 pb-8 text-xs text-muted-foreground sm:px-10">
          <div className="mx-auto w-full max-w-[24rem] text-center lg:text-left">
            © {new Date().getFullYear()} Routely
          </div>
        </footer>
      </div>

      <AuthShowcase className="hidden lg:flex" />
    </div>
  );
}
